import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import crypto from "crypto";

function generateId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 10)}`;
}

function hashIp(ip: string): string {
  return crypto.createHash("sha256").update(ip || "unknown").digest("hex").substring(0, 16);
}

function getClientIp(req: any): string {
  return req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || "unknown";
}

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "wheresmyfuel2026!";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // === Public API ===

  // Get all active stations
  app.get("/api/stations", (_req, res) => {
    const stationList = storage.getAllStations();
    res.json(stationList);
  });

  // Get station detail with reports and comments
  app.get("/api/stations/:placeId", (req, res) => {
    const { placeId } = req.params;
    const station = storage.getStationByPlaceId(placeId);
    if (!station) {
      return res.status(404).json({ error: "Station not found" });
    }
    const reports = storage.getReportsForStation(placeId);
    const comments = storage.getCommentsForStation(placeId);
    res.json({ station, reports, comments });
  });

  // Submit fuel report
  app.post("/api/reports", (req, res) => {
    const schema = z.object({
      placeId: z.string(),
      stationName: z.string(),
      lat: z.number(),
      lng: z.number(),
      brand: z.string().optional(),
      fuelType: z.string(),
      status: z.enum(["available", "out", "queue"]),
      queueLevel: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid data", details: parsed.error.flatten() });
    }

    const ip = getClientIp(req);
    const ipHash = hashIp(ip);

    if (!storage.checkRateLimit(ipHash, parsed.data.placeId)) {
      return res.status(429).json({ error: "รายงานเกินจำนวนที่กำหนด กรุณารอสักครู่" });
    }

    const report = storage.createReport({
      reportId: generateId("RPT"),
      placeId: parsed.data.placeId,
      stationName: parsed.data.stationName,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      brand: parsed.data.brand || "",
      fuelType: parsed.data.fuelType,
      status: parsed.data.status,
      queueLevel: parsed.data.queueLevel || "none",
      reporterIp: ipHash,
      timestamp: new Date().toISOString(),
      votesConfirm: 0,
    });

    storage.recordReport(ipHash, parsed.data.placeId);
    res.json(report);
  });

  // Confirm a report (vote)
  app.post("/api/reports/:reportId/confirm", (req, res) => {
    const { reportId } = req.params;
    storage.confirmReport(reportId);
    res.json({ success: true });
  });

  // Submit comment
  app.post("/api/comments", (req, res) => {
    const schema = z.object({
      placeId: z.string(),
      stationName: z.string(),
      message: z.string().min(1).max(500),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid data" });
    }

    const ip = getClientIp(req);
    const ipHash = hashIp(ip);

    const comment = storage.createComment({
      commentId: generateId("CMT"),
      placeId: parsed.data.placeId,
      stationName: parsed.data.stationName,
      message: parsed.data.message,
      reporterIp: ipHash,
      timestamp: new Date().toISOString(),
    });

    res.json(comment);
  });

  // Submit pending station request
  app.post("/api/pending-stations", (req, res) => {
    const schema = z.object({
      stationName: z.string().min(1),
      brand: z.string().optional(),
      lat: z.number(),
      lng: z.number(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid data" });
    }

    const ip = getClientIp(req);
    const ipHash = hashIp(ip);

    const pending = storage.createPendingStation({
      requestId: generateId("REQ"),
      stationName: parsed.data.stationName,
      brand: parsed.data.brand || "อื่นๆ",
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      submittedByIp: ipHash,
      timestamp: new Date().toISOString(),
      status: "pending",
    });

    res.json(pending);
  });

  // Submit removal request
  app.post("/api/removal-requests", (req, res) => {
    const schema = z.object({
      placeId: z.string(),
      stationName: z.string(),
      reason: z.string().min(1),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid data" });
    }

    const ip = getClientIp(req);
    const ipHash = hashIp(ip);

    const removal = storage.createRemovalRequest({
      requestId: generateId("DEL"),
      placeId: parsed.data.placeId,
      stationName: parsed.data.stationName,
      reason: parsed.data.reason,
      reporterIp: ipHash,
      timestamp: new Date().toISOString(),
      status: "pending",
    });

    res.json(removal);
  });

  // === Admin API ===

  // Admin auth
  app.post("/api/admin/login", (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
      res.json({ success: true, token: "admin-session" });
    } else {
      res.status(401).json({ error: "รหัสผ่านไม่ถูกต้อง" });
    }
  });

  // Admin middleware (simple password check via header)
  function adminAuth(req: any, res: any, next: any) {
    const auth = req.headers["x-admin-token"];
    if (auth !== "admin-session") {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  }

  // Admin dashboard stats
  app.get("/api/admin/stats", adminAuth, (_req, res) => {
    res.json({
      totalStations: storage.getStationCount(),
      totalReports: storage.getReportCount(),
      todayReports: storage.getTodayReportCount(),
      pendingRequests: storage.getPendingCount(),
      totalComments: storage.getCommentCount(),
      brandStats: storage.getStationCountByBrand(),
    });
  });

  // Admin: get all reports
  app.get("/api/admin/reports", adminAuth, (_req, res) => {
    res.json(storage.getAllReports());
  });

  // Admin: get all comments
  app.get("/api/admin/comments", adminAuth, (_req, res) => {
    res.json(storage.getAllComments());
  });

  // Admin: delete comment
  app.delete("/api/admin/comments/:commentId", adminAuth, (req, res) => {
    storage.deleteComment(req.params.commentId);
    res.json({ success: true });
  });

  // Admin: get pending stations
  app.get("/api/admin/pending-stations", adminAuth, (_req, res) => {
    res.json(storage.getAllPendingStations());
  });

  // Admin: approve pending
  app.post("/api/admin/pending-stations/:requestId/approve", adminAuth, (req, res) => {
    storage.approvePendingStation(req.params.requestId, req.body.note || "");
    res.json({ success: true });
  });

  // Admin: reject pending
  app.post("/api/admin/pending-stations/:requestId/reject", adminAuth, (req, res) => {
    storage.rejectPendingStation(req.params.requestId, req.body.note || "");
    res.json({ success: true });
  });

  // Admin: get removal requests
  app.get("/api/admin/removal-requests", adminAuth, (_req, res) => {
    res.json(storage.getAllRemovalRequests());
  });

  // Admin: approve removal
  app.post("/api/admin/removal-requests/:requestId/approve", adminAuth, (req, res) => {
    storage.approveRemoval(req.params.requestId);
    res.json({ success: true });
  });

  // Admin: reject removal
  app.post("/api/admin/removal-requests/:requestId/reject", adminAuth, (req, res) => {
    storage.rejectRemoval(req.params.requestId);
    res.json({ success: true });
  });

  // Admin: tools - clear data
  app.post("/api/admin/clear/:type", adminAuth, (req, res) => {
    const { type } = req.params;
    switch (type) {
      case "reports": storage.deleteAllReports(); break;
      case "pending": storage.deleteAllPending(); break;
      case "removals": storage.deleteAllRemovals(); break;
      case "comments": storage.deleteAllComments(); break;
      default: return res.status(400).json({ error: "Invalid type" });
    }
    res.json({ success: true });
  });

  // Seed data from Excel on startup
  app.post("/api/admin/seed", adminAuth, (_req, res) => {
    res.json({ success: true, message: "Data seeded" });
  });

  return httpServer;
}
