import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import AddModuleModal from '../components/AddModuleModal';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useCommandPalette } from '../contexts/CommandPaletteContext';
import { useViewport } from '../hooks/useViewport';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { themes, glassPanel, fontStack, monoStack } from '../design-system/tokens';
import { GlassRoot, TopBar, Btn } from '../design-system/components';
import { Skeleton } from '../design-system/Skeleton';
import Icon from '../design-system/Icon';
import { configurationsApi, modulesApi } from '../services/api';
import { translateLabel } from '../utils/translateLabel';
import { detectInputType } from '../utils/detectInputType';
import SmartInput, { buildInitialFormData, enrichEditFormData } from '../components/inputs/SmartInput';

// ── Helpers ──────────────────────────────────────────────────────────

function getRecordInitials(payload, fields) {
  for (const f of fields) {
    const n = f.name || String(f);
    const v = payload[n];
    if (typeof v === 'string' && v.trim()) {
      return v.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase().slice(0, 2);
    }
  }
  return '#';
}

function statusColor(val, t) {
  const l = (val || '').toLowerCase();
  if (['active', 'paid', 'completed', 'approved', 'high'].includes(l)) return t.success;
  if (['pending', 'medium', 'draft', 'review', 'processing'].includes(l)) return t.warn;
  if (['inactive', 'cancelled', 'rejected', 'low'].includes(l)) return t.danger;
  return t.fgDim;
}

function buildChartData(records) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const todayIdx = (new Date().getDay() + 6) % 7;
  const ordered = [...days.slice(todayIdx + 1), ...days.slice(0, todayIdx + 1)];
  const dayCounts = {};
  ordered.forEach(d => { dayCounts[d] = 0; });
  records.forEach(r => {
    if (r.created_at) {
      const idx = (new Date(r.created_at).getDay() + 6) % 7;
      if (dayCounts[days[idx]] !== undefined) dayCounts[days[idx]]++;
    }
  });
  return ordered.map(d => ({ day: d, count: dayCounts[d] }));
}


function TrashIcon({ size = 14, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, display: 'block' }}>
      <path d="M3 6h18M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    </svg>
  );
}

// ── Module nav item ───────────────────────────────────────────────────
function ModuleNavItem({ mod, isActive, count, onSelect, t, theme }) {
  const isDark = theme === 'dark';
  const label = translateLabel(mod.display_name || mod.module_name);
  const initial = label.charAt(0).toUpperCase();
  return (
    <button
      onClick={() => onSelect(mod)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 10px', borderRadius: 10, marginBottom: 2,
        background: isActive ? (isDark ? 'rgba(124,108,255,0.14)' : 'rgba(99,88,255,0.08)') : 'transparent',
        border: `1px solid ${isActive ? t.primary + '50' : 'transparent'}`,
        cursor: 'pointer', textAlign: 'left',
        transition: 'background 0.15s, border-color 0.15s',
        boxShadow: isActive ? `0 2px 10px ${t.primaryGlow}` : 'none',
        touchAction: 'manipulation',
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        background: isActive ? `linear-gradient(135deg, ${t.primary}, ${t.accent})` : (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 700, color: isActive ? '#fff' : t.fgDim,
        boxShadow: isActive ? `0 2px 8px ${t.primaryGlow}` : 'none',
        transition: 'background 0.15s',
      }}>
        {initial}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12.5, fontWeight: isActive ? 600 : 400,
          color: isActive ? t.fg : t.fgMuted,
          fontFamily: fontStack, letterSpacing: '-0.01em',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {label}
        </div>
        <div style={{ fontSize: 10, color: t.fgDim, fontFamily: monoStack, marginTop: 2 }}>
          {count} records
        </div>
      </div>
      {isActive && <div style={{ width: 5, height: 5, borderRadius: '50%', background: t.primary, flexShrink: 0 }} />}
    </button>
  );
}

