export type TimetableGridEntry = {
  period_number: number | null;
  starts_at: string;
  ends_at: string;
};

export type TimetableGridPeriod = {
  period_number: number;
  name: string;
  starts_at: string;
  ends_at: string;
};

export type TimetableGridSlot = {
  key: string;
  periodNumber: number | null;
  name: string;
  startsAt: string;
  endsAt: string;
};

export function timetableGridSlotKey(entry: TimetableGridEntry) {
  return entry.period_number
    ? `period-${entry.period_number}`
    : `legacy-${entry.starts_at.slice(0, 5)}-${entry.ends_at.slice(0, 5)}`;
}

export function buildTimetableGridSlots(
  entries: TimetableGridEntry[],
  periods: TimetableGridPeriod[],
): TimetableGridSlot[] {
  const slots = new Map<string, TimetableGridSlot>();

  for (const period of periods) {
    const key = `period-${period.period_number}`;
    slots.set(key, {
      key,
      periodNumber: period.period_number,
      name: period.name,
      startsAt: period.starts_at.slice(0, 5),
      endsAt: period.ends_at.slice(0, 5),
    });
  }

  for (const entry of entries) {
    const key = timetableGridSlotKey(entry);
    if (slots.has(key)) continue;
    slots.set(key, {
      key,
      periodNumber: entry.period_number,
      name: entry.period_number ? `Period ${entry.period_number}` : "Class",
      startsAt: entry.starts_at.slice(0, 5),
      endsAt: entry.ends_at.slice(0, 5),
    });
  }

  return [...slots.values()].sort((left, right) => {
    if (left.periodNumber !== null && right.periodNumber !== null) {
      return left.periodNumber - right.periodNumber;
    }
    if (left.periodNumber !== null) return -1;
    if (right.periodNumber !== null) return 1;
    return left.startsAt.localeCompare(right.startsAt);
  });
}
