const paths = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
  layers: <><path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></>,
  spark: <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/>,
  user: <><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></>,
  users: <><circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3 3-5 7-5s7 2 7 5"/><path d="M17 11a3 3 0 100-6"/><path d="M22 20c0-2.5-2-4-5-4.5"/></>,
  cal: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></>,
  file: <><path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z"/><path d="M14 3v6h6"/></>,
  scan: <><path d="M3 7V5a2 2 0 012-2h2M3 17v2a2 2 0 002 2h2M21 7V5a2 2 0 00-2-2h-2M21 17v2a2 2 0 01-2 2h-2"/><path d="M7 12h10"/></>,
  chart: <><path d="M3 3v18h18"/><path d="M7 14l3-3 4 4 5-7"/></>,
  bolt: <path d="M13 2L3 14h7l-1 8 11-13h-8l1-7z"/>,
  plus: <><path d="M12 5v14M5 12h14"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></>,
  bell: <><path d="M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 004 0"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 01-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3h0a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8v0a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
  moon: <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/>,
  chevron: <path d="m9 6 6 6-6 6"/>,
  chevronDown: <path d="m6 9 6 6 6-6"/>,
  chevronLeft: <path d="m15 18-6-6 6-6"/>,
  arrowUp: <><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></>,
  arrowDown: <><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></>,
  arrowRight: <><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></>,
  dot: <circle cx="12" cy="12" r="4"/>,
  close: <><path d="M18 6 6 18M6 6l12 12"/></>,
  cmd: <path d="M9 9V6a3 3 0 113 3H9zm0 0v6m0 0v3a3 3 0 11-3-3h3zm0 0h6m0 0V6a3 3 0 113 3h-3zm0 0v6m0 0v3a3 3 0 113-3h-3z"/>,
  package: <><path d="M21 16V8l-9-5-9 5v8l9 5 9-5z"/><path d="M3.3 7l8.7 5 8.7-5M12 12v10"/></>,
  truck: <><rect x="1" y="6" width="13" height="11" rx="1"/><path d="M14 9h4l3 4v4h-7"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="17.5" cy="18.5" r="2.5"/></>,
  coin: <><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 9.5h4.5a1.5 1.5 0 010 3h-3a1.5 1.5 0 000 3H15"/></>,
  pulse: <path d="M3 12h4l3-9 4 18 3-9h4"/>,
  db: <><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v6c0 1.7 4 3 9 3s9-1.3 9-3V5M3 11v6c0 1.7 4 3 9 3s9-1.3 9-3v-6"/></>,
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>,
  list: <><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/></>,
  filter: <path d="M3 4h18l-7 9v6l-4 2v-8L3 4z"/>,
  download: <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/></>,
  sparkles: <><path d="M12 3v4M12 17v4M5 12H1M23 12h-4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/><circle cx="12" cy="12" r="3"/></>,
  flame: <path d="M12 22a7 7 0 007-7c0-3-1.5-5-3-7 0 0 0 3-2 3-1.5 0-2-3-2-5 0-2-3-3-3-3s2 5-2 9-2 8 0 9c-.5 0-.5-1 0-3 1 3 3 4 5 4z"/>,
  activity: <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>,
  brain: <><path d="M9.5 3A3.5 3.5 0 006 6.5c0 .8.3 1.6.8 2.2A3.5 3.5 0 005 12c0 1.1.5 2.1 1.3 2.8A3 3 0 009 18.5h1.5V5"/><path d="M14.5 3A3.5 3.5 0 0118 6.5c0 .8-.3 1.6-.8 2.2A3.5 3.5 0 0119 12c0 1.1-.5 2.1-1.3 2.8A3 3 0 0115 18.5h-1.5V5"/><path d="M12 5v13.5"/></>,
  sidebar: <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/></>,
  logout: <><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>,
  check: <polyline points="20 6 9 17 4 12"/>,
  lock: <><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></>,
  eye: <><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></>,
  eyeOff: <><path d="M17.9 17.9A10 10 0 012.1 12C2.1 12 5 5 12 5a10 10 0 017.9 4"/><path d="M10.7 10.7a3 3 0 004.6 3.6"/><path d="M2 2l20 20"/></>,
};

export default function Icon({ name, size = 16, color = 'currentColor', strokeWidth = 1.5 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, display: 'block' }}
    >
      {paths[name] || null}
    </svg>
  );
}
