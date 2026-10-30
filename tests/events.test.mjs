import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { observeWheel, latestEvent, findEvent } from '../lib/events.ts';

function storage(){
  const sqlite=new DatabaseSync(':memory:');
  const directory=new URL('../drizzle/',import.meta.url);
  for(const file of readdirSync(directory).filter(f=>f.endsWith('.sql')).sort()) sqlite.exec(readFileSync(new URL(file,directory),'utf8'));
  function prepare(sql,args=[]){return {
    bind(...values){return prepare(sql,values);},
    async first(){return sqlite.prepare(sql).get(...args)||null;},
    async all(){return {results:sqlite.prepare(sql).all(...args)};},
    async run(){return sqlite.prepare(sql).run(...args);},
  };}
  return {prepare,async batch(statements){sqlite.exec('BEGIN');try{const result=[];for(const statement of statements)result.push(await statement.run());sqlite.exec('COMMIT');return result;}catch(error){sqlite.exec('ROLLBACK');throw error;}},sqlite};
}
const at=Date.parse('2026-10-30T12:00:00Z');
const signal=(time,running=true)=>({available:true,state:running?'running':'resting',rpm:running?18:0,receivedAt:new Date(time).toISOString()});

test('simultaneous visitors share one persisted event and an isolate restart does not reopen it',async()=>{
  const db=storage();
  // D1 serializes transactions; queue the fake batches the same way.
  const batch=db.batch.bind(db);let queue=Promise.resolve();db.batch=statements=>{const result=queue.then(()=>batch(statements));queue=result.catch(()=>{});return result;};
  const events=await Promise.all(Array.from({length:8},()=>observeWheel(db,signal(at),at)));
  assert.equal(new Set(events.map(e=>e.id)).size,1);
  assert.equal(events[0].joinUntil,at+90000);
  const later=await observeWheel(db,signal(at+100000),at+100000);
  assert.equal(later.id,events[0].id,'Continued running after the join window does not create another event');
  assert.equal((await findEvent(db,events[0].id)).rpm,18);
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM wheel_events').get().n,1);
  db.sqlite.close();
});

test('offline, stale and out-of-order signals cannot create a restart or extend an event',async()=>{
  const db=storage(),first=await observeWheel(db,signal(at),at);
  await observeWheel(db,{...signal(at+10000,false),available:false},at+10000);
  await observeWheel(db,signal(at-1,false),at+20000);
  await observeWheel(db,signal(at+30000),at+30000);
  assert.equal((await latestEvent(db)).id,first.id);
  await observeWheel(db,signal(at+40000,false),at+40000);
  await observeWheel(db,signal(at+50000),at+50000);
  assert.equal((await latestEvent(db)).joinUntil,first.joinUntil,'A short stop does not extend or overlap an open event');
  await observeWheel(db,signal(at+100000,false),at+100000);
  const second=await observeWheel(db,signal(at+110000),at+110000);
  assert.notEqual(second.id,first.id);assert.equal(second.joinUntil,at+200000);
  db.sqlite.close();
});

test('resting or invalid hardware measurements never manufacture a Boost',async()=>{
  const db=storage();
  for(const value of [signal(at,false),{...signal(at+1),rpm:-1},{...signal(at+1),rpm:NaN},signal(at-121000),signal(at+6000)]){
    assert.equal(await observeWheel(db,value,at),null);
  }
  assert.equal(await findEvent(db,'missing'),null);
  db.sqlite.close();
});
