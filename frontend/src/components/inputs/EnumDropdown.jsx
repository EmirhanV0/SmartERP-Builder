const CLS_SELECT = "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60";

export default function EnumDropdown({ name, value, onChange, disabled, options = [] }) {
  // Pill picker for option sets with ≤8 items
  if (options.length > 0 && options.length <= 8) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {options.map(opt => {
          const isActive = value === opt;
          return (
            <button
              key={opt}
              type="button"
              disabled={disabled}
              onClick={() => onChange({ [name]: isActive ? '' : opt })}
              style={{ transition: 'all 0.15s' }}
              className={[
                'rounded-full px-3 py-1 text-xs font-medium select-none',
                isActive
                  ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-md scale-105'
                  : 'bg-white/5 dark:bg-white/5 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-indigo-400 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400',
                disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
              ].join(' ')}
            >
              {opt}
            </button>
          );
        })}
      </div>
    );
  }

  // Fallback: select dropdown for large option sets (>8 items)
  return (
    <select
      name={name}
      value={value ?? ''}
      onChange={e => onChange({ [name]: e.target.value })}
      disabled={disabled}
      className={CLS_SELECT}
    >
      <option value="">—</option>
      {options.map(opt => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  );
}
