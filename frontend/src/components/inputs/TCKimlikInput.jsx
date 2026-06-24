const CLS = "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 placeholder:text-gray-400 dark:placeholder:text-gray-500 disabled:opacity-60 font-mono tracking-widest";

export default function TCKimlikInput({ name, value, onChange, disabled }) {
  const handleChange = (e) => {
    const cleaned = e.target.value.replace(/[^0-9]/g, '').slice(0, 11);
    onChange({ [name]: cleaned });
  };

  return (
    <input
      type="text"
      name={name}
      value={value ?? ''}
      onChange={handleChange}
      placeholder="12345678901"
      maxLength={11}
      inputMode="numeric"
      disabled={disabled}
      className={CLS}
    />
  );
}
