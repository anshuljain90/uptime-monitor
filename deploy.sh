#!/bin/bash

# Uptime Monitor Deployment Script
# This script sets up Uptime Monitor on Cloudflare's free tier

set -e

echo "🚀 Uptime Monitor Deployment Script"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    print_error "Wrangler CLI is not installed"
    echo "Please install it with: npm install -g wrangler"
    exit 1
fi

# Check if user is logged in
if ! wrangler whoami &> /dev/null; then
    print_warning "You are not logged in to Cloudflare"
    echo "Please run: wrangler login"
    exit 1
fi

print_status "Starting Uptime Monitor deployment..."

# Step 1: Create D1 Database
print_status "Creating D1 database..."
DB_OUTPUT=$(wrangler d1 create uptime-monitor-db 2>/dev/null || echo "exists")

if [[ $DB_OUTPUT == *"already exists"* ]] || [[ $DB_OUTPUT == "exists" ]]; then
    print_warning "Database already exists, skipping creation"
else
    print_success "D1 database created"
    echo "Please update wrangler.toml with the database ID from above"
fi

# Step 2: Create KV Namespace
print_status "Creating KV namespace..."
KV_OUTPUT=$(wrangler kv:namespace create "UPTIME_MONITOR_KV" 2>/dev/null || echo "exists")

if [[ $KV_OUTPUT == *"already exists"* ]] || [[ $KV_OUTPUT == "exists" ]]; then
    print_warning "KV namespace already exists, skipping creation"
else
    print_success "KV namespace created"
    echo "Please update wrangler.toml with the KV namespace ID from above"
fi

# Step 3: Initialize database schema
print_status "Initializing database schema..."
if wrangler d1 execute uptime-monitor-db --file=database/schema.sql --remote; then
    print_success "Database schema initialized"
else
    print_warning "Database schema may already be initialized"
fi

# Step 4: Deploy Workers
print_status "Deploying Cloudflare Workers..."
if wrangler deploy; then
    print_success "Workers deployed successfully"
else
    print_error "Workers deployment failed"
    exit 1
fi

# Step 5: Build and deploy frontend
print_status "Building frontend..."
cd frontend
if npm install && npm run build; then
    print_success "Frontend built successfully"
else
    print_error "Frontend build failed"
    exit 1
fi

print_status "Deploying frontend to Cloudflare Pages..."
if wrangler pages deploy dist --project-name=uptime-monitor; then
    print_success "Frontend deployed successfully"
else
    print_error "Frontend deployment failed"
    exit 1
fi

cd ..

# Step 6: Set up custom domain (if provided)
read -p "Do you want to set up a custom domain? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "Enter your domain (e.g., uptime-monitor.yourdomain.com): " DOMAIN
    
    print_status "Setting up custom domain: $DOMAIN"
    print_warning "Please add the following DNS records to your domain:"
    echo
    echo "For the API subdomain (api.$DOMAIN):"
    echo "  CNAME api.$DOMAIN -> uptime-monitor-api.your-subdomain.workers.dev"
    echo
    echo "For the main app ($DOMAIN):"
    echo "  CNAME $DOMAIN -> uptime-monitor.pages.dev"
    echo
    print_warning "After adding DNS records, update wrangler.toml with your domain"
fi

# Step 7: Display setup completion
echo
print_success "🎉 Uptime Monitor deployment completed!"
echo
echo "Next steps:"
echo "1. Update wrangler.toml with your actual database and KV namespace IDs"
echo "2. Set up your custom domain DNS records (if applicable)"
echo "3. Update the JWT_SECRET in wrangler.toml"
echo "4. Configure email settings for notifications"
echo "5. Visit your deployed application and create your admin account"
echo
echo "Useful commands:"
echo "  wrangler d1 execute uptime-monitor-db --command='SELECT * FROM users'"
echo "  wrangler kv:namespace list"
echo "  wrangler tail --format=pretty"
echo
print_status "For more information, visit: https://github.com/anshuljain90/uptime-monitor"
