import { db } from "./server/storage";
import { stations } from "./shared/schema";
import fs from "fs";

async function reseed() {
  // Read the Thailand-wide seed data
  const seedData = JSON.parse(fs.readFileSync("seed-data-thailand.json", "utf-8"));

  console.log(`Loaded ${seedData.length} stations from seed-data-thailand.json`);

  // Clear existing stations and re-seed
  // Note: For Postgres, you might need to handle constraints if you have related data
  await db.delete(stations);
  console.log("Cleared existing stations");

  const BATCH_SIZE = 500;
  for (let i = 0; i < seedData.length; i += BATCH_SIZE) {
    const batch = seedData.slice(i, i + BATCH_SIZE).map((s: any) => ({
      placeId: s.placeId,
      name: s.name,
      brand: s.brand,
      lat: s.lat,
      lng: s.lng,
      address: s.address || "",
      isOpen24h: !!s.isOpen24h,
      source: s.source || "openstreetmap",
      status: "active",
      lastSynced: new Date().toISOString()
    }));

    await db.insert(stations).values(batch).onConflictDoNothing();
    console.log(`Inserted batch ${Math.floor(i / BATCH_SIZE) + 1} (${Math.min(i + BATCH_SIZE, seedData.length)}/${seedData.length})`);
  }

  const result = await db.select({ count: sql<number>`count(*)` }).from(stations);
  console.log(`\nTotal stations in database: ${result[0].count}`);

  process.exit(0);
}

import { sql } from "drizzle-orm";
reseed().catch(err => {
  console.error(err);
  process.exit(1);
});
