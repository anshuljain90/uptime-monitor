# UptimeGuard Setup Guide

This guide will help you deploy UptimeGuard on Cloudflare's free tier and configure your custom domain.

## Prerequisites

1. **Cloudflare Account**: Sign up at [cloudflare.com](https://cloudflare.com)
2. **Domain Name**: You'll need a domain (can be registered through Cloudflare or elsewhere)
3. **Node.js**: Install from [nodejs.org](https://nodejs.org)
4. **Git**: For cloning the repository

## Step 1: Cloudflare Account Setup

### Option A: Domain on Another DNS Provider
If your domain is managed by another DNS provider (like GoDaddy, Namecheap, etc.):

1. **Create a subdomain CNAME record**:
   ```
   Type: CNAME
   Name: status (or your preferred subdomain)
   Value: uptime-monitor.pages.dev (temporary, will update later)
   TTL: 300 (5 minutes)
   ```

2. **Add your subdomain to Cloudflare**:
   - In Cloudflare dashboard, go to "Websites"
   - Click "Add a site"
   - Enter your subdomain: `uptimeguard.yourdomain.com`
   - Choose the Free plan
   - Cloudflare will scan for DNS records

### Option B: Full Domain on Cloudflare
If you want to move your entire domain to Cloudflare:

1. **Add your domain to Cloudflare**:
   - In Cloudflare dashboard, go to "Websites"
   - Click "Add a site"
   - Enter your full domain: `yourdomain.com`
   - Choose the Free plan
   - Follow the nameserver change instructions

2. **Update nameservers** at your domain registrar:
   - Use the nameservers provided by Cloudflare
   - Wait for propagation (can take up to 24 hours)

## Step 2: Install Wrangler CLI

```bash
npm install -g wrangler
wrangler login
```

Follow the authentication flow to connect Wrangler to your Cloudflare account.

## Step 3: Clone and Setup UptimeGuard

```bash
git clone <repository-url>
cd uptime-robot
```

## Step 4: Configure Environment

1. **Update wrangler.toml**:
   ```toml
   # Replace with your domain
   route = { pattern = "api.uptimeguard.yourdomain.com/*", zone_name = "yourdomain.com" }
   
   # Generate a secure JWT secret
   JWT_SECRET = "your-very-secure-random-string-here"
   
   # Your notification email
   EMAIL_FROM = "noreply@yourdomain.com"
   ```

2. **Generate JWT Secret**:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

## Step 5: Deploy Using the Script

```bash
./deploy.sh
```

This script will:
- Create D1 database
- Create KV namespace
- Initialize database schema
- Deploy Workers API
- Build and deploy frontend
- Guide you through domain setup

## Step 6: Configure DNS Records

After deployment, update your DNS records:

### For API (if using subdomain approach):
```
Type: CNAME
Name: api.uptimeguard
Value: uptimeguard-api.your-subdomain.workers.dev
TTL: 300
```

### For Frontend:
```
Type: CNAME  
Name: uptimeguard
Value: uptimeguard.pages.dev
TTL: 300
```

### For Full Domain Integration:
If you moved your entire domain to Cloudflare, you can use:
```
Type: CNAME
Name: api
Value: uptimeguard-api.your-subdomain.workers.dev

Type: CNAME
Name: www
Value: uptimeguard.pages.dev

Type: A
Name: @
Value: [Cloudflare Proxy IP - will be automatically set]
```

## Step 7: Verify Deployment

1. **Check API**: Visit `https://api.uptimeguard.yourdomain.com/health`
   - Should return "OK"

2. **Check Frontend**: Visit `https://uptimeguard.yourdomain.com`
   - Should show the UptimeGuard login page

3. **Check Database**: 
   ```bash
   wrangler d1 execute uptimeguard-db --command="SELECT COUNT(*) FROM users" --remote
   ```

## Step 8: Initial Setup

1. **Create Admin Account**:
   - Visit your UptimeGuard URL
   - Click "Register"
   - Create your admin account

2. **First Monitor**:
   - Log in to your dashboard
   - Click "Add Monitor"
   - Add your first website to monitor

3. **Status Page**:
   - Go to "Status Pages"
   - Create your first public status page
   - Configure custom domain if desired

## Cloudflare Free Tier Limits

Your UptimeGuard installation will work within these limits:

- **Workers**: 100,000 requests/day
- **D1 Database**: 25 GB storage, 25M reads/day, 50K writes/day  
- **Pages**: Unlimited static requests
- **KV**: 100K reads/day, 1K writes/day
- **Cron Triggers**: 1000 executions/day

This supports approximately:
- **50 monitors** checking every 5 minutes
- **5 status pages** with moderate traffic
- **Unlimited visitors** to status pages

## Troubleshooting

### Common Issues:

1. **"Database not found"**:
   ```bash
   wrangler d1 create uptimeguard-db
   # Update database ID in wrangler.toml
   wrangler d1 execute uptimeguard-db --file=database/schema.sql --remote
   ```

2. **"KV namespace not found"**:
   ```bash
   wrangler kv:namespace create "UPTIMEGUARD_KV"
   # Update namespace ID in wrangler.toml
   ```

3. **"Route not working"**:
   - Verify DNS records are correct
   - Check Cloudflare SSL/TLS mode is "Full" or "Full (strict)"
   - Wait for DNS propagation (up to 24 hours)

4. **"CORS errors"**:
   - Ensure API and frontend are on same domain/subdomain
   - Check Cloudflare security settings

### Useful Commands:

```bash
# View logs
wrangler tail --format=pretty

# Check database
wrangler d1 execute uptimeguard-db --command="SELECT * FROM monitors LIMIT 5" --remote

# List KV keys
wrangler kv:key list --namespace-id=YOUR_KV_ID

# Redeploy after changes
wrangler deploy
cd frontend && npm run build && wrangler pages deploy dist
```

## Support

For issues and questions:
1. Check the troubleshooting section above
2. Review Cloudflare documentation
3. Create an issue in the GitHub repository

## Security Notes

1. **Change default JWT secret** in production
2. **Use HTTPS only** (Cloudflare provides free SSL)
3. **Regularly update dependencies**
4. **Monitor your Cloudflare usage** to stay within limits
5. **Use strong passwords** for your admin account

## Next Steps

Once UptimeGuard is running:
1. Add all your websites/services to monitor
2. Create status pages for customer communication  
3. Set up email notifications
4. Configure alert contacts
5. Share status page URLs with your team/customers

## Customization

UptimeGuard is designed to be customizable:
- **Branding**: Update logo, colors, and themes in status pages
- **Notifications**: Add custom webhook endpoints
- **Monitoring**: Adjust check intervals and timeout settings
- **UI**: Modify the frontend React components as needed

Enjoy your free, self-hosted uptime monitoring solution! 🚀
