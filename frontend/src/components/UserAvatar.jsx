import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { themes, monoStack } from '../design-system/tokens';
import UserMenuDropdown from './UserMenuDropdown';

function getInitials(user) {
  if (user?.full_name) {
    const parts = user.full_name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  }
  if (user?.email) return user.email.charAt(0).toUpperCase();
  return '?';
}

export default function UserAvatar() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const t = themes[theme];
  const isDark = theme === 'dark';
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const initials = getInitials(user);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const handleKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      {/* Avatar circle */}
      <div
        onClick={() => setOpen(o => !o)}
        title={user?.full_name || user?.email || 'Profile'}
        style={{
          width: 32, height: 32, borderRadius: '50%',
          background: `linear-gradient(135deg, ${t.primary}, ${t.accent})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 600, color: '#fff',
          fontFamily: monoStack,
          border: `2px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.8)'}`,
          cursor: 'pointer',
          boxShadow: open ? `0 0 0 3px ${t.primaryGlow}` : 'none',
          transition: 'box-shadow 0.15s',
          userSelect: 'none',
        }}
      >
        {initials}
      </div>

      {/* Dropdown */}
      {open && (
        <UserMenuDropdown
          t={t}
          isDark={isDark}
          initials={initials}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
