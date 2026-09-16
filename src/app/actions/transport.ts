"use server";

import { revalidatePath } from "next/cache";
import { requireTransportContext } from "@/lib/transport/context";
import { assignmentSchema, driverSchema, routeSchema, stopSchema, transportFeeSchema, vehicleSchema, type TransportFormState } from "@/lib/transport/schemas";

function values(formData: FormData) { return Object.fromEntries(formData.entries()); }

export async function saveDriver(_: TransportFormState | undefined, formData: FormData): Promise<TransportFormState> {
  const parsed = driverSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Driver form invalid hai." };
  const { supabase, schoolId } = await requireTransportContext("manage");
  const { error } = await supabase.from("transport_drivers").insert({ school_id: schoolId, full_name: parsed.data.fullName, license_number: parsed.data.licenseNumber, phone: parsed.data.phone || null, status: parsed.data.status ?? "active" });
  if (error) return { error: error.code === "23505" ? "Driver already exists." : "Driver add nahi ho saka." };
  revalidatePath("/transport"); return { success: "Driver add ho gaya." };
}

export async function saveVehicle(_: TransportFormState | undefined, formData: FormData): Promise<TransportFormState> {
  const parsed = vehicleSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Vehicle form invalid hai." };
  const { supabase, schoolId } = await requireTransportContext("manage");
  const { error } = await supabase.from("transport_vehicles").insert({ school_id: schoolId, registration_number: parsed.data.registrationNumber, vehicle_type: parsed.data.vehicleType, capacity: parsed.data.capacity, status: parsed.data.status ?? "active", driver_id: parsed.data.driverId || null, notes: parsed.data.notes || null });
  if (error) return { error: error.code === "23505" ? "Vehicle already exists." : "Vehicle add nahi ho saka." };
  revalidatePath("/transport"); return { success: "Vehicle add ho gaya." };
}

export async function saveRoute(_: TransportFormState | undefined, formData: FormData): Promise<TransportFormState> {
  const parsed = routeSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Route form invalid hai." };
  const { supabase, schoolId } = await requireTransportContext("manage");
  const { error } = await supabase.from("transport_routes").insert({ school_id: schoolId, name: parsed.data.name, route_code: parsed.data.routeCode, vehicle_id: parsed.data.vehicleId || null, description: parsed.data.description || null, status: parsed.data.status ?? "active" });
  if (error) return { error: error.code === "23505" ? "Route already exists." : "Route add nahi ho saka." };
  revalidatePath("/transport"); return { success: "Route add ho gaya." };
}

export async function saveStop(_: TransportFormState | undefined, formData: FormData): Promise<TransportFormState> {
  const parsed = stopSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Stop form invalid hai." };
  const { supabase, schoolId } = await requireTransportContext("manage");
  const { error } = await supabase.from("transport_stops").insert({ school_id: schoolId, name: parsed.data.name, stop_type: parsed.data.stopType ?? "pickup", address: parsed.data.address || null, latitude: parsed.data.latitude === "" ? null : parsed.data.latitude, longitude: parsed.data.longitude === "" ? null : parsed.data.longitude });
  if (error) return { error: error.code === "23505" ? "Stop already exists." : "Stop add nahi ho saka." };
  revalidatePath("/transport"); return { success: "Stop add ho gaya." };
}

export async function saveStudentAssignment(_: TransportFormState | undefined, formData: FormData): Promise<TransportFormState> {
  const parsed = assignmentSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Assignment form invalid hai." };
  const { supabase, schoolId } = await requireTransportContext("manage");
  const { error } = await supabase.from("transport_student_assignments").insert({
    school_id: schoolId,
    student_id: parsed.data.studentId,
    route_id: parsed.data.routeId,
    pickup_stop_id: parsed.data.pickupStopId || null,
    dropoff_stop_id: parsed.data.dropoffStopId || null,
    notes: parsed.data.notes || null,
  });
  if (error) return { error: error.message.includes("capacity") ? "Vehicle capacity exceed ho gayi hai." : "Student assignment save nahi ho saka." };
  revalidatePath("/transport"); return { success: "Student assigned ho gaya." };
}

export async function saveTransportFee(_: TransportFormState | undefined, formData: FormData): Promise<TransportFormState> {
  const parsed = transportFeeSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Transport fee form invalid hai." };
  const { supabase, schoolId } = await requireTransportContext("manage");
  const { error } = await supabase.from("transport_fees").upsert({
    school_id: schoolId,
    route_id: parsed.data.routeId,
    student_id: parsed.data.studentId,
    amount: parsed.data.amount,
    frequency: parsed.data.frequency,
    due_day: parsed.data.dueDay,
    is_active: true,
  }, { onConflict: "school_id,route_id,student_id" });
  if (error) return { error: "Transport fee save nahi ho saka." };
  revalidatePath("/transport"); return { success: "Transport fee set ho gaya." };
}
