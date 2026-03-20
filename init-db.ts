import Database from "better-sqlite3";
import fs from "fs";

const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");

// Create tables
sqlite.exec(`
CREATE TABLE IF NOT EXISTS stations (
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
);

CREATE TABLE IF NOT EXISTS fuel_reports (
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
);

CREATE TABLE IF NOT EXISTS station_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  comment_id TEXT NOT NULL UNIQUE,
  place_id TEXT NOT NULL,
  station_name TEXT NOT NULL,
  message TEXT NOT NULL,
  reporter_ip TEXT DEFAULT '',
  timestamp TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pending_stations (
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
);

CREATE TABLE IF NOT EXISTS removal_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL UNIQUE,
  place_id TEXT NOT NULL,
  station_name TEXT NOT NULL,
  reason TEXT NOT NULL,
  reporter_ip TEXT DEFAULT '',
  timestamp TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS rate_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_hash TEXT NOT NULL,
  place_id TEXT NOT NULL,
  last_report TEXT NOT NULL,
  daily_requests INTEGER DEFAULT 0,
  date TEXT NOT NULL
);
`);

// Seed stations from JSON
const seedData = JSON.parse(fs.readFileSync("seed-data.json", "utf-8"));
const insertStmt = sqlite.prepare(`
  INSERT OR IGNORE INTO stations (place_id, name, brand, lat, lng, address, is_open_24h, source, status, last_synced)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertMany = sqlite.transaction((stationList: any[]) => {
  for (const s of stationList) {
    insertStmt.run(s.placeId, s.name, s.brand, s.lat, s.lng, s.address, s.isOpen24h ? 1 : 0, s.source, s.status, s.lastSynced);
  }
});

insertMany(seedData.stations);
console.log(`Seeded ${seedData.stations.length} stations`);

// Verify
const count = sqlite.prepare("SELECT count(*) as c FROM stations WHERE status = 'active'").get() as any;
console.log(`Active stations in DB: ${count.c}`);

sqlite.close();
