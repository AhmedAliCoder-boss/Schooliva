export type AttendanceCounts = {
  absent: number;
  halfDay: number;
  excused: number;
  late: number;
};

export type PayrollDeductionPolicy = {
  workingDaysPerMonth: number;
  deductAbsences: boolean;
  halfDayDeductionFactor: number;
  deductExcusedDays: boolean;
  lateMarksPerDayDeduction: number;
};

export type PayrollAttendanceBreakdownItem = {
  key: "absent" | "halfDay" | "excused" | "late";
  count: number;
  deductionDays: number;
  amount: number;
};

export function calculatePayrollAttendanceBreakdown(
  monthlySalary: number,
  attendance: AttendanceCounts,
  policy: PayrollDeductionPolicy,
): { items: PayrollAttendanceBreakdownItem[]; deductionDays: number; amount: number } {
  const candidates: PayrollAttendanceBreakdownItem[] = [
    { key: "absent", count: attendance.absent, deductionDays: policy.deductAbsences ? attendance.absent : 0, amount: 0 },
    { key: "halfDay", count: attendance.halfDay, deductionDays: attendance.halfDay * policy.halfDayDeductionFactor, amount: 0 },
    { key: "excused", count: attendance.excused, deductionDays: policy.deductExcusedDays ? attendance.excused : 0, amount: 0 },
    {
      key: "late",
      count: attendance.late,
      deductionDays: policy.lateMarksPerDayDeduction > 0
        ? Math.floor(attendance.late / policy.lateMarksPerDayDeduction)
        : 0,
      amount: 0,
    },
  ];
  let remainingDays = policy.workingDaysPerMonth;
  const items = candidates.map((candidate) => {
    const deductionDays = Math.min(Math.max(remainingDays, 0), candidate.deductionDays);
    remainingDays -= deductionDays;
    return {
      ...candidate,
      deductionDays,
      amount: Math.round((monthlySalary * deductionDays / policy.workingDaysPerMonth) * 100) / 100,
    };
  }).filter((item) => item.count > 0);
  const deductionDays = items.reduce((total, item) => total + item.deductionDays, 0);
  const amount = Math.round((monthlySalary * deductionDays / policy.workingDaysPerMonth) * 100) / 100;
  let lastDeduction: PayrollAttendanceBreakdownItem | undefined;
  for (const item of items) {
    if (item.deductionDays > 0) lastDeduction = item;
  }
  if (lastDeduction) {
    const componentTotal = items.reduce((total, item) => total + item.amount, 0);
    lastDeduction.amount = Math.round((lastDeduction.amount + amount - componentTotal) * 100) / 100;
  }
  return { items, deductionDays, amount };
}

export function calculatePayrollAmounts(
  monthlySalary: number,
  allowanceTotal: number,
  fixedDeductionTotal: number,
  attendance: AttendanceCounts,
  policy: PayrollDeductionPolicy,
) {
  const lateDeductionDays = policy.lateMarksPerDayDeduction > 0
    ? Math.floor(attendance.late / policy.lateMarksPerDayDeduction)
    : 0;
  const attendanceDeductionDays = Math.min(
    policy.workingDaysPerMonth,
    (policy.deductAbsences ? attendance.absent : 0)
      + attendance.halfDay * policy.halfDayDeductionFactor
      + (policy.deductExcusedDays ? attendance.excused : 0)
      + lateDeductionDays,
  );
  const attendanceDeduction = Math.round((monthlySalary * attendanceDeductionDays / policy.workingDaysPerMonth) * 100) / 100;
  const grossAmount = Math.round((monthlySalary + allowanceTotal) * 100) / 100;
  const totalDeductions = Math.round((fixedDeductionTotal + attendanceDeduction) * 100) / 100;
  const netAmount = Math.max(0, Math.round((grossAmount - totalDeductions) * 100) / 100);
  return { attendanceDeductionDays, attendanceDeduction, grossAmount, totalDeductions, netAmount };
}
