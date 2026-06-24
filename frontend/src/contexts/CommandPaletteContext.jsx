import { createContext, useContext, useState, useCallback } from 'react';

const CommandPaletteContext = createContext(null);

export function CommandPaletteProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [paletteData, setPaletteData] = useState({
    modules: [],
    records: [],
    fields: [],
    isAdmin: false,
    onSelectModule: null,
    onOpenRecord: null,
    onOpenAddModule: null,
    scope: 'user',
    adminCache: null,
    onProfileNavigate: null,
  });

  const openPalette  = useCallback(() => setIsOpen(true),  []);
  const closePalette = useCallback(() => setIsOpen(false), []);

  return (
    <CommandPaletteContext.Provider value={{ isOpen, openPalette, closePalette, paletteData, setPaletteData }}>
      {children}
    </CommandPaletteContext.Provider>
  );
}

export function useCommandPalette() {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) throw new Error('useCommandPalette must be used within CommandPaletteProvider');
  return ctx;
}
