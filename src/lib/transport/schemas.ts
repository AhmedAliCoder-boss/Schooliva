import { z } from "zod";

export const driverSchema = z.object({
  fullName: z.string().trim().min(1, "Driver name required hai."),
  licenseNumber: z.string().trim().min(1, "License number required hai."),
  phone: z.string().trim().optional(),
  status: z.enum(["active", "inactive", "on_leave"]).optional(),
});

export const vehicleSchema = z.object({
  registrationNumber: z.string().trim().min(1, "Registration number required hai."),
  vehicleType: z.string().trim().min(1, "Vehicle type required hai."),
  capacity: z.coerce.number().int().positive("Capacity positive hona chahiye."),
  status: z.enum(["active", "maintenance", "inactive"]).optional(),
  driverId: z.string().uuid().optional().or(z.literal("")),
  notes: z.string().trim().optional(),
});

export const routeSchema = z.object({
  name: z.string().trim().min(1, "Route name required hai."),
  routeCode: z.string().trim().min(1, "Route code required hai."),
  vehicleId: z.string().uuid().optional().or(z.literal("")),
  description: z.string().trim().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export const stopSchema = z.object({
  name: z.string().trim().min(1, "Stop name required hai."),
  stopType: z.enum(["pickup", "dropoff", "both"]).optional(),
  address: z.string().trim().optional(),
  latitude: z.coerce.number().optional().or(z.literal("")),
  longitude: z.coerce.number().optional().or(z.literal("")),
});

export const assignmentSchema = z.object({
  studentId: z.string().uuid("Student required hai."),
  routeId: z.string().uuid("Route required hai."),
  pickupStopId: z.string().uuid().optional().or(z.literal("")),
  dropoffStopId: z.string().uuid().optional().or(z.literal("")),
  notes: z.string().trim().optional(),
});

export const transportFeeSchema = z.object({
  routeId: z.string().uuid("Route required hai."),
  studentId: z.string().uuid("Student required hai."),
  amount: z.coerce.number().min(0),
  frequency: z.enum(["monthly", "quarterly", "term", "yearly"]),
  dueDay: z.coerce.number().int().min(1).max(31),
});

export type TransportFormState = { error?: string; success?: string };
