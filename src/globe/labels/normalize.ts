/** Name key used for matching labels across sources ("Lake Victoria" ≈ "Victoria"). */
export function labelNorm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\b(river|lake|mount|mountains|range|desert|sea|island|islands|city|rio|lago)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
}

const cache = new WeakMap<object, string[]>()

/** Cached normalised names (name + alternates) for a label. */
export function labelKeys(label: { name: string; alt?: string[] }): string[] {
  let keys = cache.get(label)
  if (!keys) {
    keys = [labelNorm(label.name), ...(label.alt ?? []).map(labelNorm)].filter(Boolean)
    cache.set(label, keys)
  }
  return keys
}
