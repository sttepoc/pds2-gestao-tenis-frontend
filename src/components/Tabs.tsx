import { useRef, type KeyboardEvent } from 'react';

type Tab = { id: string; label: string };
type Props = { tabs: Tab[]; value: string; onChange(id: string): void; label?: string };

export const tabId = (id: string) => `tab-${id}`;
export const panelId = (id: string) => `panel-${id}`;

/** Só a lista de abas (WAI-ARIA); quem usa renderiza o tabpanel. */
export function Tabs({ tabs, value, onChange, label = 'Reservas' }: Props) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function move(event: KeyboardEvent, index: number) {
    const last = tabs.length - 1;
    const target = { ArrowRight: index === last ? 0 : index + 1, ArrowLeft: index === 0 ? last : index - 1, Home: 0, End: last }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    onChange(tabs[target].id);
    refs.current[target]?.focus();
  }

  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((tab, index) => (
        <button
          key={tab.id} id={tabId(tab.id)} ref={(node) => { refs.current[index] = node; }}
          type="button" role="tab" className="tab"
          aria-selected={tab.id === value} aria-controls={panelId(tab.id)}
          tabIndex={tab.id === value ? 0 : -1}
          onClick={() => onChange(tab.id)} onKeyDown={(event) => move(event, index)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
