CREATE TABLE "fuel_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_id" text NOT NULL,
	"place_id" text NOT NULL,
	"station_name" text NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"brand" text DEFAULT '',
	"fuel_type" text NOT NULL,
	"status" text NOT NULL,
	"queue_level" text DEFAULT 'none',
	"reporter_ip" text DEFAULT '',
	"timestamp" text NOT NULL,
	"votes_confirm" integer DEFAULT 0,
	CONSTRAINT "fuel_reports_report_id_unique" UNIQUE("report_id")
);

CREATE TABLE "pending_stations" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" text NOT NULL,
	"station_name" text NOT NULL,
	"brand" text DEFAULT 'อื่นๆ',
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"place_id_found" text DEFAULT '',
	"maps_verified" boolean DEFAULT false,
	"submitted_by_ip" text DEFAULT '',
	"timestamp" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_at" text,
	"note" text DEFAULT '',
	CONSTRAINT "pending_stations_request_id_unique" UNIQUE("request_id")
);

CREATE TABLE "rate_limits" (
	"id" serial PRIMARY KEY NOT NULL,
	"ip_hash" text NOT NULL,
	"place_id" text NOT NULL,
	"last_report" text NOT NULL,
	"daily_requests" integer DEFAULT 0,
	"date" text NOT NULL
);

CREATE TABLE "removal_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" text NOT NULL,
	"place_id" text NOT NULL,
	"station_name" text NOT NULL,
	"reason" text NOT NULL,
	"reporter_ip" text DEFAULT '',
	"timestamp" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	CONSTRAINT "removal_requests_request_id_unique" UNIQUE("request_id")
);

CREATE TABLE "station_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"comment_id" text NOT NULL,
	"place_id" text NOT NULL,
	"station_name" text NOT NULL,
	"message" text NOT NULL,
	"reporter_ip" text DEFAULT '',
	"timestamp" text NOT NULL,
	CONSTRAINT "station_comments_comment_id_unique" UNIQUE("comment_id")
);

CREATE TABLE "stations" (
	"id" serial PRIMARY KEY NOT NULL,
	"place_id" text NOT NULL,
	"name" text NOT NULL,
	"brand" text DEFAULT 'อื่นๆ' NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"address" text DEFAULT '',
	"is_open_24h" boolean DEFAULT false,
	"source" text DEFAULT 'manual' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"last_synced" text,
	CONSTRAINT "stations_place_id_unique" UNIQUE("place_id")
);
