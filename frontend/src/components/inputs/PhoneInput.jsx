import { useState, useEffect, useRef } from 'react';

const COUNTRIES = [
  { code: 'TR', flag: '🇹🇷', dial: '+90',  name: 'Turkey' },
  { code: 'US', flag: '🇺🇸', dial: '+1',   name: 'United States' },
  { code: 'GB', flag: '🇬🇧', dial: '+44',  name: 'United Kingdom' },
  { code: 'DE', flag: '🇩🇪', dial: '+49',  name: 'Germany' },
  { code: 'FR', flag: '🇫🇷', dial: '+33',  name: 'France' },
  { code: 'IT', flag: '🇮🇹', dial: '+39',  name: 'Italy' },
  { code: 'ES', flag: '🇪🇸', dial: '+34',  name: 'Spain' },
  { code: 'JP', flag: '🇯🇵', dial: '+81',  name: 'Japan' },
  { code: 'AE', flag: '🇦🇪', dial: '+971', name: 'UAE' },
  { code: 'SA', flag: '🇸🇦', dial: '+966', name: 'Saudi Arabia' },
];

export default function PhoneInput({ name, value, onChange, disabled }) {
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = e => { if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filtered = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.dial.includes(search)
  );

  const handleChange = e => {
    const cleaned = e.target.value.replace(/[^0-9\s\-]/g, '').slice(0, 15);
    onChange({ [name]: cleaned });
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div className="flex items-center overflow-hidden rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 transition focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20">
        {/* Country trigger */}
        <button
          type="button"
          onClick={() => !disabled && setOpen(d => !d)}
          disabled={disabled}
          className="flex shrink-0 items-center gap-1.5 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 px-2.5 py-2 text-sm transition hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-60"
        >
          <span style={{ fontSize: 15 }}>{country.flag}</span>
          <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{country.dial}</span>
          <svg className="h-3 w-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Number input */}
        <input
          type="tel"
          name={name}
          value={value ?? ''}
          onChange={handleChange}
          placeholder="555 123 4567"
          disabled={disabled}
          className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none disabled:opacity-60"
        />
      </div>

      {/* Country dropdown */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xl">
          <div className="border-b border-gray-100 dark:border-gray-700 p-2">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search country…"
              autoFocus
              className="w-full rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-2.5 py-1.5 text-xs text-gray-700 dark:text-gray-200 outline-none"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.map(c => (
              <button
                key={c.code}
                type="button"
                onClick={() => { setCountry(c); setOpen(false); setSearch(''); }}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm transition hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                  c.code === country.code ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300' : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                <span style={{ fontSize: 15 }}>{c.flag}</span>
                <span className="text-xs font-medium text-gray-400 dark:text-gray-500">{c.dial}</span>
                <span className="flex-1 truncate text-left">{c.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
