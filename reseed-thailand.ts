import Database from "better-sqlite3";
import fs from "fs";

const db = new Database("data.db");
db.pragma("journal_mode = WAL");

// Read the Thailand-wide seed data
const seedData = JSON.parse(fs.readFileSync("seed-data-thailand.json", "utf-8"));

console.log(`Loaded ${seedData.length} stations from seed-data-thailand.json`);

// Clear existing stations and re-seed
db.exec("DELETE FROM stations");
console.log("Cleared existing stations");

// Insert in batches
const insert = db.prepare(`
  INSERT OR IGNORE INTO stations (place_id, name, brand, lat, lng, address, is_open_24h, source, status, last_synced)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
`);

const batchInsert = db.transaction((batch: any[]) => {
  for (const s of batch) {
    insert.run(
      s.placeId,
      s.name,
      s.brand,
      s.lat,
      s.lng,
      s.address || "",
      s.isOpen24h ? 1 : 0,
      s.source || "openstreetmap",
      new Date().toISOString()
    );
  }
});

const BATCH_SIZE = 500;
for (let i = 0; i < seedData.length; i += BATCH_SIZE) {
  const batch = seedData.slice(i, i + BATCH_SIZE);
  batchInsert(batch);
  console.log(`Inserted batch ${Math.floor(i / BATCH_SIZE) + 1} (${Math.min(i + BATCH_SIZE, seedData.length)}/${seedData.length})`);
}

const count = db.prepare("SELECT COUNT(*) as c FROM stations").get() as any;
console.log(`\nTotal stations in database: ${count.c}`);

const brands = db.prepare("SELECT brand, COUNT(*) as c FROM stations GROUP BY brand ORDER BY c DESC").all();
console.log("\nBrand breakdown:");
for (const b of brands as any[]) {
  console.log(`  ${b.brand}: ${b.c}`);
}

db.close();
