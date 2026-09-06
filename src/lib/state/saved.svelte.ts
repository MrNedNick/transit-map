/**
 * The one thing in this app that belongs to the person using it: the stops
 * they marked. Kept in localStorage, mirrored across tabs through the
 * `storage` event so two open windows never drift apart.
 */
const STORAGE_KEY = 'transit-map:saved';
const LIMIT = 60;

export interface SavedStop {
  id: string;
  name: string;
  savedAt: number;
}

function read(): SavedStop[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is SavedStop =>
          !!item &&
          typeof item === 'object' &&
          typeof (item as SavedStop).id === 'string' &&
          typeof (item as SavedStop).name === 'string',
      )
      .map((item) => ({ ...item, savedAt: Number(item.savedAt) || Date.now() }))
      .slice(0, LIMIT);
  } catch {
    // Corrupted or unavailable storage should never take the map down with it.
    return [];
  }
}

let items = $state<SavedStop[]>(read());

function write() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Out of quota or storage disabled — the list still works for this session.
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY || event.key === null) items = read();
  });
}

export const savedStops = {
  get all(): SavedStop[] {
    return items;
  },
  get count(): number {
    return items.length;
  },
  has(id: string): boolean {
    return items.some((item) => item.id === id);
  },
  toggle(stop: { id: string; name: string }) {
    items = this.has(stop.id)
      ? items.filter((item) => item.id !== stop.id)
      : [{ id: stop.id, name: stop.name, savedAt: Date.now() }, ...items].slice(0, LIMIT);
    write();
  },
  remove(id: string) {
    items = items.filter((item) => item.id !== id);
    write();
  },
  clear() {
    items = [];
    write();
  },
  /** Only for tests, which need a clean slate between cases. */
  reload() {
    items = read();
  },
};
