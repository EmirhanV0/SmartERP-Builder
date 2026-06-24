const CURRENCIES = [
  { code: 'TRY', symbol: '₺' },
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
  { code: 'GBP', symbol: '£' },
  { code: 'JPY', symbol: '¥' },
  { code: 'CNY', symbol: '¥' },
  { code: 'CHF', symbol: 'Fr' },
  { code: 'SAR', symbol: '﷼' },
  { code: 'AED', symbol: 'د.إ' },
  { code: 'RUB', symbol: '₽' },
];

export default function CurrencyInput({ name, value, onChange, disabled, defaultCurrency = 'TRY' }) {
  const currKey = `${name}_currency`;

  // value is the whole formData object (passed from SmartInput)
  const currentCurrency = (typeof value === 'object' ? value?.[currKey] : null) || defaultCurrency || 'TRY';
  const currentVal = (typeof value === 'object' ? value?.[name] : value) ?? '';

  return (
    <div className="flex items-center overflow-hidden rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 transition focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20">
      <select
        value={currentCurrency}
        onChange={e => onChange({ [currKey]: e.target.value })}
        disabled={disabled}
        className="shrink-0 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 px-2 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 outline-none cursor-pointer"
        title="Currency"
      >
        {CURRENCIES.map(c => (
          <option key={c.code} value={c.code}>
            {c.symbol} {c.code}
          </option>
        ))}
      </select>
      <input
        type="number"
        name={name}
        value={currentVal}
        onChange={e => onChange({ [name]: e.target.value })}
        step="0.01"
        min="0"
        disabled={disabled}
        placeholder="0.00"
        className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none disabled:opacity-60"
      />
    </div>
  );
}
