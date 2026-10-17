"use server";

import { revalidatePath } from "next/cache";
import { requireTransportContext } from "@/lib/transport/context";
import { assignmentSchema, assignmentStatusSchema, driverSchema, driverStatusSchema, routeSchema, routeStopSchema, stopSchema, transportFeeSchema, vehicleSchema, vehicleStatusSchema, type TransportFormState } from "@/lib/transport/schemas";
import { hasTransportStudent } from "@/lib/transport/student-options";

function values(formData: FormData) { return Object.fromEntries(formData.entries()); }

export async function saveDriver(_: TransportFormState | undefined, formData: FormData): Promise<TransportFormState> {
  const parsed = driverSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "The driver form is invalid." };
  const { supabase, schoolId } = await requireTransportContext("manage");
  const { error } = await supabase.from("transport_drivers").insert({ school_id: schoolId, full_name: parsed.data.fullName, license_number: parsed.data.licenseNumber, phone: parsed.data.phone || null, status: parsed.data.status ?? "active" });
  if (error) {
    console.error("Transport driver could not be added.", error);
    return { error: error.code === "23505" ? "Driver license number already exists." : "The driver could not be added." };
  }
  revalidatePath("/transport"); return { success: "Driver added." };
}

export async function saveVehicle(_: TransportFormState | undefined, formData: FormData): Promise<TransportFormState> {
  const parsed = vehicleSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "The vehicle form is invalid." };
  const { supabase, schoolId } = await requireTransportContext("manage");
  if (parsed.data.driverId) {
    const { data: driver, error: driverError } = await supabase.from("transport_drivers").select("id,status").eq("id", parsed.data.driverId).eq("school_id", schoolId).maybeSingle();
    if (driverError) {
      console.error("Vehicle driver could not be verified.", driverError);
      return { error: "Selected driver could not be verified." };
    }
    if (!driver || driver.status !== "active") return { error: "Select an active driver from this school." };
  }
  const { error } = await supabase.from("transport_vehicles").insert({ school_id: schoolId, registration_number: parsed.data.registrationNumber, vehicle_type: parsed.data.vehicleType, capacity: parsed.data.capacity, status: parsed.data.status ?? "active", driver_id: parsed.data.driverId || null, notes: parsed.data.notes || null });
  if (error) {
    console.error("Transport vehicle could not be added.", error);
    return { error: error.code === "23505" ? "Vehicle registration already exists." : "The vehicle could not be added." };
  }
  revalidatePath("/transport"); return { success: "Vehicle added." };
}

export async function saveRoute(_: TransportFormState | undefined, formData: FormData): Promise<TransportFormState> {
  const parsed = routeSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "The route form is invalid." };
  const { supabase, schoolId } = await requireTransportContext("manage");
  if (parsed.data.vehicleId) {
    const { data: vehicle, error: vehicleError } = await supabase.from("transport_vehicles").select("id,status").eq("id", parsed.data.vehicleId).eq("school_id", schoolId).maybeSingle();
    if (vehicleError) {
      console.error("Route vehicle could not be verified.", vehicleError);
      return { error: "Selected vehicle could not be verified." };
    }
    if (!vehicle || vehicle.status !== "active") return { error: "Select an active vehicle from this school." };
  }
  const { error } = await supabase.from("transport_routes").insert({ school_id: schoolId, name: parsed.data.name, route_code: parsed.data.routeCode, vehicle_id: parsed.data.vehicleId || null, description: parsed.data.description || null, status: parsed.data.status ?? "active" });
  if (error) {
    console.error("Transport route could not be added.", error);
    return { error: error.code === "23505" ? "Route code already exists." : "The route could not be added." };
  }
  revalidatePath("/transport"); return { success: "Route added." };
}

