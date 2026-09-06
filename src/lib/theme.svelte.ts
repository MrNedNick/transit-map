export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'transit-map:theme';

/**
 * The very first value is read off `<html data-theme>`, which the inline script
 * in `index.html` sets before the first paint. That keeps the toggle, the CSS
 * and the stored preference from ever disagreeing on the first frame.
 */
function readInitial(): Theme {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

let current = $state<Theme>(readInitial());

function apply(next: Theme) {
  current = next;
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = next;
  }
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Private mode or a blocked storage partition — the theme still applies
    // for this page view, it just will not be remembered.
  }
}

export const theme = {
  get value(): Theme {
    return current;
  },
  set(next: Theme) {
    apply(next);
  },
  toggle() {
    apply(current === 'dark' ? 'light' : 'dark');
  },
};
