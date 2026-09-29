CREATE TYPE "alarm_severity" AS ENUM('warning', 'error');--> statement-breakpoint
CREATE TYPE "alarm_recovery_status" AS ENUM('active', 'escalating', 'recovered');--> statement-breakpoint
CREATE TABLE "alarms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fingerprint" text NOT NULL,
	"severity" "alarm_severity" NOT NULL,
	"kind" text NOT NULL,
	"failure_domain" text NOT NULL,
	"related_session_id" uuid,
	"related_device_id" uuid,
	"related_pipeline_id" uuid,
	"summary" text NOT NULL,
	"retryable" boolean,
	"recovery_status" "alarm_recovery_status" DEFAULT 'active' NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"event_count" integer DEFAULT 1 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"cleared_at" timestamp with time zone,
	"clear_reason" text,
	"evidence" jsonb NOT NULL,
	"ack_at" timestamp with time zone,
	"ack_by" text,
	"ack_note" text
);--> statement-breakpoint
CREATE UNIQUE INDEX "alarms_fingerprint_active_idx" ON "alarms" USING btree ("fingerprint") WHERE "alarms"."active";--> statement-breakpoint
CREATE INDEX "alarms_active_idx" ON "alarms" USING btree ("active");--> statement-breakpoint
CREATE INDEX "alarms_last_seen_idx" ON "alarms" USING btree ("last_seen_at");
