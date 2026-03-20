// Vercel Serverless Function entry point
// This wraps the Express app for Vercel's serverless runtime
import express from "express";
import Database from "better-sqlite3";
import crypto from "crypto";
import path from "path";
import fs from "fs";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// --- Database Setup ---
// Vercel serverless functions have a read-only filesystem except /tmp
// Copy the bundled data.db to /tmp if it doesn't exist there yet
function getDb() {
  const tmpDbPath = "/tmp/data.db";
  
  if (!fs.existsSync(tmpDbPath)) {
    // Look for the database in the function's deployment files
    const srcPaths = [
      path.join(process.cwd(), "data.db"),
      path.join(__dirname, "..", "data.db"),
      path.join(__dirname, "data.db"),
    ];
    
    for (const srcPath of srcPaths) {
      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, tmpDbPath);
        console.log(`Copied database from ${srcPath} to ${tmpDbPath}`);
        break;
      }
    }
  }
  
  const db = new Database(tmpDbPath);
  db.pragma("journal_mode = WAL");
  return db;
}

const db = getDb();

// --- Helper Functions ---
function generateId(prefix) {
  return `${prefix}-${Math.random().toString(36).substring(2, 10)}`;
}

function hashIp(ip) {
  return crypto.createHash("sha256").update(ip || "unknown").digest("hex").substring(0, 16);
}

function getClientIp(req) {
  return req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || "unknown";
}

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "wheresmyfuel2026!";

// --- Admin Auth Middleware ---
function adminAuth(req, res, next) {
  const auth = req.headers["x-admin-token"];
  if (auth !== "admin-session") {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// --- Public API Routes ---

app.get("/api/stations", (_req, res) => {
  const stations = db.prepare("SELECT * FROM stations WHERE status = 'active'").all();
  res.json(stations);
});

app.get("/api/stations/:placeId", (req, res) => {
  const { placeId } = req.params;
  const station = db.prepare("SELECT * FROM stations WHERE place_id = ?").get(placeId);
  if (!station) {
    return res.status(404).json({ error: "Station not found" });
  }
  
  const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const reports = db.prepare("SELECT * FROM fuel_reports WHERE place_id = ? AND timestamp > ? ORDER BY timestamp DESC").all(placeId, cutoff);
  const comments = db.prepare("SELECT * FROM station_comments WHERE place_id = ? ORDER BY timestamp DESC").all(placeId);
  
  res.json({ station, reports, comments });
});

app.post("/api/reports", (req, res) => {
  const { placeId, stationName, lat, lng, brand, fuelType, status, queueLevel } = req.body;
  
  if (!placeId || !stationName || !fuelType || !status) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  
  const ip = getClientIp(req);
  const ipHash = hashIp(ip);
  const today = new Date().toISOString().split("T")[0];
  
  // Rate limit check
  const rateRecord = db.prepare("SELECT * FROM rate_limits WHERE ip_hash = ? AND place_id = ? AND date = ?").get(ipHash, placeId, today);
  if (rateRecord && rateRecord.daily_requests >= 10) {
    return res.status(429).json({ error: "รายงานเกินจำนวนที่กำหนด กรุณารอสักครู่" });
  }
  
  const reportId = generateId("RPT");
  const timestamp = new Date().toISOString();
  
  db.prepare(`INSERT INTO fuel_reports (report_id, place_id, station_name, lat, lng, brand, fuel_type, status, queue_level, reporter_ip, timestamp, votes_confirm)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`).run(reportId, placeId, stationName, lat, lng, brand || "", fuelType, status, queueLevel || "none", ipHash, timestamp);
  
  // Record rate limit
  if (rateRecord) {
    db.prepare("UPDATE rate_limits SET daily_requests = daily_requests + 1, last_report = ? WHERE id = ?").run(timestamp, rateRecord.id);
  } else {
    db.prepare("INSERT INTO rate_limits (ip_hash, place_id, last_report, daily_requests, date) VALUES (?, ?, ?, 1, ?)").run(ipHash, placeId, timestamp, today);
  }
  
  const report = db.prepare("SELECT * FROM fuel_reports WHERE report_id = ?").get(reportId);
  res.json(report);
});

app.post("/api/reports/:reportId/confirm", (req, res) => {
  db.prepare("UPDATE fuel_reports SET votes_confirm = votes_confirm + 1 WHERE report_id = ?").run(req.params.reportId);
  res.json({ success: true });
});

app.post("/api/comments", (req, res) => {
  const { placeId, stationName, message } = req.body;
  if (!placeId || !stationName || !message || message.length > 500) {
    return res.status(400).json({ error: "Invalid data" });
  }
  
  const ip = getClientIp(req);
  const ipHash = hashIp(ip);
  const commentId = generateId("CMT");
  const timestamp = new Date().toISOString();
  
  db.prepare("INSERT INTO station_comments (comment_id, place_id, station_name, message, reporter_ip, timestamp) VALUES (?, ?, ?, ?, ?, ?)").run(commentId, placeId, stationName, message, ipHash, timestamp);
  
  const comment = db.prepare("SELECT * FROM station_comments WHERE comment_id = ?").get(commentId);
  res.json(comment);
});

app.post("/api/pending-stations", (req, res) => {
  const { stationName, brand, lat, lng } = req.body;
  if (!stationName || !lat || !lng) {
    return res.status(400).json({ error: "Invalid data" });
  }
  
  const ip = getClientIp(req);
  const ipHash = hashIp(ip);
  const requestId = generateId("REQ");
  const timestamp = new Date().toISOString();
  
  db.prepare("INSERT INTO pending_stations (request_id, station_name, brand, lat, lng, submitted_by_ip, timestamp, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')").run(requestId, stationName, brand || "อื่นๆ", lat, lng, ipHash, timestamp);
  
  const pending = db.prepare("SELECT * FROM pending_stations WHERE request_id = ?").get(requestId);
  res.json(pending);
});

app.post("/api/removal-requests", (req, res) => {
  const { placeId, stationName, reason } = req.body;
  if (!placeId || !stationName || !reason) {
    return res.status(400).json({ error: "Invalid data" });
  }
  
  const ip = getClientIp(req);
  const ipHash = hashIp(ip);
  const requestId = generateId("DEL");
  const timestamp = new Date().toISOString();
  
  db.prepare("INSERT INTO removal_requests (request_id, place_id, station_name, reason, reporter_ip, timestamp, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')").run(requestId, placeId, stationName, reason, ipHash, timestamp);
  
  const removal = db.prepare("SELECT * FROM removal_requests WHERE request_id = ?").get(requestId);
  res.json(removal);
});

// --- Admin API Routes ---

app.post("/api/admin/login", (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true, token: "admin-session" });
  } else {
    res.status(401).json({ error: "รหัสผ่านไม่ถูกต้อง" });
  }
});

