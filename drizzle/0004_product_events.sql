CREATE TABLE `product_events` (
	`day` text NOT NULL,
	`product_id` text NOT NULL,
	`views` integer DEFAULT 0 NOT NULL,
	`adds` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`day`, `product_id`)
);
