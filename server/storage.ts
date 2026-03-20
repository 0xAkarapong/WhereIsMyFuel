import {
  stations, fuelReports, stationComments, pendingStations, removalRequests, rateLimits,
  type Station, type InsertStation,
  type FuelReport, type InsertFuelReport,
  type StationComment, type InsertComment,
  type PendingStation, type InsertPendingStation,
  type RemovalRequest, type InsertRemovalRequest,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, and, desc, sql, like } from "drizzle-orm";

const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite);

export interface IStorage {
  // Stations
  getAllStations(): Station[];
  getStationByPlaceId(placeId: string): Station | undefined;
  createStation(station: InsertStation): Station;
  updateStationStatus(placeId: string, status: string): void;
  getStationCount(): number;
  getStationCountByBrand(): { brand: string; count: number }[];

  // Fuel Reports
  getAllReports(): FuelReport[];
  getReportsForStation(placeId: string): FuelReport[];
  createReport(report: InsertFuelReport): FuelReport;
  getReportCount(): number;
  getTodayReportCount(): number;
  confirmReport(reportId: string): void;
  deleteAllReports(): void;

  // Comments
  getAllComments(): StationComment[];
  getCommentsForStation(placeId: string): StationComment[];
  createComment(comment: InsertComment): StationComment;
  deleteComment(commentId: string): void;
  getCommentCount(): number;
  deleteAllComments(): void;

  // Pending Stations
  getAllPendingStations(): PendingStation[];
  getPendingCount(): number;
  createPendingStation(ps: InsertPendingStation): PendingStation;
  approvePendingStation(requestId: string, note: string): void;
  rejectPendingStation(requestId: string, note: string): void;
  deleteAllPending(): void;

  // Removal Requests
  getAllRemovalRequests(): RemovalRequest[];
  createRemovalRequest(rr: InsertRemovalRequest): RemovalRequest;
  approveRemoval(requestId: string): void;
  rejectRemoval(requestId: string): void;
  deleteAllRemovals(): void;

  // Rate Limits
  checkRateLimit(ipHash: string, placeId: string): boolean;
  recordReport(ipHash: string, placeId: string): void;
}

export class DatabaseStorage implements IStorage {
  // === Stations ===
  getAllStations(): Station[] {
    return db.select().from(stations).where(eq(stations.status, "active")).all();
  }

  getStationByPlaceId(placeId: string): Station | undefined {
    return db.select().from(stations).where(eq(stations.placeId, placeId)).get();
  }

  createStation(station: InsertStation): Station {
    return db.insert(stations).values(station).returning().get();
  }

  updateStationStatus(placeId: string, status: string): void {
    db.update(stations).set({ status }).where(eq(stations.placeId, placeId)).run();
  }

  getStationCount(): number {
    const result = db.select({ count: sql<number>`count(*)` }).from(stations).where(eq(stations.status, "active")).get();
    return result?.count ?? 0;
  }

  getStationCountByBrand(): { brand: string; count: number }[] {
    return db.select({
      brand: stations.brand,
      count: sql<number>`count(*)`,
    }).from(stations).where(eq(stations.status, "active")).groupBy(stations.brand).all();
  }

  // === Fuel Reports ===
  getAllReports(): FuelReport[] {
    return db.select().from(fuelReports).orderBy(desc(fuelReports.timestamp)).all();
  }

  getReportsForStation(placeId: string): FuelReport[] {
    // Get reports from the last 60 minutes
    const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    return db.select().from(fuelReports)
      .where(and(eq(fuelReports.placeId, placeId), sql`${fuelReports.timestamp} > ${cutoff}`))
      .orderBy(desc(fuelReports.timestamp))
      .all();
  }

  createReport(report: InsertFuelReport): FuelReport {
    return db.insert(fuelReports).values(report).returning().get();
  }

  getReportCount(): number {
    const result = db.select({ count: sql<number>`count(*)` }).from(fuelReports).get();
    return result?.count ?? 0;
  }

  getTodayReportCount(): number {
    const today = new Date().toISOString().split("T")[0];
    const result = db.select({ count: sql<number>`count(*)` }).from(fuelReports)
      .where(sql`${fuelReports.timestamp} LIKE ${today + '%'}`)
      .get();
    return result?.count ?? 0;
  }

  confirmReport(reportId: string): void {
    db.update(fuelReports)
      .set({ votesConfirm: sql`${fuelReports.votesConfirm} + 1` })
      .where(eq(fuelReports.reportId, reportId))
      .run();
  }

  deleteAllReports(): void {
    db.delete(fuelReports).run();
  }

  // === Comments ===
  getAllComments(): StationComment[] {
    return db.select().from(stationComments).orderBy(desc(stationComments.timestamp)).all();
  }

