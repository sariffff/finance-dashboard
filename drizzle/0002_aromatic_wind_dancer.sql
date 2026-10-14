ALTER TABLE "imports" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "imports" ALTER COLUMN "status" SET DEFAULT 'pending'::text;--> statement-breakpoint
DROP TYPE "public"."import_status";--> statement-breakpoint
CREATE TYPE "public"."import_status" AS ENUM('pending', 'completed', 'failed');--> statement-breakpoint
ALTER TABLE "imports" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."import_status";--> statement-breakpoint
ALTER TABLE "imports" ALTER COLUMN "status" SET DATA TYPE "public"."import_status" USING "status"::"public"."import_status";--> statement-breakpoint
ALTER TABLE "imports" ADD COLUMN "preview" jsonb;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "occurred_time" time;