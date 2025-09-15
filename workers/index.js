// Uptime Monitor - Main Cloudflare Worker
// Entry point for all API requests and monitoring functions

import { Router } from 'itty-router';
import { corsHeaders, handleCORS } from './utils/cors';
import { authMiddleware } from './middleware/auth';
import { rateLimitMiddleware } from './middleware/rateLimit';

// API Routes
import authRoutes from './api/auth';
import monitorsRoutes from './api/monitors';
import statusPagesRoutes from './api/statusPages';
import alertsRoutes from './api/alerts';
import statisticsRoutes from './api/statistics';
import publicRoutes from './api/public';

// Monitoring functions
import { runMonitoringCheck } from './monitoring/checker';
import { processNotifications } from './monitoring/notifications';
import { calculateStats } from './monitoring/statistics';

const router = Router();

// CORS preflight
router.options('*', handleCORS);

// Public routes (no auth required)
router.all('/api/public/*', publicRoutes.handle);
router.get('/status/:slug', publicRoutes.statusPage);
router.post('/status/:slug/subscribe', publicRoutes.subscribe);

// API routes with authentication
router.all('/api/auth/*', authRoutes.handle);
router.all('/api/monitors/*', authMiddleware, rateLimitMiddleware, monitorsRoutes.handle);
router.all('/api/status-pages/*', authMiddleware, rateLimitMiddleware, statusPagesRoutes.handle);
router.all('/api/alerts/*', authMiddleware, rateLimitMiddleware, alertsRoutes.handle);
router.all('/api/statistics/*', authMiddleware, rateLimitMiddleware, statisticsRoutes.handle);

// Health check endpoint
router.get('/health', () => new Response('OK', { 
  headers: { ...corsHeaders, 'content-type': 'text/plain' } 
}));

// API documentation
router.get('/docs', () => {
  const docs = `
    Uptime Monitor API Documentation
    ============================
    
    Authentication:
    POST /api/auth/login
    POST /api/auth/register
    POST /api/auth/logout
    GET  /api/auth/profile
    
    Monitors:
    GET    /api/monitors
    POST   /api/monitors
    GET    /api/monitors/:id
    PUT    /api/monitors/:id
    DELETE /api/monitors/:id
    GET    /api/monitors/:id/checks
    POST   /api/monitors/:id/test
    
    Status Pages:
    GET    /api/status-pages
    POST   /api/status-pages
    GET    /api/status-pages/:id
    PUT    /api/status-pages/:id
    DELETE /api/status-pages/:id
    GET    /status/:slug (public)
    
    Alerts:
    GET    /api/alerts/contacts
    POST   /api/alerts/contacts
    PUT    /api/alerts/contacts/:id
    DELETE /api/alerts/contacts/:id
    POST   /api/alerts/test/:id
    
    Statistics:
    GET    /api/statistics/overview
    GET    /api/statistics/monitors/:id
    GET    /api/statistics/uptime/:id
  `;
  
  return new Response(docs, {
    headers: { ...corsHeaders, 'content-type': 'text/plain' }
  });
});

// 404 handler
router.all('*', () => new Response('Not Found', { 
  status: 404,
  headers: corsHeaders 
}));

// Cron handler for monitoring checks
async function handleCron(event, env, ctx) {
  try {
    console.log('Running scheduled monitoring checks...');
    
    // Get all active monitors that need checking
    const stmt = env.DB.prepare(`
      SELECT * FROM monitors 
      WHERE is_active = 1 
      AND (
        SELECT COUNT(*) FROM monitor_checks 
        WHERE monitor_id = monitors.id 
        AND checked_at > datetime('now', '-' || monitors.interval_seconds || ' seconds')
      ) = 0
    `);
    
    const monitors = await stmt.all();
    
    console.log(`Found ${monitors.results?.length || 0} monitors to check`);
    
    // Process each monitor
    const checkPromises = monitors.results?.map(monitor => 
      runMonitoringCheck(monitor, env)
    ) || [];
    
    await Promise.allSettled(checkPromises);
    
    // Process any pending notifications
    await processNotifications(env);
    
    // Calculate daily statistics if needed
    await calculateStats(env);
    
    console.log('Monitoring checks completed');
    
  } catch (error) {
    console.error('Error in cron handler:', error);
  }
}

// Main request handler
async function handleRequest(request, env, ctx) {
  try {
    // Add environment to request for access in routes
    request.env = env;
    request.ctx = ctx;
    
    const response = await router.handle(request);
    
    // Add CORS headers to all responses
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    return response;
    
  } catch (error) {
    console.error('Error handling request:', error);
    
    return new Response(JSON.stringify({ 
      error: 'Internal Server Error',
      message: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' }
    });
  }
}

// Export handlers
export default {
  fetch: handleRequest,
  scheduled: handleCron
};
