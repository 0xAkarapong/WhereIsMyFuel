# Where's My Fuel - Gemini Context

This project is a web application for finding and reporting fuel station status across Thailand. It features a map-based interface with over 8,500 stations and real-time user-reported status.

## Project Overview

- **Purpose**: Real-time fuel station finder and status reporter for Thailand.
- **Main Technologies**:
  - **Frontend**: React 18, Tailwind CSS, shadcn/ui, Leaflet + MarkerCluster.
  - **Backend**: Express.js, better-sqlite3 (SQLite), Drizzle ORM.
  - **Type Safety**: TypeScript, Zod.
  - **Tooling**: Vite (frontend), esbuild (server bundle), tsx (dev).
  - **Deployment**: Vercel (serverless functions + static assets).

## Architecture

- **Shared Schema**: `shared/schema.ts` defines the database structure using Drizzle ORM and validation schemas using Zod.
- **Storage Layer**: `server/storage.ts` implements a `DatabaseStorage` class that handles all database operations (CRUD for stations, reports, comments, etc.).
- **API Routes**: `server/routes.ts` contains the REST API endpoints for both public and admin functionality.
- **Frontend Routing**: Uses `wouter` with hash-based navigation (`client/src/App.tsx`).
- **Main UI**: The map-centric interface is located in `client/src/pages/home.tsx` and uses `react-leaflet`.

## Building and Running

### Development
```bash
# Install dependencies
npm install

# Run the development server (client + server)
npm run dev

# Sync database schema
npm run db:push
```

### Production
```bash
# Build the project (Vite for client, esbuild for server)
npm run build

# Start the production server
npm run start
```

### Other Commands
- `npm run check`: Run TypeScript type checking.
- `npm run build:vercel`: Build specifically for Vercel deployment.

## Development Conventions

- **Database**: Use Drizzle ORM for all database interactions. The schema is defined in `shared/schema.ts`.
- **Validation**: Use Zod for request body validation (schemas are exported from `shared/schema.ts`).
- **UI Components**: Use shadcn/ui components (located in `client/src/components/ui/`).
- **API Calls**: Use the `apiRequest` helper in `client/src/lib/queryClient.ts` for frontend-to-backend communication.
- **State Management**: Use `@tanstack/react-query` for data fetching and caching.
- **Styling**: Tailwind CSS is used for styling.
- **Admin Access**: Protected by a password check (configured via `ADMIN_PASSWORD` environment variable).
- **Rate Limiting**: IP-based rate limiting is implemented in `server/storage.ts` to prevent spam reports.

## Key Files

- `shared/schema.ts`: Single source of truth for data models.
- `server/storage.ts`: Data access layer.
- `server/routes.ts`: API endpoint definitions.
- `client/src/pages/home.tsx`: Main map view.
- `client/src/components/StationMap.tsx`: Leaflet map integration.
- `client/src/components/StationPanel.tsx`: Station details and reporting UI.
- `vercel.json`: Configuration for Vercel deployment.
