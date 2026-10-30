import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
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
});
export const records = sqliteTable('records', {
  address: text('address').primaryKey(), score: integer('score').notNull(), catches: integer('catches').notNull(),
  played: integer('played').notNull().default(1), updated: integer('updated').notNull(),
});
