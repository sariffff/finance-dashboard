CREATE TYPE "public"."category_kind" AS ENUM('income', 'expense');--> statement-breakpoint
CREATE TYPE "public"."category_source" AS ENUM('rule', 'ai', 'user');--> statement-breakpoint
CREATE TYPE "public"."direction" AS ENUM('in', 'out');--> statement-breakpoint
CREATE TYPE "public"."file_type" AS ENUM('csv', 'pdf', 'slip');--> statement-breakpoint
CREATE TYPE "public"."import_status" AS ENUM('processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."match_type" AS ENUM('contains', 'regex');--> statement-breakpoint
CREATE TYPE "public"."rule_source" AS ENUM('system', 'user', 'ai_cache');--> statement-breakpoint
CREATE TABLE "bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"bank_code" text NOT NULL,
	"nickname" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"name" text NOT NULL,
	"icon" text NOT NULL,
	"color" text NOT NULL,
	"kind" "category_kind" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_user_id_name_unique" UNIQUE NULLS NOT DISTINCT("user_id","name")
);
--> statement-breakpoint
CREATE TABLE "category_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"pattern" text NOT NULL,
	"match_type" "match_type" DEFAULT 'contains' NOT NULL,
	"category_id" uuid NOT NULL,
	"source" "rule_source" NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "category_rules_user_pattern_unique" UNIQUE NULLS NOT DISTINCT("user_id","pattern","match_type")
);
--> statement-breakpoint
CREATE TABLE "imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"bank_account_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"file_type" "file_type" NOT NULL,
	"storage_key" text,
	"status" "import_status" DEFAULT 'processing' NOT NULL,
	"row_count" integer DEFAULT 0 NOT NULL,
	"duplicate_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"bank_account_id" uuid NOT NULL,
	"import_id" uuid,
	"occurred_at" date NOT NULL,
	"description" text NOT NULL,
	"merchant" text,
	"amount" numeric(14, 2) NOT NULL,
	"direction" "direction" NOT NULL,
	"category_id" uuid,
	"category_source" "category_source",
	"dedupe_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_user_id_dedupe_hash_unique" UNIQUE("user_id","dedupe_hash"),
	CONSTRAINT "transactions_amount_non_negative" CHECK ("transactions"."amount" >= 0)
);
--> statement-breakpoint
ALTER TABLE "category_rules" ADD CONSTRAINT "category_rules_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imports" ADD CONSTRAINT "imports_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bank_accounts_user_id_idx" ON "bank_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "imports_user_id_created_at_idx" ON "imports" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "transactions_user_id_occurred_at_idx" ON "transactions" USING btree ("user_id","occurred_at");