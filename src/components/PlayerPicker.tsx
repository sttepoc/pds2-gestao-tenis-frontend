import { useEffect, useId, useRef, useState } from 'react';
import { searchPlayers } from '../api/bookings';
import { isExpired } from '../api/error';
import type { Player, Session } from '../api/types';

type Props = {
  value: Player[];
  onChange: (players: Player[]) => void;
  max: 3;
  session: Session;
  onExpired: () => void;
};

const DEBOUNCE_MS = 300;

export function PlayerPicker({ value, onChange, max, session, onExpired }: Props) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Player[]>([]);
  const [message, setMessage] = useState('');
  const expiredRef = useRef(onExpired);
  expiredRef.current = onExpired;

  useEffect(() => {
    const term = query.trim();
    if (Array.from(term).length < 2) {
      setResults([]);
      setMessage('');
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      searchPlayers(session.token, term).then((found) => {
        if (!active) return;
        setResults(found);
        setMessage(found.length === 0 ? 'Nenhum jogador encontrado.' : '');
      }).catch((error: unknown) => {
        if (!active) return;
        if (isExpired(error)) return expiredRef.current();
        setResults([]);
        setMessage('Não foi possível buscar jogadores. Tente de novo.');
      });
    }, DEBOUNCE_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, session.token]);

  const full = value.length >= max;
  const available = results.filter((player) => !value.some((item) => item.id === player.id));

  function add(player: Player) {
    onChange([...value, { id: player.id, name: player.name }]);
    setQuery('');
    setResults([]);
  }

  return (
    <div className="player-picker">
      {value.length > 0 && (
        <ul className="chip-list" aria-label="Convidados">
          {value.map((player) => (
            <li key={player.id} className="chip">
              <span>{player.name}</span>
              <button
                type="button" className="chip-remove" aria-label={`Remover ${player.name}`}
                onClick={() => onChange(value.filter((item) => item.id !== player.id))}
              >×</button>
            </li>
          ))}
        </ul>
      )}
      {full ? (
        <p className="muted">Até {max} convidados.</p>
      ) : (
        <div className="field">
          <label htmlFor={`${id}-search`}>Convidar jogadores</label>
          <input
            id={`${id}-search`} type="search" autoComplete="off" maxLength={60}
            value={query} onChange={(event) => setQuery(event.target.value)}
          />
          {message && <p className="muted">{message}</p>}
          {available.length > 0 && (
            <ul className="player-results" aria-label="Resultados da busca">
              {available.map((player) => (
                <li key={player.id}>
                  <button type="button" className="button button--secondary" onClick={() => add(player)}>{player.name}</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