export async function saveStop(_: TransportFormState | undefined, formData: FormData): Promise<TransportFormState> {
  const parsed = stopSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "The stop form is invalid." };
  const { supabase, schoolId } = await requireTransportContext("manage");
  const { error } = await supabase.from("transport_stops").insert({ school_id: schoolId, name: parsed.data.name, stop_type: parsed.data.stopType ?? "pickup", address: parsed.data.address || null, latitude: parsed.data.latitude === "" ? null : parsed.data.latitude, longitude: parsed.data.longitude === "" ? null : parsed.data.longitude });
  if (error) {
    console.error("Transport stop could not be added.", error);
    return { error: error.code === "23505" ? "Stop already exists." : "The stop could not be added." };
  }
  revalidatePath("/transport"); return { success: "Stop added." };
}

export async function saveStudentAssignment(_: TransportFormState | undefined, formData: FormData): Promise<TransportFormState> {
  const parsed = assignmentSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "The assignment form is invalid." };
  const { supabase, schoolId } = await requireTransportContext("manage");
  const { data: studentOptions, error: studentError } = await supabase.rpc("transport_students_for_assignment", { target_school_id: schoolId });
  if (studentError) {
    console.error("Transport assignment student could not be verified.", studentError);
    return { error: "Student could not be verified." };
  }
  if (!hasTransportStudent(studentOptions, parsed.data.studentId)) return { error: "Select an active student from this school." };
  const { data: route, error: routeError } = await supabase.from("transport_routes").select("id,status,transport_vehicles(status)").eq("id", parsed.data.routeId).eq("school_id", schoolId).maybeSingle();
  if (routeError) {
    console.error("Transport assignment route could not be verified.", routeError);
    return { error: "Route could not be verified." };
  }
  const routeVehicle = route ? (Array.isArray(route.transport_vehicles) ? route.transport_vehicles[0] : route.transport_vehicles) : null;
  if (!route || route.status !== "active" || routeVehicle?.status !== "active") return { error: "Select an active route with an active vehicle from this school." };
  const { error } = await supabase.from("transport_student_assignments").insert({
    school_id: schoolId,
    student_id: parsed.data.studentId,
    route_id: parsed.data.routeId,
    pickup_stop_id: parsed.data.pickupStopId || null,
    dropoff_stop_id: parsed.data.dropoffStopId || null,
    notes: parsed.data.notes || null,
  });
  if (error) {
    console.error("Transport student assignment could not be saved.", error);
    if (error.message.includes("capacity")) return { error: "Vehicle capacity has been exceeded." };
    if (error.code === "23505") return { error: "This student already has an assignment on the selected route or stop." };
    return { error: error.message.toLowerCase().includes("stop not on this route") ? "Choose pickup and drop-off stops that belong to this route." : "The student assignment could not be saved." };
  }
  revalidatePath("/transport"); return { success: "Student assigned." };
}

export async function saveTransportFee(_: TransportFormState | undefined, formData: FormData): Promise<TransportFormState> {
  const parsed = transportFeeSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "The transport fee form is invalid." };
  const { supabase, schoolId } = await requireTransportContext("manage");
  const [{ data: studentOptions, error: studentError }, { data: route, error: routeError }] = await Promise.all([
    supabase.rpc("transport_students_for_assignment", { target_school_id: schoolId }),
    supabase.from("transport_routes").select("id,status,transport_vehicles(status)").eq("id", parsed.data.routeId).eq("school_id", schoolId).maybeSingle(),
  ]);
  if (studentError || routeError) {
    console.error("Transport fee references could not be verified.", { studentError, routeError });
    return { error: "Student and route could not be verified." };
  }
  if (!hasTransportStudent(studentOptions, parsed.data.studentId)) return { error: "Select an active student from this school." };
  const routeVehicle = route ? (Array.isArray(route.transport_vehicles) ? route.transport_vehicles[0] : route.transport_vehicles) : null;
  if (!route || route.status !== "active" || routeVehicle?.status !== "active") return { error: "Select an active route with an active vehicle from this school." };
  const { error } = await supabase.from("transport_fees").upsert({
    school_id: schoolId,
    route_id: parsed.data.routeId,
    student_id: parsed.data.studentId,
    amount: parsed.data.amount,
    frequency: parsed.data.frequency,
    due_day: parsed.data.dueDay,
    is_active: true,
  }, { onConflict: "school_id,route_id,student_id" });
  if (error) {
    console.error("Transport fee could not be saved.", error);
    return { error: "The transport fee could not be saved." };
  }
  revalidatePath("/transport"); return { success: "Transport fee set." };
}

