import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { Skeleton } from '../design-system/Skeleton';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useCommandPalette } from '../contexts/CommandPaletteContext';
import { useViewport } from '../hooks/useViewport';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { themes, glassPanel, fontStack, monoStack } from '../design-system/tokens';
import { GlassRoot, TopBar } from '../design-system/components';
import Icon from '../design-system/Icon';
import { adminApi } from '../services/api';
import { timeAgo } from '../utils/timeAgo';

// -- Severity helper --------------------------------------------------
function getSeverity(stage) {
  if (stage === 'AI')     return 'HIGH';
  if (stage === 'DDL')    return 'MED';
  if (stage === 'DELETE') return 'LOW';
  return 'LOW';
}

function SeverityBadge({ stage }) {
  const map = {
    HIGH: { bg: '#ef444422', color: '#ef4444', label: 'HIGH' },
    MED:  { bg: '#f59e0b22', color: '#f59e0b', label: 'MED'  },
    LOW:  { bg: '#22c55e22', color: '#22c55e', label: 'LOW'  },
  };
  const s = map[getSeverity(stage)] || map.LOW;
  return (
    <span style={{ padding: '2px 7px', borderRadius: 99, fontSize: 9.5, fontFamily: monoStack, fontWeight: 700, background: s.bg, color: s.color, border: `1px solid ${s.color}35` }}>
      {s.label}
    </span>
  );
}

function SectorPill({ code, t }) {
  if (!code) return <span style={{ color: t.fgDim }}>–</span>;
  const label = code.charAt(0).toUpperCase() + code.slice(1).toLowerCase().replace(/_/g, ' ');
  return (
    <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontFamily: monoStack, background: `${t.accent}18`, color: t.accent, border: `1px solid ${t.accent}30` }}>
      {label}
    </span>
  );
}

const NAV_ITEMS = [
  { key: 'overview',       label: 'Overview',       icon: 'chart'    },
  { key: 'users',          label: 'Users',           icon: 'users'    },
  { key: 'tenants',        label: 'Companies',       icon: 'db'       },
  { key: 'configurations', label: 'Configurations',  icon: 'settings' },
  { key: 'logs',           label: 'AI Logs',         icon: 'brain'    },
  { key: 'diagnostics',    label: 'Diagnostics',     icon: 'activity' },
];

const PAGE_SIZE = 20;


function fmtDate(iso) {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

function truncate(str, len = 80) {
  if (!str) return '–';
  const s = String(str);
  return s.length > len ? s.slice(0, len) + '…' : s;
}

// ── Badge components ─────────────────────────────────────────────────

function StageBadge({ stage }) {
  const map = {
    AI:     { bg: '#ef444422', color: '#ef4444', border: '#ef444435' },
    DDL:    { bg: '#f59e0b22', color: '#f59e0b', border: '#f59e0b35' },
    DELETE: { bg: '#eab30822', color: '#eab308', border: '#eab30835' },
  };
  const s = map[stage] || { bg: 'rgba(128,128,128,0.12)', color: '#888', border: 'transparent' };
  return (
    <span style={{ padding: '2px 7px', borderRadius: 99, fontSize: 10, fontFamily: monoStack, fontWeight: 600, background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {stage}
    </span>
  );
}

function RoleBadge({ role, t }) {
  const isAdmin = role === 'admin';
  return (
    <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontFamily: monoStack, background: isAdmin ? `${t.primary}22` : 'rgba(128,128,128,0.1)', color: isAdmin ? t.primary : t.fgMuted, border: `1px solid ${isAdmin ? `${t.primary}35` : 'transparent'}` }}>
      {isAdmin ? 'admin' : 'user'}
    </span>
  );
}

function StatusBadge({ status, t }) {
  const map = { active: t.success, approved: t.accent, draft: t.fgDim, pending_approval: t.warn };
  const color = map[status] || t.fgDim;
  return (
    <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontFamily: monoStack, background: `${color}18`, color, border: `1px solid ${color}30` }}>
      {status}
    </span>
  );
}

function AmbiguityBadge({ flag, t }) {
  const color = flag ? t.warn : t.success;
  return (
    <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontFamily: monoStack, background: `${color}18`, color, border: `1px solid ${color}30` }}>
      {flag ? 'ambiguous' : 'clear'}
    </span>
  );
}

function SectionHeader({ title, count, t }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: t.fg, fontFamily: fontStack, letterSpacing: '-0.03em', margin: 0 }}>{title}</h2>
      {count != null && (
        <span style={{ padding: '2px 9px', borderRadius: 99, fontSize: 11, fontFamily: monoStack, background: 'rgba(128,128,128,0.12)', color: t.fgMuted }}>{count}</span>
      )}
    </div>
  );
}

// ── OverviewSection ──────────────────────────────────────────────────

const SECTOR_COLORS = ['#7c6cff','#06b6d4','#22c55e','#f59e0b','#ef4444','#a855f7','#ec4899','#14b8a6','#f97316','#6b7280'];

