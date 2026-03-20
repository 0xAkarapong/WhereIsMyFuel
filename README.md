# Where's My Fuel ⛽

ค้นหาปั๊มน้ำมันทั่วประเทศไทยกว่า 8,500 แห่ง พร้อมระบบรายงานสถานะน้ำมันเรียลไทม์

## Features

- **แผนที่ปั๊มน้ำมันทั่วไทย** - ข้อมูลจาก OpenStreetMap กว่า 8,500 ปั๊ม พร้อม marker clustering
- **รายงานสถานะน้ำมัน** - ผู้ใช้แจ้งสถานะ (มี/หมด/คิวยาว) แบบเรียลไทม์
- **กรองตามแบรนด์** - PTT, Bangchak, Shell, Esso, Caltex, PT, Susco, IRPC, Cosmo, Petronas, Pure
- **ค้นหา** - ค้นหาตามชื่อปั๊ม แบรนด์ หรือพื้นที่
- **แจ้งเพิ่ม/ลบปั๊ม** - ผู้ใช้แจ้งเพิ่มปั๊มใหม่หรือขอลบปั๊มที่ปิด
- **ระบบความคิดเห็น** - แสดงความคิดเห็นในแต่ละปั๊ม
- **Admin Dashboard** - จัดการคำขอ, ดูสถิติ, ลบข้อมูล
- **Dark Mode** - รองรับโหมดมืด/สว่าง
- **Responsive** - ใช้งานได้ทั้งมือถือและ Desktop

## Tech Stack

- **Frontend**: React 18, Tailwind CSS, shadcn/ui, Leaflet + MarkerCluster
- **Backend**: Express.js, better-sqlite3, Drizzle ORM
- **Build**: Vite
- **Deploy**: Vercel (serverless functions + static frontend)

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
```

เปิดที่ http://localhost:5000

## Vercel Deployment

### 1. Push to GitHub

```bash
git add .
git commit -m "Where's My Fuel - nationwide fuel station finder"
git push
```

### 2. Connect to Vercel

1. ไปที่ [vercel.com](https://vercel.com) แล้วเชื่อมต่อ GitHub repo
2. Vercel จะอ่าน `vercel.json` อัตโนมัติ
3. ตั้งค่า Environment Variables:
   - `ADMIN_PASSWORD` - รหัสผ่าน Admin (default: `wheresmyfuel2026!`)

### 3. Deploy

Vercel จะ deploy อัตโนมัติทุกครั้งที่ push ไปยัง main branch

**หมายเหตุ**: Database (SQLite) จะถูก copy ไปยัง `/tmp` ในแต่ละ serverless function invocation ข้อมูล write จะหายเมื่อ function cold start ใหม่ สำหรับ production จริง แนะนำใช้ [Turso](https://turso.tech) หรือ [PlanetScale](https://planetscale.com) แทน SQLite

## Project Structure

```
├── api/                    # Vercel serverless API handler
│   └── index.js
├── client/                 # Frontend React app
│   ├── index.html
│   └── src/
│       ├── components/     # StationMap, StationPanel, AddStationDialog
│       ├── hooks/          # use-theme, use-admin
│       ├── lib/            # constants, queryClient
│       └── pages/          # home, admin, not-found
├── server/                 # Express backend (dev + traditional deploy)
│   ├── index.ts
│   ├── routes.ts
│   ├── storage.ts
│   └── seed.ts
├── shared/                 # Shared schema (Drizzle ORM)
│   └── schema.ts
├── seed-data-thailand.json # 8,599 fuel stations across Thailand
├── vercel.json             # Vercel deployment config
└── data.db                 # SQLite database
```

## Admin Access

- URL: `/#/admin`
- Default password: `wheresmyfuel2026!`
- Set custom password via `ADMIN_PASSWORD` env var

## Data Source

Station data sourced from OpenStreetMap via Overpass API, covering all of Thailand.

---

Created with [Perplexity Computer](https://www.perplexity.ai/computer)
