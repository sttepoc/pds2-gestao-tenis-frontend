import type { ReactNode } from 'react';
import type { Court, MaintenanceWindow, Surface } from '../api/types';
import { formatClubDateTime } from '../lib/club-time';

export const SURFACE_LABELS: Record<Surface, string> = {
  clay: 'Saibro',
  hard: 'Rápida',
  grass: 'Grama',
  synthetic: 'Sintética',
};

/** Quadra vista de cima, pintada com a cor do piso. Só ilustra: o piso também aparece em texto. */
export function CourtPlan({ surface, covered }: { surface: Surface; covered: boolean }) {
  return (
    <svg
      className={`court-plan surface--${surface}${covered ? ' court-plan--covered' : ''}`}
      viewBox="0 0 30 15" aria-hidden="true" focusable="false"
    >
      <rect className="court-plan-floor" x="3" y="2" width="24" height="11" />
      <g className="court-plan-lines">
        <rect x="3" y="2" width="24" height="11" />
        <path d="M3 3.4h24M3 11.6h24M8.6 3.4v8.2M21.4 3.4v8.2M8.6 7.5h12.8" />
        <path className="court-plan-net" d="M15 1.2v12.6" />
      </g>
    </svg>
  );
}

type Props = {
  court: Court;
  now?: number;
  removing?: boolean;
  onRemoveMaintenance?: (window: MaintenanceWindow) => void;
  children?: ReactNode;
};

export function CourtCard({ court, now, removing, onRemoveMaintenance, children }: Props) {
  const current = now === undefined ? undefined : court.maintenance.find(
    (item) => Date.parse(item.starts_at) <= now && now < Date.parse(item.ends_at),
  );
  const inMaintenance = current !== undefined;
  const upcoming = now === undefined ? [] : court.maintenance
    .filter((item) => Date.parse(item.ends_at) > now)
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  return (
    <article className="court-card">
      <CourtPlan surface={court.surface} covered={court.covered} />
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
      {current && <p className="court-card-meta">Em manutenção até {formatClubDateTime(current.ends_at)}</p>}
      {upcoming.length > 0 && (
        <ul className="maintenance-list">
          {upcoming.map((item) => (
            <li key={item.id}>
              <span>{formatClubDateTime(item.starts_at)} – {formatClubDateTime(item.ends_at)}</span>
              <span>{item.reason}</span>
              {onRemoveMaintenance && (
                <button
                  type="button" className="button button--secondary" disabled={removing}
                  aria-label={`Remover manutenção de ${court.name} em ${formatClubDateTime(item.starts_at)}`}
                  onClick={() => onRemoveMaintenance(item)}
                >
                  Remover
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {children}
    </article>
  );
}
