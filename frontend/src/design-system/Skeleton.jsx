// variant: 'rect' | 'circle' | 'line'
export function Skeleton({ width = '100%', height = 16, rounded = false, count = 1, variant = 'rect', style = {} }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="skeleton-shimmer"
          style={{
            width,
            height: variant === 'circle' ? width : height,
            borderRadius: variant === 'circle' ? '50%' : rounded ? 99 : 8,
            flexShrink: 0,
            ...style,
          }}
        />
      ))}
    </>
  );
}
