const CLS = "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60 [color-scheme:light] dark:[color-scheme:dark]";

export default function DateInput({ name, value, onChange, disabled }) {
  return (
    <input
      type="date"
      name={name}
      value={value ?? ''}
      onChange={(e) => onChange({ [name]: e.target.value })}
      disabled={disabled}
      className={CLS}
    />
  );
}
