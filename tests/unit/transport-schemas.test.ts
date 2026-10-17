import { describe, expect, it } from "vitest";

import {
  assignmentSchema,
  assignmentStatusSchema,
  driverStatusSchema,
  routeStopSchema,
  stopSchema,
  transportFeeSchema,
  vehicleSchema,
  vehicleStatusSchema,
} from "../../src/lib/transport/schemas";
import { hasTransportStudent, parseTransportStudentOptions } from "../../src/lib/transport/student-options";

const id = "d9428888-122b-4f71-bdf3-57db2058e358";
const postgresUuidWithoutRfcVersion = "00000000-0000-0000-0000-000000000000";

describe("transport workflow validation", () => {
  it("bounds vehicle capacity and validates vehicle status updates", () => {
    expect(vehicleSchema.safeParse({ registrationNumber: "ABC-123", vehicleType: "Bus", capacity: "35", driverId: "" }).success).toBe(true);
    expect(vehicleSchema.safeParse({ registrationNumber: "ABC-123", vehicleType: "Bus", capacity: "0" }).success).toBe(false);
    expect(vehicleSchema.safeParse({ registrationNumber: "ABC-123", vehicleType: "Bus", capacity: "1001" }).success).toBe(false);
    expect(vehicleStatusSchema.safeParse({ vehicleId: id, status: "maintenance" }).success).toBe(true);
    expect(vehicleStatusSchema.safeParse({ vehicleId: id, status: "scrapped" }).success).toBe(false);
    expect(driverStatusSchema.safeParse({ driverId: id, status: "on_leave" }).success).toBe(true);
  });

  it("validates stop coordinates and route stop schedule/order", () => {
    expect(stopSchema.safeParse({ name: "Main gate", latitude: "24.8607", longitude: "67.0011" }).success).toBe(true);
    expect(stopSchema.safeParse({ name: "Main gate", latitude: "91", longitude: "67" }).success).toBe(false);
    expect(routeStopSchema.safeParse({ routeId: id, stopId: id, stopOrder: "2", pickupTime: "07:30", dropoffTime: "15:00" }).success).toBe(true);
    expect(routeStopSchema.safeParse({ routeId: id, stopId: id, stopOrder: "0", pickupTime: "25:30" }).success).toBe(false);
  });

  it("validates route assignments and bounded fee plans", () => {
    expect(assignmentSchema.safeParse({ studentId: id, routeId: id, pickupStopId: "", dropoffStopId: "" }).success).toBe(true);
    expect(assignmentSchema.safeParse({ studentId: postgresUuidWithoutRfcVersion, routeId: postgresUuidWithoutRfcVersion, pickupStopId: "", dropoffStopId: "" }).success).toBe(true);
    expect(assignmentSchema.safeParse({ studentId: id, routeId: "", pickupStopId: "", dropoffStopId: "" }).error?.issues[0]?.message).toBe("Select a route.");
    expect(assignmentSchema.safeParse({ studentId: id, routeId: "not-a-uuid", pickupStopId: "", dropoffStopId: "" }).error?.issues[0]?.message).toBe("The selected route ID is invalid.");
    expect(assignmentStatusSchema.safeParse({ assignmentId: id, status: "inactive" }).success).toBe(true);
    expect(transportFeeSchema.safeParse({ studentId: id, routeId: id, amount: "2500", frequency: "monthly", dueDay: "15" }).success).toBe(true);
    expect(transportFeeSchema.safeParse({ studentId: id, routeId: id, amount: "Infinity", frequency: "monthly", dueDay: "32" }).success).toBe(false);
  });

  it("parses limited student lookup results without trusting their shape", () => {
    expect(parseTransportStudentOptions([{ id, first_name: "Amina", last_name: "Khan", admission_number: "S-1" }])).toEqual([
      { id, first_name: "Amina", last_name: "Khan", admission_number: "S-1" },
    ]);
    expect(hasTransportStudent([{ id }], id)).toBe(true);
    expect(hasTransportStudent([{ id: "not-a-uuid" }], id)).toBe(false);
    expect(parseTransportStudentOptions([{ id: 7 }, null])).toEqual([]);
  });
});
