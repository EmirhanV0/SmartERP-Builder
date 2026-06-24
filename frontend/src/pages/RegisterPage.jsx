import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { authApi } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { useViewport } from '../hooks/useViewport';
import { themes, glassPanel, fontStack, monoStack } from '../design-system/tokens';
import { GlassRoot, TopBar, Btn, Field, DSInput } from '../design-system/components';
import Icon from '../design-system/Icon';

const SECTORS = [
  { value: 'retail', label: 'Retail', icon: 'package' },
  { value: 'manufacturing', label: 'Manufacturing', icon: 'flame' },
  { value: 'healthcare', label: 'Healthcare', icon: 'pulse' },
  { value: 'construction', label: 'Construction', icon: 'truck' },
  { value: 'technology', label: 'Technology', icon: 'bolt' },
  { value: 'logistics', label: 'Logistics', icon: 'truck' },
  { value: 'education', label: 'Education', icon: 'file' },
  { value: 'food', label: 'Food & F&B', icon: 'flame' },
  { value: 'finance', label: 'Finance', icon: 'coin' },
  { value: 'service', label: 'Service', icon: 'users' },
  { value: 'other', label: 'Other', icon: 'plus' },
];

export default function RegisterPage() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { isMobile } = useViewport();
  const t = themes[theme];
  const isDark = theme === 'dark';

  const [form, setForm] = useState({ full_name: '', email: '', password: '', company_name: '', sector_code: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState('');

  const handleChange = (e) => { setForm(p => ({ ...p, [e.target.name]: e.target.value })); setError(''); };
  const handleSector = (val) => { setForm(p => ({ ...p, sector_code: val })); setError(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.full_name.trim()) { setError('Full name is required.'); return; }
    if (!form.email || !form.email.includes('@')) { setError('Please enter a valid email.'); return; }
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (!form.company_name.trim()) { setError('Company name is required.'); return; }
    if (!form.sector_code) { setError('Please select a sector.'); return; }

    setLoading(true); setError('');
    try {
      await authApi.register(form);
      toast.success('Registration successful! You can now log in.');
      navigate('/login');
    } catch (err) {
      const s = err.response?.status;
      const d = err.response?.data?.detail;
      if (s === 400 && d?.toLowerCase().includes('email')) setError('This email is already registered.');
      else if (s === 400) setError('Registration failed. Please try again.');
      else if (!err.response) setError('Could not connect to server.');
      else setError('An unexpected error occurred.');
    } finally { setLoading(false); }
  };

  return (
    <GlassRoot>
      <div style={{ position: 'absolute', top: 'max(16px, calc(env(safe-area-inset-top, 0px) + 8px))', left: 16, right: 16, zIndex: 3 }}>
        <TopBar mode="auth" showSearch={false} />
      </div>

      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: isMobile ? '16px' : '24px', zIndex: 2, paddingTop: isMobile ? 70 : 90, overflowY: 'auto',
      }}>
        <div style={{ ...glassPanel(t, theme), width: '100%', maxWidth: isMobile ? '100%' : 520, padding: isMobile ? 24 : 40, display: 'flex', flexDirection: 'column', gap: 18, margin: 'auto' }}>
          {/* Hero */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 11,
                background: `linear-gradient(135deg, ${t.primary}, ${t.accent})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 8px 22px ${t.primaryGlow}`,
              }}>
                <Icon name="sparkles" size={18} color="#fff" strokeWidth={2} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: t.fgDim, fontFamily: monoStack, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Step 1 of 1 · Quick setup</div>
                <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.025em', margin: 0, marginTop: 2, color: t.fg }}>Create your workspace</h1>
              </div>
            </div>
            <div style={{ fontSize: 12.5, color: t.fgMuted, lineHeight: 1.5 }}>
              30 seconds. We'll personalize SmartERP for your sector right away.
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 10, background: `${t.danger}18`, border: `1px solid ${t.danger}44`, color: t.danger, fontSize: 12.5 }}>{error}</div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }} noValidate>
            {/* Name + Email row */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
              <Field label="Full name">
                <DSInput name="full_name" value={form.full_name} placeholder="Your name" icon="user"
                  focused={focusedField === 'full_name'} onChange={handleChange}
                  onFocus={() => setFocusedField('full_name')} onBlur={() => setFocusedField('')}
                  disabled={loading} autoComplete="name" />
              </Field>
              <Field label="Work email">
                <DSInput name="email" type="email" value={form.email} placeholder="you@company.com"
                  focused={focusedField === 'email'} onChange={handleChange}
                  onFocus={() => setFocusedField('email')} onBlur={() => setFocusedField('')}
                  disabled={loading} autoComplete="email" />
              </Field>
            </div>

            <Field label="Password" sublabel="min 8 chars">
              <DSInput name="password" type="password" value={form.password} placeholder="At least 8 characters"
                icon="shield" focused={focusedField === 'password'} onChange={handleChange}
                onFocus={() => setFocusedField('password')} onBlur={() => setFocusedField('')}
                disabled={loading} autoComplete="new-password" />
            </Field>

            <Field label="Company name">
              <DSInput name="company_name" value={form.company_name} placeholder="Your company"
                icon="package" focused={focusedField === 'company_name'} onChange={handleChange}
                onFocus={() => setFocusedField('company_name')} onBlur={() => setFocusedField('')}
                disabled={loading} autoComplete="organization" />
            </Field>

            {/* Visual sector picker */}
            <Field label="Sector" sublabel="we'll suggest modules">
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(4, 1fr)', gap: 6 }}>
                {SECTORS.slice(0, 8).map((s) => {
                  const selected = form.sector_code === s.value;
                  return (
                    <div
                      key={s.value}
                      onClick={() => handleSector(s.value)}
                      style={{
                        padding: '10px 10px', borderRadius: 9,
                        background: selected
                          ? (isDark ? `linear-gradient(135deg, ${t.primary}33, ${t.accent}22)` : `${t.primary}15`)
                          : (isDark ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.5)'),
                        border: `1px solid ${selected ? `${t.primary}66` : t.border}`,
                        cursor: 'pointer',
                        boxShadow: selected ? `0 4px 14px ${t.primaryGlow}` : 'none',
                        position: 'relative',
                        transition: 'all 0.15s',
                      }}
                    >
                      <Icon name={s.icon} size={14} color={selected ? t.primary : t.fgMuted} />
                      <div style={{ fontSize: 11, fontWeight: selected ? 600 : 500, marginTop: 5, color: selected ? t.fg : t.fgMuted, lineHeight: 1.2 }}>{s.label}</div>
                      {selected && (
                        <div style={{
                          position: 'absolute', top: 5, right: 5, width: 14, height: 14, borderRadius: '50%',
                          background: `linear-gradient(135deg, ${t.primary}, ${t.accent})`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#fff', fontSize: 8, fontWeight: 700,
                        }}>✓</div>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Fallback for remaining options */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: 6, marginTop: 6 }}>
                {SECTORS.slice(8).map((s) => {
                  const selected = form.sector_code === s.value;
                  return (
                    <div
                      key={s.value}
                      onClick={() => handleSector(s.value)}
                      style={{
                        padding: '10px 10px', borderRadius: 9,
                        background: selected
                          ? (isDark ? `linear-gradient(135deg, ${t.primary}33, ${t.accent}22)` : `${t.primary}15`)
                          : (isDark ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.5)'),
                        border: `1px solid ${selected ? `${t.primary}66` : t.border}`,
                        cursor: 'pointer',
                        boxShadow: selected ? `0 4px 14px ${t.primaryGlow}` : 'none',
                        position: 'relative',
                      }}
                    >
                      <Icon name={s.icon} size={14} color={selected ? t.primary : t.fgMuted} />
                      <div style={{ fontSize: 11, fontWeight: selected ? 600 : 500, marginTop: 5, color: selected ? t.fg : t.fgMuted, lineHeight: 1.2 }}>{s.label}</div>
                      {selected && (
                        <div style={{
                          position: 'absolute', top: 5, right: 5, width: 14, height: 14, borderRadius: '50%',
                          background: `linear-gradient(135deg, ${t.primary}, ${t.accent})`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#fff', fontSize: 8, fontWeight: 700,
                        }}>✓</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Field>

            <Btn variant="primary" size="lg" type="submit" disabled={loading} style={{ width: '100%', marginTop: 4, justifyContent: 'center' }}>
              {loading ? 'Creating…' : <>Create workspace <Icon name="arrowRight" size={14} color="#fff" strokeWidth={2} /></>}
            </Btn>
          </form>

          <div style={{ textAlign: 'center', fontSize: 12.5, color: t.fgMuted }}>
            Already have an account?{' '}
            <span style={{ color: t.primary, fontWeight: 500, cursor: 'pointer', touchAction: 'manipulation', display: 'inline-block', padding: '6px 2px' }} onClick={() => navigate('/login')}>Sign in</span>
          </div>
        </div>
      </div>
    </GlassRoot>
  );
}
