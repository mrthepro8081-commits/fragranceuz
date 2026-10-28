CREATE TABLE `product_images` (
	`key` text PRIMARY KEY NOT NULL,
	`content_type` text NOT NULL,
	`data` blob NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `product_removals` (
	`key` text PRIMARY KEY NOT NULL,
	`removed_at` text NOT NULL
);