export async function saveRouteStop(_: TransportFormState | undefined, formData: FormData): Promise<TransportFormState> {
  const parsed = routeStopSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "The route stop form is invalid." };
  const { supabase, schoolId } = await requireTransportContext("manage");
  const [{ data: route, error: routeError }, { data: stop, error: stopError }] = await Promise.all([
    supabase.from("transport_routes").select("id,status").eq("id", parsed.data.routeId).eq("school_id", schoolId).maybeSingle(),
    supabase.from("transport_stops").select("id,stop_type").eq("id", parsed.data.stopId).eq("school_id", schoolId).maybeSingle(),
  ]);
  if (routeError || stopError) {
    console.error("Route stop references could not be verified.", { routeError, stopError });
    return { error: "Route and stop could not be verified." };
  }
  if (!route || route.status !== "active") return { error: "Select an active route from this school." };
  if (!stop) return { error: "Select a stop from this school." };
  const { error } = await supabase.from("transport_route_stops").insert({
    school_id: schoolId,
    route_id: parsed.data.routeId,
    stop_id: parsed.data.stopId,
    stop_order: parsed.data.stopOrder,
    pickup_time: parsed.data.pickupTime || null,
    dropoff_time: parsed.data.dropoffTime || null,
  });
  if (error) {
    console.error("Stop could not be added to transport route.", error);
    return { error: error.code === "23505" ? "That stop or stop order already exists on this route." : "Stop could not be added to route." };
  }
  revalidatePath("/transport");
  return { success: "Stop added to route sequence." };
}

export async function updateAssignmentStatus(_: TransportFormState | undefined, formData: FormData): Promise<TransportFormState> {
  const parsed = assignmentStatusSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "The assignment status is invalid." };
  const { supabase, schoolId } = await requireTransportContext("manage");
  const { data: assignment, error } = await supabase.from("transport_student_assignments")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.assignmentId)
    .eq("school_id", schoolId)
    .select("id")
    .maybeSingle();
  if (error || !assignment) {
    console.error("Transport assignment status could not be updated.", error);
    if (!error) return { error: "Assignment was not found in this school." };
    return { error: error.message.includes("capacity") ? "Vehicle capacity is now full; assignment could not be reactivated." : "Assignment status could not be updated." };
  }
  revalidatePath("/transport");
  return { success: `Assignment ${parsed.data.status}.` };
}

export async function updateVehicleStatus(_: TransportFormState | undefined, formData: FormData): Promise<TransportFormState> {
  const parsed = vehicleStatusSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "The vehicle status is invalid." };
  const { supabase, schoolId } = await requireTransportContext("manage");
  const { data: vehicle, error } = await supabase.from("transport_vehicles")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.vehicleId)
    .eq("school_id", schoolId)
    .select("id")
    .maybeSingle();
  if (error || !vehicle) {
    console.error("Transport vehicle status could not be updated.", error);
    if (!error) return { error: "Vehicle was not found in this school." };
    return { error: "Vehicle status could not be updated." };
  }
  revalidatePath("/transport");
  return { success: `Vehicle marked ${parsed.data.status.replaceAll("_", " ")}.` };
}

export async function updateDriverStatus(_: TransportFormState | undefined, formData: FormData): Promise<TransportFormState> {
  const parsed = driverStatusSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "The driver status is invalid." };
  const { supabase, schoolId } = await requireTransportContext("manage");
  const { data: driver, error } = await supabase.from("transport_drivers")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.driverId)
    .eq("school_id", schoolId)
    .select("id")
    .maybeSingle();
  if (error || !driver) {
    console.error("Transport driver status could not be updated.", error);
    if (!error) return { error: "Driver was not found in this school." };
    return { error: "Driver status could not be updated." };
  }
  revalidatePath("/transport");
  return { success: `Driver marked ${parsed.data.status.replaceAll("_", " ")}.` };
}
