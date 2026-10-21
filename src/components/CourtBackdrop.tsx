import type { CSSProperties } from 'react';

// Quadra de tênis vista de cima, em metros e nas medidas oficiais da ITF.
// O viewBox usa metros, então as linhas têm a espessura real (5 cm; fundo com 10 cm).
const RUNOFF_BACK = 6.4;
const RUNOFF_SIDE = 3.66;
const LENGTH = 23.77;
const WIDTH = 10.97;
const ALLEY = 1.37;
const SERVICE = 6.4;
const POST_OFFSET = 0.914;

const TOTAL_LENGTH = LENGTH + RUNOFF_BACK * 2;
const TOTAL_WIDTH = WIDTH + RUNOFF_SIDE * 2;
const X0 = RUNOFF_BACK;
const Y0 = RUNOFF_SIDE;
const NET_X = X0 + LENGTH / 2;
const MID_Y = Y0 + WIDTH / 2;

type Segment = { x1: number; y1: number; x2: number; y2: number; width: number; delay: number };

const LINES: Segment[] = [
  // Linhas de fundo
  { x1: X0, y1: Y0, x2: X0, y2: Y0 + WIDTH, width: 0.1, delay: 0 },
  { x1: X0 + LENGTH, y1: Y0, x2: X0 + LENGTH, y2: Y0 + WIDTH, width: 0.1, delay: 0 },
  // Laterais de duplas
  { x1: X0, y1: Y0, x2: X0 + LENGTH, y2: Y0, width: 0.05, delay: 120 },
  { x1: X0, y1: Y0 + WIDTH, x2: X0 + LENGTH, y2: Y0 + WIDTH, width: 0.05, delay: 120 },
  // Laterais de simples
  { x1: X0, y1: Y0 + ALLEY, x2: X0 + LENGTH, y2: Y0 + ALLEY, width: 0.05, delay: 220 },
  { x1: X0, y1: Y0 + WIDTH - ALLEY, x2: X0 + LENGTH, y2: Y0 + WIDTH - ALLEY, width: 0.05, delay: 220 },
  // Linhas de saque
  { x1: NET_X - SERVICE, y1: Y0 + ALLEY, x2: NET_X - SERVICE, y2: Y0 + WIDTH - ALLEY, width: 0.05, delay: 340 },
  { x1: NET_X + SERVICE, y1: Y0 + ALLEY, x2: NET_X + SERVICE, y2: Y0 + WIDTH - ALLEY, width: 0.05, delay: 340 },
  // Linha central de saque e marcas centrais
  { x1: NET_X - SERVICE, y1: MID_Y, x2: NET_X + SERVICE, y2: MID_Y, width: 0.05, delay: 440 },
  { x1: X0, y1: MID_Y, x2: X0 + 0.1, y2: MID_Y, width: 0.05, delay: 440 },
  { x1: X0 + LENGTH - 0.1, y1: MID_Y, x2: X0 + LENGTH, y2: MID_Y, width: 0.05, delay: 440 },
];

// A bola sai do lado do formulário, cruza a rede e quica perto dela.
const BALL_FROM = { x: 29.2, y: 7.1 };
const BALL_LANDS = { x: 17.2, y: 12.4 };

type Orientation = 'horizontal' | 'vertical';

// Milímetro de precisão basta e evita atributos como 30.169999999999998.
const round = (value: number) => Math.round(value * 1000) / 1000;

// Toda a geometria é fixa: calculada uma vez por orientação, ao carregar o módulo.
function buildGeometry(orientation: Orientation) {
  const vertical = orientation === 'vertical';
  const at = (x: number, y: number) => (vertical ? { x: round(y), y: round(x) } : { x: round(x), y: round(y) });
  const land = at(BALL_LANDS.x, BALL_LANDS.y);
  const from = at(BALL_FROM.x, BALL_FROM.y);

  return {
    box: vertical ? [round(TOTAL_WIDTH), round(TOTAL_LENGTH)] : [round(TOTAL_LENGTH), round(TOTAL_WIDTH)],
    corner: at(X0, Y0),
    size: vertical ? { width: WIDTH, height: LENGTH } : { width: LENGTH, height: WIDTH },
    lines: LINES.map((line) => ({
      a: at(line.x1, line.y1),
      b: at(line.x2, line.y2),
      width: line.width,
      style: { animationDelay: `${line.delay}ms` } as CSSProperties,
    })),
    netStart: at(NET_X, Y0 - POST_OFFSET),
    netEnd: at(NET_X, Y0 + WIDTH + POST_OFFSET),
    land,
    flight: {
      '--dx': `${round(from.x - land.x)}px`,
      '--dy': `${round(from.y - land.y)}px`,
    } as CSSProperties,
  };
}

const GEOMETRY = {
  horizontal: buildGeometry('horizontal'),
  vertical: buildGeometry('vertical'),
};

function Court({ orientation }: { orientation: Orientation }) {
  const { box, corner, size, lines, netStart, netEnd, land, flight } = GEOMETRY[orientation];

  return (
    <svg
      className={`court court--${orientation}`}
      viewBox={`0 0 ${box[0]} ${box[1]}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <rect width={box[0]} height={box[1]} className="court-runoff" />
      <rect x={corner.x} y={corner.y} width={size.width} height={size.height} className="court-surface" />

      {lines.map(({ a, b, width, style }, index) => (
        <line
          key={index}
          x1={a.x}
          y1={a.y}
          x2={b.x}
          y2={b.y}
          pathLength={1}
          strokeWidth={width}
          className="court-line"
          style={style}
        />
      ))}

      <g className="court-net">
        <line x1={netStart.x} y1={netStart.y} x2={netEnd.x} y2={netEnd.y} pathLength={1} className="court-net-shadow court-line" />
        <line x1={netStart.x} y1={netStart.y} x2={netEnd.x} y2={netEnd.y} pathLength={1} className="court-net-tape court-line" />
        <circle cx={netStart.x} cy={netStart.y} r={0.09} className="court-post" />
        <circle cx={netEnd.x} cy={netEnd.y} r={0.09} className="court-post" />
      </g>

      <ellipse cx={land.x} cy={land.y} rx={0.32} ry={0.2} className="bounce-mark" />
      <g transform={`translate(${land.x} ${land.y})`}>
        <g className="ball-flight" style={flight}>
          <ellipse cx={0.06} cy={0.08} rx={0.24} ry={0.18} className="ball-shadow" />
          <g className="ball-lift">
            <circle r={0.22} className="ball" />
            <path d="M -0.15 -0.16 C -0.05 -0.05 -0.05 0.05 -0.15 0.16 M 0.15 -0.16 C 0.05 -0.05 0.05 0.05 0.15 0.16" className="ball-seam" />
          </g>
        </g>
      </g>
    </svg>
  );
}

export function CourtBackdrop() {
  return (
    <div className="backdrop">
      <Court orientation="horizontal" />
      <Court orientation="vertical" />
    </div>
  );
}

export function BallMark() {
  return (
    <svg className="ball-mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <circle cx="16" cy="16" r="15" fill="var(--ball)" />
      <path d="M5 6c6 5 6 15 0 20M27 6c-6 5-6 15 0 20" fill="none" stroke="#F7FBE0" strokeWidth="2.4" />
    </svg>
  );
}
