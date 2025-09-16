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
npm run dev          # Start development servers
npm run deploy       # Deploy to Cloudflare
```

## API Documentation

Full API documentation available at `/docs` endpoint after deployment.

## Contributing

### Steps

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add this amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request into develop branch

### Git Commit Best Practices

- **Follow a one-feature/fix/enhancement per branch approach**  
  Work on one logical change at a time. Keep the scope of each branch and commit focused.

- **Commit frequently with detailed messages**  
  Write meaningful commit messages as you make progress. Don’t wait until the end to commit everything at once.

- **If committing a single file, the commit message MUST start with the filename**  

- **Do not mention Claude or any internal/proprietary tools in commit messages**

- **Keep `CHANGELOG.md` updated** : Update the `Unreleased` section continuously as a part of your commits, no need to make seaparate commit if adding anything to `Unreleased` section. Create separate commit for CHANGELOG.md in case creating a tag.

- **Keep `README.md` updated** : if there is any important information in the commit which should reflect in README.md then make the necessary change and add README.md in the same commit

- **Keep `claude.md` updated** : if there is any important information in the commit which should reflect in claude.md then make the necessary change and add claude.md in the same commit

- **Keep swagger updated** : if there is any change in the API contract then make the necessary changes so that swagger UI is always updated. In such cases if APIs become backward in-compatible then major version should be bumped in CHANGELOG.md

- **Keep `NOTICE.md` updated** : if we use/ remove any new third-party project or there is any change in any component of any of the existing third-party projects, that should reflect in NOTICE.md file as a separate commit

- **Structure commit messages properly**  
  Use the following format:
  
  ```
  <type>: <short summary>

  [Optional body with reasoning or context]

  [Optional footer for issue reference, breaking change, etc.]
  ```

  Example:

  ```
  feat: implement user login with JWT

  Adds secure login endpoint and token generation logic.
  Updates validation and error handling.
  ```

- **Use conventional commit types**
  - `feat`: a new feature  
  - `fix`: a bug fix  
  - `docs`: documentation only  
  - `style`: formatting, whitespace, linting  
  - `refactor`: non-functional code changes  
  - `test`: adding or updating tests  
  - `chore`: configuration, build scripts, or tooling

- **Avoid vague or generic messages** : eg. `update`, `stuff`, `misc`  

- **Reference issues or tickets appropriately**  
  Use `Fixes #123`, `Refs #456` in the footer to link commits to issues.

- **Squash or rebase before merge**  
  Clean up local history if needed before merging into `develop`.

## License

Apache License - Free to use and modify
