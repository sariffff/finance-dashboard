CREATE TABLE "monthly_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"month" text NOT NULL,
	"bullets" jsonb NOT NULL,
	"input_hash" text NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "monthly_insights_user_id_month_unique" UNIQUE("user_id","month")
);
--> statement-breakpoint
ALTER TABLE "monthly_insights" ADD CONSTRAINT "monthly_insights_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;