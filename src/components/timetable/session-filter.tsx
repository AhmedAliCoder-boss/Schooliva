import Link from "next/link";

type Session = { id: string; name: string };

export function TimetableSessionFilter({
  sessions,
  selectedSessionId,
  action,
}: {
  sessions: Session[];
  selectedSessionId: string;
  action: string;
}) {
  return (
    <form className="timetable-filter" action={action} method="get">
      <label htmlFor="timetable-session">Academic session</label>
      <select id="timetable-session" name="sessionId" defaultValue={selectedSessionId}>
        {sessions.length > 1 && <option value="all">All sessions</option>}
        {sessions.map((session) => <option key={session.id} value={session.id}>{session.name}</option>)}
      </select>
      <button className="admin-button" type="submit">Apply</button>
      <Link className="text-action" href={action}>Reset</Link>
    </form>
  );
}