app.get("/api/admin/stats", adminAuth, (_req, res) => {
  const totalStations = db.prepare("SELECT COUNT(*) as c FROM stations WHERE status = 'active'").get().c;
  const totalReports = db.prepare("SELECT COUNT(*) as c FROM fuel_reports").get().c;
  const today = new Date().toISOString().split("T")[0];
  const todayReports = db.prepare("SELECT COUNT(*) as c FROM fuel_reports WHERE timestamp LIKE ?").get(today + "%").c;
  const pendingRequests = db.prepare("SELECT COUNT(*) as c FROM pending_stations WHERE status = 'pending'").get().c;
  const totalComments = db.prepare("SELECT COUNT(*) as c FROM station_comments").get().c;
  const brandStats = db.prepare("SELECT brand, COUNT(*) as count FROM stations WHERE status = 'active' GROUP BY brand").all();
  
  res.json({ totalStations, totalReports, todayReports, pendingRequests, totalComments, brandStats });
});

app.get("/api/admin/reports", adminAuth, (_req, res) => {
  res.json(db.prepare("SELECT * FROM fuel_reports ORDER BY timestamp DESC").all());
});

app.get("/api/admin/comments", adminAuth, (_req, res) => {
  res.json(db.prepare("SELECT * FROM station_comments ORDER BY timestamp DESC").all());
});

app.delete("/api/admin/comments/:commentId", adminAuth, (req, res) => {
  db.prepare("DELETE FROM station_comments WHERE comment_id = ?").run(req.params.commentId);
  res.json({ success: true });
});

app.get("/api/admin/pending-stations", adminAuth, (_req, res) => {
  res.json(db.prepare("SELECT * FROM pending_stations ORDER BY timestamp DESC").all());
});

app.post("/api/admin/pending-stations/:requestId/approve", adminAuth, (req, res) => {
  const pending = db.prepare("SELECT * FROM pending_stations WHERE request_id = ?").get(req.params.requestId);
  if (!pending) return res.status(404).json({ error: "Not found" });
  
  const newPlaceId = `manual-${Date.now()}`;
  db.prepare("INSERT INTO stations (place_id, name, brand, lat, lng, source, status, last_synced) VALUES (?, ?, ?, ?, ?, 'manual', 'active', ?)").run(newPlaceId, pending.station_name, pending.brand || "อื่นๆ", pending.lat, pending.lng, new Date().toISOString());
  db.prepare("UPDATE pending_stations SET status = 'approved', reviewed_at = ?, note = ? WHERE request_id = ?").run(new Date().toISOString(), req.body.note || "", req.params.requestId);
  
  res.json({ success: true });
});

app.post("/api/admin/pending-stations/:requestId/reject", adminAuth, (req, res) => {
  db.prepare("UPDATE pending_stations SET status = 'rejected', reviewed_at = ?, note = ? WHERE request_id = ?").run(new Date().toISOString(), req.body.note || "", req.params.requestId);
  res.json({ success: true });
});

app.get("/api/admin/removal-requests", adminAuth, (_req, res) => {
  res.json(db.prepare("SELECT * FROM removal_requests ORDER BY timestamp DESC").all());
});

app.post("/api/admin/removal-requests/:requestId/approve", adminAuth, (req, res) => {
  const removal = db.prepare("SELECT * FROM removal_requests WHERE request_id = ?").get(req.params.requestId);
  if (!removal) return res.status(404).json({ error: "Not found" });
  
  db.prepare("UPDATE stations SET status = 'removed' WHERE place_id = ?").run(removal.place_id);
  db.prepare("UPDATE removal_requests SET status = 'approved' WHERE request_id = ?").run(req.params.requestId);
  res.json({ success: true });
});

app.post("/api/admin/removal-requests/:requestId/reject", adminAuth, (req, res) => {
  db.prepare("UPDATE removal_requests SET status = 'rejected' WHERE request_id = ?").run(req.params.requestId);
  res.json({ success: true });
});

app.post("/api/admin/clear/:type", adminAuth, (req, res) => {
  const { type } = req.params;
  switch (type) {
    case "reports": db.prepare("DELETE FROM fuel_reports").run(); break;
    case "pending": db.prepare("DELETE FROM pending_stations").run(); break;
    case "removals": db.prepare("DELETE FROM removal_requests").run(); break;
    case "comments": db.prepare("DELETE FROM station_comments").run(); break;
    default: return res.status(400).json({ error: "Invalid type" });
  }
  res.json({ success: true });
});

// Export for Vercel
export default app;
