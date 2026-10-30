// Included by the root layout only in development, before the app boots.
// Only foreign extension code is excluded from the development overlay.
// App frames, mixed stacks and errors without a known origin stay visible.
export function isExtensionError(error, filename = '') {
  try {
    const extension = /\b(?:chrome-extension|moz-extension|safari-web-extension):\/\/[^/\s]+\//;
    const stack = error && typeof error.stack === 'string' ? error.stack : '';
    const frames = stack.split(/\r?\n/).filter(line => /^\s*at\s+/.test(line) || /^[^@\n]*@[a-z][\w+-]*:\/\//i.test(line));
    if (!frames.length) return /^(?:chrome-extension|moz-extension|safari-web-extension):\/\//.test(filename);
    return frames.every(frame => extension.test(frame) &&
      !/\b(?:https?|file|blob|webpack|vite):|\beval\b|<anonymous>/.test(frame));
  } catch {
    return false;
  }
}

export const extensionErrorPrelude = `(() => {
  const key = Symbol.for('wheelkeepers.dev.extension-error-filter');
  if (window[key]) return;
  window[key] = true;
  const isExtensionError = ${isExtensionError.toString()};
  window.addEventListener('error', event => {
    if (isExtensionError(event.error, event.filename)) event.stopImmediatePropagation();
  }, true);
  window.addEventListener('unhandledrejection', event => {
    if (isExtensionError(event.reason)) event.stopImmediatePropagation();
  }, true);
})();`;
