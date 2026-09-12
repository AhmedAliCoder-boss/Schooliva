"use client";
import { useActionState } from "react";
import { deleteTimetableEntry } from "@/app/actions/timetable";
export function DeleteTimetableEntry({ id }: { id: string }) { const [state, action] = useActionState(deleteTimetableEntry, undefined); return <form action={action} className="delete-form"><input type="hidden" name="id" value={id} /><button type="submit">Remove</button>{state?.error && <span className="student-error">{state.error}</span>}</form>; }