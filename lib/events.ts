import type { WheelEvent } from './game';

type Signal = { available: boolean; state: string; rpm: number | null; receivedAt: string | null };
const columns = 'id,seed,rpm,opened_at AS openedAt,join_until AS joinUntil';
const JOIN_WINDOW_MS = 90000;

export async function latestEvent(db: D1Database): Promise<WheelEvent | null> {
  return db.prepare(`SELECT ${columns} FROM wheel_events ORDER BY opened_at DESC,id DESC LIMIT 1`).first<WheelEvent>();
}

export async function findEvent(db: D1Database, id: string): Promise<WheelEvent | null> {
  return db.prepare(`SELECT ${columns} FROM wheel_events WHERE id = ?`).bind(id).first<WheelEvent>();
}

// Persist the observed hardware transition, rather than an isolate-local flag.
// The guarded insert and signal update share a transaction: simultaneous visitors
// create one event, and stale/offline measurements never manufacture a restart.
export async function observeWheel(db: D1Database, signal: Signal, now = Date.now()): Promise<WheelEvent | null> {
  const observedAt = Date.parse(signal.receivedAt || '');
  if (!signal.available || !Number.isFinite(observedAt) || observedAt > now + 5000 ||
      now - observedAt > 120000 || signal.rpm == null || !Number.isFinite(signal.rpm) || signal.rpm < 0 ||
      !['running', 'resting'].includes(signal.state)) return latestEvent(db);
  const previous = await db.prepare('SELECT observed_at FROM wheel_signal WHERE id = 1').first<{ observed_at: number }>();
  if (previous && previous.observed_at >= observedAt) return latestEvent(db);
  const running = signal.state === 'running' && signal.rpm > 0;
  const id = crypto.randomUUID(), seed = crypto.getRandomValues(new Uint32Array(1))[0];
  await db.batch([
    db.prepare(`INSERT INTO wheel_events (id,seed,rpm,opened_at,join_until)
      SELECT ?,?,?,?,? FROM wheel_signal WHERE id = 1 AND running = 0 AND observed_at < ? AND ? = 1
      AND NOT EXISTS (SELECT 1 FROM wheel_events WHERE join_until > ?)`)
      .bind(id, seed, signal.rpm, now, now + JOIN_WINDOW_MS, observedAt, running ? 1 : 0, now),
    db.prepare('UPDATE wheel_signal SET running = ?,observed_at = ? WHERE id = 1 AND observed_at < ?')
      .bind(running ? 1 : 0, observedAt, observedAt),
  ]);
  return latestEvent(db);
}
