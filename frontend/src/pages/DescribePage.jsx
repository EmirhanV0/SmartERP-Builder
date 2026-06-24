import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { promptApi } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { useViewport } from '../hooks/useViewport';
import { themes, glassPanel, fontStack, monoStack } from '../design-system/tokens';
import { GlassRoot, TopBar, Btn, Steps } from '../design-system/components';
import Icon from '../design-system/Icon';

const SECTORS = ['Healthcare', 'Manufacturing', 'Retail', 'Construction', 'Hospitality', 'Logistics', 'Education', 'Technology', 'Finance', 'Other'];
const SECTOR_VALUES = { Healthcare: 'healthcare', Manufacturing: 'manufacturing', Retail: 'retail', Construction: 'construction', Hospitality: 'food', Logistics: 'logistics', Education: 'education', Technology: 'technology', Finance: 'finance', Other: 'other' };

const EXAMPLES = [
  { label: 'Healthcare clinic', hint: 'Patients · Appointments · Reports' },
  { label: 'E-commerce shop', hint: 'Orders · Inventory · Customers' },
  { label: 'Construction firm', hint: 'Projects · Crew · Equipment' },
  { label: 'Restaurant chain', hint: 'Menu · Suppliers · Sales' },
];

const EXAMPLE_TEXTS = {
  'Healthcare clinic': 'We run a medical clinic with 8 doctors and 3 admin staff. We need to track patient records, appointments, diagnoses, prescriptions, and billing. Currently we use paper files and need to move to a digital system that handles patient history and insurance claims.',
  'E-commerce shop': 'We run an online store selling handmade goods. We need to manage product inventory across 3 warehouses, track customer orders from placement to delivery, manage supplier relationships, and generate invoices automatically.',
  'Construction firm': 'We are a construction company handling 10-15 projects simultaneously. We need to track project timelines, crew assignments, equipment usage, material procurement, and client invoicing for each project separately.',
  'Restaurant chain': 'We operate 4 restaurant branches. We need to track daily sales per branch, manage supplier deliveries, monitor food inventory levels, schedule staff shifts, and generate monthly P&L reports per location.',
};

