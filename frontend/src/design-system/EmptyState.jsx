import { useTheme } from '../contexts/ThemeContext';
import { themes, glassPanel, fontStack } from './tokens';
import Icon from './Icon';
import { Btn } from './components';

export function EmptyState({ icon = 'file', title, description, action, compact = false }) {
  const { theme } = useTheme();
  const t = themes[theme];

  return (
    <div style={{
      ...glassPanel(t, theme),
      padding: compact ? '24px 20px' : '44px 32px',
      textAlign: 'center',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: compact ? 10 : 14,
    }}>
      <div style={{
        width: compact ? 40 : 56, height: compact ? 40 : 56,
        borderRadius: compact ? 11 : 16,
        background: `${t.primary}15`, border: `1px solid ${t.primary}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name={icon} size={compact ? 18 : 24} color={t.primary} />
      </div>
      {title && (
        <div style={{ fontSize: compact ? 13 : 15, fontWeight: 600, color: t.fg, fontFamily: fontStack, lineHeight: 1.3 }}>
          {title}
        </div>
      )}
      {description && (
        <div style={{ fontSize: compact ? 11.5 : 12.5, color: t.fgMuted, lineHeight: 1.6, maxWidth: 320 }}>
          {description}
        </div>
      )}
      {action && (
        <Btn variant="primary" size={compact ? 'sm' : 'md'} onClick={action.onClick} style={{ marginTop: 4 }}>
          {action.label}
        </Btn>
      )}
    </div>
  );
}
