import type { ReactNode } from 'react';
import type { Court, Surface } from '../api/types';

export const SURFACE_LABELS: Record<Surface, string> = {
  clay: 'Saibro',
  hard: 'Rápida',
  grass: 'Grama',
  synthetic: 'Sintética',
};

type Props = { court: Court; now?: number; children?: ReactNode };

export function CourtCard({ court, now, children }: Props) {
  const inMaintenance = now !== undefined && court.maintenance.some(
    (item) => Date.parse(item.starts_at) <= now && now < Date.parse(item.ends_at),
  );
  return (
    <article className="court-card">
      <div className="court-card-head">
        <h3>{court.name}</h3>
        {inMaintenance
          ? <span className="badge">Em manutenção</span>
          : <span className="badge badge--active">Disponível</span>}
      </div>
      <p className="court-card-meta">
        <span>{SURFACE_LABELS[court.surface]}</span>
        <span>{court.covered ? 'Coberta' : 'Descoberta'}</span>
      </p>
      {children}
    </article>
  );
}
