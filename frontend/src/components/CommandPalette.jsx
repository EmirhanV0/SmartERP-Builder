import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCommandPalette } from '../contexts/CommandPaletteContext';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useViewport } from '../hooks/useViewport';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { themes, glassPanel, fontStack, monoStack } from '../design-system/tokens';
import Icon from '../design-system/Icon';
import { translateLabel } from '../utils/translateLabel';

function fuzzyMatch(query, text) {
  if (!query) return true;
  return String(text).toLowerCase().includes(query.toLowerCase());
}

const CAT_COLOR = { MODULE: '#7c6cff', RECORD: '#22d3ee', FIELD: '#34d399', ACTION: '#fbbf24' };
const CAT_LABEL = { MODULE: 'Module', RECORD: 'Record', FIELD: 'Field', ACTION: 'Action' };
const CAT_ICON  = { MODULE: 'layers', RECORD: 'file', FIELD: 'grid', ACTION: 'bolt' };

const ADMIN_CAT_COLOR = {
  TENANT: '#a855f7', USER: '#3b82f6', CONFIG: '#7c6cff',
  AILOG: '#22d3ee', DIAG: '#ef4444', ACTION: '#fbbf24',
};
const ADMIN_CAT_LABEL = {
  TENANT: 'Company', USER: 'User', CONFIG: 'Config',
  AILOG: 'AI Log', DIAG: 'Diagnostic', ACTION: 'Action',
};
const ADMIN_CAT_ICON = {
  TENANT: 'db', USER: 'users', CONFIG: 'settings',
  AILOG: 'brain', DIAG: 'activity', ACTION: 'bolt',
};

const PROFILE_CAT_COLOR = { SECTION: '#7c6cff', ACTION: '#fbbf24' };
const PROFILE_CAT_LABEL = { SECTION: 'Section', ACTION: 'Action' };
const PROFILE_CAT_ICON  = { SECTION: 'user', ACTION: 'bolt' };

const PROFILE_SECTIONS = [
  { id: 'prof-account',    title: 'Account',    nav: 'account'    },
  { id: 'prof-password',   title: 'Password',   nav: 'password'   },
  { id: 'prof-erps',       title: 'My ERPs',    nav: 'erps'       },
  { id: 'prof-statistics', title: 'Statistics', nav: 'statistics' },
];

const PROFILE_ACTIONS = [
  { id: 'pact-dashboard', title: 'Back to Dashboard', action: 'dashboard' },
  { id: 'pact-logout',    title: 'Logout',             action: 'logout'    },
];

const ADMIN_NAV_ACTIONS = [
  { id: 'adm-overview', title: 'Go to Overview',       nav: 'overview'    },
  { id: 'adm-users',    title: 'Go to Users',           nav: 'users'       },
  { id: 'adm-tenants',  title: 'Go to Companies',       nav: 'tenants'     },
  { id: 'adm-configs',  title: 'Go to Configurations',  nav: 'configurations' },
  { id: 'adm-logs',     title: 'Go to AI Logs',         nav: 'logs'        },
  { id: 'adm-diag',     title: 'Go to Diagnostics',     nav: 'diagnostics' },
  { id: 'adm-dash',     title: 'Back to Dashboard',     nav: 'dashboard'   },
  { id: 'adm-logout',   title: 'Logout',                nav: 'logout'      },
];

