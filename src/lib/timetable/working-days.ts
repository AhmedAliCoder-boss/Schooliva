export const timetableDays = [
  { day: 1, name: "Monday", shortName: "Mon" },
  { day: 2, name: "Tuesday", shortName: "Tue" },
  { day: 3, name: "Wednesday", shortName: "Wed" },
  { day: 4, name: "Thursday", shortName: "Thu" },
  { day: 5, name: "Friday", shortName: "Fri" },
  { day: 6, name: "Saturday", shortName: "Sat" },
  { day: 7, name: "Sunday", shortName: "Sun" },
] as const;

export const defaultTimetableWorkingDays = timetableDays.map(({ day }) => day);

export function isTimetableWorkingDay(workingDays: readonly number[], day: number) {
  return workingDays.includes(day);
}