ALTER TABLE "conversations" ADD COLUMN "pinned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "accent_color" text DEFAULT 'green' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "text_size" text DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "model" text DEFAULT 'claude-sonnet-4-6' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "dictation_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "voice_name" text;