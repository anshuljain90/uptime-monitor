# Uptime Monitor - Free Uptime Monitoring Solution

A comprehensive uptime monitoring application built for Cloudflare's free tier, providing all the features of UptimeRobot without the cost.

## Features

### Core Monitoring
- **Multiple Monitor Types**: HTTP(S), Ping, Port, Keyword, SSL Certificate, Heartbeat/Cron
- **Configurable Intervals**: 30 seconds to 1 hour (30 seconds requires Pro tier, 5 min default for free)
- **Global Monitoring**: Multiple worldwide check locations
- **Response Time Tracking**: Detailed performance metrics
- **SSL & Domain Monitoring**: Certificate and domain expiry alerts

### Dashboard & Analytics
- **Modern UI**: Clean, responsive dashboard similar to UptimeRobot
- **Real-time Updates**: Live status monitoring with WebSocket support
- **Historical Data**: 90-day uptime history with interactive charts
- **Incident Management**: Detailed logs and timeline
- **Uptime Statistics**: SLA calculations and reporting

### Public Status Pages
- **Custom Branding**: Logo, colors, fonts, and themes
- **Custom Domains**: Map to your subdomain
- **90-day History**: Visual uptime bars
- **Email Subscriptions**: User notifications for incidents
- **Maintenance Windows**: Scheduled maintenance announcements

### Notifications & Alerts
- **Email Alerts**: Google Workspace integration
- **Push Notifications**: Progressive Web App support
- **Webhooks**: Custom endpoint notifications
- **Smart Alerting**: Configurable thresholds and escalation

### Security & Access
- **User Authentication**: Username/password login
- **Team Management**: Multiple user access levels
- **API Access**: RESTful API for automation
- **Data Security**: Encrypted storage and transmission

## Architecture

- **Backend**: Cloudflare Workers (serverless functions)
- **Database**: Cloudflare D1 (SQLite-based)
- **Frontend**: Cloudflare Pages (static hosting)
- **Scheduling**: Cloudflare Cron Triggers
- **Storage**: Cloudflare KV (configuration & cache)

## Cloudflare Free Tier Limits

- **Workers**: 100,000 requests/day
- **D1**: 25 GB storage, 25M reads/day, 50K writes/day
- **Pages**: Unlimited static requests
- **Cron**: 1000 executions/day
- **KV**: 100K reads/day, 1K writes/day

## Setup Instructions

### 1. Cloudflare Account Setup
- Create/login to Cloudflare account
- Add your domain (or create a subdomain)
- Enable required services: Workers, Pages, D1, KV

### 2. Domain Configuration
Since your domain is on another DNS:
1. Create a CNAME record pointing your subdomain to Cloudflare
2. Or transfer just the subdomain to Cloudflare DNS
3. Alternative: Use workers.dev subdomain initially

### 3. Deploy Backend
```bash
npm install -g wrangler
wrangler login
wrangler d1 create uptimeguard-db
wrangler kv:namespace create "UPTIMEGUARD_KV"
wrangler deploy
```

### 4. Deploy Frontend
```bash
npm run build
wrangler pages deploy dist
```

### 5. Configure Monitoring
- Set up cron triggers for monitoring intervals
- Configure notification endpoints
- Add your first monitors

## Project Structure

```
uptime-monitor/
├── workers/           # Cloudflare Workers (API)
│   ├── api/          # API endpoints
│   ├── monitoring/   # Monitoring logic
│   └── cron/         # Scheduled tasks
├── frontend/         # React frontend
│   ├── src/
│   ├── public/
│   └── dist/
├── database/         # D1 database schema
├── docs/            # Documentation
└── deploy/          # Deployment scripts
```

## Development

```bash
git clone https://github.com/anshuljain90/uptime-monitor.git
cd uptime-monitor
npm install
cd frontend && npm install  # Install frontend dependencies
cd ..
npm run dev          # Start both workers and frontend dev servers
npm run build        # Build for production
npm run deploy       # Deploy to Cloudflare
```

### Development Scripts

- `npm run dev` - Start both workers and frontend dev servers concurrently
- `npm run dev:workers` - Start only the Cloudflare Workers dev server (port 8787)
- `npm run dev:frontend` - Start only the frontend dev server
- `npm run build` - Build both workers and frontend for production
- `npm run deploy` - Full deployment using interactive deploy script
- `npm run db:init` - Initialize database schema (remote)
- `npm run db:local` - Initialize database schema (local)
- `npm run tail` - View live worker logs

## Current Implementation Status

### ✅ Completed Features
- **Backend Infrastructure**: Complete Cloudflare Workers setup with routing and middleware
- **Authentication System**: JWT-based user authentication with secure session management
- **Database Schema**: Full D1 SQLite database with users, monitors, incidents, and status pages tables
- **API Endpoints**: All core endpoints implemented (auth, monitors, alerts, status pages, public)
- **Frontend Foundation**: React-based dashboard with Tailwind CSS and responsive design
- **Development Environment**: Concurrent dev servers with hot reload for both workers and frontend
- **Deployment System**: Automated deployment scripts with interactive setup

### 🚧 In Development
- **Monitor Creation UI**: Interface for adding and editing monitors
- **Monitoring Engine**: Actual monitoring logic and health checks
- **Notification System**: Email and webhook alert implementations
- **Dashboard Analytics**: Real-time charts and uptime statistics
- **Public Status Pages**: Customer-facing status page functionality

### 📋 Next Priorities
1. Build monitor creation and management UI
2. Implement monitoring logic in workers/monitoring/checker.js
3. Set up Cloudflare Cron Triggers for automated checks
4. Add notification system (email/webhook/push)
5. Create public status page templates
6. Add historical data visualization and analytics

## API Documentation

Full API documentation available at `/docs` endpoint after deployment.

## License

Apache License - Free to use and modify
