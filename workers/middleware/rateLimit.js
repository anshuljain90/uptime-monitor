// Rate limiting middleware using Cloudflare KV

import { errorResponse } from '../utils/cors';

export async function rateLimitMiddleware(request) {
  try {
    const clientIP = request.headers.get('CF-Connecting-IP') || 
                     request.headers.get('X-Forwarded-For') || 
                     'unknown';
    
    const user = request.user;
    const key = `ratelimit:${user ? user.id : clientIP}`;
    
    // Different limits based on user type
    const limits = {
      admin: { requests: 10000, window: 3600 }, // 10k per hour
      user: { requests: 1000, window: 3600 },   // 1k per hour
      anonymous: { requests: 100, window: 3600 } // 100 per hour
    };
    
    const limit = limits[user?.role] || limits.anonymous;
    
    // Get current count from KV
    const currentCount = await request.env.UPTIME_MONITOR_KV.get(key);
    const count = currentCount ? parseInt(currentCount) : 0;
    
    if (count >= limit.requests) {
      return errorResponse(
        `Rate limit exceeded. Maximum ${limit.requests} requests per hour.`,
        429,
        'RATE_LIMIT_EXCEEDED'
      );
    }
    
    // Increment counter with TTL
    await request.env.UPTIME_MONITOR_KV.put(
      key, 
      (count + 1).toString(), 
      { expirationTtl: limit.window }
    );
    
    // Add rate limit headers to response
    request.rateLimitHeaders = {
      'X-RateLimit-Limit': limit.requests.toString(),
      'X-RateLimit-Remaining': (limit.requests - count - 1).toString(),
      'X-RateLimit-Reset': new Date(Date.now() + limit.window * 1000).toISOString()
    };
    
  } catch (error) {
    console.error('Rate limit middleware error:', error);
    // Don't block request on rate limit errors, just log
  }
}
