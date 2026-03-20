// Vercel Serverless Function entry point
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
  ssl: {
    rejectUnauthorized: false
  },
  connectionTimeoutMillis: 10000,
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

// --- Public API Routes ---

app.get("/api/stations", async (_req, res) => {
  console.log("Fetching stations...");
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not defined");
    }
    const result = await pool.query('SELECT * FROM "stations" WHERE status = \'active\'');
    console.log(`Found ${result.rows.length} stations`);
    res.json(result.rows);
  } catch (err) {
    console.error("CRITICAL DATABASE ERROR:", err);
    res.status(500).json({ 
      error: "Internal Server Error",
      details: "Could not connect to database. Please check Vercel environment variables.",
      code: err.code
    });
  }
});

app.get("/api/stations/:placeId", async (req, res) => {
  try {
    const { placeId } = req.params;
    const stationResult = await pool.query('SELECT * FROM "stations" WHERE place_id = $1', [placeId]);
    const station = stationResult.rows[0];
    if (!station) {
      return res.status(404).json({ error: "Station not found" });
    }
    
    const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const reportsResult = await pool.query('SELECT * FROM "fuel_reports" WHERE place_id = $1 AND timestamp > $2 ORDER BY timestamp DESC', [placeId, cutoff]);
    const commentsResult = await pool.query('SELECT * FROM "station_comments" WHERE place_id = $1 ORDER BY timestamp DESC', [placeId]);
    
    res.json({ 
      station, 
      reports: reportsResult.rows, 
      comments: commentsResult.rows 
    });
  } catch (err) {
    console.error("Database Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
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
    
    const rateResult = await pool.query('SELECT * FROM "rate_limits" WHERE ip_hash = $1 AND place_id = $2 AND date = $3', [ipHash, placeId, today]);
    const rateRecord = rateResult.rows[0];
    
    if (rateRecord && rateRecord.daily_requests >= 10) {
      return res.status(429).json({ error: "รายงานเกินจำนวนที่กำหนด กรุณารอสักครู่" });
    }
    
    const reportId = generateId("RPT");
    const timestamp = new Date().toISOString();
    
    await pool.query(`INSERT INTO "fuel_reports" (report_id, place_id, station_name, lat, lng, brand, fuel_type, status, queue_level, reporter_ip, timestamp, votes_confirm)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0)`, 
      [reportId, placeId, stationName, lat, lng, brand || "", fuelType, status, queueLevel || "none", ipHash, timestamp]
    );
    
    if (rateRecord) {
      await pool.query('UPDATE "rate_limits" SET daily_requests = daily_requests + 1, last_report = $1 WHERE id = $2', [timestamp, rateRecord.id]);
    } else {
      await pool.query('INSERT INTO "rate_limits" (ip_hash, place_id, last_report, daily_requests, date) VALUES ($1, $2, $3, 1, $4)', [ipHash, placeId, timestamp, today]);
    }
    
    const finalReportResult = await pool.query('SELECT * FROM "fuel_reports" WHERE report_id = $1', [reportId]);
    res.json(finalReportResult.rows[0]);
  } catch (err) {
    console.error("Database Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Admin Auth
function adminAuth(req, res, next) {
  const auth = req.headers["x-admin-token"];
  if (auth !== "admin-session") {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

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
    const totalStations = (await pool.query('SELECT COUNT(*) as c FROM "stations" WHERE status = \'active\'')).rows[0].c;
    const totalReports = (await pool.query('SELECT COUNT(*) as c FROM "fuel_reports"')).rows[0].c;
    const today = new Date().toISOString().split("T")[0];
    const todayReports = (await pool.query('SELECT COUNT(*) as c FROM "fuel_reports" WHERE timestamp LIKE $1', [today + "%"])).rows[0].c;
    const pendingRequests = (await pool.query('SELECT COUNT(*) as c FROM "pending_stations" WHERE status = \'pending\'')).rows[0].c;
    const totalComments = (await pool.query('SELECT COUNT(*) as c FROM "station_comments"')).rows[0].c;
    const brandStats = (await pool.query('SELECT brand, COUNT(*) as count FROM "stations" WHERE status = \'active\' GROUP BY brand')).rows;
    
    res.json({ 
      totalStations: Number(totalStations), 
      totalReports: Number(totalReports), 
      todayReports: Number(todayReports), 
      pendingRequests: Number(pendingRequests), 
      totalComments: Number(totalComments), 
      brandStats: brandStats.map(b => ({ ...b, count: Number(b.count) }))
    });
  } catch (err) {
    console.error("Database Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Export for Vercel
export default app;
