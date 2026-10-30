import type { WheelEvent } from '../../lib/game';

// These are the existing game's public service and its authorized frontend.
export const API_ORIGIN = 'https://wheelkeepers.dpdns.org';
export const PUBLISHED_ORIGIN = 'https://wheelkeepers-a-little-hamster-a.imd.site';
declare const __WHEELKEEPERS_STATIC__: boolean | undefined;
export type Pulse = {
  available: boolean; rpm: number | null; height: string | null; source: string;
  receivedAt: string | null; state: string; seed: number; transaction: string | null;
  event?: WheelEvent | null; serverNow?: number;
};

const unavailable = 'The game server is unavailable. You can still play practice. Try again later.';
export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 0) { super(message); this.name = 'ApiError'; this.status = status; }
}
type StorageAccess = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type ClientOptions = {
  pageOrigin: string; apiOrigin?: string; fetcher?: typeof fetch; storage?: StorageAccess;
};
export function createApiClient({ pageOrigin, apiOrigin = API_ORIGIN, fetcher = fetch, storage }: ClientOptions) {
  const external = !!apiOrigin && pageOrigin !== apiOrigin;
  const base = external ? apiOrigin : '';
  const key = `wk-session:${apiOrigin}`;
  let token: string | null = null;
  try { token = external ? storage?.getItem(key) || null : null; } catch { /* Storage can be blocked. */ }
  function remember(value: string | null) {
    token = value;
    try { if (value) storage?.setItem(key, value); else storage?.removeItem(key); } catch { /* Keep an in-memory session. */ }
  }
  async function api(path: string, data?: unknown, method?: string): Promise<any> {
    const headers = new Headers({ Accept: 'application/json' });
    if (data !== undefined) headers.set('Content-Type', 'application/json');
    if (external && token) headers.set('Authorization', `Bearer ${token}`);
    let response: Response;
    try {
      response = await fetcher(`${base}/api/${path}`, {
        method: method || (data === undefined ? 'GET' : 'POST'), headers,
        body: data === undefined ? undefined : JSON.stringify(data),
        credentials: external ? 'omit' : 'same-origin', cache: 'no-store',
        signal: AbortSignal.timeout(15000),
      });
    } catch { throw new ApiError(unavailable); }
    if (!response.headers.get('content-type')?.includes('application/json')) throw new ApiError(unavailable);
    let result: any;
    try { result = await response.json(); } catch { throw new ApiError(unavailable); }
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw new ApiError(unavailable);
    if (!response.ok) {
      if (response.status === 401 && external) remember(null);
      throw new ApiError(typeof result.error === 'string' ? result.error : unavailable, response.status);
    }
    if (path === 'auth/verify' && external) {
      if (typeof result.token !== 'string' || !/^[a-f0-9-]{72}$/.test(result.token)) throw new ApiError(unavailable);
      remember(result.token);
    }
    if (path === 'auth/session' && (method === 'DELETE' || !result.address)) remember(null);
    return result;
  }
  async function connectWallet(provider: { request: (data: any) => Promise<any> }) {
    // A service failure must not produce an unexplained wallet signature prompt.
    const service = await api('auth/session');
    if (external && service.authMode !== 'bearer') throw new ApiError(unavailable);
    const accounts = await provider.request({ method: 'eth_requestAccounts' });
    if (!Array.isArray(accounts) || !/^0x[0-9a-f]{40}$/i.test(accounts[0] || '')) throw new ApiError('Choose an Ethereum account in your wallet.');
    const nonce = await api('auth/nonce', { address: accounts[0] });
    if (typeof nonce.id !== 'string' || typeof nonce.message !== 'string' ||
        !nonce.message.startsWith(`${new URL(pageOrigin).host} wants you to sign in with your Ethereum account:\n`) ||
        !nonce.message.includes(`\nURI: ${pageOrigin}\n`)) {
      throw new ApiError('The sign-in message does not match this site. Close it and try again.');
    }
    const hex = '0x' + Array.from(new TextEncoder().encode(nonce.message), b => b.toString(16).padStart(2, '0')).join('');
    const signature = await provider.request({ method: 'personal_sign', params: [hex, accounts[0]] });
    return api('auth/verify', { id: nonce.id, signature });
  }
  return { api, connectWallet };
}

// Static previews on other hosts cannot use the origin-restricted live service.
// The original Worker development entry continues to use its local /api routes.
export function liveServicesAvailable() {
  const staticExport = typeof __WHEELKEEPERS_STATIC__ !== 'undefined' && __WHEELKEEPERS_STATIC__;
  return !staticExport || [API_ORIGIN, PUBLISHED_ORIGIN].includes(window.location.origin);
}
let client: ReturnType<typeof createApiClient> | undefined;
export function gameApi() {
  if (!client) {
    let storage: Storage | undefined;
    try { storage = window.sessionStorage; } catch { /* Storage is optional. */ }
    client = createApiClient({ pageOrigin: window.location.origin,
      apiOrigin: process.env.NODE_ENV === 'development' ? '' : API_ORIGIN, storage });
  }
  return client;
}
export function api(path: string, data?: unknown, method?: string) {
  if (!liveServicesAvailable()) return Promise.reject(new ApiError('Live scores and wallet sign-in are available on the published site. Practice works here.'));
  return gameApi().api(path, data, method);
}
