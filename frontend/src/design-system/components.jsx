import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useCommandPalette } from '../contexts/CommandPaletteContext';
import { useViewport } from '../hooks/useViewport';
import Icon from './Icon';
import { themes, fontStack, monoStack, glassPanel } from './tokens';
import UserAvatar from '../components/UserAvatar';

// ─── Ambient glass background ───────────────────────────────────────
export function GlassRoot({ children, style = {}, scenario, fullScreen = false }) {
  const { theme } = useTheme();
  const t = themes[theme];
  const isDark = theme === 'dark';

  const orbPalette = scenario === 'furniture'
    ? [t.accent, '#f59e0b', t.primary]
    : [t.primary, t.accent, '#f472b6'];

  return (
    <div
      data-theme={theme}
      className="page-enter"
      style={{
        width: '100%',
        height: fullScreen ? '100vh' : undefined,
        minHeight: fullScreen ? undefined : '100vh',
        background: t.bg,
        color: t.fg,
        fontFamily: fontStack,
        fontSize: 13,
        letterSpacing: '-0.005em',
        overflow: fullScreen ? 'hidden' : undefined,
        overflowX: fullScreen ? undefined : 'hidden',
        position: 'relative',
        isolation: 'isolate',
        ...style,
      }}
    >
      {/* Ambient orbs */}
      <div style={{ position: 'absolute', top: -220, left: '10%', width: 640, height: 640, borderRadius: '50%', background: `radial-gradient(circle, ${orbPalette[0]}, transparent 60%)`, opacity: isDark ? 0.35 : 0.16, filter: 'blur(60px)', zIndex: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -220, right: '5%', width: 560, height: 560, borderRadius: '50%', background: `radial-gradient(circle, ${orbPalette[1]}, transparent 60%)`, opacity: isDark ? 0.25 : 0.12, filter: 'blur(60px)', zIndex: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: '25%', right: '25%', width: 400, height: 400, borderRadius: '50%', background: `radial-gradient(circle, ${orbPalette[2]}, transparent 60%)`, opacity: isDark ? 0.14 : 0, filter: 'blur(80px)', zIndex: 0, pointerEvents: 'none', transition: 'none' }} />
      {children}
    </div>
  );
}

