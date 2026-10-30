CREATE TABLE `event_records` (
	`event_id` text NOT NULL,
	`address` text NOT NULL,
	`score` integer NOT NULL,
	`catches` integer NOT NULL,
	`orbits` integer NOT NULL,
	`played` integer DEFAULT 1 NOT NULL,
	`updated` integer NOT NULL,
	PRIMARY KEY(`event_id`, `address`)
);
--> statement-breakpoint
CREATE INDEX `event_records_ranking` ON `event_records` (`event_id`,`score`);--> statement-breakpoint
CREATE TABLE `wheel_events` (
	`id` text PRIMARY KEY NOT NULL,
	`seed` integer NOT NULL,
	`rpm` real NOT NULL,
	`opened_at` integer NOT NULL,
	`join_until` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `wheel_events_opened` ON `wheel_events` (`opened_at`);--> statement-breakpoint
CREATE TABLE `wheel_signal` (
	`id` integer PRIMARY KEY NOT NULL,
	`running` integer DEFAULT 0 NOT NULL,
	`observed_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE `runs` ADD `event_id` text;
--> statement-breakpoint
INSERT INTO wheel_signal (id,running,observed_at) VALUES (1,0,0);
