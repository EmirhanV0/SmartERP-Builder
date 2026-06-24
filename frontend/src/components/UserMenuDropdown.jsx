import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { fontStack } from '../design-system/tokens';
import Icon from '../design-system/Icon';

function MenuItem({ icon, label, onClick, danger, t, isDark }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 14px',
        background: hov
          ? (danger ? `${t.danger}15` : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'))
          : 'transparent',
        border: 'none', cursor: 'pointer', textAlign: 'left',
        color: danger ? t.danger : t.fg,
        fontSize: 12.5, fontFamily: fontStack,
        transition: 'background 0.1s',
      }}
    >
      <Icon name={icon} size={14} color={danger ? t.danger : t.fgMuted} />
      {label}
    </button>
  );
}

export default function UserMenuDropdown({ t, isDark, initials, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };
  const handleAdmin = () => { navigate('/admin'); onClose(); };
  const handleProfile = () => { navigate('/profile'); onClose(); };

  return (
    <div style={{
      position: 'absolute', top: 42, right: 0, zIndex: 200,
      width: 228, maxWidth: 'min(calc(100vw - 32px), 228px)',
      // More opaque than glassPanel — dropdown needs to be clearly readable
      background: isDark ? 'rgba(16, 16, 26, 0.97)' : 'rgba(255, 255, 255, 0.98)',
      backdropFilter: 'blur(28px) saturate(160%)',
      WebkitBackdropFilter: 'blur(28px) saturate(160%)',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,15,30,0.09)'}`,
      boxShadow: isDark
        ? '0 20px 60px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04)'
        : '0 20px 60px rgba(15,15,30,0.15), 0 0 0 1px rgba(255,255,255,0.9)',
      borderRadius: 14,
      overflow: 'hidden',
      animation: 'fadeIn 0.12s ease',
    }}>
      {/* User info header */}
      <div style={{
        padding: '14px 16px 12px',
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,15,30,0.07)'}`,
        display: 'flex', alignItems: 'center', gap: 10,
        background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
          background: `linear-gradient(135deg, ${t.primary}, ${t.accent})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: 'monospace',
          boxShadow: `0 3px 10px ${t.primaryGlow}`,
        }}>
          {initials}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          {user?.full_name && (
            <div style={{
              fontSize: 12.5, fontWeight: 600, color: t.fg, fontFamily: fontStack,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {user.full_name}
            </div>
          )}
          <div style={{
            fontSize: 10.5, color: t.fgMuted, fontFamily: 'monospace',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {user?.email || ''}
          </div>
        </div>
      </div>

      {/* Menu items — Profile → Admin Panel (admin only) → Logout */}
      <div style={{ padding: '6px 0' }}>
        <MenuItem icon="user" label="Profile" onClick={handleProfile} t={t} isDark={isDark} />

        {user?.role === 'admin' && (
          <MenuItem icon="shield" label="Admin Panel" onClick={handleAdmin} t={t} isDark={isDark} />
        )}

        <div style={{
          height: 1,
          background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,15,30,0.06)',
          margin: '6px 10px',
        }} />

        <MenuItem icon="close" label="Logout" onClick={handleLogout} danger t={t} isDark={isDark} />
      </div>
    </div>
  );
}
