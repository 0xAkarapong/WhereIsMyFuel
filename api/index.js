// Vercel Serverless Function entry point
// This wraps the Express app for Vercel's serverless runtime
import express from "express";
import pg from "pg";
import crypto from "crypto";

const { Pool } = pg;

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// --- Database Setup ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

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

app.get("/api/stations", async (_req, res) => {
  try {
    const result = await pool.query("SELECT * FROM stations WHERE status = 'active'");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/stations/:placeId", async (req, res) => {
  try {
    const { placeId } = req.params;
    const stationResult = await pool.query("SELECT * FROM stations WHERE place_id = $1", [placeId]);
    const station = stationResult.rows[0];
    if (!station) {
      return res.status(404).json({ error: "Station not found" });
    }
    
    const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const reportsResult = await pool.query("SELECT * FROM fuel_reports WHERE place_id = $1 AND timestamp > $2 ORDER BY timestamp DESC", [placeId, cutoff]);
    const commentsResult = await pool.query("SELECT * FROM station_comments WHERE place_id = $1 ORDER BY timestamp DESC", [placeId]);
    
    res.json({ 
      station, 
      reports: reportsResult.rows, 
      comments: commentsResult.rows 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/reports", async (req, res) => {
  try {
    const { placeId, stationName, lat, lng, brand, fuelType, status, queueLevel } = req.body;
    
    if (!placeId || !stationName || !fuelType || !status) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    
    const ip = getClientIp(req);
    const ipHash = hashIp(ip);
    const today = new Date().toISOString().split("T")[0];
    
    // Rate limit check
    const rateResult = await pool.query("SELECT * FROM rate_limits WHERE ip_hash = $1 AND place_id = $2 AND date = $3", [ipHash, placeId, today]);
    const rateRecord = rateResult.rows[0];
    
    if (rateRecord && rateRecord.daily_requests >= 10) {
      return res.status(429).json({ error: "รายงานเกินจำนวนที่กำหนด กรุณารอสักครู่" });
    }
    
    const reportId = generateId("RPT");
    const timestamp = new Date().toISOString();
    
    await pool.query(`INSERT INTO fuel_reports (report_id, place_id, station_name, lat, lng, brand, fuel_type, status, queue_level, reporter_ip, timestamp, votes_confirm)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0)`, 
      [reportId, placeId, stationName, lat, lng, brand || "", fuelType, status, queueLevel || "none", ipHash, timestamp]
    );
    
    // Record rate limit
    if (rateRecord) {
      await pool.query("UPDATE rate_limits SET daily_requests = daily_requests + 1, last_report = $1 WHERE id = $2", [timestamp, rateRecord.id]);
    } else {
      await pool.query("INSERT INTO rate_limits (ip_hash, place_id, last_report, daily_requests, date) VALUES ($1, $2, $3, 1, $4)", [ipHash, placeId, timestamp, today]);
    }
    
    const finalReportResult = await pool.query("SELECT * FROM fuel_reports WHERE report_id = $1", [reportId]);
    res.json(finalReportResult.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/reports/:reportId/confirm", async (req, res) => {
  try {
    await pool.query("UPDATE fuel_reports SET votes_confirm = votes_confirm + 1 WHERE report_id = $1", [req.params.reportId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/comments", async (req, res) => {
  try {
    const { placeId, stationName, message } = req.body;
    if (!placeId || !stationName || !message || message.length > 500) {
      return res.status(400).json({ error: "Invalid data" });
    }
    
    const ip = getClientIp(req);
    const ipHash = hashIp(ip);
    const commentId = generateId("CMT");
    const timestamp = new Date().toISOString();
    
    await pool.query("INSERT INTO station_comments (comment_id, place_id, station_name, message, reporter_ip, timestamp) VALUES ($1, $2, $3, $4, $5, $6)", 
      [commentId, placeId, stationName, message, ipHash, timestamp]
    );
    
    const result = await pool.query("SELECT * FROM station_comments WHERE comment_id = $1", [commentId]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/pending-stations", async (req, res) => {
  try {
    const { stationName, brand, lat, lng } = req.body;
    if (!stationName || !lat || !lng) {
      return res.status(400).json({ error: "Invalid data" });
    }
    
    const ip = getClientIp(req);
    const ipHash = hashIp(ip);
    const requestId = generateId("REQ");
    const timestamp = new Date().toISOString();
    
    await pool.query("INSERT INTO pending_stations (request_id, station_name, brand, lat, lng, submitted_by_ip, timestamp, status) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')", 
      [requestId, stationName, brand || "อื่นๆ", lat, lng, ipHash, timestamp]
    );
    
    const result = await pool.query("SELECT * FROM pending_stations WHERE request_id = $1", [requestId]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/removal-requests", async (req, res) => {
  try {
    const { placeId, stationName, reason } = req.body;
    if (!placeId || !stationName || !reason) {
      return res.status(400).json({ error: "Invalid data" });
    }
    
    const ip = getClientIp(req);
    const ipHash = hashIp(ip);
    const requestId = generateId("DEL");
    const timestamp = new Date().toISOString();
    
    await pool.query("INSERT INTO removal_requests (request_id, place_id, station_name, reason, reporter_ip, timestamp, status) VALUES ($1, $2, $3, $4, $5, $6, 'pending')", 
      [requestId, placeId, stationName, reason, ipHash, timestamp]
    );
    
    const result = await pool.query("SELECT * FROM removal_requests WHERE request_id = $1", [requestId]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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

app.get("/api/admin/stats", adminAuth, async (_req, res) => {
  try {
    const totalStations = (await pool.query("SELECT COUNT(*) as c FROM stations WHERE status = 'active'")).rows[0].c;
    const totalReports = (await pool.query("SELECT COUNT(*) as c FROM fuel_reports")).rows[0].c;
    const today = new Date().toISOString().split("T")[0];
    const todayReports = (await pool.query("SELECT COUNT(*) as c FROM fuel_reports WHERE timestamp LIKE $1", [today + "%"])).rows[0].c;
    const pendingRequests = (await pool.query("SELECT COUNT(*) as c FROM pending_stations WHERE status = 'pending'")).rows[0].c;
    const totalComments = (await pool.query("SELECT COUNT(*) as c FROM station_comments")).rows[0].c;
    const brandStats = (await pool.query("SELECT brand, COUNT(*) as count FROM stations WHERE status = 'active' GROUP BY brand")).rows;
    
    res.json({ 
      totalStations: Number(totalStations), 
      totalReports: Number(totalReports), 
      todayReports: Number(todayReports), 
      pendingRequests: Number(pendingRequests), 
      totalComments: Number(totalComments), 
      brandStats: brandStats.map(b => ({ ...b, count: Number(b.count) }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/admin/reports", adminAuth, async (_req, res) => {
  try {
    const result = await pool.query("SELECT * FROM fuel_reports ORDER BY timestamp DESC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/admin/comments", adminAuth, async (_req, res) => {
  try {
    const result = await pool.query("SELECT * FROM station_comments ORDER BY timestamp DESC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/admin/comments/:commentId", adminAuth, async (req, res) => {
  try {
    await pool.query("DELETE FROM station_comments WHERE comment_id = $1", [req.params.commentId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/admin/pending-stations", adminAuth, async (_req, res) => {
  try {
    const result = await pool.query("SELECT * FROM pending_stations ORDER BY timestamp DESC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/pending-stations/:requestId/approve", adminAuth, async (req, res) => {
  try {
    const pendingResult = await pool.query("SELECT * FROM pending_stations WHERE request_id = $1", [req.params.requestId]);
    const pending = pendingResult.rows[0];
    if (!pending) return res.status(404).json({ error: "Not found" });
    
    const newPlaceId = `manual-${Date.now()}`;
    await pool.query("INSERT INTO stations (place_id, name, brand, lat, lng, source, status, last_synced) VALUES ($1, $2, $3, $4, $5, 'manual', 'active', $6)", 
      [newPlaceId, pending.station_name, pending.brand || "อื่นๆ", pending.lat, pending.lng, new Date().toISOString()]
    );
    await pool.query("UPDATE pending_stations SET status = 'approved', reviewed_at = $1, note = $2 WHERE request_id = $3", 
      [new Date().toISOString(), req.body.note || "", req.params.requestId]
    );
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/pending-stations/:requestId/reject", adminAuth, async (req, res) => {
  try {
    await pool.query("UPDATE pending_stations SET status = 'rejected', reviewed_at = $1, note = $2 WHERE request_id = $3", 
      [new Date().toISOString(), req.body.note || "", req.params.requestId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/admin/removal-requests", adminAuth, async (_req, res) => {
  try {
    const result = await pool.query("SELECT * FROM removal_requests ORDER BY timestamp DESC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/removal-requests/:requestId/approve", adminAuth, async (req, res) => {
  try {
    const removalResult = await pool.query("SELECT * FROM removal_requests WHERE request_id = $1", [req.params.requestId]);
    const removal = removalResult.rows[0];
    if (!removal) return res.status(404).json({ error: "Not found" });
    
    await pool.query("UPDATE stations SET status = 'removed' WHERE place_id = $1", [removal.place_id]);
    await pool.query("UPDATE removal_requests SET status = 'approved' WHERE request_id = $1", [req.params.requestId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/removal-requests/:requestId/reject", adminAuth, async (req, res) => {
  try {
    await pool.query("UPDATE removal_requests SET status = 'rejected' WHERE request_id = $1", [req.params.requestId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/clear/:type", adminAuth, async (req, res) => {
  try {
    const { type } = req.params;
    switch (type) {
      case "reports": await pool.query("DELETE FROM fuel_reports"); break;
      case "pending": await pool.query("DELETE FROM pending_stations"); break;
      case "removals": await pool.query("DELETE FROM removal_requests"); break;
      case "comments": await pool.query("DELETE FROM station_comments"); break;
      default: return res.status(400).json({ error: "Invalid type" });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export for Vercel
export default app;
