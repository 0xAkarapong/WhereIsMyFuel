import {
  stations, fuelReports, stationComments, pendingStations, removalRequests, rateLimits,
  type Station, type InsertStation,
  type FuelReport, type InsertFuelReport,
  type StationComment, type InsertComment,
  type PendingStation, type InsertPendingStation,
  type RemovalRequest, type InsertRemovalRequest,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { eq, and, desc, sql, like } from "drizzle-orm";
import "dotenv/config";

if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL environment variable is missing.");
  console.error("Please create a .env file and set DATABASE_URL to your Postgres connection string.");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool);

export interface IStorage {
  // Stations
  getAllStations(): Promise<Station[]>;
  getStationByPlaceId(placeId: string): Promise<Station | undefined>;
  createStation(station: InsertStation): Promise<Station>;
  updateStationStatus(placeId: string, status: string): Promise<void>;
  getStationCount(): Promise<number>;
  getStationCountByBrand(): Promise<{ brand: string; count: number }[]>;

  // Fuel Reports
  getAllReports(): Promise<FuelReport[]>;
  getReportsForStation(placeId: string): Promise<FuelReport[]>;
  createReport(report: InsertFuelReport): Promise<FuelReport>;
  getReportCount(): Promise<number>;
  getTodayReportCount(): Promise<number>;
  confirmReport(reportId: string): Promise<void>;
  deleteAllReports(): Promise<void>;

  // Comments
  getAllComments(): Promise<StationComment[]>;
  getCommentsForStation(placeId: string): Promise<StationComment[]>;
  createComment(comment: InsertComment): Promise<StationComment>;
  deleteComment(commentId: string): Promise<void>;
  getCommentCount(): Promise<number>;
  deleteAllComments(): Promise<void>;

  // Pending Stations
  getAllPendingStations(): Promise<PendingStation[]>;
  getPendingCount(): Promise<number>;
  createPendingStation(ps: InsertPendingStation): Promise<PendingStation>;
  approvePendingStation(requestId: string, note: string): Promise<void>;
  rejectPendingStation(requestId: string, note: string): Promise<void>;
  deleteAllPending(): Promise<void>;

  // Removal Requests
  getAllRemovalRequests(): Promise<RemovalRequest[]>;
  createRemovalRequest(rr: InsertRemovalRequest): Promise<RemovalRequest>;
  approveRemoval(requestId: string): Promise<void>;
  rejectRemoval(requestId: string): Promise<void>;
  deleteAllRemovals(): Promise<void>;

