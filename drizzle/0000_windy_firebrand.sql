CREATE TABLE `nonces` (
	`id` text PRIMARY KEY NOT NULL,
	`address` text NOT NULL,
	`message` text NOT NULL,
	`created` integer NOT NULL,
	`expires` integer NOT NULL,
	`used` integer DEFAULT 0 NOT NULL,
	`ip` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `records` (
	`address` text PRIMARY KEY NOT NULL,
	`score` integer NOT NULL,
	`catches` integer NOT NULL,
	`played` integer DEFAULT 1 NOT NULL,
	`updated` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`address` text NOT NULL,
	`seed` integer NOT NULL,
	`started` integer NOT NULL,
	`consumed` integer DEFAULT 0 NOT NULL,
	`score` integer,
	`catches` integer,
	`source` text NOT NULL,
	`replay_hash` text
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`token` text PRIMARY KEY NOT NULL,
	`address` text NOT NULL,
	`expires` integer NOT NULL
);
