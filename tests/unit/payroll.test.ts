import { describe, expect, it } from "vitest";

import { calculatePayrollAmounts, calculatePayrollAttendanceBreakdown } from "../../src/lib/payroll/calculation";
import { payrollCompensationSchema, payrollPeriodSchema, payrollPolicySchema } from "../../src/lib/payroll/schemas";

describe("payroll policy and calculations", () => {
  const standardPolicy = {
    workingDaysPerMonth: 20,
    deductAbsences: true,
    halfDayDeductionFactor: 0.5,
    deductExcusedDays: false,
    lateMarksPerDayDeduction: 3,
  };

  it("deducts policy-defined absent, half-day and late amounts but keeps excused leave paid", () => {
    expect(calculatePayrollAmounts(60000, 5000, 2000, {
      absent: 2,
      halfDay: 2,
      excused: 4,
      late: 5,
    }, standardPolicy)).toEqual({
      attendanceDeductionDays: 4,
      attendanceDeduction: 12000,
      grossAmount: 65000,
      totalDeductions: 14000,
      netAmount: 51000,
    });
  });

  it("supports principal disabling attendance deductions and clamps net salary at zero", () => {
    expect(calculatePayrollAmounts(1000, 0, 2000, {
      absent: 10,
      halfDay: 10,
      excused: 0,
      late: 10,
    }, { ...standardPolicy, deductAbsences: false, halfDayDeductionFactor: 0, lateMarksPerDayDeduction: 0 })).toMatchObject({
      attendanceDeduction: 0,
      netAmount: 0,
    });
  });

  it("breaks down absence, half-day, excused, and late deductions against the saved policy", () => {
    expect(calculatePayrollAttendanceBreakdown(60000, {
      absent: 2,
      halfDay: 2,
      excused: 4,
      late: 5,
    }, standardPolicy)).toEqual({
      items: [
        { key: "absent", count: 2, deductionDays: 2, amount: 6000 },
        { key: "halfDay", count: 2, deductionDays: 1, amount: 3000 },
        { key: "excused", count: 4, deductionDays: 0, amount: 0 },
        { key: "late", count: 5, deductionDays: 1, amount: 3000 },
      ],
      deductionDays: 4,
      amount: 12000,
    });
  });

  it("caps detailed day deductions and keeps rounded components equal to the recorded attendance deduction", () => {
    const breakdown = calculatePayrollAttendanceBreakdown(100, {
      absent: 30,
      halfDay: 1,
      excused: 1,
      late: 1,
    }, { ...standardPolicy, workingDaysPerMonth: 3, deductExcusedDays: true, lateMarksPerDayDeduction: 1 });
    expect(breakdown.deductionDays).toBe(3);
    expect(breakdown.items.reduce((total, item) => total + item.amount, 0)).toBe(breakdown.amount);
  });

  it("validates policy boundaries and month periods", () => {
    expect(payrollPolicySchema.safeParse({
      workingDaysPerMonth: "26",
      deductAbsences: "true",
      halfDayDeductionFactor: "0.5",
      deductExcusedDays: "false",
      lateMarksPerDayDeduction: "0",
    }).success).toBe(true);
    expect(payrollPolicySchema.safeParse({
      workingDaysPerMonth: "0",
      deductAbsences: "true",
      halfDayDeductionFactor: "1.5",
      deductExcusedDays: "false",
      lateMarksPerDayDeduction: "0",
    }).success).toBe(false);
    expect(payrollPeriodSchema.safeParse({ period: "2026-10" }).success).toBe(true);
    expect(payrollPeriodSchema.safeParse({ period: "2026-13" }).success).toBe(false);
  });

  it("parses the selected employee type and UUID and requires a positive monthly salary", () => {
    expect(payrollCompensationSchema.safeParse({
      employee: "teacher:00000000-0000-4000-8000-000000000001",
      monthlySalary: 50000,
    })).toMatchObject({ success: true, data: { employeeType: "teacher", employeeId: "00000000-0000-4000-8000-000000000001" } });
    expect(payrollCompensationSchema.safeParse({ employee: "staff:not-a-uuid", monthlySalary: 50000 }).success).toBe(false);
    expect(payrollCompensationSchema.safeParse({ employee: "", monthlySalary: 50000 }).success).toBe(false);
    expect(payrollCompensationSchema.safeParse({
      employee: "staff:00000000-0000-4000-8000-000000000001",
      monthlySalary: 0,
    }).success).toBe(false);
  });
});
