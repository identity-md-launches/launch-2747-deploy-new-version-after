import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { isExtensionError, extensionErrorPrelude } from '../scripts/dev-extension-errors.mjs';

const extensionStack = "TypeError: Cannot read properties of undefined (reading 'M_ID')\n" +
  '    at Y (chrome-extension://example/executors/200.js:1:761)\n' +
  '    at F (chrome-extension://example/executors/200.js:1:1442)';
const appFrame = '    at start (http://127.0.0.1:5173/app/page.tsx:180:3)';

test('only errors whose frames all belong to browser extensions are filtered', () => {
  assert.equal(isExtensionError({ stack: extensionStack }), true);
  assert.equal(isExtensionError({ stack: extensionStack.replaceAll('chrome-extension:', 'moz-extension:') }), true);
  assert.equal(isExtensionError(undefined, 'chrome-extension://example/injected.js'), true);
  assert.equal(isExtensionError({ stack: extensionStack + '\n' + appFrame }), false);
  assert.equal(isExtensionError({ stack: 'TypeError: M_ID\n' + appFrame }), false);
  assert.equal(isExtensionError(new Error("Cannot read properties of undefined (reading 'M_ID')")), false);
  assert.equal(isExtensionError("Cannot read properties of undefined (reading 'M_ID')"), false);
  assert.equal(isExtensionError(undefined, 'http://127.0.0.1:5173/chrome-extension://example/injected.js'), false);
  assert.equal(isExtensionError({ stack: extensionStack + '\n    at new Promise (<anonymous>)' }), false);
  assert.equal(isExtensionError({ stack: 'Error\n' + appFrame }, 'chrome-extension://example/injected.js'), false);
  assert.equal(isExtensionError({ get stack() { throw new Error('foreign getter'); } }), false);
});

test('extension rejections do not reach the overlay; app and mixed errors do, with native logging preserved', () => {
  const window = new EventTarget();
  runInNewContext(extensionErrorPrelude, { window, Symbol });
  runInNewContext(extensionErrorPrelude, { window, Symbol });
  const seen = [];
  window.addEventListener('unhandledrejection', event => seen.push(event.reason));
  window.addEventListener('error', event => seen.push(event.error));
  for (let i = 0; i < 50; i++) {
    const event = Object.assign(new Event('unhandledrejection', { cancelable: true }), { reason: { stack: extensionStack } });
    window.dispatchEvent(event);
    assert.equal(event.defaultPrevented, false, 'The browser can still log the underlying extension failure');
  }
  assert.equal(seen.length, 0);
  const ordinary = { stack: 'Error: game failure\n' + appFrame };
  const mixed = { stack: extensionStack + '\n' + appFrame };
  for (const reason of [ordinary, mixed]) window.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason }));
  window.dispatchEvent(Object.assign(new Event('error'), { error: ordinary, filename: 'http://127.0.0.1:5173/app/page.tsx' }));
  assert.deepEqual(seen, [ordinary, mixed, ordinary]);
});
