import type { Attendance, Participant } from '../api/types';

const GROUPS: { attendance: Attendance; label: string }[] = [
  { attendance: 'confirmed', label: 'Confirmados' },
  { attendance: 'pending', label: 'Pendentes' },
  { attendance: 'declined', label: 'Não vão' },
];

// Grupos vazios não aparecem.
export function AttendanceList({ participants }: { participants: Participant[] }) {
  return (
    <div className="attendance-list">
      {GROUPS.map(({ attendance, label }) => {
        const people = participants.filter((item) => item.attendance === attendance);
        if (people.length === 0) return null;
        return (
          <section key={attendance} className="attendance-group">
            <h3>{label} ({people.length})</h3>
            <ul>{people.map((item) => <li key={item.id}>{item.name}</li>)}</ul>
          </section>
        );
      })}
    </div>
  );
}
