ALTER TABLE `runs` ADD `state` text;--> statement-breakpoint
ALTER TABLE `runs` ADD `checkpoint` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `runs` ADD `updated` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `runs` ADD `last_payload` text;