// ── Main ─────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { setPaletteData } = useCommandPalette();
  const { isMobile, isTablet } = useViewport();
  const { lock, unlock } = useBodyScrollLock();
  const t = themes[theme];
  const isDark = theme === 'dark';
  const isNarrow = isMobile || isTablet; // ≤ 1024px — right panel drops below

  const [configs, setConfigs] = useState([]);
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [loadingInit, setLoadingInit] = useState(true);
  const [deleteConfigModal, setDeleteConfigModal] = useState(false);
  const [deletingConfig, setDeletingConfig] = useState(false);

  const [modules, setModules] = useState([]);
  const [selectedModule, setSelectedModule] = useState(null);
  const [selectedSchema, setSelectedSchema] = useState(null);
  const [loadingModules, setLoadingModules] = useState(false);

  const [records, setRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [moduleCounts, setModuleCounts] = useState([]);

  const [error, setError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [showAddModuleModal, setShowAddModuleModal] = useState(false);

  // Drawer scroll lock
  useEffect(() => {
    if (sidebarOpen) { lock(); } else { unlock(); }
    return () => unlock();
  }, [sidebarOpen]); // eslint-disable-line

  // Modal scroll lock
  useEffect(() => {
    if (modalOpen) { lock(); } else { unlock(); }
    return () => unlock();
  }, [modalOpen]); // eslint-disable-line

  // Esc key closes drawer / modal
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        if (sidebarOpen) setSidebarOpen(false);
        else if (modalOpen && !saving) setModalOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [sidebarOpen, modalOpen, saving]);

  // Load configs on mount
  useEffect(() => {
    const load = async () => {
      try {
        const res = await configurationsApi.list();
        const cfgs = res.data || [];
        setConfigs(cfgs);
        if (cfgs.length === 0) return;
        const newConfigId = sessionStorage.getItem('newConfigId');
        sessionStorage.removeItem('newConfigId');
        let target = cfgs[cfgs.length - 1];
        if (newConfigId) {
          const found = cfgs.find(c => String(c.config_id) === newConfigId);
          if (found) target = found;
        }
        setSelectedConfig(target);
      } catch {
        setError('Could not load configurations.');
      } finally {
        setLoadingInit(false);
      }
    };
    load();
  }, []);

  // Load modules when config changes
  useEffect(() => {
    if (!selectedConfig) return;
    const load = async () => {
      setLoadingModules(true);
      setModules([]); setSelectedModule(null); setSelectedSchema(null);
      setRecords([]); setModuleCounts([]); setError('');
      try {
        const res = await modulesApi.list(selectedConfig.config_id);
        const mods = res.data || [];
        setModules(mods);
        if (mods.length > 0) setSelectedModule(mods[0]);
      } catch {
        setError('Could not load modules.');
      } finally {
        setLoadingModules(false);
      }
    };
    load();
  }, [selectedConfig]);

  // Fetch record counts per module
  useEffect(() => {
    if (modules.length === 0) { setModuleCounts([]); return; }
    const fetchCounts = async () => {
      const results = await Promise.allSettled(
        modules.map(mod => modulesApi.getRecords(mod.map_id, { limit: 1, offset: 0 }))
      );
      setModuleCounts(
        modules.map((mod, i) => ({
          map_id: mod.map_id,
          name: translateLabel(mod.display_name || mod.module_name),
          count: results[i].status === 'fulfilled' ? (results[i].value.data?.total ?? 0) : 0,
        }))
      );
    };
    fetchCounts();
  }, [modules]);

  const refreshModuleList = useCallback(async () => {
    if (!selectedConfig) return;
    try {
      const res = await modulesApi.list(selectedConfig.config_id);
      setModules(res.data || []);
    } catch { /* silent */ }
  }, [selectedConfig]);

  const loadRecords = useCallback(async (mod) => {
    if (!mod) return;
    setLoadingRecords(true); setError('');
    try {
      const [schemaRes, recordsRes] = await Promise.all([
        modulesApi.getSchema(mod.map_id),
        modulesApi.getRecords(mod.map_id),
      ]);
      setSelectedSchema(schemaRes.data || null);
      setRecords(recordsRes.data?.records || []);
    } catch {
      setError('Could not load records.');
    } finally {
      setLoadingRecords(false);
    }
  }, []);

  useEffect(() => {
    if (selectedModule) loadRecords(selectedModule);
  }, [selectedModule, loadRecords]);

  const handleSelectConfig = config => { setSelectedConfig(config); setError(''); };
  const handleSelectModule = mod => {
    setSelectedModule(mod); setSelectedSchema(null); setRecords([]); setError(''); setSidebarOpen(false);
  };

  const getFields = () => selectedSchema?.fields || [];

  const openNewRecord = () => {
    setEditingRecord(null); setFormData(buildInitialFormData(getFields())); setModalOpen(true);
  };
  const openEditRecord = record => {
    setEditingRecord(record); setFormData(enrichEditFormData(record.data_payload, getFields())); setModalOpen(true);
  };
  const handleFieldChange = updates => setFormData(prev => ({ ...prev, ...updates }));

  const handleDelete = async record => {
    if (!window.confirm('Delete this record?')) return;
    try {
      await modulesApi.deleteRecord(selectedModule.map_id, record.record_id);
      setRecords(prev => prev.filter(r => r.record_id !== record.record_id));
      setModuleCounts(prev => prev.map(m => m.map_id === selectedModule.map_id ? { ...m, count: Math.max(0, m.count - 1) } : m));
      toast.success('Record deleted.');
    } catch { toast.error('Could not delete record.'); }
  };

  const handleDeleteConfig = async () => {
    setDeletingConfig(true);
    try {
      await configurationsApi.delete(selectedConfig.config_id);
      toast.success('ERP configuration deleted.');
      setDeleteConfigModal(false);
      const res = await configurationsApi.list();
      const cfgs = res.data || [];
      setConfigs(cfgs);
      if (cfgs.length === 0) navigate('/setup/describe');
      else setSelectedConfig(cfgs[cfgs.length - 1]);
    } catch { toast.error('Could not delete configuration.'); }
    finally { setDeletingConfig(false); }
  };

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      if (editingRecord) {
        await modulesApi.updateRecord(selectedModule.map_id, editingRecord.record_id, formData);
        toast.success('Record updated.');
      } else {
        await modulesApi.createRecord(selectedModule.map_id, formData);
        toast.success('Record added.');
        setModuleCounts(prev => prev.map(m => m.map_id === selectedModule.map_id ? { ...m, count: m.count + 1 } : m));
      }
      await loadRecords(selectedModule);
      setModalOpen(false);
    } catch {
      const msg = 'Could not save record.';
      setError(msg); toast.error(msg);
    } finally { setSaving(false); }
  };

  const paletteRef = useRef({});
  paletteRef.current = {
    onSelectModule: handleSelectModule,
    onOpenRecord: openEditRecord,
    onOpenAddModule: () => setShowAddModuleModal(true),
  };
  const stableSelectModule  = useCallback((m) => paletteRef.current.onSelectModule(m),  []);
  const stableOpenRecord    = useCallback((r) => paletteRef.current.onOpenRecord(r),    []);
  const stableOpenAddModule = useCallback(()  => paletteRef.current.onOpenAddModule(),  []);

  useEffect(() => {
    setPaletteData({
      modules, records, fields: selectedSchema?.fields || [],
      isAdmin: user?.role === 'admin',
      onSelectModule: stableSelectModule, onOpenRecord: stableOpenRecord, onOpenAddModule: stableOpenAddModule,
    });
  }, [modules, records, selectedSchema, user?.role, stableSelectModule, stableOpenRecord, stableOpenAddModule, setPaletteData]);

  useEffect(() => {
    return () => setPaletteData({ modules: [], records: [], fields: [], isAdmin: false, scope: 'user', onSelectModule: null, onOpenRecord: null, onOpenAddModule: null, onProfileNavigate: null });
  }, [setPaletteData]);

  const fields = getFields();
  const moduleName = selectedModule ? translateLabel(selectedModule.display_name || selectedModule.module_name) : 'Dashboard';
  const currentCount = moduleCounts.find(m => m.map_id === selectedModule?.map_id)?.count ?? records.length;
  const chartData = useMemo(() => buildChartData(records), [records]);
  const gradId    = `areaGrad-${theme}`;

  if (loadingInit) {
    return (
      <GlassRoot>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
          <span style={{ fontSize: 13, color: themes.dark.fgMuted, fontFamily: monoStack }}>Loading…</span>
        </div>
      </GlassRoot>
    );
  }

  if (configs.length === 0) {
    return (
      <GlassRoot>
        <div style={{ position: 'absolute', top: `max(12px, calc(env(safe-area-inset-top, 0px) + 6px))`, left: 16, right: 16, zIndex: 3 }}>
          <TopBar />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 16, padding: '0 24px' }}>
          <div style={{ fontSize: 15, color: t.fgMuted, fontFamily: fontStack, textAlign: 'center' }}>No ERP configured yet.</div>
          <Btn variant="primary" icon="sparkles" onClick={() => navigate('/setup/describe')}>Create Your First ERP</Btn>
        </div>
      </GlassRoot>
    );
  }

  // ── Safe-area top for TopBar container
  const topBarTop = `max(12px, calc(env(safe-area-inset-top, 0px) + 6px))`;
  const configBarTop = 72; // approximate, kept as fixed offset below topbar

  // ── Sidebar content (shared between static sidebar and drawer)
  const SidebarContent = () => (
    <>
      <div style={{
        padding: '14px 16px 10px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: `1px solid ${t.border}`, flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 9.5, color: t.fgDim, fontFamily: monoStack, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Modules</div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: t.fg, marginTop: 2 }}>{modules.length} active</div>
        </div>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: `linear-gradient(135deg, ${t.primary}, ${t.accent})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 2px 8px ${t.primaryGlow}`,
        }}>
          <Icon name="layers" size={13} color="#fff" />
        </div>
      </div>

      <div style={{ padding: '10px 8px', flex: 1, overflowY: 'auto' }}>
        {loadingModules ? (
          <div style={{ padding: '16px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Skeleton height={36} rounded />
            <Skeleton height={36} rounded />
            <Skeleton height={36} rounded />
          </div>
        ) : modules.length === 0 ? (
          <div style={{ padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: t.fgMuted, marginBottom: 8 }}>No modules yet.</div>
            <button onClick={() => navigate('/setup/describe')} style={{ fontSize: 11.5, color: t.primary, background: 'none', border: 'none', cursor: 'pointer' }}>
              Create an ERP →
            </button>
          </div>
        ) : (
          modules.map(mod => (
            <ModuleNavItem
              key={mod.map_id} mod={mod}
              isActive={selectedModule?.map_id === mod.map_id}
              count={moduleCounts.find(m => m.map_id === mod.map_id)?.count ?? 0}
              onSelect={handleSelectModule} t={t} theme={theme}
            />
          ))
        )}
      </div>

      <div style={{ padding: '10px 8px', borderTop: `1px solid ${t.border}`, flexShrink: 0 }}>
        <button
          onClick={() => { setShowAddModuleModal(true); setSidebarOpen(false); }}
          style={{
            width: '100%', padding: '8px 12px', borderRadius: 10,
            background: 'none', border: `1px dashed ${t.primary}55`,
            color: t.primary, fontSize: 11.5, fontFamily: fontStack, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
            touchAction: 'manipulation',
          }}
        >
          <Icon name="plus" size={12} color={t.primary} />
          Add module
        </button>
      </div>
    </>
  );

  return (
    <GlassRoot>
      {/* TopBar */}
      <div style={{ position: 'absolute', top: topBarTop, left: 16, right: 16, zIndex: 10 }}>
        <TopBar
          subtitle={selectedConfig?.config_name}
          showSearch
          onHamburger={isMobile ? () => setSidebarOpen(true) : undefined}
        />
      </div>

      {/* Config bar */}
      <div style={{
        position: 'absolute', top: 72, left: 16, right: 16, zIndex: 9,
        ...glassPanel(t, theme), padding: '8px 14px', borderRadius: 12,
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'stretch' : 'center',
        gap: isMobile ? 8 : 10,
      }}>
        {/* ERP selector row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: isMobile ? undefined : 1, minWidth: 0 }}>
          {/* Tablet hamburger (tablet shows config bar hamburger; mobile uses TopBar hamburger) */}
          {isTablet && (
            <button
              onClick={() => setSidebarOpen(true)}
              style={{ padding: '4px', background: 'none', border: 'none', cursor: 'pointer', color: t.fgMuted, display: 'flex', flexShrink: 0, minWidth: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center', touchAction: 'manipulation' }}
            >
              <Icon name="sidebar" size={15} />
            </button>
          )}

          <span style={{ fontSize: 10, color: t.fgDim, fontFamily: monoStack, letterSpacing: '0.06em', textTransform: 'uppercase', flexShrink: 0 }}>
            ERP:
          </span>

          {configs.length > 1 ? (
            <select
              value={selectedConfig?.config_id ?? ''}
              onChange={e => {
                const found = configs.find(c => c.config_id === Number(e.target.value));
                if (found) handleSelectConfig(found);
              }}
              style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none', color: t.fg, fontSize: 12.5, fontFamily: fontStack, cursor: 'pointer', fontWeight: 500 }}
            >
              {configs.map(c => (
                <option key={c.config_id} value={c.config_id} style={{ background: isDark ? '#0f0f1a' : '#fff', color: t.fg }}>
                  {c.config_name} · {c.module_count} modules
                </option>
              ))}
            </select>
          ) : (
            <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 500, color: t.fg, fontFamily: fontStack, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {selectedConfig?.config_name} · {selectedConfig?.module_count} modules
            </span>
          )}

          {selectedConfig && (
            <button
              onClick={() => setDeleteConfigModal(true)}
              title="Delete ERP"
              style={{ padding: '4px 6px', borderRadius: 6, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', opacity: 0.65, flexShrink: 0, touchAction: 'manipulation' }}
            >
              <TrashIcon size={13} color={t.danger} />
            </button>
          )}
        </div>

        {!isMobile && <div style={{ width: 1, height: 16, background: t.border, flexShrink: 0 }} />}

        {/* New ERP — full-width below selector on mobile, inline on desktop */}
        <button
          onClick={() => navigate('/setup/describe')}
          style={{
            display: 'flex', alignItems: 'center',
            justifyContent: isMobile ? 'center' : undefined,
            gap: 5, flexShrink: 0,
            padding: '5px 10px', borderRadius: 7,
            background: `${t.primary}18`, border: `1px solid ${t.primary}33`,
            color: t.primary, fontSize: 11, fontFamily: fontStack, fontWeight: 500, cursor: 'pointer',
            touchAction: 'manipulation',
          }}
        >
          <Icon name="plus" size={10} color={t.primary} />
          New ERP
        </button>
      </div>

      {/* 3-column layout */}
      <div style={{
        position: 'absolute', top: isMobile ? 160 : 122, left: 0, right: 0, bottom: 0,
        display: 'flex',
        flexWrap: isNarrow ? 'wrap' : 'nowrap',
        alignContent: isNarrow ? 'flex-start' : 'stretch',
        overflow: 'hidden',
        zIndex: 2,
      }}>

        {/* ── LEFT SIDEBAR — hidden on mobile, shown on tablet/desktop ── */}
        {!isMobile && (
          <aside style={{
            width: 240, flexShrink: 0,
            height: isTablet ? 'calc(100% - 320px)' : undefined,
            borderRight: `1px solid ${t.border}`,
            overflowY: 'auto', overflowX: 'hidden',
            display: 'flex', flexDirection: 'column',
            background: isDark ? 'rgba(10,10,18,0.65)' : 'rgba(247,247,251,0.75)',
          }}>
            <SidebarContent />
          </aside>
        )}

        {/* ── CENTER ─────────────────────────────────────────────────── */}
        <main style={{
          flex: 1, minWidth: 0,
          height: isNarrow ? `calc(100% - ${isMobile ? 0 : 320}px)` : undefined,
          overflowY: 'auto', padding: isMobile ? '16px 16px 48px' : '20px 20px 48px',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          {/* Module title */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.success }} />
              <span style={{ fontSize: 9.5, color: t.fgDim, fontFamily: monoStack, letterSpacing: '0.08em', textTransform: 'uppercase' }}>WORKFLOW · ACTIVE</span>
            </div>
            <h1 style={{ fontSize: isMobile ? 20 : 22, fontWeight: 600, letterSpacing: '-0.03em', color: t.fg, margin: 0 }}>{moduleName}</h1>
            <div style={{ fontSize: 10.5, color: t.fgDim, fontFamily: monoStack, marginTop: 2 }}>this week</div>
          </div>

          {/* Hero KPI */}
          {selectedModule && (
            <div style={{ ...glassPanel(t, theme), padding: isMobile ? '16px 18px' : '20px 24px', display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{ flexShrink: 0 }}>
                <div key={theme} style={{
                  fontSize: 'clamp(48px, 12vw, 80px)',
                  fontWeight: 700, letterSpacing: '-0.05em', lineHeight: 1,
                  background: `linear-gradient(135deg, ${t.fg}, ${t.primary} 50%, ${t.accent})`,
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                }}>
                  {currentCount}
                </div>
                <div style={{ fontSize: 10.5, color: t.fgDim, fontFamily: monoStack, marginTop: 4 }}>Total records across all modules</div>
              </div>
              {/* flex:1 + minWidth:0 lets the chart fill the rest of the panel
                  (fixed 120/180px width squeezed it into the right edge) */}
              <div key={theme} style={{ flex: 1, minWidth: 0, height: 76 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={t.accent} stopOpacity={0.45} />
                        <stop offset="95%" stopColor={t.primary} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="day" hide />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{ background: isDark ? '#0f0f1a' : '#fff', border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 10.5, color: t.fg, fontFamily: monoStack }}
                      formatter={v => [v, 'records']}
                    />
                    <Area type="monotone" dataKey="count" stroke={t.primary} strokeWidth={1.5} fill={`url(#${gradId})`} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 10, background: `${t.danger}18`, border: `1px solid ${t.danger}44`, color: t.danger, fontSize: 12.5, fontFamily: fontStack, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="close" size={14} color={t.danger} />
              <span style={{ flex: 1 }}>{error}</span>
              <button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.danger, display: 'flex' }}><Icon name="close" size={12} /></button>
            </div>
          )}

          {/* Records section */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.fg, fontFamily: fontStack }}>Recent Records</div>
                <div style={{ fontSize: 10.5, color: t.fgDim, fontFamily: monoStack, marginTop: 2 }}>
                  Showing {records.length} of {currentCount}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {!isMobile && <Btn variant="ghost" size="sm" icon="filter">Filter</Btn>}
                {selectedModule && (
                  <Btn variant="primary" size="sm" icon="plus" onClick={openNewRecord}>
                    {isMobile ? '' : 'Add Record'}
                  </Btn>
                )}
              </div>
            </div>

            {loadingRecords ? (
              <div style={{ ...glassPanel(t, theme), padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Skeleton height={44} />
                <Skeleton height={44} />
                <Skeleton height={44} />
                <Skeleton height={44} />
              </div>
            ) : records.length === 0 ? (
              <div style={{ ...glassPanel(t, theme), padding: isMobile ? '32px 16px' : '48px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 46, height: 46, borderRadius: 13, background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="file" size={22} color={t.fgDim} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.fg, marginBottom: 4 }}>No records yet</div>
                  <div style={{ fontSize: 12, color: t.fgMuted }}>Add your first record to get started</div>
                </div>
                {selectedModule && <Btn variant="primary" size="md" icon="plus" onClick={openNewRecord}>Add your first record</Btn>}
              </div>
            ) : (
              <div style={{ ...glassPanel(t, theme), overflow: 'hidden' }}>
                {/* Table header — hidden on mobile */}
                {!isMobile && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px',
                    borderBottom: `1px solid ${t.border}`,
                    background: isDark ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.02)',
                  }}>
                    <div style={{ width: 32, flexShrink: 0 }} />
                    {fields.slice(0, 4).map(f => {
                      const name = f.name || String(f);
                      return (
                        <div key={name} style={{ flex: 1, minWidth: 0, fontSize: 9, fontWeight: 600, color: t.fgDim, fontFamily: monoStack, letterSpacing: '0.07em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {translateLabel(f.label || name)}
                        </div>
                      );
                    })}
                    {fields.length === 0 && <div style={{ flex: 1, fontSize: 9, color: t.fgDim, fontFamily: monoStack, letterSpacing: '0.07em', textTransform: 'uppercase' }}>Data</div>}
                    <div style={{ fontSize: 9, color: t.fgDim, fontFamily: monoStack, letterSpacing: '0.07em', textTransform: 'uppercase', flexShrink: 0, width: 88, textAlign: 'right' }}>Actions</div>
                  </div>
                )}

                {/* Rows */}
                <div style={{ overflowX: 'auto' }}>
                  {records.map((record, idx) => {
                    const payload = record.data_payload || {};
                    const initials = getRecordInitials(payload, fields);
                    const isLast = idx === records.length - 1;
                    return (
                      <div
                        key={record.record_id}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: isMobile ? '12px 14px' : '10px 16px', borderBottom: isLast ? 'none' : `1px solid ${t.border}`, cursor: 'pointer', transition: 'background 0.1s', minWidth: isMobile ? 0 : undefined }}
                        onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.02)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        onClick={() => openEditRecord(record)}
                      >
                        <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: `linear-gradient(135deg, ${t.primary}, ${t.accent})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', boxShadow: `0 2px 6px ${t.primaryGlow}` }}>
                          {initials}
                        </div>

                        {fields.length > 0 ? fields.slice(0, isMobile ? 2 : 4).map((f, fi) => {
                          const name = f.name || String(f);
                          const raw  = payload[name];
                          const val  = raw !== undefined && raw !== null ? String(raw).slice(0, 30) : '—';
                          const { inputType } = detectInputType(name);
                          if (inputType === 'enum' && raw) {
                            const col = statusColor(val, t);
                            return (
                              <div key={name} style={{ flex: 1, minWidth: 0 }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 99, background: `${col}18`, border: `1px solid ${col}33`, fontSize: 10.5, color: col, fontFamily: monoStack }}>
                                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: col }} />{val}
                                </span>
                              </div>
                            );
                          }
                          return (
                            <div key={name} style={{ flex: 1, minWidth: 0, fontSize: fi === 0 ? 12.5 : 11.5, fontWeight: fi === 0 ? 500 : 400, color: fi === 0 ? t.fg : t.fgMuted, fontFamily: fontStack, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {val}
                            </div>
                          );
                        }) : (
                          <div style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: t.fgMuted, fontFamily: monoStack }}>
                            {JSON.stringify(payload).slice(0, 60)}
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: 6, flexShrink: 0, width: 88, justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                          <button onClick={() => openEditRecord(record)} style={{ padding: '3px 8px', borderRadius: 6, background: `${t.primary}18`, border: `1px solid ${t.primary}33`, color: t.primary, fontSize: 10.5, fontFamily: monoStack, cursor: 'pointer', minHeight: 28, touchAction: 'manipulation' }}>
                            Edit
                          </button>
                          <button onClick={() => handleDelete(record)} style={{ padding: '3px 6px', borderRadius: 6, background: 'none', border: 'none', color: t.danger, cursor: 'pointer', display: 'flex', alignItems: 'center', opacity: 0.75, touchAction: 'manipulation' }}>
                            <TrashIcon size={13} color={t.danger} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </main>

        {/* ── RIGHT PANEL ────────────────────────────────────────────── */}
        {isMobile ? (
          /* Mobile: collapsible accordion below main */
          <div style={{
            width: '100%', borderTop: `1px solid ${t.border}`,
            background: isDark ? 'rgba(10,10,18,0.65)' : 'rgba(247,247,251,0.75)',
          }}>
            <button
              onClick={() => setRightPanelOpen(o => !o)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer',
                color: t.fgMuted, fontSize: 11, fontFamily: monoStack, touchAction: 'manipulation',
              }}
            >
              <span style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}>This Week</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                style={{ transform: rightPanelOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {rightPanelOpen && (
              <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                <RightPanelContent currentCount={currentCount} records={records} modulesCount={modules.length} t={t} isDark={isDark} />
              </div>
            )}
          </div>
        ) : (
          /* Tablet/Desktop: fixed right panel */
          <aside style={{
            width: isTablet ? '100%' : 244,
            height: isTablet ? 320 : undefined,
            flexShrink: 0,
            borderLeft: isTablet ? 'none' : `1px solid ${t.border}`,
            borderTop: isTablet ? `1px solid ${t.border}` : 'none',
            overflowY: 'auto', overflowX: 'hidden',
            background: isDark ? 'rgba(10,10,18,0.65)' : 'rgba(247,247,251,0.75)',
            padding: '16px 14px',
            display: 'flex', flexDirection: isTablet ? 'row' : 'column',
            flexWrap: isTablet ? 'wrap' : 'nowrap',
            gap: isTablet ? 16 : 24,
          }}>
            <RightPanelContent currentCount={currentCount} records={records} modulesCount={modules.length} t={t} isDark={isDark} />
          </aside>
        )}
      </div>

      {/* ── MOBILE SIDEBAR DRAWER ────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="modal-scroll-contain"
          style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex' }}
        >
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} onClick={() => setSidebarOpen(false)} />
          <aside style={{
            position: 'relative', zIndex: 51, width: 280, flexShrink: 0,
            background: isDark ? '#0a0a12' : '#f7f7fb',
            overflowY: 'auto', display: 'flex', flexDirection: 'column',
            animation: 'slideInLeft 0.25s ease-out',
            paddingTop: 'env(safe-area-inset-top, 0px)',
            overscrollBehavior: 'contain',
          }}>
            <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${t.border}` }}>
              <span style={{ fontSize: 9.5, color: t.fgDim, fontFamily: monoStack, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Modules</span>
              <button onClick={() => setSidebarOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.fgMuted, display: 'flex', padding: 8, touchAction: 'manipulation' }}>
                <Icon name="close" size={16} />
              </button>
            </div>
            <div style={{ padding: '10px 8px', flex: 1, overflowY: 'auto' }}>
              {modules.map(mod => (
                <ModuleNavItem
                  key={mod.map_id} mod={mod}
                  isActive={selectedModule?.map_id === mod.map_id}
                  count={moduleCounts.find(m => m.map_id === mod.map_id)?.count ?? 0}
                  onSelect={handleSelectModule} t={t} theme={theme}
                />
              ))}
            </div>
            <div style={{ padding: '10px 8px', borderTop: `1px solid ${t.border}`, paddingBottom: 'max(10px, calc(env(safe-area-inset-bottom, 0px) + 10px))' }}>
              <button
                onClick={() => { setShowAddModuleModal(true); setSidebarOpen(false); }}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, background: 'none', border: `1px dashed ${t.primary}55`, color: t.primary, fontSize: 11.5, fontFamily: fontStack, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', touchAction: 'manipulation' }}
              >
                <Icon name="plus" size={12} color={t.primary} />
                Add module
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Add module modal */}
      {showAddModuleModal && selectedConfig && (
        <AddModuleModal
          configId={selectedConfig.config_id}
          onClose={() => setShowAddModuleModal(false)}
          onSuccess={refreshModuleList}
          isMobile={isMobile}
        />
      )}

      {/* Delete config modal */}
      {deleteConfigModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }} onClick={() => !deletingConfig && setDeleteConfigModal(false)} />
          <div style={{ ...glassPanel(t, theme), position: 'relative', zIndex: 1, width: '100%', maxWidth: 400, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: `${t.danger}18`, border: `1px solid ${t.danger}33`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TrashIcon size={18} color={t.danger} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: t.fg }}>Delete Configuration</div>
                <div style={{ fontSize: 11.5, color: t.fgMuted, marginTop: 2 }}>{selectedConfig?.config_name}</div>
              </div>
            </div>
            <p style={{ fontSize: 12.5, color: t.fgMuted, lineHeight: 1.6, marginBottom: 20 }}>
              This ERP and all its data will be permanently deleted. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <Btn variant="ghost" style={{ flex: 1 }} onClick={() => setDeleteConfigModal(false)} disabled={deletingConfig}>Cancel</Btn>
              <Btn variant="danger" style={{ flex: 1 }} onClick={handleDeleteConfig} disabled={deletingConfig}>
                {deletingConfig ? 'Deleting…' : 'Delete ERP'}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* Record modal */}
      {modalOpen && (
        <div
          className="modal-scroll-contain"
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'center',
            padding: isMobile ? 0 : 16,
          }}
        >
          {!isMobile && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)' }} onClick={() => !saving && setModalOpen(false)} />
          )}
          <div style={{
            ...glassPanel(t, theme),
            position: isMobile ? 'fixed' : 'relative',
            inset: isMobile ? 0 : undefined,
            zIndex: 1,
            width: isMobile ? '100%' : '100%',
            maxWidth: isMobile ? '100%' : 'min(95vw, 896px)',
            maxHeight: isMobile ? '100%' : '90vh',
            height: isMobile ? '100%' : undefined,
            borderRadius: isMobile ? 0 : 16,
            display: 'flex', flexDirection: 'column',
            overscrollBehavior: 'contain',
          }}>
            {/* Header */}
            <div style={{
              padding: isMobile
                ? `max(18px, calc(env(safe-area-inset-top, 0px) + 12px)) 16px 14px`
                : '18px 24px 14px',
              borderBottom: `1px solid ${t.border}`,
              display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0,
            }}>
              <div>
                <div style={{ fontSize: 9.5, color: t.accent, fontFamily: monoStack, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
                  {editingRecord ? 'EDIT RECORD' : 'NEW RECORD'} · {moduleName.toUpperCase()}
                </div>
                <div style={{ fontSize: 18, fontWeight: 600, color: t.fg, letterSpacing: '-0.02em' }}>
                  {editingRecord ? `Edit ${moduleName}` : `Create ${moduleName}`}
                </div>
              </div>
              <button onClick={() => !saving && setModalOpen(false)} style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0, background: 'none', border: `1px solid ${t.border}`, cursor: 'pointer', color: t.fgMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'manipulation' }}>
                <Icon name="close" size={13} />
              </button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '14px 16px' : '16px 24px' }}>
              {fields.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '14px 16px' }}>
                  {fields.map(f => {
                    const name = f.name || String(f);
                    const label = translateLabel(f.label || name);
                    const { inputType } = detectInputType(name, f.type);
                    const tagMap = { date: ':date', currency: ':$', number: ':num', number_with_unit: ':unit', enum: ':enum', phone: ':tel', email: ':email', tc_kimlik: ':tc', textarea: ':text' };
                    const typeTag = tagMap[inputType] || ':str';
                    const isWide = inputType === 'textarea';
                    return (
                      <div key={name} style={{ gridColumn: (!isMobile && isWide) ? '1 / -1' : undefined, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                          <label style={{ fontSize: 11, fontWeight: 500, color: t.fgMuted, fontFamily: fontStack }}>{label}</label>
                          <span style={{ fontSize: 9.5, color: t.fgDim, fontFamily: monoStack }}>{typeTag}</span>
                        </div>
                        <SmartInput field={f} value={formData} onChange={handleFieldChange} disabled={saving} />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div>
                  <label style={{ fontSize: 11, color: t.fgMuted, fontFamily: fontStack, display: 'block', marginBottom: 6 }}>Value (JSON)</label>
                  <textarea
                    rows={6}
                    value={typeof formData === 'object' ? JSON.stringify(formData, null, 2) : formData}
                    onChange={e => { try { setFormData(JSON.parse(e.target.value)); } catch { } }}
                    style={{ width: '100%', padding: '11px 14px', borderRadius: 10, background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.5)', border: `1px solid ${t.border}`, color: t.fg, fontSize: 12, fontFamily: monoStack, outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.5 }}
                  />
                </div>
              )}
              {error && (
                <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, background: `${t.danger}18`, border: `1px solid ${t.danger}44`, color: t.danger, fontSize: 12 }}>
                  {error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{
              padding: isMobile
                ? `12px 16px max(18px, calc(env(safe-area-inset-bottom, 0px) + 12px))`
                : '12px 24px 18px',
              borderTop: `1px solid ${t.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
            }}>
              <div style={{ fontSize: 10.5, color: t.fgDim, fontFamily: monoStack }}>
                {(() => {
                  const filled = fields.filter(f => { const n = f.name || String(f); const v = formData[n]; return v !== undefined && v !== null && v !== ''; }).length;
                  return `${filled}/${fields.length} fields`;
                })()}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <Btn variant="ghost" size="md" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</Btn>
                <Btn variant="primary" size="md" icon={saving ? undefined : 'check'} onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </Btn>
              </div>
            </div>
          </div>
        </div>
      )}
    </GlassRoot>
  );
}

// ── Right panel content (shared between mobile accordion and desktop aside) ──
function RightPanelContent({ currentCount, records, modulesCount, t, isDark }) {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const addedThisWeek = records.filter(r => r.created_at && new Date(r.created_at).getTime() > weekAgo).length;
  const metrics = [
    { label: 'Total records', value: currentCount, pct: 100, color: t.primary },
    { label: 'Added this week', value: addedThisWeek, pct: currentCount > 0 ? Math.min(100, Math.round((addedThisWeek / currentCount) * 100)) : 0, color: t.accent },
    { label: 'Modules', value: modulesCount, pct: Math.min(100, Math.round((modulesCount / 10) * 100)), color: t.success },
  ];
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 9.5, color: t.fgDim, fontFamily: monoStack, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>This Week</div>
      {metrics.map((m, i) => (
        <div key={i} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <span style={{ fontSize: 11.5, color: t.fgMuted, fontFamily: 'system-ui' }}>{m.label}</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: t.fg, letterSpacing: '-0.03em' }}>{m.value}</span>
          </div>
          <div style={{ height: 4, borderRadius: 2, background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${m.pct}%`, borderRadius: 2, background: `linear-gradient(90deg, ${m.color}, ${m.color}cc)`, transition: 'width 0.6s cubic-bezier(0.22,1,0.36,1)' }} />
          </div>
        </div>
      ))}
    </div>
  );
}
