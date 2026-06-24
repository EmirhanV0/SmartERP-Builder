import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useViewport } from '../hooks/useViewport';
import { modulesApi } from '../services/api';
import { themes, glassPanel, fontStack, monoStack } from '../design-system/tokens';
import { GlassRoot, TopBar, Btn, Field, DSInput } from '../design-system/components';
import Icon from '../design-system/Icon';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { isMobile } = useViewport();
  const t = themes[theme];
  const isDark = theme === 'dark';

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState('');

  const handleChange = (e) => { setForm(p => ({ ...p, [e.target.name]: e.target.value })); setError(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.email.includes('@')) { setError('Please enter a valid email address.'); return; }
    if (!form.password) { setError('Password is required.'); return; }
    setLoading(true); setError('');
    try {
      await login(form.email, form.password);
      toast.success('Welcome back!');
      try {
        const res = await modulesApi.list();
        navigate(res.data?.length > 0 ? '/dashboard' : '/setup/describe', { replace: true });
      } catch { navigate('/setup/describe', { replace: true }); }
    } catch (err) {
      const s = err.response?.status;
      if (s === 401 || s === 400) setError('Invalid email or password.');
      else if (!err.response) setError('Could not connect to server.');
      else setError('An unexpected error occurred.');
    } finally { setLoading(false); }
  };

  return (
    <GlassRoot>
      {/* TopBar */}
      <div style={{ position: 'absolute', top: 'max(16px, calc(env(safe-area-inset-top, 0px) + 8px))', left: 16, right: 16, zIndex: 3 }}>
        <TopBar mode="auth" showSearch={false} />
      </div>

      {/* Centered card */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: isMobile ? '16px' : '24px', zIndex: 2,
      }}>
        <div style={{ ...glassPanel(t, theme), width: '100%', maxWidth: 420, padding: isMobile ? 24 : 40, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Hero */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', marginBottom: 14 }}>
              <div style={{
                width: 54, height: 54, borderRadius: 16,
                background: `linear-gradient(135deg, ${t.primary}, ${t.accent})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 10px 32px ${t.primaryGlow}`,
              }}>
                <Icon name="bolt" size={26} color="#fff" strokeWidth={2.2} />
              </div>
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.025em', margin: 0, color: t.fg }}>Welcome back</h1>
            <div style={{ fontSize: 13, color: t.fgMuted, marginTop: 6, lineHeight: 1.5 }}>
              Build your ERP in minutes,<br />not months.
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: 10,
              background: `${t.danger}18`, border: `1px solid ${t.danger}44`,
              color: t.danger, fontSize: 12.5,
            }}>{error}</div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }} noValidate>
            <Field label="Work email">
              <DSInput
                name="email" type="email" value={form.email}
                placeholder="you@company.com"
                icon="user" focused={focusedField === 'email'}
                onChange={handleChange}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField('')}
                disabled={loading} autoComplete="email"
              />
            </Field>

            <Field label="Password">
              <DSInput
                name="password" type="password" value={form.password}
                placeholder="••••••••"
                icon="shield" focused={focusedField === 'password'}
                onChange={handleChange}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField('')}
                disabled={loading} autoComplete="current-password"
              />
            </Field>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: t.fgMuted, cursor: 'pointer', minHeight: 44, touchAction: 'manipulation' }}>
              <span style={{
                width: 14, height: 14, borderRadius: 4,
                background: `linear-gradient(135deg, ${t.primary}, ${t.accent})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 2px 8px ${t.primaryGlow}`,
              }}><span style={{ color: '#fff', fontSize: 9 }}>✓</span></span>
              Keep me signed in
            </label>

            <Btn variant="primary" size="lg" type="submit" disabled={loading} style={{ width: '100%', marginTop: 4, justifyContent: 'center' }}>
              {loading ? 'Signing in…' : <>Sign in <Icon name="arrowRight" size={14} color="#fff" strokeWidth={2} /></>}
            </Btn>
          </form>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: t.fgDim, fontSize: 11, fontFamily: monoStack }}>
            <div style={{ flex: 1, height: 1, background: t.border }} />
            <span>OR</span>
            <div style={{ flex: 1, height: 1, background: t.border }} />
          </div>

          <div style={{ textAlign: 'center', fontSize: 12.5, color: t.fgMuted }}>
            New here?{' '}
            <span
              style={{ color: t.primary, fontWeight: 500, cursor: 'pointer', touchAction: 'manipulation', display: 'inline-block', padding: '6px 2px' }}
              onClick={() => navigate('/register')}
            >Create account</span>
          </div>
        </div>
      </div>
    </GlassRoot>
  );
}
