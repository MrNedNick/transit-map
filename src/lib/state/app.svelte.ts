import {
  DEFAULT_STATE,
  decodeState,
  differsBeyondCamera,
  encodeState,
  type AppState,
} from './url';

function readFromLocation(): AppState {
  if (typeof location === 'undefined') return { ...DEFAULT_STATE };
  return decodeState(location.search);
}

let current = $state<AppState>(readFromLocation());
let pending: number | null = null;

/**
 * Panning the map must not fill the history stack, or Back would crawl the
 * user's own scroll path backwards. Camera moves replace the current entry;
 * anything the user deliberately changed pushes a new one, so Back returns to
 * the previous view instead of resetting the map.
 */
function write(push: boolean) {
  if (typeof history === 'undefined') return;
  const url = `${location.pathname}${encodeState(current)}`;
  if (push) history.pushState(null, '', url);
  else history.replaceState(null, '', url);
}

function scheduleReplace() {
  if (pending !== null) clearTimeout(pending);
  pending = window.setTimeout(() => {
    pending = null;
    write(false);
  }, 220);
}

if (typeof window !== 'undefined') {
  // Normalise the address bar straight away, so the link is shareable before
  // the user has touched anything.
  write(false);

  window.addEventListener('popstate', () => {
    current = readFromLocation();
  });
}

export const appState = {
  get value(): AppState {
    return current;
  },
  /** Continuous map movement: coalesced, and never a new history entry. */
  setCamera(camera: { lon: number; lat: number; zoom: number }) {
    if (
      camera.lon === current.lon &&
      camera.lat === current.lat &&
      camera.zoom === current.zoom
    ) {
      return;
    }
    current = { ...current, ...camera };
    scheduleReplace();
  },
  /** A deliberate change: filters, the selected stop, the travel budget. */
  update(patch: Partial<AppState>) {
    const next = { ...current, ...patch };
    const push = differsBeyondCamera(current, next);
    current = next;
    if (pending !== null) {
      clearTimeout(pending);
      pending = null;
    }
    write(push);
  },
};
