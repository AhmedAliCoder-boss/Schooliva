import { z } from "zod";

const databaseUuid = (message?: string) => z.string().regex(
  /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i,
  message,
);

export const driverSchema = z.object({
  fullName: z.string().trim().min(1, "Driver name required hai.").max(160),
  licenseNumber: z.string().trim().min(1, "License number required hai.").max(80),
  phone: z.string().trim().max(40).optional(),
  status: z.enum(["active", "inactive", "on_leave"]).optional(),
});

export const vehicleSchema = z.object({
  registrationNumber: z.string().trim().min(1, "Registration number required hai.").max(40),
  vehicleType: z.string().trim().min(1, "Vehicle type required hai.").max(80),
  capacity: z.coerce.number().int().min(1).max(1000, "Capacity max 1000 honi chahiye."),
  status: z.enum(["active", "maintenance", "inactive"]).optional(),
  driverId: databaseUuid().optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional(),
});

export const routeSchema = z.object({
  name: z.string().trim().min(1, "Route name required hai.").max(160),
  routeCode: z.string().trim().min(1, "Route code required hai.").max(40),
  vehicleId: databaseUuid().optional().or(z.literal("")),
  description: z.string().trim().max(1000).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export const stopSchema = z.object({
  name: z.string().trim().min(1, "Stop name required hai.").max(160),
  stopType: z.enum(["pickup", "dropoff", "both"]).optional(),
  address: z.string().trim().max(500).optional(),
  latitude: z.union([z.literal(""), z.coerce.number().finite().min(-90).max(90)]).optional(),
  longitude: z.union([z.literal(""), z.coerce.number().finite().min(-180).max(180)]).optional(),
});

export const assignmentSchema = z.object({
  studentId: databaseUuid("Student required hai."),
  routeId: z.string().min(1, "Route select karein.").pipe(databaseUuid("Selected route ID invalid hai.")),
  pickupStopId: databaseUuid().optional().or(z.literal("")),
  dropoffStopId: databaseUuid().optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional(),
});

export const transportFeeSchema = z.object({
  routeId: databaseUuid("Route required hai."),
  studentId: databaseUuid("Student required hai."),
  amount: z.coerce.number().finite().min(0).max(1000000000),
  frequency: z.enum(["monthly", "quarterly", "term", "yearly"]),
  dueDay: z.coerce.number().int().min(1).max(31),
});

export const routeStopSchema = z.object({
  routeId: databaseUuid("Route required hai."),
  stopId: databaseUuid("Stop required hai."),
  stopOrder: z.coerce.number().int().min(1).max(500),
  pickupTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Valid pickup time enter karein.").optional().or(z.literal("")),
  dropoffTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Valid drop-off time enter karein.").optional().or(z.literal("")),
});

export const assignmentStatusSchema = z.object({
  assignmentId: databaseUuid(),
  status: z.enum(["active", "inactive"]),
});

export const driverStatusSchema = z.object({
  driverId: databaseUuid(),
  status: z.enum(["active", "inactive", "on_leave"]),
});

export const vehicleStatusSchema = z.object({
  vehicleId: databaseUuid(),
  status: z.enum(["active", "maintenance", "inactive"]),
});

export type TransportFormState = { error?: string; success?: string };
