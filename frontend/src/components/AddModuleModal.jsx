import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useTheme } from '../contexts/ThemeContext';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { themes, glassPanel, fontStack, monoStack } from '../design-system/tokens';
import { Btn } from '../design-system/components';
import Icon from '../design-system/Icon';
import { configurationsApi } from '../services/api';

const FIELD_TYPES = [
  { value: 'text',             label: 'Text' },
  { value: 'textarea',         label: 'Text Area' },
  { value: 'number',           label: 'Number' },
  { value: 'currency',         label: 'Currency' },
  { value: 'date',             label: 'Date' },
  { value: 'phone',            label: 'Phone' },
  { value: 'email',            label: 'Email' },
  { value: 'enum',             label: 'Dropdown / Enum' },
  { value: 'gender',           label: 'Gender' },
  { value: 'tc_kimlik',        label: 'TC Kimlik' },
  { value: 'number_with_unit', label: 'Number + Unit' },
];

const CURRENCY_OPTIONS = [
  { code: 'TRY', label: '₺ TRY' },
  { code: 'USD', label: '$ USD' },
  { code: 'EUR', label: '€ EUR' },
  { code: 'GBP', label: '£ GBP' },
  { code: 'JPY', label: '¥ JPY' },
  { code: 'CHF', label: 'Fr CHF' },
  { code: 'AED', label: 'AED' },
];

let _uid = 0;
function newField() {
  return { id: ++_uid, name: '', type: 'text', required: false, enum_values: '', unit: '', default_currency: 'TRY' };
}

function TrashIcon({ size = 13, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, display: 'block' }}>
      <path d="M3 6h18M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    </svg>
  );
}

