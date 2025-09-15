# Claude Code Project Documentation

## Project Overview
**Uptime Monitor** - A comprehensive uptime monitoring application built for Cloudflare's free tier, providing all the features of UptimeRobot without the cost.

## Architecture
- **Backend**: Cloudflare Workers (serverless functions)
- **Database**: Cloudflare D1 (SQLite-based)
- **Frontend**: React with Vite, deployed on Cloudflare Pages
- **Scheduling**: Cloudflare Cron Triggers
- **Storage**: Cloudflare KV (configuration & cache)

## Project Structure
```
uptime-monitor/
├── workers/           # Cloudflare Workers (API)
│   ├── api/          # API endpoints (auth, monitors, alerts, etc.)
│   ├── monitoring/   # Monitoring logic and notifications
│   ├── middleware/   # Auth and rate limiting
│   └── utils/        # JWT, CORS utilities
├── frontend/         # React frontend
│   ├── src/
│   ├── public/
│   └── dist/
├── database/         # D1 database schema
│   └── schema.sql
├── deploy.sh         # Deployment script
└── wrangler.toml     # Cloudflare configuration
```

## Development Commands

### Start Development Servers
```bash
npm run dev          # Start both workers and frontend dev servers
npm run dev:workers  # Start only workers dev server (port 8787)
npm run dev:frontend # Start only frontend dev server
```

### Database Commands
```bash
npm run db:init      # Initialize database schema (remote)
npm run db:local     # Initialize database schema (local)
npm run db:query     # Execute custom database query
```

### Build Commands
```bash
npm run build        # Build both workers and frontend
npm run build:workers # Build workers
npm run build:frontend # Build frontend
```

### Deployment Commands
```bash
npm run deploy       # Full deployment using deploy.sh script
npm run deploy:workers # Deploy only workers
npm run deploy:frontend # Deploy only frontend
./deploy.sh          # Interactive deployment script
```

### Utility Commands
```bash
npm run tail         # View worker logs
wrangler whoami      # Check Cloudflare login status
wrangler login       # Login to Cloudflare
```

## Current Status
✅ **Authentication system** - Complete JWT-based authentication with secure middleware
✅ **Frontend UI** - Modern React dashboard with Tailwind CSS and responsive design
✅ **Backend API** - Full Cloudflare Workers API with routing, auth, monitors, alerts, status pages
✅ **Database schema** - Complete D1 database with all tables and relationships
✅ **Development environment** - Concurrent dev servers with hot reload
✅ **Deployment system** - Interactive deployment script and Cloudflare configuration
✅ **Project structure** - Complete application architecture with proper organization

## Key Files to Know

### Backend Entry Point
- `workers/index.js` - Main worker entry point with routing

### Frontend Entry Point
- `frontend/src/App.jsx` - Main React app component

### Database
- `database/schema.sql` - Database schema for D1
- `wrangler.toml` - Cloudflare configuration with D1 and KV settings

### Configuration
- `package.json` - Main project dependencies and scripts
- `frontend/package.json` - Frontend-specific dependencies
- `wrangler.toml` - Cloudflare Workers configuration

## Environment Setup
1. **Prerequisites**: Node.js 18+, Wrangler CLI
2. **Install dependencies**: `npm install`
3. **Install frontend deps**: `cd frontend && npm install`
4. **Start development**: `npm run dev`

## Deployment Prerequisites
- Cloudflare account with Workers, Pages, D1, and KV enabled
- Wrangler CLI installed and authenticated
- Domain configured (optional, can use workers.dev subdomain)

## Security Notes
- JWT_SECRET needs to be updated in wrangler.toml for production
- CORS settings configured for development, may need production URLs
- Database uses proper SQL schema with foreign key constraints

## Implementation Completed
1. ✅ **Complete Backend API** - All endpoints implemented (auth, monitors, alerts, status pages, public)
2. ✅ **Authentication System** - JWT-based auth with middleware and session management
3. ✅ **Database Architecture** - Full D1 schema with proper relationships and constraints
4. ✅ **Frontend Foundation** - React app with routing, components, and Tailwind CSS
5. ✅ **Development Workflow** - Concurrent dev servers, build scripts, deployment automation
6. ✅ **Project Documentation** - Complete setup guides and development instructions

## Next Development Priorities
1. **Monitor Creation UI** - Build interface for adding/editing monitors in frontend
2. **Monitoring Engine** - Implement actual monitoring logic in workers/monitoring/checker.js
3. **Cron Jobs** - Set up Cloudflare Cron Triggers for automated monitoring schedules
4. **Notification System** - Email and webhook alert implementations
5. **Dashboard Analytics** - Real-time charts, uptime statistics, and historical data
6. **Public Status Pages** - Customer-facing status page templates and functionality

## Cloudflare Free Tier Limits
- **Workers**: 100,000 requests/day
- **D1**: 25 GB storage, 25M reads/day, 50K writes/day
- **Pages**: Unlimited static requests
- **Cron**: 1000 executions/day
- **KV**: 100K reads/day, 1K writes/day

## Useful Debugging Commands
```bash
wrangler tail --format=pretty                    # Live worker logs
wrangler d1 execute uptime-monitor-db --command="SELECT * FROM users"  # Query database
wrangler kv:namespace list                        # List KV namespaces
```

## Testing
- No test framework currently configured
- Consider adding Jest for unit tests and Playwright for E2E tests

## Linting/Code Quality
- No linting currently configured
- Consider adding ESLint and Prettier