// ─── Logo ─────────────────────────────────────────────────────────
export function Logo({ size = 30, showName = true, sub }) {
  const { theme } = useTheme();
  const t = themes[theme];
  const navigate = useNavigate();
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
      onClick={() => navigate('/dashboard')}
    >
      <div style={{
        width: size, height: size, borderRadius: size * 0.3,
        background: `linear-gradient(135deg, ${t.primary}, ${t.accent})`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 6px 20px ${t.primaryGlow}`,
        flexShrink: 0,
      }}>
        <Icon name="bolt" size={size * 0.5} color="#fff" strokeWidth={2.2} />
      </div>
      {showName && (
        <div>
          <div style={{ fontWeight: 600, fontSize: size * 0.46, letterSpacing: '-0.02em', lineHeight: 1, color: t.fg }}>SmartERP</div>
          {sub && <div style={{ fontSize: 9.5, color: t.fgDim, fontFamily: monoStack, marginTop: 2 }}>{sub}</div>}
        </div>
      )}
    </div>
  );
}

// ─── Icon chip (small button) ─────────────────────────────────────
export function IconChip({ children, onClick }) {
  const { theme } = useTheme();
  const t = themes[theme];
  const isDark = theme === 'dark';
  return (
    <div
      style={{
        padding: '6px 10px',
        background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.5)',
        borderRadius: 8,
        display: 'flex', alignItems: 'center', gap: 6,
        border: `1px solid ${t.border}`,
        color: t.fg,
        cursor: 'pointer',
      }}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

// ─── TopBar (connected) ────────────────────────────────────────────
export function TopBar({ subtitle, mode = 'app', showSearch = true, onHamburger }) {
  const { theme, toggleTheme } = useTheme();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { openPalette } = useCommandPalette();
  const { isMobile } = useViewport();
  const t = themes[theme];
  const isDark = theme === 'dark';

  // Global ⌘K / Ctrl+K shortcut
  useEffect(() => {
    if (!showSearch) return;
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        openPalette();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showSearch, openPalette]);

  return (
    <div style={{
      ...glassPanel(t, theme),
      borderRadius: isMobile ? 12 : 14,
      padding: isMobile ? '0 12px' : '10px 14px',
      paddingTop: 'max(10px, calc(env(safe-area-inset-top, 0px) + 6px))',
      paddingBottom: isMobile ? '8px' : '10px',
      display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 14,
      position: 'relative', zIndex: 10,
      minHeight: 52,
    }}>
      {/* Hamburger — only on mobile, only when onHamburger provided */}
      {isMobile && onHamburger && (
        <button
          onClick={onHamburger}
          aria-label="Open menu"
          style={{
            width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none', cursor: 'pointer', color: t.fg, flexShrink: 0, borderRadius: 8,
            touchAction: 'manipulation',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      )}

      {/* Logo — icon only on mobile */}
      <Logo size={30} sub={isMobile ? undefined : subtitle} showName={!isMobile} />

      {/* Spacer / full search bar */}
      {showSearch ? (
        isMobile ? (
          <div style={{ flex: 1 }} />
        ) : (
          <div
            onClick={openPalette}
            style={{
              flex: 1, marginLeft: 14,
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 14px',
              background: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.55)',
              border: `1px solid ${t.border}`,
              borderRadius: 10,
              position: 'relative', overflow: 'hidden',
              cursor: 'pointer',
            }}
          >
            <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${t.primary}11, transparent 50%, ${t.accent}11)`, pointerEvents: 'none' }} />
            <Icon name="search" size={14} color={t.fgDim} />
            <span style={{ fontSize: 12.5, color: t.fgMuted, flex: 1, position: 'relative', userSelect: 'none' }}>
              Search modules, records, actions...
            </span>
            <div style={{ display: 'flex', gap: 3, position: 'relative' }}>
              <kbd style={{ padding: '2px 6px', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,15,30,0.06)', borderRadius: 4, fontSize: 10, fontFamily: monoStack, color: t.fgMuted }}>⌘</kbd>
              <kbd style={{ padding: '2px 6px', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,15,30,0.06)', borderRadius: 4, fontSize: 10, fontFamily: monoStack, color: t.fgMuted }}>K</kbd>
            </div>
          </div>
        )
      ) : (
        !isMobile && <div style={{ flex: 1 }} />
      )}

      {/* Right controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 4 : 8 }}>
        {/* Mobile: icon-only search button */}
        {showSearch && isMobile && (
          <button
            onClick={openPalette}
            aria-label="Search"
            style={{
              width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.4)',
              border: `1px solid ${t.border}`, borderRadius: 8,
              cursor: 'pointer', color: t.fgMuted, flexShrink: 0, touchAction: 'manipulation',
            }}
          >
            <Icon name="search" size={15} color={t.fgMuted} />
          </button>
        )}

        {/* Theme toggle — icon+label on desktop, icon-only on mobile */}
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          style={{
            display: 'flex', alignItems: 'center', gap: isMobile ? 0 : 6,
            padding: isMobile ? '0' : '6px 10px',
            width: isMobile ? 44 : undefined,
            height: isMobile ? 44 : undefined,
            justifyContent: 'center',
            background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.5)',
            borderRadius: 8,
            border: `1px solid ${t.border}`,
            color: t.fg, cursor: 'pointer', flexShrink: 0, touchAction: 'manipulation',
          }}
        >
          <Icon name={isDark ? 'sun' : 'moon'} size={13} />
          {!isMobile && <span style={{ fontSize: 11, fontFamily: monoStack }}>{isDark ? 'DARK' : 'LIGHT'}</span>}
        </button>

        {mode === 'app' && isAuthenticated && (
          <>
            {!isMobile && (
              <IconChip onClick={() => navigate('/dashboard')}>
                <Icon name="grid" size={13} />
              </IconChip>
            )}
            <UserAvatar />
          </>
        )}
      </div>
    </div>
  );
}

