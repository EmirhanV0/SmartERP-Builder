import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { promptApi, schemaApi } from '../services/api';
import { translateLabel } from '../utils/translateLabel';
import { detectInputType } from '../utils/detectInputType';
import { useTheme } from '../contexts/ThemeContext';
import { useViewport } from '../hooks/useViewport';
import { themes, glassPanel, fontStack, monoStack } from '../design-system/tokens';
import { GlassRoot, TopBar, Steps, Btn } from '../design-system/components';
import Icon from '../design-system/Icon';

function fieldTypeTag(fieldName) {
  const { inputType } = detectInputType(fieldName);
  const map = {
    date: ':date',
    currency: ':number', number: ':number', number_with_unit: ':number',
    enum: ':enum',
    email: ':text', phone: ':text', tc_kimlik: ':text',
    textarea: ':text', text: ':text',
  };
  return map[inputType] || ':text';
}

// ── Animated confidence gauge ────────────────────────────────────────
function ConfidenceGauge({ score, t, size = 128 }) {
  const [animated, setAnimated] = useState(false);
  const pct = Math.round(score * 100);
  const color = score >= 0.85 ? t.success : score >= 0.65 ? t.warn : t.danger;
  const label = score >= 0.85 ? 'High match' : score >= 0.65 ? 'Medium match' : 'Low match';
  const cx = size / 2;
  const radius = (size - 24) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animated ? pct / 100 : 0) * circumference;
  const innerInset = Math.round(size * 0.125);
  const scoreFontSize = size >= 180 ? 36 : 28;

  useEffect(() => {
    const id = setTimeout(() => setAnimated(true), 80);
    return () => clearTimeout(id);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={cx} cy={cx} r={radius} fill="none" stroke={`${color}20`} strokeWidth="8" />
          <circle
            cx={cx} cy={cx} r={radius}
            fill="none" stroke={color} strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{
              transition: 'stroke-dashoffset 1.2s cubic-bezier(0.22, 1, 0.36, 1)',
              transform: 'rotate(-90deg)',
              transformOrigin: `${cx}px ${cx}px`,
            }}
          />
        </svg>
        <div style={{
          position: 'absolute',
          top: innerInset, bottom: innerInset, left: innerInset, right: innerInset,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${color}18, transparent 70%)`,
        }} />
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: scoreFontSize, fontWeight: 700, color, letterSpacing: '-0.04em', lineHeight: 1 }}>{pct}%</span>
          <span style={{ fontSize: 9.5, color: t.fgDim, fontFamily: monoStack, marginTop: 3, letterSpacing: '0.05em', textTransform: 'uppercase' }}>confidence</span>
        </div>
      </div>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '4px 12px', borderRadius: 99,
        background: `${color}18`, border: `1px solid ${color}35`,
        fontSize: 10.5, color, fontFamily: monoStack,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />
        {label}
      </div>
    </div>
  );
}

// ── Stat card ────────────────────────────────────────────────────────
function StatCard({ label, value, icon, color, t, theme }) {
  return (
    <div style={{
      ...glassPanel(t, theme),
      padding: '14px 16px',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: `${color}18`, border: `1px solid ${color}33`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name={icon} size={16} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color: t.fg, letterSpacing: '-0.04em', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 9.5, color: t.fgDim, fontFamily: monoStack, marginTop: 4, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</div>
      </div>
    </div>
  );
}

// ── Module toggle card ───────────────────────────────────────────────
function ModuleCard({ name, displayName, isEnabled, onToggle, t, theme, aiSuggested }) {
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        ...glassPanel(t, theme),
        padding: '14px 16px',
        cursor: 'pointer',
        border: isEnabled ? `1px solid ${t.primary}55` : `1px solid ${t.border}`,
        background: isEnabled
          ? (isDark ? 'rgba(124,108,255,0.13)' : 'rgba(99,88,255,0.07)')
          : (isDark ? 'rgba(20,20,32,0.55)' : 'rgba(255,255,255,0.65)'),
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        textAlign: 'left',
        transition: 'border-color 0.2s, background 0.2s, box-shadow 0.2s',
        boxShadow: isEnabled
          ? `0 0 0 1px ${t.primary}22, 0 4px 16px ${t.primaryGlow}`
          : (isDark ? '0 8px 32px rgba(0,0,0,0.4)' : '0 8px 32px rgba(15,15,30,0.06)'),
      }}
    >
      <div style={{ flex: 1, marginRight: 10 }}>
        <div style={{
          fontSize: 12.5, fontWeight: 600,
          color: isEnabled ? t.fg : t.fgMuted,
          fontFamily: fontStack, letterSpacing: '-0.01em',
        }}>
          {translateLabel(displayName || name)}
        </div>
        {aiSuggested && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 5 }}>
            <Icon name="sparkles" size={9} color={t.accent} />
            <span style={{ fontSize: 9.5, color: t.accent, fontFamily: monoStack }}>AI suggested</span>
          </div>
        )}
      </div>
      <div style={{
        width: 32, height: 18, borderRadius: 9, flexShrink: 0,
        background: isEnabled
          ? `linear-gradient(135deg, ${t.primary}, ${t.accent})`
          : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.12)'),
        position: 'relative', transition: 'background 0.2s',
      }}>
        <div style={{
          position: 'absolute', top: 2, left: isEnabled ? 16 : 2,
          width: 14, height: 14, borderRadius: '50%',
          background: isEnabled ? '#fff' : (isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.3)'),
          transition: 'left 0.2s',
          boxShadow: isEnabled ? `0 1px 4px ${t.primaryGlow}` : 'none',
        }} />
      </div>
    </button>
  );
}

// ── Entity collapsible card with field pills ─────────────────────────
function EntityCard({ entityName, fields, isEnabled, onToggle, t, theme }) {
  const [open, setOpen] = useState(true);
  const isDark = theme === 'dark';

  const tagColors = {
    ':date': t.primary,
    ':number': t.success,
    ':enum': t.warn,
    ':text': t.accent,
  };

  return (
    <div style={{
      ...glassPanel(t, theme),
      border: isEnabled ? `1px solid ${t.primary}44` : `1px solid ${t.border}`,
      background: isEnabled
        ? (isDark ? 'rgba(124,108,255,0.10)' : 'rgba(99,88,255,0.05)')
        : (isDark ? 'rgba(20,20,32,0.55)' : 'rgba(255,255,255,0.65)'),
      overflow: 'hidden',
      transition: 'border-color 0.2s',
    }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '13px 16px', cursor: 'pointer',
          borderBottom: open && fields.length > 0 ? `1px solid ${t.border}` : 'none',
        }}
        onClick={() => setOpen(o => !o)}
      >
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onToggle(); }}
          style={{
            width: 26, height: 26, borderRadius: 7, flexShrink: 0,
            background: isEnabled
              ? `linear-gradient(135deg, ${t.primary}, ${t.accent})`
              : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'),
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.2s',
            boxShadow: isEnabled ? `0 2px 8px ${t.primaryGlow}` : 'none',
          }}
        >
          <Icon name="check" size={12} color={isEnabled ? '#fff' : t.fgDim} strokeWidth={2.5} />
        </button>

        <div style={{ flex: 1 }}>
          <span style={{
            fontSize: 12.5, fontWeight: 600,
            color: isEnabled ? t.fg : t.fgMuted,
            fontFamily: fontStack, letterSpacing: '-0.01em',
          }}>
            {translateLabel(entityName)}
          </span>
          {fields.length > 0 && (
            <span style={{ marginLeft: 8, fontSize: 10, color: t.fgDim, fontFamily: monoStack }}>
              {fields.length} fields
            </span>
          )}
        </div>

        {fields.length > 0 && (
          <div style={{
            color: t.fgDim,
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
            display: 'flex',
          }}>
            <Icon name="chevron" size={13} />
          </div>
        )}
      </div>

      {open && fields.length > 0 && (
        <div style={{ padding: '10px 16px 12px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {fields.map((f, i) => {
            const tag = fieldTypeTag(f);
            const col = tagColors[tag] || t.fgDim;
            return (
              <span key={i} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 8px', borderRadius: 6,
                background: `${col}16`, border: `1px solid ${col}30`,
                fontSize: 10.5, fontFamily: monoStack, color: col,
              }}>
                {translateLabel(f)}
                <span style={{ color: `${col}80`, fontSize: 9 }}>{tag}</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────
export default function PreviewPage() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { isMobile } = useViewport();
  const t = themes[theme];
  const isDark = theme === 'dark';

  const [analysis, setAnalysis] = useState(null);
  const [configName, setConfigName] = useState('');
  const [enabledEntities, setEnabledEntities] = useState({});
  const [enabledModules, setEnabledModules] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [nameFocused, setNameFocused] = useState(false);

  // Clarification flow (confidence < 0.85)
  const [clarifyAnswers, setClarifyAnswers] = useState({});
  const [clarifyLoading, setClarifyLoading] = useState(false);
  const [clarifyDismissed, setClarifyDismissed] = useState(false);

  // Shared between initial mount and clarify re-analyze: hydrates all
  // proposal-derived state from a fresh AnalysisResponse
  const applyAnalysis = (data) => {
    setAnalysis(data);
    const suggestedName = data.schema_proposal?.suggested_name;
    if (suggestedName) setConfigName(suggestedName);

    const entities = data.schema_proposal?.entities || [];
    if (entities.length > 0) {
      const initial = {};
      entities.forEach((e) => { initial[e] = true; });
      setEnabledEntities(initial);
      setEnabledModules({});
    } else {
      const recommended = data.schema_proposal?.recommended_modules || [];
      const initial = {};
      recommended.forEach((m) => { initial[m.module_id] = true; });
      setEnabledModules(initial);
      setEnabledEntities({});
    }
  };

  useEffect(() => {
    const raw = sessionStorage.getItem('analysisResult');
    if (!raw) { navigate('/setup/describe', { replace: true }); return; }
    try {
      applyAnalysis(JSON.parse(raw));
    } catch {
      navigate('/setup/describe', { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const handleReanalyze = async () => {
    // Unanswered questions are simply left out of the payload
    const answered = Object.fromEntries(
      Object.entries(clarifyAnswers).filter(([, v]) => v && v.trim())
    );
    if (Object.keys(answered).length === 0) return;
    setClarifyLoading(true);
    setError('');
    try {
      // 'other' fallback covers stale sessions stored before sector was persisted
      const sector = analysis.sector || 'other';
      const res = await promptApi.clarify({
        original_text: analysis.raw_input,
        sector,
        answers: answered,
      });
      const next = {
        ...res.data,
        sector,
        clarifyRound: (analysis.clarifyRound ?? 0) + 1,
      };
      sessionStorage.setItem('analysisResult', JSON.stringify(next));
      applyAnalysis(next);
      setClarifyAnswers({});
      const pct = Math.round((next.confidence_score ?? 0) * 100);
      toast.success(`Re-analysis complete — confidence is now ${pct}%.`);
    } catch (err) {
      const msg = !err.response
        ? 'Could not connect to server. Please try again.'
        : 'Re-analysis failed. Please try again.';
      setError(msg);
      toast.error(msg);
    } finally {
      setClarifyLoading(false);
    }
  };

  const toggleEntity = (entityName) =>
    setEnabledEntities((prev) => ({ ...prev, [entityName]: !prev[entityName] }));

  const toggleModule = (moduleId) =>
    setEnabledModules((prev) => ({ ...prev, [moduleId]: !prev[moduleId] }));

  const handleApprove = async () => {
    setLoading(true);
    setError('');
    try {
      const entities = analysis.schema_proposal?.entities || [];
      const fieldsMap = analysis.schema_proposal?.fields || {};
      const recommended = analysis.schema_proposal?.recommended_modules || [];
      const useEntities = entities.length > 0;

      const payload = {
        config_id: analysis.config_id,
        config_name: configName.trim() || null,
        entities: [],
        modules: [],
      };

      if (useEntities) {
        payload.entities = entities
          .filter((e) => enabledEntities[e])
          .map((e) => ({
            entity_name: e,
            display_name: e,
            fields: (fieldsMap[e] || []).map((f) => ({ name: f, type: 'string', required: false, label: f })),
          }));
      } else {
        payload.modules = recommended
          .filter((m) => enabledModules[m.module_id])
          .map((m) => ({ module_id: m.module_id, display_name: m.display_name }));
      }

      const approveRes = await schemaApi.approve(payload);
      if (approveRes.data?.config_id) {
        sessionStorage.setItem('newConfigId', String(approveRes.data.config_id));
      }
      toast.success('ERP created successfully! Redirecting to Dashboard...');
      sessionStorage.removeItem('analysisResult');
      setTimeout(() => navigate('/dashboard', { replace: true }), 1500);
    } catch (err) {
      const msg = !err.response
        ? 'Could not connect to server. Please try again.'
        : 'ERP creation failed.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!analysis) {
    return (
      <GlassRoot>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
          <div style={{ fontSize: 13, color: themes.dark.fgMuted, fontFamily: monoStack }}>Loading…</div>
        </div>
      </GlassRoot>
    );
  }

  const score = analysis.confidence_score ?? 0;
  const entities = analysis.schema_proposal?.entities || [];
  const fieldsMap = analysis.schema_proposal?.fields || {};
  const relationships = analysis.schema_proposal?.relationships || [];
  const recommended = analysis.schema_proposal?.recommended_modules || [];
  const useEntities = entities.length > 0;

  // Clarification flow derived values
  const isLowConfidence = score < 0.85;
  const clarifyRound = analysis.clarifyRound ?? 0;
  const clarifyQuestions = (analysis.ambiguity_questions || [])
    .slice(0, 4) // safety cap — the prompt asks for 2-4 but AI may overshoot
    .map((q) => (typeof q === 'string' ? q : q.question || JSON.stringify(q)));
  const canClarify = clarifyRound < 2 && clarifyQuestions.length > 0;
  const hasClarifyAnswer = Object.values(clarifyAnswers).some((v) => v && v.trim());

  const activeCount = useEntities
    ? entities.filter((e) => enabledEntities[e]).length
    : recommended.filter((m) => enabledModules[m.module_id]).length;

  const totalFields = useEntities
    ? entities.reduce((sum, e) => sum + (fieldsMap[e]?.length || 0), 0)
    : 0;

  const sectorLabel = analysis.sector || analysis.schema_proposal?.sector || 'your business';

  return (
    <GlassRoot>
      {/* TopBar */}
      <div style={{ position: 'absolute', top: 'max(16px, calc(env(safe-area-inset-top, 0px) + 8px))', left: 16, right: 16, zIndex: 3 }}>
        <TopBar subtitle="step 2 of 3" showSearch={false} />
      </div>

      {/* Scrollable content */}
      <div style={{
        position: 'absolute', top: isMobile ? 70 : 80, left: 0, right: 0, bottom: 0,
        overflow: 'auto', zIndex: 2, padding: isMobile ? '20px 16px 60px' : '24px 24px 60px',
      }}>
        <div style={{ maxWidth: 840, margin: '0 auto' }}>

          {/* Steps indicator */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            {isMobile ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  padding: '3px 10px', borderRadius: 99,
                  background: `linear-gradient(135deg, ${t.primary}, ${t.accent})`,
                  fontSize: 10.5, color: '#fff', fontFamily: monoStack, fontWeight: 600,
                }}>Step 2</div>
                <span style={{ fontSize: 11.5, color: t.fgMuted, fontFamily: monoStack }}>of 3 · Review & Approve</span>
              </div>
            ) : (
              <Steps current={1} total={3} labels={['Describe', 'Review', 'Build']} />
            )}
          </div>

          {/* Error banner */}
          {error && (
            <div style={{
              marginBottom: 16, padding: '10px 14px', borderRadius: 10,
              background: `${t.danger}18`, border: `1px solid ${t.danger}44`,
              color: t.danger, fontSize: 12.5, fontFamily: fontStack,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <Icon name="close" size={14} color={t.danger} />
              <span style={{ flex: 1 }}>{error}</span>
              <button
                onClick={() => setError('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.danger, display: 'flex' }}
              >
                <Icon name="close" size={12} />
              </button>
            </div>
          )}

          {/* ── Hero + Gauge card ─────────────────────────────────── */}
          <div style={{
            ...glassPanel(t, theme),
            padding: isMobile ? '20px 16px' : '28px 28px 24px',
            marginBottom: 14,
            display: 'flex',
            gap: isMobile ? 20 : 28,
            alignItems: isMobile ? 'center' : 'flex-start',
            flexDirection: isMobile ? 'column' : 'row',
          }}>
            {/* Gauge — top on mobile, right on desktop */}
            {isMobile && (
              <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                <ConfidenceGauge score={score} t={t} size={140} />
              </div>
            )}

            {/* Left: text + name input + CTAs */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '4px 10px', borderRadius: 99,
                background: `${t.accent}15`, border: `1px solid ${t.accent}30`,
                fontSize: 10.5, fontFamily: monoStack, color: t.accent,
                marginBottom: 14,
              }}>
                <Icon name="sparkles" size={10} color={t.accent} />
                AI suggests:
              </div>

              <h1 key={theme} style={{
                fontSize: isMobile ? 22 : 26, fontWeight: 600, letterSpacing: '-0.03em',
                margin: '0 0 8px', lineHeight: 1.18,
                background: `linear-gradient(135deg, ${t.fg}, ${t.primary} 55%, ${t.accent})`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>
                A {activeCount}-module ERP<br />
                <span style={{ fontSize: isMobile ? 15 : 17, fontWeight: 400 }}>tailored for {sectorLabel}</span>
              </h1>

              <p style={{ fontSize: 13, color: t.fgMuted, margin: '0 0 20px', lineHeight: 1.6 }}>
                Review the modules below, rename your ERP, then approve to build your system.
              </p>

              {/* ERP Name input */}
              <div style={{ marginBottom: 20 }}>
                <div style={{
                  fontSize: 10, color: t.fgMuted, fontFamily: monoStack,
                  letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 7,
                }}>
                  ERP Name
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px',
                  background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.5)',
                  border: `1px solid ${nameFocused ? t.primary : t.border}`,
                  borderRadius: 10,
                  boxShadow: nameFocused ? `0 0 0 3px ${t.primaryGlow}` : 'none',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}>
                  <Icon name="file" size={13} color={t.fgDim} />
                  <input
                    type="text"
                    value={configName}
                    onChange={e => setConfigName(e.target.value)}
                    onFocus={() => setNameFocused(true)}
                    onBlur={() => setNameFocused(false)}
                    placeholder="e.g. Athlete Health ERP"
                    maxLength={150}
                    style={{
                      flex: 1, background: 'none', border: 'none', outline: 'none',
                      color: t.fg, fontSize: 13, fontFamily: fontStack,
                      letterSpacing: '-0.005em',
                    }}
                  />
                </div>
                {analysis.schema_proposal?.suggested_name && (
                  <div style={{ marginTop: 5, fontSize: 10.5, color: t.fgDim, fontFamily: monoStack }}>
                    AI suggestion: {analysis.schema_proposal.suggested_name}
                  </div>
                )}
              </div>

              {/* CTAs */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Btn
                  variant="primary"
                  size="lg"
                  icon={loading ? undefined : 'check'}
                  onClick={handleApprove}
                  disabled={loading || activeCount === 0}
                >
                  {loading ? 'Building ERP…' : 'Approve & Build'}
                </Btn>
                <Btn
                  variant="ghost"
                  size="lg"
                  icon="chevronLeft"
                  onClick={() => navigate('/setup/describe')}
                  disabled={loading}
                >
                  Edit Schema
                </Btn>
              </div>
            </div>

            {/* Right: gauge — desktop only */}
            {!isMobile && (
              <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 4 }}>
                <ConfidenceGauge score={score} t={t} size={200} />
              </div>
            )}
          </div>

          {/* ── Clarification panel (confidence < 0.85) ──────────── */}
          {isLowConfidence && !clarifyDismissed && (
            <div style={{
              ...glassPanel(t, theme),
              marginBottom: 14, padding: isMobile ? '16px 14px' : '18px 20px',
              border: `1px solid ${t.warn}44`,
              background: isDark ? 'rgba(251,191,36,0.06)' : 'rgba(251,191,36,0.04)',
            }}>
              {/* Header: title + confidence badge */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: canClarify ? 14 : 0 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: `${t.warn}18`, border: `1px solid ${t.warn}33`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon name="sparkles" size={15} color={t.warn} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4,
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: t.warn }}>
                      Help me understand better
                    </span>
                    <span style={{
                      padding: '2px 8px', borderRadius: 99,
                      background: `${t.warn}18`, border: `1px solid ${t.warn}35`,
                      fontSize: 9.5, color: t.warn, fontFamily: monoStack,
                    }}>
                      {Math.round(score * 100)}% confidence
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: t.fgMuted, margin: 0, lineHeight: 1.5 }}>
                    {canClarify
                      ? 'This is my best guess so far. Answer any of these (all optional) and I’ll refine the proposal — or continue with it as-is.'
                      : 'Confidence is still below 85%. Review the best-guess proposal below — you can continue and adjust modules manually.'}
                  </p>
                  {!canClarify && (
                    <button
                      type="button"
                      onClick={() => setClarifyDismissed(true)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: 12, color: t.fgMuted, fontFamily: fontStack,
                        textDecoration: 'underline', textUnderlineOffset: 3,
                        padding: '6px 0 0', touchAction: 'manipulation',
                      }}
                    >
                      Continue anyway
                    </button>
                  )}
                </div>
              </div>

              {canClarify && (
                <>
                  {/* Question inputs — single column, full-width */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                    {clarifyQuestions.map((q, i) => (
                      <div key={i}>
                        <div style={{
                          display: 'flex', gap: 7, alignItems: 'flex-start',
                          fontSize: 12, color: t.fg, marginBottom: 6, lineHeight: 1.45,
                        }}>
                          <span style={{ color: t.warn, flexShrink: 0, marginTop: 1 }}>›</span>
                          {q}
                        </div>
                        <input
                          type="text"
                          value={clarifyAnswers[q] || ''}
                          onChange={(e) => setClarifyAnswers((prev) => ({ ...prev, [q]: e.target.value }))}
                          placeholder="Your answer (optional)…"
                          disabled={clarifyLoading}
                          maxLength={300}
                          style={{
                            width: '100%', boxSizing: 'border-box',
                            padding: '10px 14px',
                            background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.55)',
                            border: `1px solid ${t.border}`,
                            borderRadius: 10, outline: 'none',
                            color: t.fg, fontSize: 12.5, fontFamily: fontStack,
                            letterSpacing: '-0.005em',
                          }}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Re-analyze CTA + continue-anyway escape hatch */}
                  <div style={{
                    display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
                    flexDirection: isMobile ? 'column' : 'row',
                  }}>
                    <Btn
                      variant="primary"
                      icon={clarifyLoading ? undefined : 'sparkles'}
                      onClick={handleReanalyze}
                      disabled={clarifyLoading || !hasClarifyAnswer}
                      style={isMobile ? { width: '100%', justifyContent: 'center' } : undefined}
                    >
                      {clarifyLoading ? 'Re-analyzing…' : 'Re-analyze with answers'}
                    </Btn>
                    <button
                      type="button"
                      onClick={() => setClarifyDismissed(true)}
                      disabled={clarifyLoading}
                      style={{
                        background: 'none', border: 'none', cursor: clarifyLoading ? 'not-allowed' : 'pointer',
                        fontSize: 12, color: t.fgMuted, fontFamily: fontStack,
                        textDecoration: 'underline', textUnderlineOffset: 3,
                        padding: '8px 4px', touchAction: 'manipulation',
                      }}
                    >
                      Continue anyway
                    </button>
                  </div>

                  {/* Thinking trail during re-analysis */}
                  {clarifyLoading && (
                    <div style={{
                      borderTop: `1px solid ${t.border}`, marginTop: 14, paddingTop: 12,
                      display: 'flex', alignItems: 'center', gap: 10,
                    }}>
                      <svg
                        width={12} height={12} viewBox="0 0 24 24" fill="none"
                        stroke={t.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        className="animate-spin-slow" style={{ flexShrink: 0 }}
                      >
                        <path d="M12 3v4M12 17v4M5 12H1M23 12h-4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                      <span style={{ fontSize: 11.5, color: t.fgMuted }}>
                        Merging your answers into the analysis…
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── 4 Stat cards ─────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
            <StatCard
              label="Modules"
              value={activeCount}
              icon="layers"
              color={t.primary}
              t={t} theme={theme}
            />
            <StatCard
              label="Entities"
              value={useEntities ? entities.length : recommended.length}
              icon="scan"
              color={t.accent}
              t={t} theme={theme}
            />
            <StatCard
              label="Fields"
              value={totalFields || '—'}
              icon="list"
              color={t.success}
              t={t} theme={theme}
            />
            <StatCard
              label="Relations"
              value={relationships.length || '—'}
              icon="activity"
              color={t.warn}
              t={t} theme={theme}
            />
          </div>

          {/* ── Modules / Entities section ────────────────────────── */}
          {useEntities ? (
            <>
              <div style={{ marginBottom: 14 }}>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.fg, fontFamily: fontStack }}>
                    Suggested Modules
                  </div>
                  <div style={{ fontSize: 10.5, color: t.fgDim, fontFamily: monoStack, marginTop: 3 }}>
                    Toggle to include in your ERP · {activeCount} of {entities.length} selected
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 10 }}>
                  {entities.map(entityName => (
                    <ModuleCard
                      key={entityName}
                      name={entityName}
                      displayName={entityName}
                      isEnabled={enabledEntities[entityName] ?? true}
                      onToggle={() => toggleEntity(entityName)}
                      t={t} theme={theme}
                      aiSuggested
                    />
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.fg, fontFamily: fontStack }}>
                    Entities & Fields
                  </div>
                  <div style={{ fontSize: 10.5, color: t.fgDim, fontFamily: monoStack, marginTop: 3 }}>
                    Field color indicates type ·{' '}
                    <span style={{ color: t.primary }}>:date</span>{' · '}
                    <span style={{ color: t.success }}>:number</span>{' · '}
                    <span style={{ color: t.warn }}>:enum</span>{' · '}
                    <span style={{ color: t.accent }}>:text</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {entities.map(entityName => (
                    <EntityCard
                      key={entityName}
                      entityName={entityName}
                      fields={fieldsMap[entityName] || []}
                      isEnabled={enabledEntities[entityName] ?? true}
                      onToggle={() => toggleEntity(entityName)}
                      t={t} theme={theme}
                    />
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div style={{ marginBottom: 14 }}>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.fg, fontFamily: fontStack }}>
                  Suggested Modules
                </div>
                <div style={{ fontSize: 10.5, color: t.fgDim, fontFamily: monoStack, marginTop: 3 }}>
                  {activeCount} of {recommended.length} selected
                </div>
              </div>
              {recommended.length === 0 ? (
                <div style={{
                  ...glassPanel(t, theme), padding: 24,
                  textAlign: 'center', color: t.fgDim, fontSize: 13,
                }}>
                  No module suggestions found.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 10 }}>
                  {recommended.map(mod => (
                    <ModuleCard
                      key={mod.module_id}
                      name={mod.module_id}
                      displayName={mod.display_name}
                      isEnabled={enabledModules[mod.module_id] ?? true}
                      onToggle={() => toggleModule(mod.module_id)}
                      t={t} theme={theme}
                      aiSuggested={mod.ai_suggested}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Relationships ─────────────────────────────────────── */}
          {relationships.length > 0 && (
            <div style={{ ...glassPanel(t, theme), padding: '16px 20px', marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.fg, fontFamily: fontStack, marginBottom: 10 }}>
                Relationships
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {relationships.map((rel, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: t.fgMuted }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.primary, flexShrink: 0 }} />
                    {typeof rel === 'string'
                      ? rel
                      : `${rel.from || ''} → ${rel.to || ''} (${rel.type || ''})`}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </GlassRoot>
  );
}
