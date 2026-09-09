CREATE TABLE `audit` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace` text NOT NULL,
	`at` text NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`entity_id` text NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`before` text,
	`after` text,
	FOREIGN KEY (`workspace`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_workspace_at` ON `audit` (`workspace`,`at`);--> statement-breakpoint
CREATE TABLE `budgets` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace` text NOT NULL,
	`object_id` text NOT NULL,
	`month` text NOT NULL,
	`article` text NOT NULL,
	`amount` integer,
	`author` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`workspace`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`object_id`) REFERENCES `objects`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "budget_positive" CHECK("budgets"."amount" IS NULL OR "budgets"."amount">=0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `budgets_unique` ON `budgets` (`workspace`,`object_id`,`month`,`article`);--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace` text NOT NULL,
	`number` text NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`operation_at` text NOT NULL,
	`created_at` text NOT NULL,
	`recipient_id` text NOT NULL,
	`object_id` text NOT NULL,
	`recipient_name` text NOT NULL,
	`object_name` text NOT NULL,
	`author` text NOT NULL,
	`author_name` text NOT NULL,
	`comment` text DEFAULT '' NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`original_id` text,
	`total` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`workspace`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recipient_id`) REFERENCES `recipients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`object_id`) REFERENCES `objects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `documents_period` ON `documents` (`workspace`,`status`,`operation_at`);--> statement-breakpoint
CREATE INDEX `documents_object_period` ON `documents` (`workspace`,`object_id`,`operation_at`);--> statement-breakpoint
CREATE INDEX `documents_recipient_period` ON `documents` (`workspace`,`recipient_id`,`operation_at`);--> statement-breakpoint
CREATE INDEX `documents_return` ON `documents` (`original_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `documents_number` ON `documents` (`workspace`,`number`);--> statement-breakpoint
CREATE TABLE `guards` (
	`id` text PRIMARY KEY NOT NULL,
	`ok` integer NOT NULL,
	CONSTRAINT "optimistic_concurrency_guard" CHECK("guards"."ok"=1)
);
--> statement-breakpoint
CREATE TABLE `lines` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`resource_id` text NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`group` text NOT NULL,
	`unit` text NOT NULL,
	`qty` integer NOT NULL,
	`price` integer NOT NULL,
	`amount` integer NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`original_line_id` text,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`resource_id`) REFERENCES `resources`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "line_values" CHECK("lines"."qty">0 AND "lines"."price">=0 AND "lines"."amount">=0)
);
--> statement-breakpoint
CREATE INDEX `lines_document` ON `lines` (`document_id`);--> statement-breakpoint
CREATE INDEX `lines_resource` ON `lines` (`resource_id`);--> statement-breakpoint
CREATE INDEX `lines_original` ON `lines` (`original_line_id`);--> statement-breakpoint
CREATE TABLE `objects` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`model` text DEFAULT '' NOT NULL,
	`plate` text DEFAULT '' NOT NULL,
	`vin` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`responsible` text DEFAULT '' NOT NULL,
	`comment` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`workspace`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `objects_code_unique` ON `objects` (`workspace`,`code`);--> statement-breakpoint
CREATE TABLE `receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace` text NOT NULL,
	`actor` text NOT NULL,
	`result` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `recipients` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace` text NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`position` text DEFAULT '' NOT NULL,
	`department` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`comment` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`workspace`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `recipients_workspace` ON `recipients` (`workspace`);--> statement-breakpoint
CREATE TABLE `resources` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`group` text NOT NULL,
	`unit` text NOT NULL,
	`price` integer NOT NULL,
	`sku` text DEFAULT '' NOT NULL,
	`manufacturer` text DEFAULT '' NOT NULL,
	`grade` text DEFAULT '' NOT NULL,
	`comment` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`workspace`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "resource_price_positive" CHECK("resources"."price" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `resources_code_unique` ON `resources` (`workspace`,`code`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`timezone` text DEFAULT 'Asia/Kamchatka' NOT NULL,
	`price_basis` text DEFAULT 'with_vat' NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL
);
