export default function LoadingSpinner({ fullScreen = false, size = 'md', inline = false }) {
  const sizes = { sm: 'h-4 w-4', md: 'h-8 w-8', lg: 'h-12 w-12' };

  const spinner = (
    <div
      className={`${sizes[size]} animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600`}
    />
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white">
        {spinner}
      </div>
    );
  }

  // sm size (inside a button) or inline mode -> without wrapper
  if (size === 'sm' || inline) return spinner;

  return <div className="flex justify-center py-8">{spinner}</div>;
}
