CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"conversation_id" text,
	"project_id" text,
	"title" text DEFAULT 'New session' NOT NULL,
	"type" text DEFAULT 'chat' NOT NULL,
	"state" text DEFAULT 'active' NOT NULL,
	"model" text,
	"think_mode" text DEFAULT 'balanced' NOT NULL,
	"temporary" boolean DEFAULT false NOT NULL,
	"context_notes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"summary" text,
	"summary_generated_at" timestamp with time zone,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sessions_user_state_idx" ON "sessions" USING btree ("user_id","state","started_at");--> statement-breakpoint
CREATE INDEX "sessions_conversation_idx" ON "sessions" USING btree ("conversation_id");