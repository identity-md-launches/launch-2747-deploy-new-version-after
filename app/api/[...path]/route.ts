import { isAddress, verifyMessage } from 'viem';
import { cookies } from 'next/headers';
import { body, database, digest, identity, json, pulse, sameOrigin } from '@/lib/server';
import { createGame, replayChunk, verifyRunTiming, type Game } from '@/lib/game';
export const dynamic = 'force-dynamic';
const endpoint = (r: Request) => new URL(r.url).pathname.replace(/^\/api\//, '');
export async function GET(req: Request) {
  try {
    const path = endpoint(req);
    if (path === 'pulse') return json(await pulse());
    if (path === 'auth/session') return json({ address: await identity() });
    if (path === 'leaderboard') {
      const db = database(), address = await identity();
      const top = await db.prepare('SELECT address,score,catches,played FROM records ORDER BY score DESC,updated ASC,address ASC LIMIT 20').all();
      const count = await db.prepare('SELECT COUNT(*) AS n FROM records').first<{n: number}>();
      const me = address ? await db.prepare('SELECT address,score,catches,played FROM records WHERE address = ?').bind(address).first() : null;
      return json({ rows: top.results, total: count?.n || 0, me });
    }
    return json({ error: 'Not found.' }, 404);
  } catch { return json({ error: 'Service temporarily unavailable.' }, 503); }
}
export async function DELETE(req: Request) {
  try {
    sameOrigin(req);
    if (endpoint(req) !== 'auth/session') return json({ error: 'Not found.' }, 404);
    const token = (await cookies()).get('wk_session')?.value;
    if (token) await database().prepare('DELETE FROM sessions WHERE token = ?').bind(await digest(token)).run();
    const r = json({ ok: true }); r.headers.set('Set-Cookie', 'wk_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'); return r;
  } catch { return json({ error: 'Could not sign out.' }, 400); }
}
export async function POST(req: Request) {
  try {
    const data = await body(req), path = endpoint(req), db = database(), now = Date.now();
    if (path === 'auth/nonce') {
      const { address } = data;
      if (typeof address !== 'string' || !isAddress(address)) return json({ error: 'Choose an Ethereum wallet.' }, 400);
      const account = address.toLowerCase(), ip = await digest(req.headers.get('cf-connecting-ip') || 'local');
      const limit = await db.prepare('SELECT COUNT(*) AS n FROM nonces WHERE created > ? AND (address = ? OR ip = ?)').bind(now - 600000, account, ip).first<{n: number}>();
      if ((limit?.n || 0) >= 20) return json({ error: 'Too many sign-in attempts. Try again in 10 minutes.' }, 429);
      const id = crypto.randomUUID(), expires = now + 300000, url = new URL(req.url);
      const message = `${url.host} wants you to sign in with your Ethereum account:\n${address}\n\nSign in to Wheelkeepers to save your arcade scores. This message does not authorize a transaction or token access.\n\nURI: ${url.origin}\nVersion: 1\nChain ID: 1\nNonce: ${id.replaceAll('-', '')}\nIssued At: ${new Date(now).toISOString()}\nExpiration Time: ${new Date(expires).toISOString()}`;
      await db.prepare('INSERT INTO nonces (id,address,message,created,expires,ip) VALUES (?,?,?,?,?,?)').bind(id, account, message, now, expires, ip).run();
      await db.batch([
        db.prepare('DELETE FROM nonces WHERE id IN (SELECT id FROM nonces WHERE expires < ? LIMIT 100)').bind(now - 600000),
        db.prepare('DELETE FROM sessions WHERE token IN (SELECT token FROM sessions WHERE expires < ? LIMIT 100)').bind(now),
        db.prepare('DELETE FROM runs WHERE id IN (SELECT id FROM runs WHERE updated < ? LIMIT 100)').bind(now - 86400000),
      ]);
      return json({ id, message });
    }
    if (path === 'auth/verify') {
      const { id, signature } = data;
      if (typeof id !== 'string' || typeof signature !== 'string' || !/^0x[0-9a-f]{130}$/i.test(signature)) return json({ error: 'Invalid signature.' }, 400);
      const nonce = await db.prepare('SELECT * FROM nonces WHERE id = ? AND used = 0 AND expires > ?').bind(id, now).first<{address: `0x${string}`; message: string}>();
      if (!nonce || !await verifyMessage({ address: nonce.address, message: nonce.message, signature: signature as `0x${string}` })) return json({ error: 'Signature expired or does not match this wallet.' }, 401);
      const used = await db.prepare('UPDATE nonces SET used = 1 WHERE id = ? AND used = 0 AND expires > ?').bind(id, now).run();
      if (used.meta.changes !== 1) return json({ error: 'This sign-in message has already been used.' }, 401);
      const token = crypto.randomUUID() + crypto.randomUUID();
      await db.prepare('INSERT INTO sessions (token,address,expires) VALUES (?,?,?)').bind(await digest(token), nonce.address, now + 604800000).run();
      const response = json({ address: nonce.address });
      response.headers.set('Set-Cookie', `wk_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${new URL(req.url).protocol === 'https:' ? '; Secure' : ''}`);
      return response;
    }
    if (path !== 'runs') return json({ error: 'Not found.' }, 404);
    const address = await identity();
    if (!address) return json({ error: 'Sign in with your wallet to play a ranked run.' }, 401);
    if (data.action === 'start') {
      const recent = await db.prepare('SELECT COUNT(*) AS n FROM runs WHERE address = ? AND started > ?').bind(address, now - 60000).first<{n: number}>();
      if ((recent?.n || 0) >= 4) return json({ error: 'Take a breather. Your next ranked run opens in a minute.' }, 429);
      const live = await pulse();
      if (!live.available) return json({ error: 'The live feed is stale or offline. Practice is available; ranked runs resume with fresh data.' }, 503);
      const id = crypto.randomUUID();
      // Salt the live block with fresh server entropy. A practiced or copied replay
      // cannot be carried into a new ranked run, even within the same Squeek block.
      const seed = parseInt((await digest(`${live.seed}:${id}:${address}`)).slice(0,8),16);
      const started=Date.now();
      await db.batch([
        db.prepare('UPDATE runs SET consumed = 1 WHERE address = ? AND consumed = 0').bind(address),
        db.prepare('INSERT INTO runs (id,address,seed,started,source,state,updated) VALUES (?,?,?,?,?,?,?)').bind(id, address, seed, started, JSON.stringify(live),JSON.stringify(createGame(seed)),started),
      ]);
      return json({ id, seed, source: live.height });
    }
    if (data.action !== 'checkpoint' || typeof data.id !== 'string' || !Number.isSafeInteger(data.sequence) || data.sequence<1 || typeof data.finished!=='boolean') return json({ error: 'Invalid run checkpoint.' }, 400);
    const run = await db.prepare('SELECT * FROM runs WHERE id = ? AND address = ?').bind(data.id, address).first<{seed: number; started: number; state:string|null; checkpoint:number; updated:number; consumed:number; last_payload:string|null;score:number;catches:number}>();
    if (!run?.state) return json({ error: 'This run expired. Start a new run.' }, 400);
    const previousState=JSON.parse(run.state) as Game;
    if(run.consumed&&!previousState.ended)return json({error:'This run was replaced by a newer run.'},400);
    const payloadHash=await digest(JSON.stringify([data.sequence,data.throughStep,data.finished,data.moves]));
    if(data.sequence===run.checkpoint&&payloadHash===run.last_payload) return json({saved:!!run.consumed,finished:!!run.consumed,score:run.score,catches:run.catches,lives:previousState.lives,step:data.throughStep,sequence:run.checkpoint});
    if(run.consumed||now-run.updated>60000||data.sequence!==run.checkpoint+1) return json({error:'This run expired or its checkpoint is out of order.'},400);
    const g = replayChunk(previousState,data.moves,data.throughStep,data.finished);
    verifyRunTiming(run.started,now,g.step);
    const replayHash = await digest((run.last_payload||'')+payloadHash);
    if(!g.ended){
      const saved=await db.prepare('UPDATE runs SET state = ?,checkpoint = ?,updated = ?,last_payload = ?,score = ?,catches = ?,replay_hash = ? WHERE id = ? AND address = ? AND checkpoint = ? AND consumed = 0')
        .bind(JSON.stringify(g),data.sequence,now,payloadHash,g.score,g.catches,replayHash,data.id,address,run.checkpoint).run();
      if(saved.meta.changes!==1)return json({error:'Checkpoint already advanced. Retry the same checkpoint.'},409);
      return json({saved:false,finished:false,score:g.score,catches:g.catches,lives:g.lives,step:g.step,sequence:data.sequence});
    }
    // D1 batch is transactional: a storage failure leaves the run retryable, and racing
    // submissions cannot increment played twice.
    const committed = await db.batch([
      db.prepare(`INSERT INTO records (address,score,catches,played,updated)
      SELECT address,?,?,1,? FROM runs WHERE id = ? AND address = ? AND consumed = 0 AND checkpoint = ?
      ON CONFLICT(address) DO UPDATE SET catches = CASE WHEN excluded.score > records.score THEN excluded.catches ELSE records.catches END,
      updated = CASE WHEN excluded.score > records.score THEN excluded.updated ELSE records.updated END,
      score = MAX(records.score, excluded.score), played = records.played + 1`).bind(g.score, g.catches, now, data.id, address,run.checkpoint),
      db.prepare('UPDATE runs SET consumed = 1,score = ?,catches = ?,replay_hash = ?,state = ?,checkpoint = ?,updated = ?,last_payload = ? WHERE id = ? AND address = ? AND checkpoint = ? AND consumed = 0')
        .bind(g.score,g.catches,replayHash,JSON.stringify(g),data.sequence,now,payloadHash,data.id,address,run.checkpoint),
    ]);
    if (committed[1].meta.changes !== 1) return json({ error: 'This run was already submitted.' }, 409);
    return json({ score: g.score, catches: g.catches,lives:g.lives, saved: true,finished:true,step:g.step,sequence:data.sequence });
  } catch (e) { return json({ error: e instanceof Error ? e.message : 'Could not complete this request.' }, 400); }
}
