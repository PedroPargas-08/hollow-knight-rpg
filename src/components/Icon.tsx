import type { IconName } from '../types';

const PATHS: Record<IconName, string> = {
  home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 3.5-7 8-7s8 3 8 7',
  users: 'M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2 20c0-3.300 3-6 7-6s7 2.700 7 6M16 4.500a3.500 3.500 0 010 6.500M18 14c2.400.6 4 2.400 4 5',
  scroll: 'M8 4h11v13a3 3 0 01-3 3H6a3 3 0 003-3V6a2 2 0 00-2-2M8 4a2 2 0 00-2 2v1h3M12 9h4M12 13h4',
  book: 'M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 19a2 2 0 002 2h13M9 7h6',
  map: 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14',
  sword: 'M20 4h-5L7 12l3 3 8-8zM6 13l-3 3 2 2 3-3M8 18l-3 3',
  shield: 'M12 3l8 3v6c0 5-3.500 8-8 9-4.500-1-8-4-8-9V6z',
  heart: 'M12 20s-7-4.500-8.500-9A4.500 4.500 0 0112 7a4.500 4.500 0 018.500 4C19 15.500 12 20 12 20z',
  soul: 'M12 3c3 4 6 6.500 6 10a6 6 0 01-12 0c0-3.500 3-6 6-10zM9.500 14a2.500 2.500 0 002.500 2.500',
  bell: 'M6 16v-5a6 6 0 1112 0v5l2 2H4zM10 21h4',
  gear: 'M12 15a3 3 0 100-6 3 3 0 000 6zM12 3v3M12 18v3M3 12h3M18 12h3M5.600 5.600l2.100 2.100M16.300 16.300l2.100 2.100M18.400 5.600l-2.100 2.100M7.700 16.300l-2.100 2.100',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 018 0v3',
  search: 'M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z',
  eyeoff: 'M3 3l18 18M10.600 6.200A9.600 9.600 0 0112 6c6 0 10 6 10 6a17 17 0 01-3 3.600M6.300 7.600C3.600 9.400 2 12 2 12s4 6 10 6c1.500 0 2.900-.4 4.100-1M9.900 9.900a3 3 0 004.200 4.200',
  menu: 'M4 7h16M4 12h16M4 17h16',
  close: 'M6 6l12 12M18 6L6 18',
  chevron: 'M9 6l6 6-6 6',
  plus: 'M12 5v14M5 12h14',
  skull: 'M12 3a8 8 0 00-5 14v3h10v-3A8 8 0 0012 3zM9 12h.01M15 12h.01M10 20v-2M14 20v-2',
  crown: 'M3 8l4 4 5-7 5 7 4-4-2 11H5z',
  compass: 'M12 21a9 9 0 100-18 9 9 0 000 18zM15.500 8.500l-2 5-5 2 2-5z',
  pack: 'M8 8a4 4 0 018 0M6 8h12v12H6zM6 14h12M10 17h4',
  star: 'M12 3l2.700 5.600 6.100.9-4.400 4.300 1 6.100L12 17l-5.400 2.900 1-6.100L3.200 9.500l6.100-.9z',
  check: 'M5 12.500l4.500 4.500L19 7',
  alert: 'M12 3l10 18H2zM12 10v5M12 18h.01',
  info: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v5M12 8h.01',
  door: 'M6 21V4h12v17M3 21h18M14 12h.01',
  dice: 'M5 5h14v14H5zM9 9h.01M15 9h.01M12 12h.01M9 15h.01M15 15h.01',
  feather: 'M20 4c-8 0-14 5-14 12v4M20 4c0 8-5 13-12 13M9 15l-4 5',
  spark: 'M12 3v6M12 15v6M3 12h6M15 12h6M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2',
  flag: 'M5 21V4M5 5h12l-2 4 2 4H5',
  hourglass: 'M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9',
  gem: 'M6 4h12l3 5-9 12L3 9zM3 9h18M9 4L7 9l5 12M15 4l2 5-5 12',
  sheet: 'M7 3h8l4 4v14H7zM15 3v4h4M10 12h6M10 16h6',
  back: 'M15 6l-6 6 6 6',
  logout: 'M10 4H5v16h5M15 8l4 4-4 4M19 12H9',
  mask: 'M12 3C8 3 5 5 5 9c0 6 3 11 7 12 4-1 7-6 7-12 0-4-3-6-7-6zM8.500 10l2.500 2M15.500 10L13 12M12 15v2',
  armor: 'M12 3L2 7v10l10 4 10-4V7L12 3zM2 7l10 4 10-4M6 9v8M18 9v-8',
  crosshair: 'M12 3v6M12 15v6M3 12h6M15 12h6M12 12a5 5 0 000 10 5 5 0 000-10z',
  play: 'M6 4v16l12-8z',
  forward: 'M10 17l5-5-5-5M14 17l5-5-5-5',
  'user-plus': 'M16 11c2 0 3.5-1.5 3.5-3.5S18 4 16 4s-3.5 1.5-3.5 3.5S14 11 16 11zM8 11c2 0 3.5-1.5 3.5-3.5S10 4 8 4s-3.5 1.5-3.5 3.5S6 11 8 11zM12 16v6M12 19h6',
  history: 'M12 3v6M12 15v6M3 12h6M15 12h6M12 12a5 5 0 000 10 5 5 0 000-10z',
  droplet: 'M12 3c-4 0-7 3-7 7a7 7 0 0014 0c0-4-3-7-7-7zM12 11v5M12 18h.01',
};

export function Icon({ name, label, className = '' }: { name: IconName; label?: string; className?: string }) {
  return (
    <svg className={`icon ${className}`} viewBox="0 0 24 24" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} focusable="false">
      <path d={PATHS[name]} />
    </svg>
  );
}
