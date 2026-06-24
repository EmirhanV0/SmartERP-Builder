const CLS = "w-full resize-none rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 placeholder:text-gray-400 dark:placeholder:text-gray-500 disabled:opacity-60";

export default function TextareaInput({ name, value, onChange, disabled, placeholder }) {
  return (
    <textarea
      name={name}
      rows={3}
      value={value ?? ''}
      onChange={(e) => onChange({ [name]: e.target.value })}
      placeholder={placeholder}
      disabled={disabled}
      className={CLS}
    />
  );
}