export default function AddModuleModal({ configId, onClose, onSuccess, isMobile = false }) {
  const { theme } = useTheme();
  const t = themes[theme];
  const isDark = theme === 'dark';
  const { lock, unlock } = useBodyScrollLock();

  const [moduleName, setModuleName]       = useState('');
  const [displayName, setDisplayName]     = useState('');
  const [description, setDescription]     = useState('');
  const [fields, setFields]               = useState([newField(), newField()]);
  const [saving, setSaving]               = useState(false);
  const [error, setError]                 = useState('');

  useEffect(() => {
    lock();
    return () => unlock();
  }, []);

  const addField = () => setFields(prev => [...prev, newField()]);
  const removeField = (id) => {
    if (fields.length <= 1) return;
    setFields(prev => prev.filter(f => f.id !== id));
  };
  const updateField = (id, patch) =>
    setFields(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));

  const filledFields = fields.filter(f => f.name.trim());

  const handleSubmit = async () => {
    if (!moduleName.trim()) { setError('Module name is required.'); return; }
    if (filledFields.length < 1) { setError('At least 1 field with a name is required.'); return; }
    setSaving(true); setError('');
    try {
      await configurationsApi.addManualModule(configId, {
        module_name:  moduleName.trim(),
        display_name: displayName.trim() || moduleName.trim(),
        description:  description.trim() || undefined,
        fields: filledFields.map(f => ({
          name:             f.name.trim(),
          type:             f.type,
          required:         f.required,
          enum_values:      f.type === 'enum'
            ? f.enum_values.split(',').map(v => v.trim()).filter(Boolean)
            : undefined,
          unit:             f.type === 'number_with_unit' ? (f.unit.trim() || undefined) : undefined,
          default_currency: f.type === 'currency' ? f.default_currency : undefined,
        })),
      });
      toast.success('Module created!');
      onSuccess();
      onClose();
    } catch (err) {
      const detail = err.response?.data?.detail;
      const isConflict = err.response?.status === 409;
      const msg = typeof detail === 'string'
        ? detail
        : isConflict
          ? 'A module with this name already exists in this ERP.'
          : 'Could not create module.';
      setError(msg);
      toast.error(isConflict ? 'Module name already exists.' : 'Could not create module.');
    } finally { setSaving(false); }
  };

  const inputStyle = {
    width: '100%', padding: '8px 11px',
    background: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.7)',
    border: `1px solid ${t.border}`, borderRadius: 8,
    color: t.fg, fontSize: 12.5, fontFamily: fontStack, outline: 'none',
    boxSizing: 'border-box',
  };
  const selectStyle = {
    ...inputStyle, cursor: 'pointer',
    appearance: 'none', WebkitAppearance: 'none',
  };

  // Mobile: full-screen panel
  const panelStyle = isMobile
    ? {
        ...glassPanel(t, theme),
        borderRadius: 0,
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }
    : {
        ...glassPanel(t, theme),
        width: '100%', maxWidth: 'min(95vw, 768px)',
        maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        gap: 0,
      };

  const headerPaddingTop = isMobile
    ? 'max(20px, calc(env(safe-area-inset-top, 0px) + 14px))'
    : '20px';

  const footerPaddingBottom = isMobile
    ? 'max(14px, calc(env(safe-area-inset-bottom, 0px) + 10px))'
    : '14px';

  const panel = (
    <div style={panelStyle}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: `${headerPaddingTop} 20px 16px`,
        borderBottom: `1px solid ${t.border}`,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: `linear-gradient(135deg, ${t.primary}, ${t.accent})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 4px 14px ${t.primaryGlow}`,
          }}>
            <Icon name="layers" size={16} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: t.fg, letterSpacing: '-0.02em' }}>
              Create New Module
            </div>
            <div style={{ fontSize: 10.5, color: t.fgDim, fontFamily: monoStack, marginTop: 1 }}>
              Define fields manually
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.fgDim, display: 'flex', padding: 8, touchAction: 'manipulation' }}
          onMouseEnter={e => { e.currentTarget.style.color = t.fg; }}
          onMouseLeave={e => { e.currentTarget.style.color = t.fgDim; }}
        >
          <Icon name="close" size={18} />
        </button>
      </div>

      {/* Body */}
      <div className="modal-scroll-contain" style={{ padding: '20px 20px', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', flex: 1 }}>
        {/* Error */}
        {error && (
          <div style={{
            padding: '10px 14px', borderRadius: 9,
            background: `${t.danger}18`, border: `1px solid ${t.danger}44`,
            color: t.danger, fontSize: 12.5, fontFamily: fontStack,
          }}>
            {error}
          </div>
        )}

        {/* Module info */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 500, color: t.fgMuted, marginBottom: 5 }}>Module name *</div>
            <input
              value={moduleName}
              onChange={e => { setModuleName(e.target.value); setError(''); }}
              placeholder="e.g. Insurance Claims"
              style={inputStyle}
            />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 500, color: t.fgMuted, marginBottom: 5 }}>Display name</div>
            <input
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Same as module name if empty"
              style={inputStyle}
            />
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 500, color: t.fgMuted, marginBottom: 5 }}>Description (optional)</div>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Briefly describe what this module tracks"
            rows={2}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
          />
        </div>

        {/* Fields builder */}
        <div>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10,
          }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: t.fgMuted }}>Fields</div>
            <span style={{ fontSize: 10, color: t.fgDim, fontFamily: monoStack }}>
              {filledFields.length} configured
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 10 : 6 }}>
            {/* Column headers — desktop only */}
            {!isMobile && (
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 140px 44px 28px',
                gap: 6, paddingLeft: 2,
              }}>
                {['Field name', 'Type', 'Req.', ''].map(h => (
                  <div key={h} style={{ fontSize: 9.5, color: t.fgDim, fontFamily: monoStack, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{h}</div>
                ))}
              </div>
            )}

            {fields.map(f => (
              <div key={f.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {isMobile ? (
                  /* Mobile: card layout */
                  <div style={{
                    padding: '12px', borderRadius: 10,
                    background: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.55)',
                    border: `1px solid ${t.border}`,
                    display: 'flex', flexDirection: 'column', gap: 8,
                  }}>
                    {/* Name + delete */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        value={f.name}
                        onChange={e => updateField(f.id, { name: e.target.value })}
                        placeholder="field_name"
                        style={{ ...inputStyle, flex: 1, padding: '9px 11px' }}
                      />
                      <button
                        onClick={() => removeField(f.id)}
                        disabled={fields.length <= 1}
                        style={{
                          background: 'none', border: 'none', cursor: fields.length > 1 ? 'pointer' : 'default',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          opacity: fields.length <= 1 ? 0.25 : 0.6,
                          padding: 8, minWidth: 36, minHeight: 36,
                          touchAction: 'manipulation',
                        }}
                      >
                        <TrashIcon size={16} color={t.danger} />
                      </button>
                    </div>
                    {/* Type + required */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <select
                        value={f.type}
                        onChange={e => updateField(f.id, { type: e.target.value, enum_values: '', unit: '' })}
                        style={{ ...selectStyle, flex: 1, padding: '9px 11px' }}
                      >
                        {FIELD_TYPES.map(ft => (
                          <option key={ft.value} value={ft.value}
                            style={{ background: isDark ? '#0f0f1a' : '#fff', color: t.fg }}>
                            {ft.label}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => updateField(f.id, { required: !f.required })}
                        style={{
                          height: 38, padding: '0 12px', borderRadius: 7,
                          border: `1px solid ${f.required ? t.primary : t.border}`,
                          background: f.required ? `${t.primary}18` : 'transparent',
                          color: f.required ? t.primary : t.fgDim,
                          cursor: 'pointer', fontSize: 10, fontFamily: monoStack, fontWeight: 600,
                          flexShrink: 0, touchAction: 'manipulation',
                        }}
                      >
                        {f.required ? 'REQ' : 'OPT'}
                      </button>
                    </div>
                    {/* Sub-rows */}
                    {f.type === 'enum' && (
                      <input
                        value={f.enum_values}
                        onChange={e => updateField(f.id, { enum_values: e.target.value })}
                        placeholder="Pending, Approved, Rejected  (comma-separated)"
                        style={{ ...inputStyle, padding: '8px 11px', fontSize: 11.5, color: t.fgMuted }}
                      />
                    )}
                    {f.type === 'number_with_unit' && (
                      <input
                        value={f.unit}
                        onChange={e => updateField(f.id, { unit: e.target.value })}
                        placeholder="Unit label (e.g. kg, pcs, m²)"
                        style={{ ...inputStyle, padding: '8px 11px', fontSize: 11.5, color: t.fgMuted }}
                      />
                    )}
                    {f.type === 'currency' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 10.5, color: t.fgDim, flexShrink: 0, fontFamily: fontStack }}>Currency:</span>
                        <select
                          value={f.default_currency}
                          onChange={e => updateField(f.id, { default_currency: e.target.value })}
                          style={{ ...selectStyle, padding: '6px 8px', fontSize: 11.5, flex: 1 }}
                        >
                          {CURRENCY_OPTIONS.map(c => (
                            <option key={c.code} value={c.code}
                              style={{ background: isDark ? '#0f0f1a' : '#fff', color: t.fg }}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Desktop: grid layout */
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 44px 28px', gap: 6, alignItems: 'center' }}>
                      <input
                        value={f.name}
                        onChange={e => updateField(f.id, { name: e.target.value })}
                        placeholder="field_name"
                        style={{ ...inputStyle, padding: '7px 10px' }}
                      />
                      <select
                        value={f.type}
                        onChange={e => updateField(f.id, { type: e.target.value, enum_values: '', unit: '' })}
                        style={{ ...selectStyle, padding: '7px 10px' }}
                      >
                        {FIELD_TYPES.map(ft => (
                          <option key={ft.value} value={ft.value}
                            style={{ background: isDark ? '#0f0f1a' : '#fff', color: t.fg }}>
                            {ft.label}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => updateField(f.id, { required: !f.required })}
                        style={{
                          height: 32, borderRadius: 7, border: `1px solid ${f.required ? t.primary : t.border}`,
                          background: f.required ? `${t.primary}18` : 'transparent',
                          color: f.required ? t.primary : t.fgDim,
                          cursor: 'pointer', fontSize: 10, fontFamily: monoStack, fontWeight: 600,
                        }}
                      >
                        {f.required ? 'YES' : 'NO'}
                      </button>
                      <button
                        onClick={() => removeField(f.id)}
                        disabled={fields.length <= 1}
                        style={{
                          background: 'none', border: 'none', cursor: fields.length > 1 ? 'pointer' : 'default',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          opacity: fields.length <= 1 ? 0.25 : 0.6,
                          padding: 4,
                        }}
                        onMouseEnter={e => { if (fields.length > 1) e.currentTarget.style.opacity = '1'; }}
                        onMouseLeave={e => { e.currentTarget.style.opacity = fields.length <= 1 ? '0.25' : '0.6'; }}
                      >
                        <TrashIcon color={t.danger} />
                      </button>
                    </div>

                    {f.type === 'enum' && (
                      <div style={{ paddingLeft: 2, paddingRight: 78 }}>
                        <input
                          value={f.enum_values}
                          onChange={e => updateField(f.id, { enum_values: e.target.value })}
                          placeholder="Pending, Approved, Rejected  (comma-separated)"
                          style={{ ...inputStyle, padding: '6px 10px', fontSize: 11.5, color: t.fgMuted }}
                        />
                      </div>
                    )}
                    {f.type === 'number_with_unit' && (
                      <div style={{ paddingLeft: 2, paddingRight: 78 }}>
                        <input
                          value={f.unit}
                          onChange={e => updateField(f.id, { unit: e.target.value })}
                          placeholder="Unit label (e.g. kg, pcs, m²)"
                          style={{ ...inputStyle, padding: '6px 10px', fontSize: 11.5, color: t.fgMuted }}
                        />
                      </div>
                    )}
                    {f.type === 'currency' && (
                      <div style={{ paddingLeft: 2, paddingRight: 78, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 10.5, color: t.fgDim, flexShrink: 0, fontFamily: fontStack }}>Default currency:</span>
                        <select
                          value={f.default_currency}
                          onChange={e => updateField(f.id, { default_currency: e.target.value })}
                          style={{ ...selectStyle, padding: '5px 8px', fontSize: 11.5, width: 110 }}
                        >
                          {CURRENCY_OPTIONS.map(c => (
                            <option key={c.code} value={c.code}
                              style={{ background: isDark ? '#0f0f1a' : '#fff', color: t.fg }}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}

            {/* Add field */}
            <button
              onClick={addField}
              style={{
                padding: isMobile ? '10px 12px' : '7px 12px', borderRadius: 8, marginTop: 2,
                background: 'none', border: `1px dashed ${t.primary}55`,
                color: t.primary, fontSize: 11.5, fontFamily: fontStack, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                transition: 'border-color 0.15s, background 0.15s',
                touchAction: 'manipulation',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = `${t.primary}10`; e.currentTarget.style.borderColor = t.primary; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = `${t.primary}55`; }}
            >
              <Icon name="plus" size={12} color={t.primary} />
              Add field
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        padding: `14px 20px ${footerPaddingBottom}`,
        borderTop: `1px solid ${t.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 11, color: t.fgDim, fontFamily: monoStack }}>
          {filledFields.length} field{filledFields.length !== 1 ? 's' : ''} configured
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="ghost" size="sm" onClick={onClose} disabled={saving}>Cancel</Btn>
          <Btn variant="primary" size="sm" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Creating…' : <>Create Module <Icon name="arrowRight" size={12} color="#fff" /></>}
          </Btn>
        </div>
      </div>
    </div>
  );

  if (isMobile) return panel;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
        animation: 'fadeIn 0.15s ease',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {panel}
    </div>
  );
}
