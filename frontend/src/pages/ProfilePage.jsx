import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useViewport } from '../hooks/useViewport';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useCommandPalette } from '../contexts/CommandPaletteContext';
import { themes, glassPanel, fontStack, monoStack } from '../design-system/tokens';
import { GlassRoot, TopBar, Btn, Field } from '../design-system/components';
import { Skeleton } from '../design-system/Skeleton';
import { EmptyState } from '../design-system/EmptyState';
import Icon from '../design-system/Icon';
import { configurationsApi, userApi } from '../services/api';
import { timeAgo } from '../utils/timeAgo';
// GlassTooltip inline (rechartsTheme.js .js extension causes a parse error in production build)
function GlassTooltip({ active, payload, label, t, theme: _theme }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ ...glassPanel(t, _theme), padding: '10px 14px', minWidth: 110, pointerEvents: 'none' }}>
      {label && <div style={{ fontSize: 10.5, color: t.fgDim, fontFamily: monoStack, marginBottom: 6, letterSpacing: '0.03em' }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontFamily: fontStack, marginTop: i > 0 ? 4 : 0 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color || p.fill, flexShrink: 0 }} />
          <span style={{ flex: 1, color: t.fgMuted }}>{p.name || p.dataKey}</span>
          <span style={{ fontWeight: 600, color: t.fg }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────


function fmtMemberDate(iso) {
  if (!iso) return '–';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

function getInitials(name, email) {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return '?';
}

function pwStrength(pw) {
  if (!pw || pw.length < 8) return { label: 'Too short', color: '#ef4444', pct: 15 };
  const hasLetter = /[A-Za-z]/.test(pw);
  const hasDigit  = /\d/.test(pw);
  if (!hasLetter || !hasDigit) return { label: 'Weak', color: '#ef4444', pct: 25 };
  if (pw.length >= 12)         return { label: 'Strong', color: '#34d399', pct: 100 };
  return { label: 'Good', color: '#fbbf24', pct: 65 };
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ── Badge components ─────────────────────────────────────────────────────────

function RolePill({ role, t }) {
  const isAdmin = role === 'admin';
  const color   = isAdmin ? t.primary : t.fgMuted;
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 99, fontSize: 10.5, fontFamily: monoStack,
      background: isAdmin ? `${t.primary}22` : 'rgba(128,128,128,0.10)',
      color, border: `1px solid ${isAdmin ? `${t.primary}40` : 'transparent'}`,
    }}>
      {isAdmin ? 'Admin' : 'User'}
    </span>
  );
}

function StatusPill({ status, t }) {
  const map = {
    active:           t.success,
    approved:         t.accent,
    draft:            t.fgDim,
    pending_approval: t.warn,
  };
  const color = map[status] || t.fgDim;
  const label = status === 'pending_approval' ? 'pending' : status;
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 99, fontSize: 10.5, fontFamily: monoStack,
      background: `${color}18`, color, border: `1px solid ${color}30`,
    }}>
      {label}
    </span>
  );
}

// ── Password field with show/hide toggle ─────────────────────────────────────

function PwField({ label, value, onChange, show, onToggle, placeholder, t, isDark }) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label style={{
        fontSize: 11.5, fontWeight: 500, color: t.fgMuted,
        letterSpacing: '-0.005em', display: 'block', marginBottom: 6,
      }}>
        {label}
      </label>
      <div style={{
        display: 'flex', alignItems: 'center',
        background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.5)',
        border: `1px solid ${focused ? t.primary : t.border}`,
        borderRadius: 10,
        boxShadow: focused ? `0 0 0 3px ${t.primaryGlow}` : 'none',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}>
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            flex: 1, padding: '11px 14px',
            background: 'transparent', border: 'none', outline: 'none',
            color: t.fg, fontSize: 13, fontFamily: fontStack,
            letterSpacing: show ? '-0.005em' : '0.15em',
          }}
        />
        <button
          type="button"
          onClick={onToggle}
          style={{
            padding: '0 14px', background: 'none', border: 'none', cursor: 'pointer',
            color: t.fgDim, display: 'flex', alignItems: 'center',
            minHeight: 44, touchAction: 'manipulation',
          }}
        >
          <Icon name={show ? 'eyeOff' : 'eye'} size={15} color={t.fgDim} />
        </button>
      </div>
    </div>
  );
}