// ─── Button ────────────────────────────────────────────────────────
export function Btn({ variant = 'primary', size = 'md', children, style = {}, icon, onClick, disabled, type = 'button' }) {
  const { theme } = useTheme();
  const t = themes[theme];

  const sizes = {
    sm: { padY: 6, padX: 10, font: 11.5, gap: 5 },
    md: { padY: 8, padX: 14, font: 12.5, gap: 6 },
    lg: { padY: 12, padX: 20, font: 14, gap: 8 },
  }[size] || { padY: 8, padX: 14, font: 12.5, gap: 6 };

  const variants = {
    primary: {
      background: `linear-gradient(135deg, ${t.primary}, ${t.accent})`,
      color: '#fff',
      border: '1px solid transparent',
      boxShadow: `0 6px 22px ${t.primaryGlow}, inset 0 1px 0 rgba(255,255,255,0.18)`,
    },
    ghost: {
      background: 'transparent',
      color: t.fg,
      border: `1px solid ${t.border}`,
      boxShadow: 'none',
    },
    soft: {
      background: t.primarySoft,
      color: t.primary,
      border: `1px solid ${t.primary}33`,
      boxShadow: 'none',
    },
    danger: {
      background: 'transparent',
      color: t.danger,
      border: `1px solid ${t.danger}40`,
      boxShadow: 'none',
    },
  }[variant] || {};

  const hoverEnter = (e) => {
    if (disabled) return;
    if (variant === 'ghost') { e.currentTarget.style.borderColor = t.fgMuted; e.currentTarget.style.background = t.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'; }
    if (variant === 'soft')  { e.currentTarget.style.boxShadow = `0 2px 10px ${t.primaryGlow}`; }
    if (variant === 'primary') { e.currentTarget.style.boxShadow = `0 8px 28px ${t.primaryGlow}, inset 0 1px 0 rgba(255,255,255,0.22)`; }
    if (variant === 'danger') { e.currentTarget.style.background = `${t.danger}12`; }
  };
  const hoverLeave = (e) => {
    if (variant === 'ghost') { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.background = 'transparent'; }
    if (variant === 'soft')  { e.currentTarget.style.boxShadow = 'none'; }
    if (variant === 'primary') { e.currentTarget.style.boxShadow = `0 6px 22px ${t.primaryGlow}, inset 0 1px 0 rgba(255,255,255,0.18)`; }
    if (variant === 'danger') { e.currentTarget.style.background = 'transparent'; }
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={hoverEnter}
      onMouseLeave={hoverLeave}
      onFocus={e => { if (!disabled) { e.currentTarget.style.outline = `2px solid ${t.primary}66`; e.currentTarget.style.outlineOffset = '2px'; } }}
      onBlur={e => { e.currentTarget.style.outline = 'none'; }}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: sizes.gap,
        padding: `${sizes.padY}px ${sizes.padX}px`,
        borderRadius: 9,
        fontSize: sizes.font, fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: fontStack,
        letterSpacing: '-0.005em',
        opacity: disabled ? 0.6 : 1,
        transition: 'opacity 0.15s, box-shadow 0.15s, border-color 0.15s, background 0.15s',
        touchAction: 'manipulation',
        minHeight: size === 'lg' ? 48 : size === 'sm' ? 32 : 38,
        ...variants,
        ...style,
      }}
    >
      {icon && <Icon name={icon} size={sizes.font * 1.1} color={variant === 'primary' ? '#fff' : 'currentColor'} strokeWidth={2} />}
      {children}
    </button>
  );
}

// ─── Field label wrapper ─────────────────────────────────────────
export function Field({ label, sublabel, children, style = {} }) {
  const { theme } = useTheme();
  const t = themes[theme];
  return (
    <div style={style}>
      {label && (
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
          <label style={{ fontSize: 11.5, fontWeight: 500, color: t.fgMuted, letterSpacing: '-0.005em' }}>{label}</label>
          {sublabel && <span style={{ fontSize: 10.5, color: t.fgDim, fontFamily: monoStack }}>{sublabel}</span>}
        </div>
      )}
      {children}
    </div>
  );
}

