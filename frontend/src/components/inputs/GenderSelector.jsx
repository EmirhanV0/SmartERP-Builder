const GENDERS = [
  { value: 'Male',   label: 'Male',   symbol: '♂' },
  { value: 'Female', label: 'Female', symbol: '♀' },
  { value: 'Other',  label: 'Other',  symbol: '○' },
];

export default function GenderSelector({ name, value, onChange, disabled }) {
  const selected = value ?? '';

  return (
    <div className="flex gap-2">
      {GENDERS.map(g => {
        const isActive = selected === g.value;
        return (
          <button
            key={g.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange({ [name]: isActive ? '' : g.value })}
            style={{ transition: 'all 0.15s' }}
            className={[
              'flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-medium',
              isActive
                ? 'bg-gradient-to-r from-indigo-500 to-violet-500 border-transparent text-white shadow-md'
                : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:border-indigo-400 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400',
              disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
            ].join(' ')}
          >
            <span>{g.symbol}</span>
            <span>{g.label}</span>
          </button>
        );
      })}
    </div>
  );
}
