export default function NumberWithUnitInput({ name, value, onChange, disabled, units = [], defaultUnit = '' }) {
  const unitKey = `${name}_unit`;
  const currentUnit = value?.[unitKey] ?? defaultUnit;
  const currentVal = value?.[name] ?? '';

  return (
    <div className="flex gap-2">
      <input
        type="number"
        name={name}
        value={currentVal}
        onChange={(e) => onChange({ [name]: e.target.value })}
        step="0.01"
        min="0"
        disabled={disabled}
        className="min-w-0 flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60"
      />
      <select
        value={currentUnit}
        onChange={(e) => onChange({ [unitKey]: e.target.value })}
        disabled={disabled}
        className="w-24 shrink-0 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-2 text-sm outline-none transition focus:border-indigo-500 disabled:opacity-60"
      >
        {units.map((u) => (
          <option key={u} value={u}>{u}</option>
        ))}
      </select>
    </div>
  );
}