function OverviewSection({ data, analytics, analyticsLoading, t, theme, isDark, isMobile, isTablet }) {
  if (!data) return (
    <div style={{ textAlign: 'center', padding: 60, color: t.fgDim, fontSize: 13, fontFamily: fontStack }}>No data available.</div>
  );

  const cards = [
    { label: 'Companies',      value: data.total_tenants,      icon: 'db',       color: t.accent  },
    { label: 'Users',          value: data.total_users,        icon: 'users',    color: t.primary },
    { label: 'Configurations', value: data.total_configs,      icon: 'settings', color: '#a855f7' },
    { label: 'Records',        value: data.total_records,      icon: 'list',     color: t.success },
    { label: 'Analyses (7d)',  value: data.recent_analyses_7d, icon: 'activity', color: t.warn    },
  ];

  const maxRecords = analytics.topTenants?.[0]?.total_records || 1;
  const tooltipStyle = { background: isDark ? 'rgba(20,20,32,0.97)' : 'rgba(255,255,255,0.97)', border: `1px solid ${t.border}`, borderRadius: 10, fontSize: 12, fontFamily: fontStack, color: t.fg, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' };

  return (
    <div>
      <SectionHeader title="Overview" t={t} />

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
        {cards.map(({ label, value, icon, color }) => (
          <div key={label} style={{ ...glassPanel(t, theme), padding: '16px 18px' }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, marginBottom: 12, background: `${color}18`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={icon} size={15} color={color} />
            </div>
            <div style={{ fontSize: 30, fontWeight: 700, color: t.fg, fontFamily: fontStack, letterSpacing: '-0.04em', lineHeight: 1 }}>{value ?? 0}</div>
            <div style={{ fontSize: 11, color: t.fgMuted, fontFamily: fontStack, marginTop: 5 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Daily analyses bar chart */}
      {data.daily_analyses?.length > 0 ? (
        <div key={theme} style={{ ...glassPanel(t, theme), padding: '20px 20px 12px', marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: t.fg, fontFamily: fontStack, marginBottom: 16, letterSpacing: '-0.01em' }}>
            AI Analyses — Last 7 Days
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.daily_analyses} margin={{ top: 4, right: 8, bottom: 4, left: -10 }}>
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: t.fgDim, fontFamily: monoStack }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: t.fgDim, fontFamily: monoStack }} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
              <Tooltip contentStyle={tooltipStyle} formatter={(val) => [val, 'Analyses']} />
              <Bar dataKey="count" fill={t.primary} radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div style={{ ...glassPanel(t, theme), padding: 40, textAlign: 'center', color: t.fgDim, fontSize: 13, fontFamily: fontStack, marginBottom: 20 }}>
          No AI analyses in the last 7 days.
        </div>
      )}

      {/* Analytics charts row */}
      {analyticsLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? '1fr 1fr' : '1fr 1fr 1fr', gap: 16 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ ...glassPanel(t, theme), padding: 20 }}>
              <Skeleton height={12} width="50%" style={{ marginBottom: 16 }} />
              <Skeleton height={160} />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? '1fr 1fr' : '1fr 1fr 1fr', gap: 16 }}>

          {/* Sector Distribution — Donut */}
          {analytics.sectorDistribution?.length > 0 && (
            <div key={`sector-${theme}`} style={{ ...glassPanel(t, theme), padding: '16px 16px 14px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: t.fg, fontFamily: fontStack, marginBottom: 14, letterSpacing: '-0.01em' }}>
                Sector Distribution
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <PieChart width={110} height={110}>
                  <Pie data={analytics.sectorDistribution} dataKey="count" nameKey="sector" cx="50%" cy="50%" innerRadius={30} outerRadius={50} paddingAngle={2} strokeWidth={0}>
                    {analytics.sectorDistribution.map((entry, idx) => (
                      <Cell key={entry.sector} fill={SECTOR_COLORS[idx % SECTOR_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {analytics.sectorDistribution.slice(0, 6).map((entry, idx) => (
                    <div key={entry.sector} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: SECTOR_COLORS[idx % SECTOR_COLORS.length] }} />
                      <span style={{ fontSize: 10.5, color: t.fgMuted, fontFamily: monoStack, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {entry.sector}
                      </span>
                      <span style={{ fontSize: 10.5, color: t.fgDim, fontFamily: monoStack }}>{entry.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Top Tenants — Leaderboard */}
          {analytics.topTenants?.length > 0 && (
            <div style={{ ...glassPanel(t, theme), padding: '16px 16px 14px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: t.fg, fontFamily: fontStack, marginBottom: 14, letterSpacing: '-0.01em' }}>
                Top Companies by Records
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {analytics.topTenants.map((tenant, idx) => (
                  <div key={tenant.tenant_id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontFamily: monoStack, color: t.fgDim, minWidth: 14 }}>#{idx + 1}</span>
                      <span style={{ fontSize: 11.5, color: t.fg, fontFamily: fontStack, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                        {tenant.company_name}
                      </span>
                      <span style={{ fontSize: 10.5, color: t.fgMuted, fontFamily: monoStack }}>{tenant.total_records}</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 99, background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 99, width: `${Math.round((tenant.total_records / maxRecords) * 100)}%`, background: `linear-gradient(90deg, ${t.primary}, ${t.accent})`, transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Confidence Distribution — Histogram */}
          {analytics.confidenceDistribution?.length > 0 && (
            <div key={`conf-${theme}`} style={{ ...glassPanel(t, theme), padding: '16px 16px 12px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: t.fg, fontFamily: fontStack, marginBottom: 14, letterSpacing: '-0.01em' }}>
                AI Confidence (last 30d)
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={analytics.confidenceDistribution} margin={{ top: 4, right: 4, bottom: 4, left: -16 }}>
                  <XAxis dataKey="bucket" tick={{ fontSize: 9, fill: t.fgDim, fontFamily: monoStack }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: t.fgDim, fontFamily: monoStack }} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
                  <Tooltip contentStyle={{ ...tooltipStyle, fontSize: 11 }} formatter={(val) => [val, 'Configs']} />
                  <Bar dataKey="count" fill={t.accent} radius={[3, 3, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

// ── TableSection ─────────────────────────────────────────────────────

function TableSection({ title, data, t, isDark, columns }) {
  const [query, setQuery] = useState('');
  const [page, setPage]   = useState(1);

  if (!data) return (
    <div style={{ textAlign: 'center', padding: 60, color: t.fgDim, fontSize: 13, fontFamily: fontStack }}>No data available.</div>
  );

  const q        = query.trim().toLowerCase();
  const filtered = q ? data.filter(row => Object.values(row).some(v => v != null && String(v).toLowerCase().includes(q))) : data;
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged    = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <SectionHeader title={title} count={filtered.length} t={t} />

      <div style={{ position: 'relative', marginBottom: 14 }}>
        <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
          <Icon name="search" size={13} color={t.fgDim} />
        </div>
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setPage(1); }}
          placeholder={`Search ${title.toLowerCase()}…`}
          style={{ width: '100%', padding: '9px 14px 9px 34px', background: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.6)', border: `1px solid ${t.border}`, borderRadius: 10, color: t.fg, fontSize: 13, fontFamily: fontStack, outline: 'none', boxSizing: 'border-box' }}
        />
      </div>

      {paged.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: t.fgDim, fontSize: 13, fontFamily: fontStack, border: `1.5px dashed ${t.border}`, borderRadius: 14 }}>
          {q ? 'No results match your search.' : 'No data found.'}
        </div>
      ) : (
        <div style={{ background: isDark ? 'rgba(20,20,32,0.55)' : 'rgba(255,255,255,0.65)', backdropFilter: 'blur(24px)', border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.6)'}`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: fontStack }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                  {columns.map(({ key, label }) => (
                    <th key={key} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10.5, fontWeight: 600, color: t.fgDim, fontFamily: monoStack, letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap', background: isDark ? 'rgba(255,255,255,0.025)' : 'rgba(15,15,30,0.025)' }}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map((row, i) => (
                  <tr key={i} style={{ borderBottom: i < paged.length - 1 ? `1px solid ${t.border}` : 'none' }}
                    onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.025)' : 'rgba(15,15,30,0.025)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {columns.map(({ key, render, wrap }) => (
                      <td key={key} title={!render ? String(row[key] ?? '–') : undefined} style={{ padding: '10px 14px', fontSize: 12.5, color: t.fg, maxWidth: wrap ? 260 : 200, overflow: 'hidden', textOverflow: wrap ? 'clip' : 'ellipsis', wordBreak: wrap ? 'break-word' : 'normal', whiteSpace: wrap ? 'normal' : 'nowrap' }}>
                        {render ? render(row[key]) : String(row[key] ?? '–')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderTop: `1px solid ${t.border}`, fontSize: 11.5, color: t.fgMuted, fontFamily: monoStack }}>
              <span>{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <div key={p} onClick={() => setPage(p)} style={{ width: 28, height: 28, borderRadius: 7, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, background: p === page ? `linear-gradient(135deg, ${t.primary}, ${t.accent})` : 'transparent', color: p === page ? '#fff' : t.fgMuted, border: p === page ? '1px solid transparent' : `1px solid ${t.border}`, touchAction: 'manipulation' }}>
                    {p}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── DiagnosticsSection ───────────────────────────────────────────────

function DiagnosticsSection({ data, onResolve, t, isDark, isMobile }) {
  const [filter, setFilter]       = useState('all');
  const [selected, setSelected]   = useState(null);
  const [localItems, setLocalItems] = useState(null);
  const [resolving, setResolving] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false); // mobile full-screen modal

  const { lock, unlock } = useBodyScrollLock();

  useEffect(() => {
    if (data !== undefined) {
      setLocalItems(data || []);
      if (!selected && data?.length) setSelected(data[0].diag_id);
    }
  }, [data]); // eslint-disable-line

  // Scroll lock when mobile detail modal is open
  useEffect(() => {
    if (isMobile && detailOpen) { lock(); } else { unlock(); }
    return () => unlock();
  }, [isMobile, detailOpen]); // eslint-disable-line

  const isResolved = (d) => d.recovery_status === 'manual_resolved' || d.recovery_status === 'auto_resolved';

  const allCount      = (localItems || []).length;
  const openCount     = (localItems || []).filter(d => !isResolved(d)).length;
  const resolvedCount = (localItems || []).filter(d =>  isResolved(d)).length;

  const FILTER_TABS = [
    { key: 'all',      label: `All · ${allCount}`           },
    { key: 'open',     label: `Open · ${openCount}`         },
    { key: 'resolved', label: `Resolved · ${resolvedCount}` },
    { key: 'ai',       label: 'AI'                          },
    { key: 'ddl',      label: 'DDL'                         },
    { key: 'delete',   label: 'DELETE'                      },
  ];

  const filtered = (localItems || []).filter(d => {
    if (filter === 'open')     return !isResolved(d);
    if (filter === 'resolved') return  isResolved(d);
    if (filter === 'ai')       return d.failure_stage === 'AI';
    if (filter === 'ddl')      return d.failure_stage === 'DDL';
    if (filter === 'delete')   return d.failure_stage === 'DELETE';
    return true;
  });

  const incident = (localItems || []).find(d => d.diag_id === selected);

  const handleResolve = async () => {
    if (!incident || resolving) return;
    if (isResolved(incident)) { toast.info('Already resolved.'); return; }
    setResolving(true);
    try {
      const res = await adminApi.resolveDiagnostic(incident.diag_id);
      const updated = res.data;
      setLocalItems(prev => prev.map(d => d.diag_id === incident.diag_id ? { ...d, recovery_status: 'manual_resolved' } : d));
      onResolve && onResolve(incident.diag_id, updated);
      toast.success('Marked as resolved.');
    } catch {
      toast.error('Failed to resolve. Try again.');
    } finally {
      setResolving(false);
    }
  };

  if (data === undefined) {
    return (
      <div>
        <SectionHeader title="Diagnostics" t={t} />
        <div style={{ textAlign: 'center', padding: 60, color: t.fgDim, fontSize: 13, fontFamily: fontStack }}>Loading…</div>
      </div>
    );
  }
  if (!localItems?.length) {
    return (
      <div>
        <SectionHeader title="Diagnostics" t={t} />
        <div style={{ padding: 48, textAlign: 'center', color: t.fgDim, fontSize: 13, fontFamily: fontStack, border: `1.5px dashed ${t.border}`, borderRadius: 14 }}>
          No incidents in the last 7 days · System running smoothly
        </div>
      </div>
    );
  }

  const DetailPanel = ({ incident, onClose }) => (
    <div style={{ flex: 1, borderRadius: 12, background: isDark ? 'rgba(20,20,32,0.55)' : 'rgba(255,255,255,0.65)', border: `1px solid ${t.border}`, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Header — stage badges + error text + date + X close */}
      <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1px solid ${t.border}`, background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(15,15,30,0.02)', flexShrink: 0 }}>
        <StageBadge stage={incident.failure_stage} />
        <SeverityBadge stage={incident.failure_stage} />
        <div style={{ fontSize: 12, fontWeight: 600, color: t.fg, fontFamily: monoStack, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {incident.error_signature?.split(':')[0] || incident.error_signature}
        </div>
        <div style={{ fontSize: 10.5, color: t.fgDim, fontFamily: monoStack, flexShrink: 0 }}>{fmtDate(incident.occurred_at)}</div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4, borderRadius: 6, flexShrink: 0, touchAction: 'manipulation', opacity: 0.6 }}
          onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}>
          <Icon name="close" size={13} color={t.fgDim} />
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16, flex: 1, overflowY: 'auto' }}>
        {[
          { label: 'ERROR SIGNATURE', value: incident.error_signature, mono: true },
          { label: 'CONTEXT', value: `config_id: ${incident.config_id ?? '—'} · company: ${incident.tenant_name ?? '—'}`, mono: false },
          { label: 'RECOVERY ACTION', value: incident.recovery_action || '—', mono: false },
        ].map(({ label, value, mono }) => (
          <div key={label}>
            <div style={{ fontSize: 9.5, color: t.fgDim, fontFamily: monoStack, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
            <div style={{ padding: '10px 12px', borderRadius: 8, background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(15,15,30,0.04)', border: `1px solid ${t.border}`, fontSize: 12.5, color: t.fg, fontFamily: mono ? monoStack : fontStack, lineHeight: 1.55, wordBreak: mono ? 'break-all' : 'break-word' }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Footer — only visible when not yet resolved */}
      {!isResolved(incident) && (
        <div style={{ padding: '12px 18px', borderTop: `1px solid ${t.border}`, background: isDark ? 'rgba(255,255,255,0.01)' : 'rgba(15,15,30,0.01)', flexShrink: 0 }}>
          <button onClick={handleResolve} disabled={resolving} style={{ padding: '8px 16px', borderRadius: 8, cursor: resolving ? 'not-allowed' : 'pointer', background: `${t.success}12`, color: t.success, border: `1px solid ${t.success}40`, fontSize: 12, fontFamily: fontStack, transition: 'all 0.15s', opacity: resolving ? 0.6 : 1, touchAction: 'manipulation', minHeight: 36 }}>
            {resolving ? 'Resolving…' : 'Mark Resolved'}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div>
      <SectionHeader title="Diagnostics" count={allCount} t={t} />
      <div style={{ fontSize: 11.5, color: t.fgDim, fontFamily: fontStack, marginBottom: 18, lineHeight: 1.55 }}>
        System-level incidents across all companies — AI failures, schema errors, database conflicts. User validation errors (e.g. duplicate names) are not tracked here.
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
        {FILTER_TABS.map(({ key, label }) => {
          const active = filter === key;
          return (
            <div key={key} onClick={() => setFilter(key)} style={{ padding: '5px 12px', borderRadius: 99, cursor: 'pointer', fontSize: 11.5, fontFamily: monoStack, background: active ? `linear-gradient(135deg, ${t.primary}, ${t.accent})` : 'transparent', color: active ? '#fff' : t.fgMuted, border: active ? '1px solid transparent' : `1px solid ${t.border}`, transition: 'all 0.15s', touchAction: 'manipulation' }}>
              {label}
            </div>
          );
        })}
      </div>

      {isMobile ? (
        /* Mobile: list only, detail opens as full-screen modal */
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: t.fgDim, fontSize: 12.5, fontFamily: fontStack, border: `1.5px dashed ${t.border}`, borderRadius: 12 }}>
                No incidents match this filter.
              </div>
            ) : filtered.map(d => {
              const resolved = isResolved(d);
              return (
                <div
                  key={d.diag_id}
                  onClick={() => { setSelected(d.diag_id); setDetailOpen(true); }}
                  style={{ padding: '12px 14px', borderRadius: 10, cursor: 'pointer', background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,15,30,0.03)', border: `1px solid ${t.border}`, touchAction: 'manipulation' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5, flexWrap: 'wrap' }}>
                    <StageBadge stage={d.failure_stage} />
                    <SeverityBadge stage={d.failure_stage} />
                    {resolved && <span style={{ fontSize: 9, fontFamily: monoStack, padding: '1px 5px', borderRadius: 99, background: `${t.success}20`, color: t.success, border: `1px solid ${t.success}30` }}>resolved</span>}
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: t.fgDim, fontFamily: monoStack }}>{timeAgo(d.occurred_at)}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: t.fgMuted, fontFamily: monoStack, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {d.error_signature?.split(':')[0] || d.error_signature}
                  </div>
                  <div style={{ fontSize: 10, color: t.fgDim, fontFamily: monoStack, marginTop: 3 }}>Tap to view details →</div>
                </div>
              );
            })}
          </div>

          {/* Mobile full-screen detail modal */}
          {detailOpen && incident && (
            <div
              className="modal-scroll-contain"
              style={{ position: 'fixed', inset: 0, zIndex: 300, background: isDark ? '#0a0a12' : '#f7f7fb', display: 'flex', flexDirection: 'column', overscrollBehavior: 'contain' }}
            >
              {/* Sticky header */}
              <div style={{
                padding: `max(18px, calc(env(safe-area-inset-top, 0px) + 12px)) 16px 14px`,
                borderBottom: `1px solid ${t.border}`,
                display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
                background: isDark ? 'rgba(10,10,18,0.9)' : 'rgba(247,247,251,0.9)',
              }}>
                <button onClick={() => setDetailOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: t.primary, fontSize: 13, fontFamily: fontStack, touchAction: 'manipulation', minWidth: 44, minHeight: 44, padding: 0 }}>
                  <Icon name="chevronLeft" size={16} color={t.primary} />
                  Back
                </button>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: t.fg, fontFamily: monoStack, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {incident.error_signature?.split(':')[0]}
                  </div>
                </div>
              </div>

              {/* Scrollable content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <StageBadge stage={incident.failure_stage} />
                  <SeverityBadge stage={incident.failure_stage} />
                  <span style={{ fontSize: 10.5, color: t.fgDim, fontFamily: monoStack, marginLeft: 'auto' }}>{fmtDate(incident.occurred_at)}</span>
                </div>
                {[
                  { label: 'ERROR SIGNATURE', value: incident.error_signature, mono: true },
                  { label: 'CONTEXT', value: `config_id: ${incident.config_id ?? '—'} · company: ${incident.tenant_name ?? '—'}`, mono: false },
                  { label: 'RECOVERY ACTION', value: incident.recovery_action || '—', mono: false },
                ].map(({ label, value, mono }) => (
                  <div key={label}>
                    <div style={{ fontSize: 9.5, color: t.fgDim, fontFamily: monoStack, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
                    <div style={{ padding: '10px 12px', borderRadius: 8, background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(15,15,30,0.04)', border: `1px solid ${t.border}`, fontSize: 12.5, color: t.fg, fontFamily: mono ? monoStack : fontStack, lineHeight: 1.55, wordBreak: mono ? 'break-all' : 'break-word' }}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Sticky footer — only when not resolved */}
              {!isResolved(incident) && (
                <div style={{ padding: `12px 16px max(16px, calc(env(safe-area-inset-bottom, 0px) + 10px))`, borderTop: `1px solid ${t.border}`, flexShrink: 0, background: isDark ? 'rgba(10,10,18,0.9)' : 'rgba(247,247,251,0.9)' }}>
                  <button onClick={handleResolve} disabled={resolving} style={{ padding: '8px 16px', borderRadius: 8, cursor: resolving ? 'not-allowed' : 'pointer', background: `${t.success}12`, color: t.success, border: `1px solid ${t.success}40`, fontSize: 12, fontFamily: fontStack, transition: 'all 0.15s', opacity: resolving ? 0.6 : 1, touchAction: 'manipulation', minHeight: 36 }}>
                    {resolving ? 'Resolving…' : 'Mark Resolved'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Desktop/Tablet: 2-panel layout */
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          {/* Incident list */}
          <div style={{ width: 270, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: t.fgDim, fontSize: 12.5, fontFamily: fontStack, border: `1.5px dashed ${t.border}`, borderRadius: 12 }}>
                No incidents match this filter.
              </div>
            ) : filtered.map(d => {
              const isSelected = selected === d.diag_id;
              const resolved   = isResolved(d);
              return (
                <div key={d.diag_id} onClick={() => setSelected(d.diag_id)} style={{ padding: '10px 12px', borderRadius: 10, cursor: 'pointer', background: isSelected ? (isDark ? 'rgba(124,108,255,0.14)' : 'rgba(99,88,255,0.08)') : (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,15,30,0.03)'), border: `1px solid ${isSelected ? t.borderStrong : t.border}`, transition: 'all 0.15s', touchAction: 'manipulation' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5, flexWrap: 'wrap' }}>
                    <StageBadge stage={d.failure_stage} />
                    <SeverityBadge stage={d.failure_stage} />
                    {resolved && <span style={{ fontSize: 9, fontFamily: monoStack, padding: '1px 5px', borderRadius: 99, background: `${t.success}20`, color: t.success, border: `1px solid ${t.success}30` }}>resolved</span>}
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: t.fgDim, fontFamily: monoStack }}>{timeAgo(d.occurred_at)}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: isSelected ? t.fg : t.fgMuted, fontFamily: monoStack, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {d.error_signature?.split(':')[0] || d.error_signature}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Detail panel */}
          {incident ? (
            <DetailPanel incident={incident} onClose={() => setSelected(null)} />
          ) : (
            <div style={{ flex: 1, padding: 40, textAlign: 'center', color: t.fgDim, fontSize: 13, fontFamily: fontStack, border: `1.5px dashed ${t.border}`, borderRadius: 12 }}>
              Select an incident to view details.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── AdminPage ────────────────────────────────────────────────────────

export default function AdminPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme } = useTheme();
  const { setPaletteData, openPalette } = useCommandPalette();
  const { isMobile, isTablet } = useViewport();
  const { lock, unlock } = useBodyScrollLock();
  const t = themes[theme];
  const isDark = theme === 'dark';

  const [section, setSection]   = useState('overview');
  const [cache, setCache]       = useState({});
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);

  // System health state
  const [health, setHealth]           = useState(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError]   = useState(false);

  // Analytics state (sector donut, top tenants, confidence histogram)
  const [analytics, setAnalytics]         = useState({});
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const loadedRef = useRef(new Set());

  // System health: mount'ta fetch + 30 saniye interval
  useEffect(() => {
    let cancelled = false;
    const fetchHealth = async () => {
      try {
        const res = await adminApi.getHealth();
        if (!cancelled) { setHealth(res.data); setHealthError(false); }
      } catch {
        if (!cancelled) setHealthError(true);
      } finally {
        if (!cancelled) setHealthLoading(false);
      }
    };
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  // Diagnostics mount fetch — populates sidebar badge without waiting for nav click
  useEffect(() => {
    if (loadedRef.current.has('diagnostics')) return;
    adminApi.diagnostics()
      .then(res => {
        setCache(prev => ({ ...prev, diagnostics: res.data }));
        loadedRef.current.add('diagnostics');
      })
      .catch(() => {}); // silent fail — badge stays empty, not a critical error
  }, []); // eslint-disable-line

  // Drawer scroll lock
  useEffect(() => {
    if (drawerOpen) { lock(); } else { unlock(); }
    return () => unlock();
  }, [drawerOpen]); // eslint-disable-line

  // Esc closes drawer
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && drawerOpen) setDrawerOpen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [drawerOpen]);

  const handleDiagnosticResolve = useCallback((diagId) => {
    setCache(prev => ({
      ...prev,
      diagnostics: prev.diagnostics?.map(d => d.diag_id === diagId ? { ...d, recovery_status: 'manual_resolved' } : d) ?? [],
    }));
  }, []);

  useEffect(() => {
    if (loadedRef.current.has(section)) return;
    setLoading(true); setError('');
    const fetchers = { overview: adminApi.overview, users: adminApi.users, tenants: adminApi.tenants, configurations: adminApi.configurations, logs: adminApi.logs, diagnostics: adminApi.diagnostics };
    fetchers[section]()
      .then(res => { setCache(prev => ({ ...prev, [section]: res.data })); loadedRef.current.add(section); })
      .catch(() => setError('Failed to load data. Check your connection or try again.'))
      .finally(() => setLoading(false));

    // Fetch analytics charts in parallel when landing on overview
    if (section === 'overview' && !loadedRef.current.has('analytics')) {
      setAnalyticsLoading(true);
      Promise.all([
        adminApi.getSectorDistribution(),
        adminApi.getTopTenants(5),
        adminApi.getConfidenceDistribution(),
      ])
        .then(([sectorRes, tenantsRes, confRes]) => {
          setAnalytics({
            sectorDistribution:      sectorRes.data,
            topTenants:              tenantsRes.data,
            confidenceDistribution:  confRes.data,
          });
          loadedRef.current.add('analytics');
        })
        .catch(() => {})
        .finally(() => setAnalyticsLoading(false));
    }
  }, [section]);

  useEffect(() => {
    setPaletteData(prev => ({
      ...prev, scope: 'admin', adminCache: cache,
      onAdminNavigate: (target) => {
        if (target === 'dashboard') navigate('/dashboard');
        else if (target === 'logout') { logout(); navigate('/login'); }
        else setSection(target);
      },
    }));
    return () => { setPaletteData(prev => ({ ...prev, scope: 'user', adminCache: null })); };
  }, [cache, logout, navigate, setPaletteData]);

  useEffect(() => {
    const handler = (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); openPalette(); } };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [openPalette]);

  const handleNavSelect = (key) => { setSection(key); setDrawerOpen(false); };

  // ── Sidebar content
  const SidebarContent = () => (
    <>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px 14px 4px', borderBottom: `1px solid ${t.border}`, marginBottom: 8 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, background: `linear-gradient(135deg, ${t.primary}, ${t.accent})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 14px ${t.primaryGlow}` }}>
          <Icon name="shield" size={14} color="#fff" strokeWidth={2.5} />
        </div>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: t.fg, fontFamily: fontStack, letterSpacing: '-0.01em' }}>Admin Panel</div>
          <div style={{ fontSize: 10, color: t.fgDim, fontFamily: monoStack, marginTop: 1 }}>{user?.email || '–'}</div>
        </div>
      </div>

      {/* Nav */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        {NAV_ITEMS.map(({ key, label, icon }) => {
          const active = section === key;
          return (
            <div key={key} onClick={() => handleNavSelect(key)} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 9, cursor: 'pointer', background: active ? (isDark ? 'rgba(124,108,255,0.14)' : 'rgba(99,88,255,0.08)') : 'transparent', border: active ? `1px solid ${t.borderStrong}` : '1px solid transparent', color: active ? t.fg : t.fgMuted, fontSize: 13, fontFamily: fontStack, fontWeight: active ? 500 : 400, transition: 'all 0.15s', minHeight: 40, touchAction: 'manipulation' }}>
              <Icon name={icon} size={14} color={active ? t.primary : t.fgDim} />
              <span style={{ flex: 1 }}>{label}</span>
              {key === 'diagnostics' && cache.diagnostics?.filter(d => d.recovery_status !== 'manual_resolved' && d.recovery_status !== 'auto_resolved').length > 0 && (
                <span style={{ fontSize: 9, fontFamily: monoStack, padding: '1px 5px', borderRadius: 99, background: `${t.danger}20`, color: t.danger, border: `1px solid ${t.danger}30` }}>
                  {cache.diagnostics.filter(d => d.recovery_status !== 'manual_resolved' && d.recovery_status !== 'auto_resolved').length}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* System Health + Back to Dashboard */}
      <div style={{ marginTop: 'auto', padding: '10px 10px 0', borderTop: `1px solid ${t.border}` }}>
        {/* System Health card — real data from /admin/health, refreshes every 30s */}
        <div style={{ padding: '10px 12px', borderRadius: 10, background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,15,30,0.03)', border: `1px solid ${t.border}`, marginBottom: 8 }}>
          {healthLoading ? (
            <div style={{ fontSize: 10, color: t.fgDim, fontFamily: monoStack, lineHeight: 1.8 }}>Loading…</div>
          ) : healthError ? (
            <div style={{ fontSize: 10, color: t.danger, fontFamily: monoStack }}>Health check failed</div>
          ) : health ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%', display: 'inline-block', flexShrink: 0,
                  background: health.status === 'healthy' ? '#22c55e' : health.status === 'degraded' ? '#f59e0b' : '#ef4444',
                  boxShadow: health.status === 'healthy' ? '0 0 6px #22c55e' : health.status === 'degraded' ? '0 0 6px #f59e0b' : '0 0 6px #ef4444',
                }} />
                <span style={{ fontSize: 11, color: t.fg, fontFamily: monoStack, fontWeight: 600 }}>
                  System {health.status}
                </span>
              </div>
              {[
                `API p95: ${health.api_p95_ms}ms`,
                `DB conn: ${health.db_pool.checked_out}/${health.db_pool.max}`,
                `Memory: ${health.memory_mb}MB`,
                `Uptime: ${health.uptime_formatted}`,
              ].map(line => (
                <div key={line} style={{ fontSize: 10, color: t.fgDim, fontFamily: monoStack, lineHeight: 1.7 }}>{line}</div>
              ))}
            </>
          ) : null}
        </div>

        <div onClick={() => navigate('/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 9, cursor: 'pointer', color: t.fgDim, fontSize: 12.5, fontFamily: fontStack, border: `1px solid ${t.border}`, transition: 'all 0.15s', touchAction: 'manipulation' }}>
          <Icon name="chevronLeft" size={13} color={t.fgDim} />
          Back to Dashboard
        </div>
      </div>
    </>
  );

  return (
    <GlassRoot>
      <div style={{ position: 'absolute', top: `max(16px, calc(env(safe-area-inset-top, 0px) + 8px))`, left: 16, right: 16, zIndex: 3 }}>
        <TopBar onHamburger={isMobile ? () => setDrawerOpen(true) : undefined} />
      </div>

      <div style={{ position: 'absolute', top: 80, left: 0, right: 0, bottom: 0, zIndex: 2, display: 'flex', overflow: 'hidden' }}>

        {/* ── Static Sidebar (desktop only) ─────────────────────────── */}
        {!isMobile && (
          <div style={{ width: 220, flexShrink: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', padding: '16px 10px', borderRight: `1px solid ${t.border}`, background: isDark ? 'rgba(10,10,18,0.55)' : 'rgba(248,248,252,0.6)', backdropFilter: 'blur(12px)' }}>
            <SidebarContent />
          </div>
        )}

        {/* ── Main content ──────────────────────────────────────────── */}
        <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '16px 16px 48px' : '24px 28px 48px' }}>
          {error && (
            <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 10, background: `${t.danger}15`, border: `1px solid ${t.danger}40`, color: t.danger, fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="bolt" size={13} color={t.danger} />
              {error}
              <span onClick={() => setError('')} style={{ marginLeft: 'auto', cursor: 'pointer', opacity: 0.7 }}>
                <Icon name="close" size={13} color={t.danger} />
              </span>
            </div>
          )}

          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, gap: 10, color: t.fgMuted, fontSize: 13, fontFamily: fontStack }}>
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={t.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin-slow">
                <path d="M12 3v4M12 17v4M5 12H1M23 12h-4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              Loading…
            </div>
          ) : (
            <>
              {section === 'overview' && <OverviewSection data={cache.overview} analytics={analytics} analyticsLoading={analyticsLoading} t={t} theme={theme} isDark={isDark} isMobile={isMobile} isTablet={isTablet} />}
              {section === 'users' && <TableSection title="Users" data={cache.users} t={t} isDark={isDark} columns={[{ key: 'email', label: 'Email' }, { key: 'full_name', label: 'Full Name' }, { key: 'role', label: 'Role', render: v => <RoleBadge role={v} t={t} /> }, { key: 'tenant_name', label: 'Company' }, { key: 'created_at', label: 'Joined', render: fmtDate }]} />}
              {section === 'tenants' && <TableSection title="Companies" data={cache.tenants} t={t} isDark={isDark} columns={[{ key: 'company_name', label: 'Company' }, { key: 'sector_code', label: 'Sector', render: v => <SectorPill code={v} t={t} /> }, { key: 'user_count', label: 'Users' }, { key: 'config_count', label: 'Configs' }, { key: 'created_at', label: 'Since', render: fmtDate }]} />}
              {section === 'configurations' && <TableSection title="Configurations" data={cache.configurations} t={t} isDark={isDark} columns={[{ key: 'config_id', label: 'ID' }, { key: 'tenant_name', label: 'Company' }, { key: 'status', label: 'Status', render: v => <StatusBadge status={v} t={t} /> }, { key: 'ai_confidence_score', label: 'Confidence', render: v => v != null ? `${Math.round(v * 100)}%` : '–' }, { key: 'module_count', label: 'Modules' }, { key: 'created_at', label: 'Created', render: fmtDate }]} />}
              {section === 'logs' && <TableSection title="AI Logs" data={cache.logs} t={t} isDark={isDark} columns={[{ key: 'tenant_name', label: 'Company' }, { key: 'raw_input', label: 'Input', render: v => truncate(v, 80), wrap: true }, { key: 'ambiguity_flag', label: 'Status', render: v => <AmbiguityBadge flag={v} t={t} /> }, { key: 'timestamp', label: 'Date', render: fmtDate }]} />}
              {section === 'diagnostics' && <DiagnosticsSection data={cache.diagnostics} onResolve={handleDiagnosticResolve} t={t} isDark={isDark} isMobile={isMobile} />}
            </>
          )}
        </div>
      </div>

      {/* ── Mobile Sidebar Drawer ─────────────────────────────────────── */}
      {drawerOpen && (
        <div className="modal-scroll-contain" style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} onClick={() => setDrawerOpen(false)} />
          <div style={{
            position: 'relative', zIndex: 51, width: 280,
            background: isDark ? '#0a0a12' : '#f7f7fb',
            overflow: 'auto', display: 'flex', flexDirection: 'column',
            padding: '16px 10px',
            animation: 'slideInLeft 0.25s ease-out',
            paddingTop: `max(16px, calc(env(safe-area-inset-top, 0px) + 12px))`,
            paddingBottom: `max(10px, calc(env(safe-area-inset-bottom, 0px) + 10px))`,
            overscrollBehavior: 'contain',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: t.fg, fontFamily: fontStack }}>Admin Panel</span>
              <button onClick={() => setDrawerOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.fgMuted, display: 'flex', padding: 8, touchAction: 'manipulation' }}>
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
