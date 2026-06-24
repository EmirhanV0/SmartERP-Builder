import { LABELS } from './labelDictionary';

/**
 * Translates a field slug or display_name into an English label.
 *
 * 1. Look up in the LABELS dictionary (with slug normalization)
 * 2. If the input contains non-ASCII / uppercase / spaces, return the original
 * 3. If it's a pure ASCII slug, capitalize it cleanly
 *
 * NOTE: \b\w is not used — it produces incorrect capitalization after Turkish characters.
 */
export function translateLabel(slugOrLabel) {
  if (!slugOrLabel) return '';

  const slug = slugOrLabel
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  if (slug && LABELS[slug]) return LABELS[slug];

  if (!/^[a-z0-9_]+$/.test(slugOrLabel)) return slugOrLabel;

  return slug
    .split('_')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
    .join(' ');
}