export default function DescribePage() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { isMobile } = useViewport();
  const t = themes[theme];
  const isDark = theme === 'dark';

  const [selectedSector, setSelectedSector] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [thinkingStep, setThinkingStep] = useState(-1);

  const charCount = description.length;
  const isReady = charCount >= 50 && selectedSector;

  const handleExample = (example) => {
    setDescription(EXAMPLE_TEXTS[example.label] || '');
    setError('');
  };

  const handleSubmit = async () => {
    if (!selectedSector) { setError('Please select a sector.'); return; }
    if (charCount < 50) { setError('Please enter at least 50 characters.'); return; }
    setLoading(true); setError(''); setThinkingStep(0);
    const t1 = setTimeout(() => setThinkingStep(1), 600);
    const t2 = setTimeout(() => setThinkingStep(2), 1200);
    try {
      const sectorCode = SECTOR_VALUES[selectedSector] || selectedSector.toLowerCase();
      const res = await promptApi.analyze({ sector: sectorCode, text: description });
      // sector + clarifyRound travel with the result — PreviewPage needs them
      // for the clarification re-analyze flow (max 2 rounds)
      sessionStorage.setItem('analysisResult', JSON.stringify({ ...res.data, sector: sectorCode, clarifyRound: 0 }));
      toast.success('Analysis complete! Review your suggested modules.');
      setThinkingStep(-1);
      navigate('/setup/preview');
    } catch (err) {
      // Prefer the backend's detail (e.g. quota message); long technical
      // details (raw 502 exception dumps) fall back to the generic message
      const detail = err.response?.data?.detail;
      const msg = !err.response
        ? 'Could not connect to server.'
        : (typeof detail === 'string' && detail.length < 200 ? detail : 'Analysis failed. Please try again.');
      setError(msg); toast.error(msg);
    } finally {
      clearTimeout(t1); clearTimeout(t2);
      setLoading(false); setThinkingStep(-1);
    }
  };

  return (
    <GlassRoot>
      <div style={{ position: 'absolute', top: 'max(16px, calc(env(safe-area-inset-top, 0px) + 8px))', left: 16, right: 16, zIndex: 3 }}>
        <TopBar />
      </div>

      <div style={{ position: 'absolute', top: isMobile ? 70 : 80, left: 0, right: 0, bottom: 0, overflow: 'auto', zIndex: 2, padding: isMobile ? '20px 16px 40px' : '24px 24px 40px' }}>
        <div style={{ maxWidth: 780, margin: '0 auto' }}>
          {/* Steps */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            {isMobile ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  padding: '3px 10px', borderRadius: 99,
                  background: `linear-gradient(135deg, ${t.primary}, ${t.accent})`,
                  fontSize: 10.5, color: '#fff', fontFamily: monoStack, fontWeight: 600,
                }}>Step 1</div>
                <span style={{ fontSize: 11.5, color: t.fgMuted, fontFamily: monoStack }}>of 3 · Describe your business</span>
              </div>
            ) : (
              <Steps current={0} total={3} labels={['Describe', 'Review', 'Build']} />
            )}
          </div>

          {/* Hero */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', ...glassPanel(t, theme), borderRadius: 99,
              fontSize: 11, fontFamily: monoStack, color: t.accent, marginBottom: 16,
            }}>
              <Icon name="sparkles" size={11} color={t.accent} />
              AI · ready to listen
            </div>
            <h1 key={theme} style={{
              fontSize: 'clamp(28px, 7vw, 38px)', fontWeight: 600, letterSpacing: '-0.035em',
              margin: 0, lineHeight: 1.05,
              background: `linear-gradient(135deg, ${t.fg}, ${t.primary} 60%, ${t.accent})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>Tell me about your business.</h1>
            <p style={{ fontSize: isMobile ? 13.5 : 15, color: t.fgMuted, marginTop: 12, lineHeight: 1.5, maxWidth: 520, margin: '12px auto 0' }}>
              In your own words — products you sell, people you manage, things you track.<br />
              SmartERP will design the modules around <em>your</em> process.
            </p>
          </div>

          {/* Input panel */}
          <div style={{ ...glassPanel(t, theme), padding: isMobile ? 16 : 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Error */}
            {error && (
              <div style={{ padding: '10px 14px', borderRadius: 10, background: `${t.danger}18`, border: `1px solid ${t.danger}44`, color: t.danger, fontSize: 12.5 }}>{error}</div>
            )}

            {/* Sector chips */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: t.fgMuted, fontFamily: monoStack, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Sector</div>
                {!isMobile && <span style={{ fontSize: 10.5, color: t.fgDim }}>helps AI pick relevant modules</span>}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {SECTORS.map(s => {
                  const active = s === selectedSector;
                  return (
                    <div
                      key={s}
                      onClick={() => { setSelectedSector(s); setError(''); }}
                      style={{
                        padding: isMobile ? '8px 14px' : '6px 12px', borderRadius: 99,
                        background: active
                          ? `linear-gradient(135deg, ${t.primary}, ${t.accent})`
                          : (isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.55)'),
                        color: active ? '#fff' : t.fgMuted,
                        border: active ? '1px solid transparent' : `1px solid ${t.border}`,
                        fontSize: 11.5, fontWeight: active ? 500 : 400,
                        cursor: 'pointer',
                        boxShadow: active ? `0 4px 12px ${t.primaryGlow}` : 'none',
                        transition: 'all 0.15s',
                        touchAction: 'manipulation',
                        minHeight: isMobile ? 40 : undefined,
                        display: 'flex', alignItems: 'center',
                      }}
                    >{s}</div>
                  );
                })}
              </div>
            </div>

            {/* Textarea */}
            <div style={{ position: 'relative' }}>
              <textarea
                value={description}
                onChange={e => { setDescription(e.target.value); setError(''); }}
                placeholder="e.g. I run a furniture workshop and need to track inventory, invoices, and supplier payments…"
                style={{
                  width: '100%', minHeight: isMobile ? 160 : 200,
                  padding: '16px 18px',
                  background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.5)',
                  border: `1px solid ${t.border}`,
                  borderRadius: 14,
                  color: t.fg,
                  fontSize: 14, fontFamily: fontStack, lineHeight: 1.6,
                  outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                  letterSpacing: '-0.005em',
                }}
                disabled={loading}
              />
              <div style={{ position: 'absolute', bottom: 12, right: 14, fontSize: 10.5, color: t.fgDim, fontFamily: monoStack, display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ color: isReady ? t.success : t.warn }}>● {isReady ? 'ready' : 'needs more'}</span>
                {!isMobile && <span>{charCount}/2000 chars · min 50</span>}
                {isMobile && <span>{charCount}/2000</span>}
              </div>
            </div>

            {/* Example chips */}
            <div>
              <div style={{ fontSize: 11, color: t.fgDim, marginBottom: 8, fontFamily: monoStack, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Or try one of these</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {EXAMPLES.map(e => (
                  <div
                    key={e.label}
                    onClick={() => handleExample(e)}
                    style={{
                      padding: '8px 12px', borderRadius: 10,
                      background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,15,30,0.04)',
                      border: `1px solid ${t.border}`,
                      cursor: 'pointer', fontSize: 11.5,
                      display: 'flex', flexDirection: 'column', gap: 2,
                      transition: 'border-color 0.15s',
                      touchAction: 'manipulation',
                      flex: isMobile ? '1 1 calc(50% - 3px)' : undefined,
                    }}
                  >
                    <div style={{ fontWeight: 500, color: t.fg }}>{e.label}</div>
                    <div style={{ color: t.fgDim, fontSize: 10, fontFamily: monoStack }}>{e.hint}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA row */}
            <div style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              alignItems: isMobile ? 'stretch' : 'center',
              justifyContent: isMobile ? undefined : 'space-between',
              gap: isMobile ? 10 : 0,
              paddingTop: 8, borderTop: `1px solid ${t.border}`, marginTop: 4,
            }}>
              {!isMobile && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: t.fgMuted }}>
                  <Icon name="shield" size={13} color={t.fgDim} />
                  Your description is private.
                </div>
              )}
              <button
                onClick={handleSubmit}
                disabled={loading || !isReady}
                className={loading ? 'animate-pulse-glow' : ''}
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: isMobile ? '14px 20px' : '12px 20px',
                  borderRadius: 9, fontSize: 14, fontWeight: 500,
                  cursor: (loading || !isReady) ? 'not-allowed' : 'pointer',
                  opacity: !isReady && !loading ? 0.6 : 1,
                  background: `linear-gradient(135deg, ${t.primary}, ${t.accent})`,
                  color: '#fff', border: '1px solid transparent',
                  boxShadow: `0 6px 22px ${t.primaryGlow}, inset 0 1px 0 rgba(255,255,255,0.18)`,
                  fontFamily: 'inherit', letterSpacing: '-0.005em',
                  touchAction: 'manipulation',
                }}
              >
                {loading ? (
                  <>
                    <svg
                      width={16} height={16} viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      className="animate-spin-slow"
                    >
                      <path d="M12 3v4M12 17v4M5 12H1M23 12h-4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    Analyzing…
                  </>
                ) : (
                  <>
                    <Icon name="sparkles" size={14} color="#fff" />
                    Analyze with AI
                    <Icon name="arrowRight" size={14} color="#fff" strokeWidth={2} />
                  </>
                )}
              </button>
            </div>

            {/* AI thinking trail */}
            {thinkingStep >= 0 && (
              <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  'Detecting business domain…',
                  'Identifying entities and fields…',
                  'Generating module structure…',
                ].map((line, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      opacity: thinkingStep >= i ? 1 : 0,
                      transform: thinkingStep >= i ? 'translateY(0)' : 'translateY(4px)',
                      transition: 'opacity 0.35s ease, transform 0.35s ease',
                    }}
                  >
                    {thinkingStep === i ? (
                      <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin-slow" style={{ flexShrink: 0 }}>
                        <path d="M12 3v4M12 17v4M5 12H1M23 12h-4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    ) : (
                      <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={t.success} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                    <span style={{ fontSize: 11.5, color: thinkingStep > i ? t.fgMuted : t.fg, fontFamily: 'inherit' }}>{line}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tip card */}
          <div style={{
            marginTop: 18, ...glassPanel(t, theme), padding: 16,
            display: 'flex', alignItems: 'center', gap: 14,
            background: isDark ? 'rgba(20,20,32,0.4)' : 'rgba(255,255,255,0.4)',
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: `${t.accent}1a`, color: t.accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: `1px solid ${t.accent}33`,
            }}><Icon name="bolt" size={16} color={t.accent} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 2, color: t.fg }}>The more detail, the better</div>
              <div style={{ fontSize: 11.5, color: t.fgMuted, lineHeight: 1.5 }}>
                Mention things you <em>currently track in Excel</em>, the people who use the system, and the reports you wish you had.
              </div>
            </div>
          </div>
        </div>
      </div>
    </GlassRoot>
  );
}
