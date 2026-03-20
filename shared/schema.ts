import { pgTable, text, serial, doublePrecision, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Gas stations cache
export const stations = pgTable("stations", {
  id: serial("id").primaryKey(),
  placeId: text("place_id").notNull().unique(),
  name: text("name").notNull(),
  brand: text("brand").notNull().default("อื่นๆ"),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  address: text("address").default(""),
  isOpen24h: boolean("is_open_24h").default(false),
  source: text("source").notNull().default("manual"),
  status: text("status").notNull().default("active"),
  lastSynced: text("last_synced"),
});

export const insertStationSchema = createInsertSchema(stations).omit({ id: true });
export type InsertStation = z.infer<typeof insertStationSchema>;
export type Station = typeof stations.$inferSelect;

// Fuel reports from users
export const fuelReports = pgTable("fuel_reports", {
  id: serial("id").primaryKey(),
  reportId: text("report_id").notNull().unique(),
  placeId: text("place_id").notNull(),
  stationName: text("station_name").notNull(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  brand: text("brand").default(""),
  fuelType: text("fuel_type").notNull(),
  status: text("status").notNull(), // available, out, queue
  queueLevel: text("queue_level").default("none"),
  reporterIp: text("reporter_ip").default(""),
  timestamp: text("timestamp").notNull(),
  votesConfirm: integer("votes_confirm").default(0),
});

export const insertFuelReportSchema = createInsertSchema(fuelReports).omit({ id: true });
export type InsertFuelReport = z.infer<typeof insertFuelReportSchema>;
export type FuelReport = typeof fuelReports.$inferSelect;

// Station comments
export const stationComments = pgTable("station_comments", {
  id: serial("id").primaryKey(),
  commentId: text("comment_id").notNull().unique(),
  placeId: text("place_id").notNull(),
  stationName: text("station_name").notNull(),
  message: text("message").notNull(),
  reporterIp: text("reporter_ip").default(""),
  timestamp: text("timestamp").notNull(),
});

export const insertCommentSchema = createInsertSchema(stationComments).omit({ id: true });
export type InsertComment = z.infer<typeof insertCommentSchema>;
export type StationComment = typeof stationComments.$inferSelect;

// Pending station requests
export const pendingStations = pgTable("pending_stations", {
  id: serial("id").primaryKey(),
  requestId: text("request_id").notNull().unique(),
  stationName: text("station_name").notNull(),
  brand: text("brand").default("อื่นๆ"),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  placeIdFound: text("place_id_found").default(""),
  mapsVerified: boolean("maps_verified").default(false),
  submittedByIp: text("submitted_by_ip").default(""),
  timestamp: text("timestamp").notNull(),
  status: text("status").notNull().default("pending"),
  reviewedAt: text("reviewed_at"),
  note: text("note").default(""),
});

export const insertPendingStationSchema = createInsertSchema(pendingStations).omit({ id: true });
export type InsertPendingStation = z.infer<typeof insertPendingStationSchema>;
export type PendingStation = typeof pendingStations.$inferSelect;

// Removal requests
export const removalRequests = pgTable("removal_requests", {
  id: serial("id").primaryKey(),
  requestId: text("request_id").notNull().unique(),
  placeId: text("place_id").notNull(),
  stationName: text("station_name").notNull(),
  reason: text("reason").notNull(),
  reporterIp: text("reporter_ip").default(""),
  timestamp: text("timestamp").notNull(),
  status: text("status").notNull().default("pending"),
});

export const insertRemovalRequestSchema = createInsertSchema(removalRequests).omit({ id: true });
export type InsertRemovalRequest = z.infer<typeof insertRemovalRequestSchema>;
export type RemovalRequest = typeof removalRequests.$inferSelect;

// Rate limits
export const rateLimits = pgTable("rate_limits", {
  id: serial("id").primaryKey(),
  ipHash: text("ip_hash").notNull(),
  placeId: text("place_id").notNull(),
  lastReport: text("last_report").notNull(),
  dailyRequests: integer("daily_requests").default(0),
  date: text("date").notNull(),
});

// Fuel type labels for the UI
export const FUEL_TYPES = {
  diesel: "ดีเซล",
  diesel_b7: "ดีเซล B7",
  diesel_premium: "ดีเซลพรีเมียม",
  diesel_vpower: "V-Power Diesel",
  gasohol95: "แก๊สโซฮอล์ 95",
  gasohol91: "แก๊สโซฮอล์ 91",
  gasohol95_premium: "แก๊สโซฮอล์ 95 พรีเมียม",
  gasohol97_premium: "แก๊สโซฮอล์ 97",
  gasohol95_power: "Gasohol 95 Power",
  benzene95: "เบนซิน 95",
  e20: "E20",
  e85: "E85",
  ngv: "NGV",
  lpg: "LPG",
} as const;

export const FUEL_STATUS = {
  available: "มีน้ำมัน",
  out: "หมด",
  queue: "คิวยาว",
} as const;

export const BRAND_LIST = [
  "PTT", "Bangchak", "Shell", "Esso", "Caltex", "PT", "Susco", "IRPC", "อื่นๆ"
] as const;