  // Rate Limits
  checkRateLimit(ipHash: string, placeId: string): Promise<boolean>;
  recordReport(ipHash: string, placeId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // === Stations ===
  async getAllStations(): Promise<Station[]> {
    return await db.select().from(stations).where(eq(stations.status, "active"));
  }

  async getStationByPlaceId(placeId: string): Promise<Station | undefined> {
    const [station] = await db.select().from(stations).where(eq(stations.placeId, placeId));
    return station;
  }

  async createStation(station: InsertStation): Promise<Station> {
    const [newStation] = await db.insert(stations).values(station).returning();
    return newStation;
  }

  async updateStationStatus(placeId: string, status: string): Promise<void> {
    await db.update(stations).set({ status }).where(eq(stations.placeId, placeId));
  }

  async getStationCount(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(stations).where(eq(stations.status, "active"));
    return Number(result[0]?.count ?? 0);
  }

  async getStationCountByBrand(): Promise<{ brand: string; count: number }[]> {
    const results = await db.select({
      brand: stations.brand,
      count: sql<number>`count(*)`,
    }).from(stations).where(eq(stations.status, "active")).groupBy(stations.brand);
    return results.map(r => ({ ...r, count: Number(r.count) }));
  }

  // === Fuel Reports ===
  async getAllReports(): Promise<FuelReport[]> {
    return await db.select().from(fuelReports).orderBy(desc(fuelReports.timestamp));
  }

  async getReportsForStation(placeId: string): Promise<FuelReport[]> {
    // Get reports from the last 60 minutes
    const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    return await db.select().from(fuelReports)
      .where(and(eq(fuelReports.placeId, placeId), sql`${fuelReports.timestamp} > ${cutoff}`))
      .orderBy(desc(fuelReports.timestamp));
  }

  async createReport(report: InsertFuelReport): Promise<FuelReport> {
    const [newReport] = await db.insert(fuelReports).values(report).returning();
    return newReport;
  }

  async getReportCount(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(fuelReports);
    return Number(result[0]?.count ?? 0);
  }

  async getTodayReportCount(): Promise<number> {
    const today = new Date().toISOString().split("T")[0];
    const result = await db.select({ count: sql<number>`count(*)` }).from(fuelReports)
      .where(like(fuelReports.timestamp, `${today}%`));
    return Number(result[0]?.count ?? 0);
  }

  async confirmReport(reportId: string): Promise<void> {
    await db.update(fuelReports)
      .set({ votesConfirm: sql`${fuelReports.votesConfirm} + 1` })
      .where(eq(fuelReports.reportId, reportId));
  }

  async deleteAllReports(): Promise<void> {
    await db.delete(fuelReports);
  }

  // === Comments ===
  async getAllComments(): Promise<StationComment[]> {
    return await db.select().from(stationComments).orderBy(desc(stationComments.timestamp));
  }

  async getCommentsForStation(placeId: string): Promise<StationComment[]> {
    return await db.select().from(stationComments)
      .where(eq(stationComments.placeId, placeId))
      .orderBy(desc(stationComments.timestamp));
  }

  async createComment(comment: InsertComment): Promise<StationComment> {
    const [newComment] = await db.insert(stationComments).values(comment).returning();
    return newComment;
  }

  async deleteComment(commentId: string): Promise<void> {
    await db.delete(stationComments).where(eq(stationComments.commentId, commentId));
  }

  async getCommentCount(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(stationComments);
    return Number(result[0]?.count ?? 0);
  }

  async deleteAllComments(): Promise<void> {
    await db.delete(stationComments);
  }

  // === Pending Stations ===
  async getAllPendingStations(): Promise<PendingStation[]> {
    return await db.select().from(pendingStations).orderBy(desc(pendingStations.timestamp));
  }

  async getPendingCount(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(pendingStations)
      .where(eq(pendingStations.status, "pending"));
    return Number(result[0]?.count ?? 0);
  }

  async createPendingStation(ps: InsertPendingStation): Promise<PendingStation> {
    const [newPending] = await db.insert(pendingStations).values(ps).returning();
    return newPending;
  }

  async approvePendingStation(requestId: string, note: string): Promise<void> {
    const [pending] = await db.select().from(pendingStations).where(eq(pendingStations.requestId, requestId));
    if (!pending) return;

    // Add station to main stations table
    const newPlaceId = `manual-${Date.now()}`;
    await db.insert(stations).values({
      placeId: newPlaceId,
      name: pending.stationName,
      brand: pending.brand ?? "อื่นๆ",
      lat: pending.lat,
      lng: pending.lng,
      source: "manual",
      status: "active",
      lastSynced: new Date().toISOString(),
    });

    await db.update(pendingStations).set({
      status: "approved",
      reviewedAt: new Date().toISOString(),
      note,
    }).where(eq(pendingStations.requestId, requestId));
  }

  async rejectPendingStation(requestId: string, note: string): Promise<void> {
    await db.update(pendingStations).set({
      status: "rejected",
      reviewedAt: new Date().toISOString(),
      note,
    }).where(eq(pendingStations.requestId, requestId));
  }

  async deleteAllPending(): Promise<void> {
    await db.delete(pendingStations);
  }

  // === Removal Requests ===
  async getAllRemovalRequests(): Promise<RemovalRequest[]> {
    return await db.select().from(removalRequests).orderBy(desc(removalRequests.timestamp));
  }

  async createRemovalRequest(rr: InsertRemovalRequest): Promise<RemovalRequest> {
    const [newRemoval] = await db.insert(removalRequests).values(rr).returning();
    return newRemoval;
  }

  async approveRemoval(requestId: string): Promise<void> {
    const [req] = await db.select().from(removalRequests).where(eq(removalRequests.requestId, requestId));
    if (!req) return;

    // Mark station as removed
    await this.updateStationStatus(req.placeId, "removed");

    await db.update(removalRequests).set({ status: "approved" })
      .where(eq(removalRequests.requestId, requestId));
  }

  async rejectRemoval(requestId: string): Promise<void> {
    await db.update(removalRequests).set({ status: "rejected" })
      .where(eq(removalRequests.requestId, requestId));
  }

  async deleteAllRemovals(): Promise<void> {
    await db.delete(removalRequests);
  }

  // === Rate Limits ===
  async checkRateLimit(ipHash: string, placeId: string): Promise<boolean> {
    const today = new Date().toISOString().split("T")[0];
    const [record] = await db.select().from(rateLimits)
      .where(and(
        eq(rateLimits.ipHash, ipHash),
        eq(rateLimits.placeId, placeId),
        eq(rateLimits.date, today)
      ));

    if (!record) return true; // No limit yet
    // Max 10 reports per station per IP per day
    return (record.dailyRequests ?? 0) < 10;
  }

  async recordReport(ipHash: string, placeId: string): Promise<void> {
    const today = new Date().toISOString().split("T")[0];
    const [existing] = await db.select().from(rateLimits)
      .where(and(
        eq(rateLimits.ipHash, ipHash),
        eq(rateLimits.placeId, placeId),
        eq(rateLimits.date, today)
      ));

    if (existing) {
      await db.update(rateLimits).set({
        dailyRequests: sql`${rateLimits.dailyRequests} + 1`,
        lastReport: new Date().toISOString(),
      }).where(eq(rateLimits.id, existing.id));
    } else {
      await db.insert(rateLimits).values({
        ipHash: ipHash,
        placeId: placeId,
        lastReport: new Date().toISOString(),
        dailyRequests: 1,
        date: today,
      });
    }
  }
}

export const storage = new DatabaseStorage();