export default function CommandPalette() {
  const { isOpen, closePalette, paletteData } = useCommandPalette();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { isMobile } = useViewport();
  const { lock, unlock } = useBodyScrollLock();
  const t = themes[theme];
  const isDark = theme === 'dark';

  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const {
    modules, records, fields, isAdmin,
    onSelectModule, onOpenRecord, onOpenAddModule,
    scope = 'user', adminCache, onAdminNavigate, onProfileNavigate,
  } = paletteData;

  useEffect(() => {
    if (!isOpen) {
      unlock();
      return;
    }
    lock();
    setQuery('');
    setActiveIdx(0);
    const timer = setTimeout(() => inputRef.current?.focus(), 30);
    return () => {
      clearTimeout(timer);
      unlock();
    };
  }, [isOpen]);

  const results = useMemo(() => {
    const items = [];
    const q = query.trim();

    if (scope === 'admin' && adminCache) {
      (adminCache.tenants || [])
        .filter(t => fuzzyMatch(q, t.company_name) || fuzzyMatch(q, t.sector_code))
        .slice(0, 4)
        .forEach(t => items.push({
          type: 'TENANT', id: `tnt-${t.tenant_id}`,
          title: t.company_name,
          subtitle: `Company · ${t.sector_code || '–'}`,
          nav: 'tenants',
        }));

      (adminCache.users || [])
        .filter(u => fuzzyMatch(q, u.email) || fuzzyMatch(q, u.full_name) || fuzzyMatch(q, u.tenant_name))
        .slice(0, 4)
        .forEach(u => items.push({
          type: 'USER', id: `usr-${u.user_id}`,
          title: u.full_name || u.email,
          subtitle: `User · ${u.email}`,
          nav: 'users',
        }));

      if (q) {
        (adminCache.configurations || [])
          .filter(c => fuzzyMatch(q, c.tenant_name) || fuzzyMatch(q, c.status) || fuzzyMatch(q, String(c.config_id)))
          .slice(0, 3)
          .forEach(c => items.push({
            type: 'CONFIG', id: `cfg-${c.config_id}`,
            title: `${c.tenant_name} — ${c.status}`,
            subtitle: `Config #${c.config_id}`,
            nav: 'configurations',
          }));
      }

      if (q) {
        (adminCache.logs || [])
          .filter(l => fuzzyMatch(q, l.raw_input) || fuzzyMatch(q, l.tenant_name))
          .slice(0, 3)
          .forEach(l => items.push({
            type: 'AILOG', id: `log-${l.log_id}`,
            title: String(l.raw_input || '').slice(0, 60),
            subtitle: `AI Log · ${l.tenant_name || '–'}`,
            nav: 'logs',
          }));
      }

      if (q) {
        (adminCache.diagnostics || [])
          .filter(d => fuzzyMatch(q, d.error_signature) || fuzzyMatch(q, d.failure_stage))
          .slice(0, 3)
          .forEach(d => items.push({
            type: 'DIAG', id: `diag-${d.diag_id}`,
            title: String(d.error_signature || '').split(':')[0].slice(0, 60),
            subtitle: `Diagnostic · ${d.failure_stage}`,
            nav: 'diagnostics',
          }));
      }

      ADMIN_NAV_ACTIONS
        .filter(a => !q || fuzzyMatch(q, a.title))
        .forEach(a => items.push({ type: 'ACTION', ...a, subtitle: 'Action' }));

      return items.slice(0, 20);
    }

    if (scope === 'profile') {
      PROFILE_SECTIONS
        .filter(s => !q || fuzzyMatch(q, s.title))
        .forEach(s => items.push({ type: 'SECTION', ...s, subtitle: 'Section' }));

      PROFILE_ACTIONS
        .filter(a => !q || fuzzyMatch(q, a.title))
        .forEach(a => items.push({ type: 'ACTION', ...a, subtitle: 'Action' }));

      return items.slice(0, 20);
    }

    modules
      .filter(m => fuzzyMatch(q, translateLabel(m.display_name || m.module_name)))
      .forEach(m => {
        items.push({
          type: 'MODULE', id: `mod-${m.map_id}`,
          title: translateLabel(m.display_name || m.module_name),
          subtitle: 'Module', data: m,
        });
      });

    if (q) {
      records
        .filter(rec => {
          try { return JSON.stringify(rec.data_payload || '').toLowerCase().includes(q.toLowerCase()); }
          catch { return false; }
        })
        .slice(0, 5)
        .forEach(rec => {
          const payload = rec.data_payload || {};
          const first = Object.values(payload).find(v => typeof v === 'string' && v.trim()) || 'Record';
          items.push({
            type: 'RECORD', id: `rec-${rec.record_id}`,
            title: String(first).slice(0, 48), subtitle: 'Record', data: rec,
          });
        });
    }

    if (q) {
      fields
        .filter(f => {
          const name = f.name || String(f);
          const label = translateLabel(f.label || name);
          return fuzzyMatch(q, label) || fuzzyMatch(q, name);
        })
        .slice(0, 4)
        .forEach(f => {
          const name = f.name || String(f);
          const label = translateLabel(f.label || name);
          items.push({
            type: 'FIELD', id: `field-${name}`,
            title: label, subtitle: `Field · ${name}`, data: f,
          });
        });
    }

    const actionList = [
      { id: 'act-add-mod',  title: 'Add new module',    action: 'add-module' },
      { id: 'act-new-erp',  title: 'Add new ERP',       action: 'new-erp'   },
      { id: 'act-switch',   title: 'Switch ERP',         action: 'switch-erp'},
      ...(isAdmin ? [{ id: 'act-admin', title: 'Go to Admin Panel', action: 'admin' }] : []),
      { id: 'act-logout',   title: 'Logout',             action: 'logout'    },
    ].filter(a => !q || fuzzyMatch(q, a.title));

    actionList.forEach(a => items.push({ type: 'ACTION', ...a, subtitle: 'Action' }));

    return items.slice(0, 20);
  }, [query, modules, records, fields, isAdmin, scope, adminCache]);

  const handleSelect = useCallback((item) => {
    closePalette();

    if (item.type === 'SECTION') {
      if (onProfileNavigate) onProfileNavigate(item.nav);
      return;
    }

    if (['TENANT', 'USER', 'CONFIG', 'AILOG', 'DIAG'].includes(item.type)) {
      if (onAdminNavigate) onAdminNavigate(item.nav);
      return;
    }

    if (item.type === 'ACTION' && item.nav) {
      if (onAdminNavigate) onAdminNavigate(item.nav);
      return;
    }

    if (item.type === 'MODULE') {
      if (onSelectModule) onSelectModule(item.data);
      else navigate('/dashboard');
    } else if (item.type === 'RECORD') {
      if (onOpenRecord) onOpenRecord(item.data);
      else navigate('/dashboard');
    } else if (item.type === 'FIELD') {
      navigate('/dashboard');
    } else if (item.type === 'ACTION') {
      switch (item.action) {
        case 'add-module':
          if (onOpenAddModule) onOpenAddModule();
          else navigate('/dashboard');
          break;
        case 'new-erp':    navigate('/setup/describe'); break;
        case 'switch-erp': navigate('/dashboard');      break;
        case 'dashboard':  navigate('/dashboard');      break;
        case 'admin':      navigate('/admin');           break;
        case 'logout':
          logout();
          navigate('/login');
          break;
        default: break;
      }
    }
  }, [closePalette, navigate, onSelectModule, onOpenRecord, onOpenAddModule, logout, onAdminNavigate, onProfileNavigate]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') { closePalette(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[activeIdx]) handleSelect(results[activeIdx]);
    }
  }, [results, activeIdx, closePalette, handleSelect]);

  useEffect(() => {
    listRef.current?.children[activeIdx]?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  useEffect(() => { setActiveIdx(0); }, [results]);

  if (!isOpen) return null;

  const inputRowPaddingTop = isMobile
    ? 'max(14px, calc(env(safe-area-inset-top, 0px) + 14px))'
    : '14px';

  const listBottomPadding = isMobile
    ? 'max(16px, calc(env(safe-area-inset-bottom, 0px) + 12px))'
    : '6px';

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        display: 'flex',
        alignItems: isMobile ? 'flex-start' : 'flex-start',
        justifyContent: 'center',
        paddingTop: isMobile ? 0 : '13vh',
        background: isDark ? 'rgba(0,0,0,0.72)' : 'rgba(14,14,26,0.42)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        animation: 'fadeIn 0.15s ease',
      }}
      onClick={e => { if (e.target === e.currentTarget) closePalette(); }}
    >
      <div
        style={{
          ...glassPanel(t, theme),
          ...(isMobile ? { borderRadius: 0 } : {}),
          width: '100%',
          maxWidth: isMobile ? '100%' : 'min(95vw, 640px)',
          margin: isMobile ? 0 : '0 16px',
          height: isMobile ? '100dvh' : 'auto',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          animation: isMobile ? 'slideInRight 0.2s ease-out' : 'scaleIn 0.15s cubic-bezier(0.22,1,0.36,1)',
        }}
      >
        {/* Search input row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          paddingTop: inputRowPaddingTop,
          paddingRight: 16, paddingBottom: 14, paddingLeft: 16,
          borderBottom: `1px solid ${t.border}`,
          flexShrink: 0,
        }}>
          <Icon name="search" size={16} color={t.fgDim} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              scope === 'admin'   ? 'Search users, tenants, configs, logs, diagnostics…' :
              scope === 'profile' ? 'Jump to section, or search actions…' :
              'Search modules, records, fields, actions…'
            }
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: t.fg, fontSize: 13.5, fontFamily: fontStack, letterSpacing: '-0.005em',
              minHeight: isMobile ? 48 : undefined,
            }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{ padding: 6, background: 'none', border: 'none', cursor: 'pointer', color: t.fgDim, display: 'flex', touchAction: 'manipulation', minWidth: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name="close" size={15} />
            </button>
          )}
          {isMobile ? (
            <button
              onClick={closePalette}
              style={{
                padding: '6px 12px', background: 'none', border: `1px solid ${t.border}`,
                borderRadius: 8, cursor: 'pointer', color: t.fgMuted,
                fontSize: 12, fontFamily: monoStack, touchAction: 'manipulation',
                flexShrink: 0,
              }}
            >
              Cancel
            </button>
          ) : (
            <kbd style={{
              padding: '2px 7px',
              background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
              borderRadius: 5, fontSize: 10, fontFamily: monoStack, color: t.fgDim, flexShrink: 0,
            }}>
              ESC
            </kbd>
          )}
        </div>

        {/* Results */}
        <div
          ref={listRef}
          className="modal-scroll-contain"
          style={{
            flex: isMobile ? 1 : undefined,
            maxHeight: isMobile ? undefined : 380,
            overflowY: 'auto',
            paddingTop: 6,
            paddingBottom: listBottomPadding,
          }}
        >
          {results.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 12.5, color: t.fgMuted, fontFamily: fontStack }}>
                {query ? `No results for "${query}"` : 'No results'}
              </div>
            </div>
          ) : (
            results.map((item, idx) => {
              const colorMap = scope === 'admin' ? ADMIN_CAT_COLOR : scope === 'profile' ? PROFILE_CAT_COLOR : CAT_COLOR;
              const labelMap = scope === 'admin' ? ADMIN_CAT_LABEL : scope === 'profile' ? PROFILE_CAT_LABEL : CAT_LABEL;
              const iconMap  = scope === 'admin' ? ADMIN_CAT_ICON  : scope === 'profile' ? PROFILE_CAT_ICON  : CAT_ICON;
              const catColor = colorMap[item.type] || t.primary;
              const catLabel = labelMap[item.type] || item.type;
              const catIcon  = iconMap[item.type]  || 'bolt';
              const isActive = idx === activeIdx;
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setActiveIdx(idx)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: isMobile ? '12px 16px' : '9px 14px',
                    cursor: 'pointer',
                    background: isActive
                      ? (isDark ? 'rgba(124,108,255,0.13)' : 'rgba(99,88,255,0.07)')
                      : 'transparent',
                    transition: 'background 0.08s',
                    touchAction: 'manipulation',
                  }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: `${catColor}18`, border: `1px solid ${catColor}33`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon name={catIcon} size={14} color={catColor} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: isMobile ? 14 : 13, color: t.fg, fontFamily: fontStack,
                      fontWeight: isActive ? 500 : 400,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {item.title}
                    </div>
                    {item.subtitle && (
                      <div style={{ fontSize: 10.5, color: t.fgDim, fontFamily: monoStack, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.subtitle}
                      </div>
                    )}
                  </div>

                  <span style={{
                    fontSize: 9.5, fontFamily: monoStack, padding: '2px 7px', borderRadius: 99,
                    background: `${catColor}18`, color: catColor, border: `1px solid ${catColor}33`,
                    flexShrink: 0, whiteSpace: 'nowrap',
                  }}>
                    {catLabel}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer hints — desktop only */}
        {!isMobile && (
          <div style={{
            padding: '8px 16px 10px',
            borderTop: `1px solid ${t.border}`,
            display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
          }}>
            {[['↑↓', 'navigate'], ['↵', 'select'], ['esc', 'close']].map(([k, l]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <kbd style={{
                  padding: '2px 6px',
                  background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
                  borderRadius: 4, fontSize: 10, fontFamily: monoStack, color: t.fgMuted,
                }}>{k}</kbd>
                <span style={{ fontSize: 10, color: t.fgDim, fontFamily: monoStack }}>{l}</span>
              </div>
            ))}
            <span style={{ marginLeft: 'auto', fontSize: 10, color: t.fgDim, fontFamily: monoStack }}>
              {results.length} result{results.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