  getCommentsForStation(placeId: string): StationComment[] {
    return db.select().from(stationComments)
      .where(eq(stationComments.placeId, placeId))
      .orderBy(desc(stationComments.timestamp))
      .all();
  }

  createComment(comment: InsertComment): StationComment {
    return db.insert(stationComments).values(comment).returning().get();
  }

  deleteComment(commentId: string): void {
    db.delete(stationComments).where(eq(stationComments.commentId, commentId)).run();
  }

  getCommentCount(): number {
    const result = db.select({ count: sql<number>`count(*)` }).from(stationComments).get();
    return result?.count ?? 0;
  }

  deleteAllComments(): void {
    db.delete(stationComments).run();
  }

  // === Pending Stations ===
  getAllPendingStations(): PendingStation[] {
    return db.select().from(pendingStations).orderBy(desc(pendingStations.timestamp)).all();
  }

  getPendingCount(): number {
    const result = db.select({ count: sql<number>`count(*)` }).from(pendingStations)
      .where(eq(pendingStations.status, "pending"))
      .get();
    return result?.count ?? 0;
  }

  createPendingStation(ps: InsertPendingStation): PendingStation {
    return db.insert(pendingStations).values(ps).returning().get();
  }

  approvePendingStation(requestId: string, note: string): void {
    const pending = db.select().from(pendingStations).where(eq(pendingStations.requestId, requestId)).get();
    if (!pending) return;

    // Add station to main stations table
    const newPlaceId = `manual-${Date.now()}`;
    db.insert(stations).values({
      placeId: newPlaceId,
      name: pending.stationName,
      brand: pending.brand ?? "อื่นๆ",
      lat: pending.lat,
      lng: pending.lng,
      source: "manual",
      status: "active",
      lastSynced: new Date().toISOString(),
    }).run();

    db.update(pendingStations).set({
      status: "approved",
      reviewedAt: new Date().toISOString(),
      note,
    }).where(eq(pendingStations.requestId, requestId)).run();
  }

  rejectPendingStation(requestId: string, note: string): void {
    db.update(pendingStations).set({
      status: "rejected",
      reviewedAt: new Date().toISOString(),
      note,
    }).where(eq(pendingStations.requestId, requestId)).run();
  }

  deleteAllPending(): void {
    db.delete(pendingStations).run();
  }

  // === Removal Requests ===
  getAllRemovalRequests(): RemovalRequest[] {
    return db.select().from(removalRequests).orderBy(desc(removalRequests.timestamp)).all();
  }

  createRemovalRequest(rr: InsertRemovalRequest): RemovalRequest {
    return db.insert(removalRequests).values(rr).returning().get();
  }

  approveRemoval(requestId: string): void {
    const req = db.select().from(removalRequests).where(eq(removalRequests.requestId, requestId)).get();
    if (!req) return;

    // Mark station as removed
    this.updateStationStatus(req.placeId, "removed");

    db.update(removalRequests).set({ status: "approved" })
      .where(eq(removalRequests.requestId, requestId)).run();
  }

  rejectRemoval(requestId: string): void {
    db.update(removalRequests).set({ status: "rejected" })
      .where(eq(removalRequests.requestId, requestId)).run();
  }

  deleteAllRemovals(): void {
    db.delete(removalRequests).run();
  }

  // === Rate Limits ===
  checkRateLimit(ipHash: string, placeId: string): boolean {
    const today = new Date().toISOString().split("T")[0];
    const record = db.select().from(rateLimits)
      .where(and(
        eq(rateLimits.ipHash, ipHash),
        eq(rateLimits.placeId, placeId),
        eq(rateLimits.date, today)
      )).get();

    if (!record) return true; // No limit yet
    // Max 10 reports per station per IP per day
    return (record.dailyRequests ?? 0) < 10;
  }

  recordReport(ipHash: string, placeId: string): void {
    const today = new Date().toISOString().split("T")[0];
    const existing = db.select().from(rateLimits)
      .where(and(
        eq(rateLimits.ipHash, ipHash),
        eq(rateLimits.placeId, placeId),
        eq(rateLimits.date, today)
      )).get();

    if (existing) {
      db.update(rateLimits).set({
        dailyRequests: sql`${rateLimits.dailyRequests} + 1`,
        lastReport: new Date().toISOString(),
      }).where(eq(rateLimits.id, existing.id)).run();
    } else {
      db.insert(rateLimits).values({
        ipHash: ipHash,
        placeId: placeId,
        lastReport: new Date().toISOString(),
        dailyRequests: 1,
        date: today,
      }).run();
    }
  }
}

export const storage = new DatabaseStorage();
