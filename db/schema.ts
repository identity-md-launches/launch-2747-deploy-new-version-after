import { sqliteTable, text, integer, real, primaryKey, index } from 'drizzle-orm/sqlite-core';
export const nonces = sqliteTable('nonces', {
  id: text('id').primaryKey(), address: text('address').notNull(), message: text('message').notNull(),
  created: integer('created').notNull(), expires: integer('expires').notNull(), used: integer('used').notNull().default(0), ip: text('ip').notNull(),
});
export const sessions = sqliteTable('sessions', {
  token: text('token').primaryKey(), address: text('address').notNull(), expires: integer('expires').notNull(),
});
export const runs = sqliteTable('runs', {
  id: text('id').primaryKey(), address: text('address').notNull(), seed: integer('seed').notNull(),
  started: integer('started').notNull(), consumed: integer('consumed').notNull().default(0),
  score: integer('score'), catches: integer('catches'), source: text('source').notNull(), replayHash: text('replay_hash'),
  state: text('state'), checkpoint: integer('checkpoint').notNull().default(0),
  updated: integer('updated').notNull().default(0), lastPayload: text('last_payload'),
  eventId: text('event_id'),
});

export const wheelEvents = sqliteTable('wheel_events', {
  id: text('id').primaryKey(), seed: integer('seed').notNull(), rpm: real('rpm').notNull(),
  openedAt: integer('opened_at').notNull(), joinUntil: integer('join_until').notNull(),
}, table => [index('wheel_events_opened').on(table.openedAt)]);
export const wheelSignal = sqliteTable('wheel_signal', {
  id: integer('id').primaryKey(), running: integer('running').notNull().default(0),
  observedAt: integer('observed_at').notNull().default(0),
});
export const eventRecords = sqliteTable('event_records', {
  eventId: text('event_id').notNull(), address: text('address').notNull(),
  score: integer('score').notNull(), catches: integer('catches').notNull(), orbits: integer('orbits').notNull(),
  played: integer('played').notNull().default(1), updated: integer('updated').notNull(),
}, table => [primaryKey({ columns: [table.eventId, table.address] }),
  index('event_records_ranking').on(table.eventId, table.score)]);
export const records = sqliteTable('records', {
  address: text('address').primaryKey(), score: integer('score').notNull(), catches: integer('catches').notNull(),
  played: integer('played').notNull().default(1), updated: integer('updated').notNull(),
});