// ─── Input ────────────────────────────────────────────────────────
export function DSInput({ value, placeholder, type = 'text', icon, suffix, focused, onChange, disabled, autoComplete, name, style = {} }) {
  const { theme } = useTheme();
  const t = themes[theme];
  const isDark = theme === 'dark';

  return (
    <div style={{
      width: '100%', padding: 0,
      background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.5)',
      border: `1px solid ${focused ? t.primary : t.border}`,
      borderRadius: 10,
      color: t.fg, fontSize: 13,
      outline: 'none', boxSizing: 'border-box',
      display: 'flex', alignItems: 'center',
      boxShadow: focused ? `0 0 0 3px ${t.primaryGlow}` : 'none',
      ...style,
    }}>
      {icon && <span style={{ paddingLeft: 12, color: t.fgDim, display: 'flex' }}><Icon name={icon} size={14} /></span>}
      <input
        type={type}
        name={name}
        value={value}
        placeholder={placeholder}
        onChange={onChange}
        disabled={disabled}
        autoComplete={autoComplete}
        style={{
          flex: 1, padding: '11px 14px',
          background: 'transparent', border: 'none', outline: 'none',
          color: t.fg, fontSize: 13, fontFamily: fontStack,
          letterSpacing: type === 'password' ? '0.15em' : '-0.005em',
        }}
      />
      {suffix && <span style={{ paddingRight: 12, color: t.fgDim, fontSize: 11, fontFamily: monoStack }}>{suffix}</span>}
    </div>
  );
}

// ─── Pill / Badge ────────────────────────────────────────────────
export function Pill({ color = 'primary', children, dot = true, size = 'md' }) {
  const { theme } = useTheme();
  const t = themes[theme];
  const colorMap = { primary: t.primary, accent: t.accent, success: t.success, warn: t.warn, danger: t.danger, neutral: t.fgMuted };
  const c = colorMap[color] || color;
  const sizes = {
    sm: { font: 10, pad: '2px 6px' },
    md: { font: 10.5, pad: '3px 8px' },
    lg: { font: 11.5, pad: '4px 10px' },
  }[size] || { font: 10.5, pad: '3px 8px' };

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: sizes.pad, borderRadius: 99,
      background: `${c}1a`, color: c,
      fontSize: sizes.font, fontFamily: monoStack,
      border: `1px solid ${c}33`,
      whiteSpace: 'nowrap',
    }}>
      {dot && <span style={{ width: 5, height: 5, borderRadius: '50%', background: c }} />}
      {children}
    </span>
  );
}

// ─── Steps indicator ─────────────────────────────────────────────
export function Steps({ current, total, labels }) {
  const { theme } = useTheme();
  const t = themes[theme];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, fontFamily: monoStack }}>
      {Array.from({ length: total }).map((_, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 24, height: 24, borderRadius: '50%',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: done || active ? `linear-gradient(135deg, ${t.primary}, ${t.accent})` : 'transparent',
                color: done || active ? '#fff' : t.fgDim,
                border: !done && !active ? `1px solid ${t.border}` : 'none',
                fontSize: 11, fontWeight: 600,
                boxShadow: active ? `0 0 14px ${t.primaryGlow}` : 'none',
              }}>
                {done ? '✓' : i + 1}
              </span>
              {labels && <span style={{ fontSize: 11.5, color: active || done ? t.fg : t.fgMuted, fontFamily: fontStack }}>{labels[i]}</span>}
            </span>
            {i < total - 1 && (
              <span style={{
                display: 'inline-block', width: 32, height: 1, margin: '0 10px',
                background: done ? `linear-gradient(90deg, ${t.primary}, ${t.accent})` : t.border,
              }} />
            )}
          </span>
        );
      })}
    </div>
  );
}

// ─── Sparkline path helper ────────────────────────────────────────
export function sparkPath(values, w = 80, h = 24) {
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const step = w / (values.length - 1);
  return values.map((v, i) => {
    const x = i * step;
    const y = h - ((v - min) / range) * h;
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
}
