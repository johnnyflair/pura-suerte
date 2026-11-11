import type { ReactNode } from 'react';

const P: Record<string, ReactNode> = {
  tesoro: (<><path d="M3 20h18L12 4z" /><path d="M7.5 14h9" /><path d="M5.5 17h13" /></>),
  templo: (<><path d="M2 20h20" /><path d="M4 20V12h16v8" /><path d="M6 12V8h12v4" /><path d="M9 8V5h6v3" /><path d="M10 20v-4h4v4" /></>),
  fruta: (<><circle cx="7" cy="17" r="3" /><circle cx="16" cy="18" r="3" /><path d="M7 14c1-5 4-8 9-10" /><path d="M16 15c-1-4-1-8 0-11" /></>),
  cafe: (<><path d="M4 9h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" /><path d="M16 11h2a2 2 0 0 1 0 4h-2" /><path d="M8 3v3" /><path d="M12 3v3" /></>),
  volcan: (<><path d="M2 20l7-11h6l7 11z" /><path d="M10 9l2-5 2 5" /><path d="M8 5L7 3" /><path d="M16 5l1-2" /></>),
  carnaval: (<><path d="M3 8c3-2 15-2 18 0 0 6-3 10-9 10S3 14 3 8z" /><path d="M7 11h3" /><path d="M14 11h3" /></>),
  cohete: (<><path d="M12 2c4 3 5 8 3 13H9C7 10 8 5 12 2z" /><path d="M9 15l-3 3 3 1" /><path d="M15 15l3 3-3 1" /><circle cx="12" cy="9" r="1.5" /></>),
  minas: (<><path d="M6 3h12l3 6-9 12L3 9z" /><path d="M3 9h18" /><path d="M9 3l3 6 3-6" /></>),
  plinko: (<><circle cx="12" cy="4" r="1.3" /><circle cx="9" cy="9" r="1.3" /><circle cx="15" cy="9" r="1.3" /><circle cx="6" cy="14" r="1.3" /><circle cx="12" cy="14" r="1.3" /><circle cx="18" cy="14" r="1.3" /><path d="M3 20h18" /></>),
  ruleta: (<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3" /><path d="M12 3v6" /><path d="M12 15v6" /><path d="M3 12h6" /><path d="M15 12h6" /></>),
  blackjack: (<><rect x="3" y="5" width="10" height="14" rx="2" /><path d="M13 6l6 2-3 12-3-1" /></>),
  coin: (<><circle cx="12" cy="12" r="9" /><path d="M12 7v10" /><path d="M9 9.5h4.5a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3H15" /></>),
  plus: (<><path d="M12 5v14" /><path d="M5 12h14" /></>),
  home: (<><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /></>),
  grid: (<><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></>),
  bag: (<><path d="M5 8h14l-1 12H6z" /><path d="M9 8a3 3 0 0 1 6 0" /></>),
  trophy: (<><path d="M8 4h8v5a4 4 0 0 1-8 0z" /><path d="M8 6H5a3 3 0 0 0 3 4" /><path d="M16 6h3a3 3 0 0 1-3 4" /><path d="M12 13v4" /><path d="M8 20h8" /></>),
  user: (<><circle cx="12" cy="8" r="4" /><path d="M4 20c1-4 4-6 8-6s7 2 8 6" /></>),
  play: <path d="M6 4l13 8-13 8z" />,
  gift: (<><rect x="3" y="9" width="18" height="12" rx="1.5" /><path d="M3 13h18" /><path d="M12 9v12" /><path d="M12 9C9 9 7 4 9.5 4S12 9 12 9z" /><path d="M12 9c3 0 5-5 2.5-5S12 9 12 9z" /></>),
  back: <path d="M15 5l-7 7 7 7" />,
  close: (<><path d="M6 6l12 12" /><path d="M18 6L6 18" /></>),
  info: (<><circle cx="12" cy="12" r="9" /><path d="M12 11v6" /><path d="M12 7.5v.01" /></>),
  shield: (<><path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z" /><path d="M9 12l2 2 4-4" /></>),
};

export function Icon({ name, size = 24, color = 'currentColor', stroke = 1.8, fill = 'none' }: {
  name: string;
  size?: number;
  color?: string;
  stroke?: number;
  fill?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {P[name]}
    </svg>
  );
}
