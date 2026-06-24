const CLS = "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60";

export default function NumberInput({ name, value, onChange, disabled, step = '1' }) {
  return (
    <input
      type="number"
      name={name}
      value={value ?? ''}
      onChange={(e) => onChange({ [name]: e.target.value })}
      step={step}
      min="0"
      disabled={disabled}
      className={CLS}
    />
  );
}
