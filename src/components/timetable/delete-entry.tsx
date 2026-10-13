"use client";
import { useActionState } from "react";
import { deleteTimetableEntry } from "@/app/actions/timetable";
export function DeleteTimetableEntry({ id }: { id: string }) {
  const [state, action, pending] = useActionState(deleteTimetableEntry, undefined);
  return (
    <form action={action} className="delete-form">
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending}>{pending ? "Removing..." : "Remove"}</button>
      {state?.error && <span className="student-error" role="status">{state.error}</span>}
      {state?.success && <span className="student-success" role="status">{state.success}</span>}
    </form>
  );
}