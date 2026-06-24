export const themes = {
  dark: {
    bg: '#0a0a12',
    bgElev: '#0f0f1a',
    bgElev2: '#15151f',
    bgElev3: '#1c1c2a',
    border: 'rgba(255,255,255,0.06)',
    borderStrong: 'rgba(255,255,255,0.10)',
    fg: '#f4f4f7',
    fgMuted: 'rgba(244,244,247,0.62)',
    fgDim: 'rgba(244,244,247,0.40)',
    primary: '#7c6cff',
    primaryGlow: 'rgba(124,108,255,0.35)',
    primarySoft: 'rgba(124,108,255,0.12)',
    accent: '#22d3ee',
    accentGlow: 'rgba(34,211,238,0.35)',
    accentSoft: 'rgba(34,211,238,0.10)',
    danger: '#ff6b6b',
    success: '#34d399',
    warn: '#fbbf24',
    grid: 'rgba(255,255,255,0.04)',
  },
  light: {
    bg: '#f7f7fb',
    bgElev: '#ffffff',
    bgElev2: '#ffffff',
    bgElev3: '#fafafd',
    border: 'rgba(15,15,30,0.06)',
    borderStrong: 'rgba(15,15,30,0.12)',
    fg: '#0e0e1a',
    fgMuted: 'rgba(14,14,26,0.62)',
    fgDim: 'rgba(14,14,26,0.40)',
    primary: '#6358ff',
    primaryGlow: 'rgba(99,88,255,0.20)',
    primarySoft: 'rgba(99,88,255,0.08)',
    accent: '#0891b2',
    accentGlow: 'rgba(8,145,178,0.25)',
    accentSoft: 'rgba(8,145,178,0.08)',
    danger: '#dc2626',
    success: '#059669',
    warn: '#d97706',
    grid: 'rgba(15,15,30,0.04)',
  },
};

export const fontStack = '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
export const monoStack = '"JetBrains Mono", "SF Mono", ui-monospace, Menlo, monospace';

export const glassPanel = (t, theme) => ({
  background: theme === 'dark' ? 'rgba(20,20,32,0.55)' : 'rgba(255,255,255,0.65)',
  backdropFilter: 'blur(24px) saturate(140%)',
  WebkitBackdropFilter: 'blur(24px) saturate(140%)',
  border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.6)'}`,
  boxShadow: theme === 'dark'
    ? '0 8px 32px rgba(0,0,0,0.4)'
    : '0 8px 32px rgba(15,15,30,0.06)',
  borderRadius: 16,
});

export const inputBase = (t, theme) => ({
  width: '100%',
  padding: '11px 14px',
  background: theme === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.5)',
  border: `1px solid ${t.border}`,
  borderRadius: 10,
  color: t.fg,
  fontSize: 13,
  fontFamily: fontStack,
  outline: 'none',
  boxSizing: 'border-box',
});
