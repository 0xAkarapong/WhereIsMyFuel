import { db } from "./storage";
import { stations, fuelReports, stationComments, removalRequests } from "@shared/schema";
import { sql } from "drizzle-orm";

// Create tables
db.run(sql`CREATE TABLE IF NOT EXISTS stations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  place_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  brand TEXT NOT NULL DEFAULT 'อื่นๆ',
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  address TEXT DEFAULT '',
  is_open_24h INTEGER DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'active',
  last_synced TEXT
)`);

db.run(sql`CREATE TABLE IF NOT EXISTS fuel_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id TEXT NOT NULL UNIQUE,
  place_id TEXT NOT NULL,
  station_name TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  brand TEXT DEFAULT '',
  fuel_type TEXT NOT NULL,
  status TEXT NOT NULL,
  queue_level TEXT DEFAULT 'none',
  reporter_ip TEXT DEFAULT '',
  timestamp TEXT NOT NULL,
  votes_confirm INTEGER DEFAULT 0
)`);

db.run(sql`CREATE TABLE IF NOT EXISTS station_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  comment_id TEXT NOT NULL UNIQUE,
  place_id TEXT NOT NULL,
  station_name TEXT NOT NULL,
  message TEXT NOT NULL,
  reporter_ip TEXT DEFAULT '',
  timestamp TEXT NOT NULL
)`);

db.run(sql`CREATE TABLE IF NOT EXISTS pending_stations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL UNIQUE,
  station_name TEXT NOT NULL,
  brand TEXT DEFAULT 'อื่นๆ',
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  place_id_found TEXT DEFAULT '',
  maps_verified INTEGER DEFAULT 0,
  submitted_by_ip TEXT DEFAULT '',
  timestamp TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_at TEXT,
  note TEXT DEFAULT ''
)`);

db.run(sql`CREATE TABLE IF NOT EXISTS removal_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL UNIQUE,
  place_id TEXT NOT NULL,
  station_name TEXT NOT NULL,
  reason TEXT NOT NULL,
  reporter_ip TEXT DEFAULT '',
  timestamp TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
)`);

db.run(sql`CREATE TABLE IF NOT EXISTS rate_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_hash TEXT NOT NULL,
  place_id TEXT NOT NULL,
  last_report TEXT NOT NULL,
  daily_requests INTEGER DEFAULT 0,
  date TEXT NOT NULL
)`);

console.log("All tables created successfully");