// ── Nav config ────────────────────────────────────────────────────────────────

const PROFILE_NAV = [
  { key: 'account',    label: 'Account',    icon: 'user'  },
  { key: 'password',   label: 'Password',   icon: 'lock'  },
  { key: 'erps',       label: 'My ERPs',    icon: 'db'    },
  { key: 'statistics', label: 'Statistics', icon: 'chart' },
];

// ── ProfilePage ───────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const navigate   = useNavigate();
  const { user, updateUser } = useAuth();
  const { theme } = useTheme();
  const { isMobile } = useViewport();
  const { lock, unlock } = useBodyScrollLock();
  const { setPaletteData } = useCommandPalette();
  const t      = themes[theme];
  const isDark = theme === 'dark';

  const [section,    setSection]    = useState('account');
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Account
  const [profileUser,    setProfileUser]    = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [fullName,    setFullName]    = useState('');
  const [fnFocused,   setFnFocused]   = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);

  // Password
  const [pw,      setPw]      = useState({ current: '', newPw: '', confirm: '' });
  const [pwShow,  setPwShow]  = useState({ current: false, newPw: false, confirm: false });
  const [pwSaving, setPwSaving] = useState(false);

  // My ERPs
  const [configs,        setConfigs]        = useState(null);
  const [configsLoading, setConfigsLoading] = useState(false);
  const [deleteTarget,   setDeleteTarget]   = useState(null);
  const [deleting,       setDeleting]       = useState(false);

  // Statistics
  const [stats,        setStats]        = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Register profile scope in Command Palette on mount, restore on unmount
  useEffect(() => {
    setPaletteData(prev => ({
      ...prev,
      scope: 'profile',
      onProfileNavigate: (key) => setSection(key),
    }));
    return () => {
      setPaletteData(prev => ({
        ...prev,
        scope: 'user',
        onProfileNavigate: null,
      }));
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch user profile on mount (company_name + sector_code also returned)
  useEffect(() => {
    userApi.getMe()
      .then(res => {
        setProfileUser(res.data);
        setFullName(res.data.full_name || '');
      })
      .catch(() => {})
      .finally(() => setProfileLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Lazy section data loading
  useEffect(() => {
    if (section === 'erps' && configs === null && !configsLoading) {
      setConfigsLoading(true);
      configurationsApi.list()
        .then(res => setConfigs(res.data))
        .catch(() => setConfigs([]))
        .finally(() => setConfigsLoading(false));
    }
    if (section === 'statistics' && !stats && !statsLoading) {
      setStatsLoading(true);
      userApi.getStats()
        .then(res => setStats(res.data))
        .catch(() => setStats({}))
        .finally(() => setStatsLoading(false));
    }
  }, [section]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mobile drawer scroll lock
  useEffect(() => {
    if (drawerOpen) lock(); else unlock();
    return () => unlock();
  }, [drawerOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Esc closes drawer
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && drawerOpen) setDrawerOpen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [drawerOpen]);

  const handleNavSelect = (key) => { setSection(key); setDrawerOpen(false); };

  // ── Handlers ─────────────────────────────────────────────────────────────

  const isDirty = profileUser && fullName !== (profileUser.full_name || '');

  const handleProfileSave = async () => {
    const trimmed = fullName.trim();
    if (trimmed.length < 2) { toast.error('Name must be at least 2 characters'); return; }
    setProfileSaving(true);
    try {
      const res = await userApi.updateProfile({ full_name: trimmed });
      setProfileUser(prev => ({ ...prev, ...res.data }));
      setFullName(res.data.full_name);
      updateUser({ full_name: res.data.full_name });
      toast.success('Profile updated');
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    const { current, newPw, confirm } = pw;
    if (!current)                                        { toast.error('Enter your current password'); return; }
    if (newPw.length < 8)                                { toast.error('New password must be at least 8 characters'); return; }
    if (!/[A-Za-z]/.test(newPw) || !/\d/.test(newPw))  { toast.error('New password must contain a letter and a number'); return; }
    if (newPw !== confirm)                               { toast.error('Passwords do not match'); return; }
    if (current === newPw)                               { toast.error('New password must differ from current'); return; }

    setPwSaving(true);
    try {
      await userApi.changePassword({ current_password: current, new_password: newPw });
      toast.success('Password updated');
      setPw({ current: '', newPw: '', confirm: '' });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update password');
    } finally {
      setPwSaving(false);
    }
  };

  const handleDeleteConfig = async (configId) => {
    setDeleting(true);
    try {
      await configurationsApi.delete(configId);
      setConfigs(prev => prev.filter(c => c.config_id !== configId));
      setDeleteTarget(null);
      toast.success('ERP configuration deleted');
    } catch {
      toast.error('Failed to delete configuration');
    } finally {
      setDeleting(false);
    }
  };

  // ── Derived values ────────────────────────────────────────────────────────

  const initials = getInitials(profileUser?.full_name, profileUser?.email);
  const strength = pwStrength(pw.newPw);

  const chartData = stats?.records_last_7_days?.map((count, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return { day: DAY_LABELS[d.getDay()], count };
  }) || [];

  const memberDays = stats?.member_since
    ? Math.floor((Date.now() - new Date(stats.member_since).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const peakIdx  = chartData.reduce((best, d, i) => d.count > (chartData[best]?.count || 0) ? i : best, 0);
  const peakDay  = chartData[peakIdx]?.day || '–';
  const avgRec   = chartData.length
    ? (chartData.reduce((s, d) => s + d.count, 0) / chartData.length).toFixed(1)
    : '0';

  // ── SidebarContent (shared between static sidebar and mobile drawer) ──────

  const SidebarContent = () => (
    <>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '0 4px 14px', borderBottom: `1px solid ${t.border}`, marginBottom: 8,
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
          <div style={{
            fontSize: 12.5, fontWeight: 600, color: t.fg, fontFamily: fontStack,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {profileUser?.full_name || user?.full_name || '–'}
          </div>
          <div style={{
            fontSize: 10.5, color: t.fgDim, fontFamily: monoStack,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {profileUser?.email || user?.email || ''}
          </div>
        </div>
      </div>

      {/* Nav items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        {PROFILE_NAV.map(({ key, label, icon }) => {
          const active = section === key;
          return (
            <div
              key={key}
              onClick={() => handleNavSelect(key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px',
                borderRadius: 9, cursor: 'pointer',
                background: active ? (isDark ? 'rgba(124,108,255,0.14)' : 'rgba(99,88,255,0.08)') : 'transparent',
                border: active ? `1px solid ${t.borderStrong}` : '1px solid transparent',
                color: active ? t.fg : t.fgMuted,
                fontSize: 13, fontFamily: fontStack, fontWeight: active ? 500 : 400,
                transition: 'all 0.15s', minHeight: 40, touchAction: 'manipulation',
              }}
            >
              <Icon name={icon} size={14} color={active ? t.primary : t.fgDim} />
              {label}
            </div>
          );
        })}
      </div>

      {/* Back to Dashboard */}
      <div style={{ marginTop: 'auto', paddingTop: 10, borderTop: `1px solid ${t.border}` }}>
        <div
          onClick={() => navigate('/dashboard')}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
            borderRadius: 9, cursor: 'pointer', color: t.fgDim, fontSize: 12.5,
            fontFamily: fontStack, border: `1px solid ${t.border}`,
            transition: 'all 0.15s', touchAction: 'manipulation', marginTop: 10,
          }}
        >
          <Icon name="chevronLeft" size={13} color={t.fgDim} />
          Back to Dashboard
        </div>
      </div>
    </>
  );

  // ── Section renderer ──────────────────────────────────────────────────────

  const renderSection = () => {

    // ── ACCOUNT ──────────────────────────────────────────────────────────────
    if (section === 'account') {
      if (profileLoading) {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Skeleton height={130} />
            <Skeleton height={220} />
          </div>
        );
      }
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Banner */}
          <div style={{
            ...glassPanel(t, theme),
            padding: isMobile ? '20px' : '24px 28px',
            display: 'flex', alignItems: 'center', gap: 22,
            flexWrap: isMobile ? 'wrap' : 'nowrap',
          }}>
            <div style={{
              width: isMobile ? 60 : 80, height: isMobile ? 60 : 80,
              borderRadius: '50%', flexShrink: 0,
              background: `linear-gradient(135deg, ${t.primary}, ${t.accent})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: isMobile ? 20 : 28, fontWeight: 700, color: '#fff',
              fontFamily: 'monospace', boxShadow: `0 8px 24px ${t.primaryGlow}`,
            }}>
              {initials}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: isMobile ? 18 : 22, fontWeight: 700, color: t.fg,
                fontFamily: fontStack, letterSpacing: '-0.03em',
              }}>
                {profileUser?.full_name || '–'}
              </div>
              <div style={{
                fontSize: 12.5, color: t.fgMuted, marginTop: 4,
                fontFamily: monoStack, wordBreak: 'break-all',
              }}>
                {profileUser?.email}
              </div>
              <div style={{
                display: 'flex', gap: 10, marginTop: 10,
                alignItems: 'center', flexWrap: 'wrap',
              }}>
                <span style={{ fontSize: 11, color: t.fgDim, fontFamily: fontStack }}>
                  Member since {fmtMemberDate(profileUser?.created_at)}
                </span>
                <RolePill role={profileUser?.role} t={t} />
              </div>
            </div>
          </div>

          {/* Form */}
          <div style={{
            ...glassPanel(t, theme),
            padding: isMobile ? '20px' : '24px 28px',
            display: 'flex', flexDirection: 'column', gap: 18,
          }}>
            <div style={{
              fontSize: 15, fontWeight: 600, color: t.fg,
              fontFamily: fontStack, letterSpacing: '-0.02em',
            }}>
              Account Details
            </div>

            {/* Full Name */}
            <Field label="Full Name">
              <div style={{
                background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.5)',
                border: `1px solid ${fnFocused ? t.primary : t.border}`,
                borderRadius: 10, display: 'flex', alignItems: 'center',
                boxShadow: fnFocused ? `0 0 0 3px ${t.primaryGlow}` : 'none',
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  onFocus={() => setFnFocused(true)}
                  onBlur={() => setFnFocused(false)}
                  placeholder="Your full name"
                  style={{
                    flex: 1, padding: '11px 14px',
                    background: 'transparent', border: 'none', outline: 'none',
                    color: t.fg, fontSize: 13, fontFamily: fontStack,
                    letterSpacing: '-0.005em',
                  }}
                />
                {isDirty && (
                  <span style={{
                    paddingRight: 12, fontSize: 10,
                    color: t.warn, fontFamily: monoStack, whiteSpace: 'nowrap',
                  }}>
                    unsaved
                  </span>
                )}
              </div>
            </Field>

            {/* Email — read only */}
            <Field label="Email">
              <div style={{
                background: isDark ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.03)',
                border: `1px solid ${t.border}`, borderRadius: 10,
                padding: '11px 14px', color: t.fgMuted, fontSize: 13,
                fontFamily: monoStack, display: 'flex',
                alignItems: 'center', justifyContent: 'space-between', gap: 8,
              }}>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {profileUser?.email}
                </span>
                <span style={{ fontSize: 10.5, color: t.fgDim, fontFamily: fontStack, flexShrink: 0 }}>
                  read-only
                </span>
              </div>
            </Field>

            {/* Company + Sector */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>
              <Field label="Company">
                <div style={{
                  background: isDark ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.03)',
                  border: `1px solid ${t.border}`, borderRadius: 10,
                  padding: '11px 14px', color: t.fgMuted, fontSize: 13, fontFamily: fontStack,
                }}>
                  {profileUser?.company_name || '–'}
                </div>
              </Field>
              <Field label="Sector">
                <div style={{
                  background: isDark ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.03)',
                  border: `1px solid ${t.border}`, borderRadius: 10,
                  padding: '10px 14px', display: 'flex', alignItems: 'center',
                }}>
                  {profileUser?.sector_code ? (
                    <span style={{
                      padding: '3px 10px', borderRadius: 99, fontSize: 11,
                      fontFamily: monoStack, background: `${t.accent}18`,
                      color: t.accent, border: `1px solid ${t.accent}30`,
                    }}>
                      {profileUser.sector_code}
                    </span>
                  ) : (
                    <span style={{ color: t.fgDim, fontSize: 13 }}>–</span>
                  )}
                </div>
              </Field>
            </div>

            {/* Save row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 4 }}>
              <Btn
                variant="primary"
                size="md"
                onClick={handleProfileSave}
                disabled={profileSaving || !isDirty}
              >
                {profileSaving ? 'Saving…' : 'Save Changes'}
              </Btn>
              {isDirty && (
                <span style={{ fontSize: 11, color: t.warn, fontFamily: monoStack }}>
                  You have unsaved changes
                </span>
              )}
            </div>
          </div>
        </div>
      );
    }

    // ── PASSWORD ──────────────────────────────────────────────────────────────
    if (section === 'password') {
      return (
        <div style={{
          ...glassPanel(t, theme),
          padding: isMobile ? '20px' : '24px 28px',
        }}>
          <div style={{ marginBottom: 22 }}>
            <div style={{
              fontSize: 15, fontWeight: 600, color: t.fg,
              fontFamily: fontStack, letterSpacing: '-0.02em',
            }}>
              Change Password
            </div>
            <div style={{ fontSize: 12, color: t.fgMuted, marginTop: 4 }}>
              Keep your account secure with a strong password
            </div>
          </div>

          <form onSubmit={handlePasswordChange} style={{
            display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 420,
          }}>
            <PwField
              label="Current Password"
              value={pw.current}
              onChange={e => setPw(p => ({ ...p, current: e.target.value }))}
              show={pwShow.current}
              onToggle={() => setPwShow(s => ({ ...s, current: !s.current }))}
              placeholder="Enter current password"
              t={t} isDark={isDark}
            />

            <div>
              <PwField
                label="New Password"
                value={pw.newPw}
                onChange={e => setPw(p => ({ ...p, newPw: e.target.value }))}
                show={pwShow.newPw}
                onToggle={() => setPwShow(s => ({ ...s, newPw: !s.newPw }))}
                placeholder="Min 8 chars, letter + number"
                t={t} isDark={isDark}
              />
              {/* Strength bar */}
              {pw.newPw.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    flex: 1, height: 4, borderRadius: 99,
                    background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%', width: `${strength.pct}%`,
                      background: strength.color, borderRadius: 99,
                      transition: 'width 0.3s, background 0.3s',
                    }} />
                  </div>
                  <span style={{
                    fontSize: 10.5, color: strength.color,
                    fontFamily: monoStack, minWidth: 55,
                  }}>
                    {strength.label}
                  </span>
                </div>
              )}
            </div>

            <div>
              <PwField
                label="Confirm New Password"
                value={pw.confirm}
                onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))}
                show={pwShow.confirm}
                onToggle={() => setPwShow(s => ({ ...s, confirm: !s.confirm }))}
                placeholder="Repeat new password"
                t={t} isDark={isDark}
              />
              {pw.confirm.length > 0 && pw.newPw !== pw.confirm && (
                <div style={{ marginTop: 6, fontSize: 11.5, color: t.danger, fontFamily: fontStack }}>
                  Passwords do not match
                </div>
              )}
            </div>

            <div style={{ paddingTop: 4 }}>
              <Btn variant="primary" size="md" type="submit" disabled={pwSaving}>
                {pwSaving ? 'Updating…' : 'Update Password'}
              </Btn>
            </div>
          </form>
        </div>
      );
    }

    // ── MY ERPS ───────────────────────────────────────────────────────────────
    if (section === 'erps') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Header row */}
          <div style={{
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', gap: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 style={{
                fontSize: 18, fontWeight: 700, color: t.fg,
                fontFamily: fontStack, letterSpacing: '-0.03em', margin: 0,
              }}>
                My ERPs
              </h2>
              {configs !== null && (
                <span style={{
                  padding: '2px 9px', borderRadius: 99, fontSize: 11,
                  fontFamily: monoStack, background: 'rgba(128,128,128,0.12)', color: t.fgMuted,
                }}>
                  {configs.length}
                </span>
              )}
            </div>
            <Btn variant="primary" size="sm" icon="plus" onClick={() => navigate('/setup/describe')}>
              New ERP
            </Btn>
          </div>

          {/* Loading skeletons */}
          {configsLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Skeleton height={90} />
              <Skeleton height={90} />
              <Skeleton height={90} />
            </div>
          )}

          {/* Empty state */}
          {!configsLoading && configs?.length === 0 && (
            <EmptyState
              icon="db"
              title="No ERPs yet"
              description="Create your first ERP configuration to get started."
              action={{ label: 'Create ERP', onClick: () => navigate('/setup/describe') }}
            />
          )}

          {/* Config cards */}
          {!configsLoading && configs?.map(cfg => (
            <div key={cfg.config_id} style={{
              ...glassPanel(t, theme),
              padding: '14px 18px',
              display: 'flex', alignItems: 'center', gap: 14,
              flexWrap: isMobile ? 'wrap' : 'nowrap',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  marginBottom: 6, flexWrap: 'wrap',
                }}>
                  <span style={{
                    fontSize: 13.5, fontWeight: 600, color: t.fg,
                    fontFamily: fontStack, letterSpacing: '-0.01em',
                  }}>
                    {cfg.config_name}
                  </span>
                  <StatusPill status={cfg.status} t={t} />
                </div>
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11.5, color: t.fgDim, fontFamily: monoStack }}>
                    {cfg.module_count} module{cfg.module_count !== 1 ? 's' : ''}
                  </span>
                  <span style={{ fontSize: 11.5, color: t.fgDim, fontFamily: monoStack }}>
                    {timeAgo(cfg.created_at)}
                  </span>
                </div>
              </div>
              <div style={{
                display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center',
              }}>
                <Btn variant="soft" size="sm" onClick={() => navigate('/dashboard')}>
                  Open
                </Btn>
                <button
                  onClick={() => setDeleteTarget(cfg)}
                  style={{
                    width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'transparent', border: `1px solid ${t.danger}40`,
                    cursor: 'pointer', touchAction: 'manipulation',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${t.danger}12`; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  title="Delete configuration"
                >
                  <Icon name="close" size={13} color={t.danger} />
                </button>
              </div>
            </div>
          ))}
        </div>
      );
    }

    // ── STATISTICS ────────────────────────────────────────────────────────────
    if (section === 'statistics') {
      if (statsLoading) {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap: 12 }}>
              <Skeleton height={88} />
              <Skeleton height={88} />
              <Skeleton height={88} />
              <Skeleton height={88} />
            </div>
            <Skeleton height={190} />
          </div>
        );
      }

      const statCards = [
        { label: 'Total ERPs',    value: stats?.total_configurations ?? 0, icon: 'db',     color: t.accent   },
        { label: 'Total Modules', value: stats?.total_modules        ?? 0, icon: 'layers', color: t.primary  },
        { label: 'Total Records', value: stats?.total_records        ?? 0, icon: 'list',   color: t.success  },
        { label: 'Member For',    value: `${memberDays}d`,                  icon: 'cal',    color: t.warn     },
      ];

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Stat cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)',
            gap: 12,
          }}>
            {statCards.map(({ label, value, icon, color }) => (
              <div key={label} style={{
                ...glassPanel(t, theme), padding: '16px 18px', borderRadius: 14,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 9,
                  background: `${color}18`, border: `1px solid ${color}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 10,
                }}>
                  <Icon name={icon} size={15} color={color} />
                </div>
                <div style={{
                  fontSize: isMobile ? 22 : 26, fontWeight: 700, color: t.fg,
                  fontFamily: fontStack, letterSpacing: '-0.04em', lineHeight: 1,
                }}>
                  {value}
                </div>
                <div style={{
                  fontSize: 11, color: t.fgDim, fontFamily: monoStack, marginTop: 4,
                }}>
                  {label}
                </div>
              </div>
            ))}
          </div>

          {/* 7-day sparkline */}
          <div style={{ ...glassPanel(t, theme), padding: '18px 20px' }}>
            <div style={{
              display: 'flex', alignItems: 'flex-start',
              justifyContent: 'space-between', marginBottom: 14, gap: 10,
            }}>
              <div>
                <div style={{
                  fontSize: 13, fontWeight: 600, color: t.fg, fontFamily: fontStack,
                }}>
                  Records added · Last 7 Days
                </div>
                <div style={{ fontSize: 11, color: t.fgDim, marginTop: 3, fontFamily: monoStack }}>
                  Peak: {peakDay} · Avg: {avgRec}/day
                </div>
              </div>
            </div>
            <div key={theme}>
              <ResponsiveContainer width="100%" height={130}>
                <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -24 }}>
                  <defs>
                    <linearGradient id={`profGrad-${theme}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={t.primary} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={t.primary} stopOpacity={0}    />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 10, fill: t.fgDim, fontFamily: monoStack }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis hide />
                  <Tooltip content={<GlassTooltip t={t} theme={theme} />} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke={t.primary}
                    strokeWidth={2}
                    fill={`url(#profGrad-${theme})`}
                    dot={false}
                    name="Records"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <GlassRoot>
      {/* TopBar */}
      <div style={{
        position: 'absolute',
        top: 'max(16px, calc(env(safe-area-inset-top, 0px) + 8px))',
        left: 16, right: 16, zIndex: 3,
      }}>
        <TopBar onHamburger={isMobile ? () => setDrawerOpen(true) : undefined} />
      </div>

      {/* Main layout */}
      <div style={{
        position: 'absolute', top: 80, left: 0, right: 0, bottom: 0,
        zIndex: 2, display: 'flex', overflow: 'hidden',
      }}>
        {/* Static sidebar — desktop only */}
        {!isMobile && (
          <div style={{
            width: 260, flexShrink: 0, overflow: 'auto',
            display: 'flex', flexDirection: 'column',
            padding: '16px 12px',
            borderRight: `1px solid ${t.border}`,
            background: isDark ? 'rgba(10,10,18,0.55)' : 'rgba(248,248,252,0.6)',
            backdropFilter: 'blur(12px)',
          }}>
            <SidebarContent />
          </div>
        )}

        {/* Section content */}
        <div style={{
          flex: 1, overflow: 'auto',
          padding: isMobile ? '16px 16px 48px' : '24px 28px 48px',
        }}>
          {renderSection()}
        </div>
      </div>

      {/* Delete confirm modal */}
      {deleteTarget && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 400,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          }}
          onClick={e => e.target === e.currentTarget && setDeleteTarget(null)}
        >
          <div style={{ ...glassPanel(t, theme), padding: 24, maxWidth: 360, width: 'calc(100% - 32px)' }}>
            <div style={{
              fontSize: 15, fontWeight: 600, color: t.fg,
              fontFamily: fontStack, marginBottom: 10,
            }}>
              Delete ERP?
            </div>
            <div style={{
              fontSize: 13, color: t.fgMuted, marginBottom: 20, lineHeight: 1.55,
            }}>
              Delete <strong style={{ color: t.fg }}>{deleteTarget.config_name}</strong>?
              {' '}This will remove all modules and records permanently.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Btn variant="ghost" size="sm" onClick={() => setDeleteTarget(null)}>Cancel</Btn>
              <Btn
                variant="danger"
                size="sm"
                onClick={() => handleDeleteConfig(deleteTarget.config_id)}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* Mobile sidebar drawer — AdminPage pattern */}
      {drawerOpen && (
        <div
          className="modal-scroll-contain"
          style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex' }}
        >
          <div
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }}
            onClick={() => setDrawerOpen(false)}
          />
          <div style={{
            position: 'relative', zIndex: 51, width: 280,
            background: isDark ? '#0a0a12' : '#f7f7fb',
            overflow: 'auto', display: 'flex', flexDirection: 'column',
            padding: '16px 12px',
            animation: 'slideInLeft 0.25s ease-out',
            paddingTop: 'max(16px, calc(env(safe-area-inset-top, 0px) + 12px))',
            paddingBottom: 'max(10px, calc(env(safe-area-inset-bottom, 0px) + 10px))',
            overscrollBehavior: 'contain',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', marginBottom: 14,
            }}>
              <span style={{
                fontSize: 12.5, fontWeight: 600, color: t.fg, fontFamily: fontStack,
              }}>
                My Profile
              </span>
              <button
                onClick={() => setDrawerOpen(false)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: t.fgMuted, display: 'flex', padding: 8,
                  touchAction: 'manipulation',
                }}
              >
                <Icon name="close" size={16} />
              </button>
            </div>
            <SidebarContent />
          </div>
        </div>
      )}
    </GlassRoot>
  );
}
