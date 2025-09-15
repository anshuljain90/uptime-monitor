// Authentication middleware for protected routes

import { errorResponse } from '../utils/cors';
import { verifyJWT } from '../utils/jwt';

export async function authMiddleware(request) {
  try {
    // Skip auth for certain routes
    if (request.url.includes('/api/auth/login') || 
        request.url.includes('/api/auth/register')) {
      return;
    }
    
    const authHeader = request.headers.get('Authorization');
    const apiKey = request.headers.get('X-API-Key');
    
    let user = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // JWT authentication
      const token = authHeader.substring(7);
      
      try {
        const payload = await verifyJWT(token, request.env.JWT_SECRET);
        user = await getUserById(payload.userId, request.env.DB);
      } catch (error) {
        return errorResponse('Invalid or expired token', 401, 'INVALID_TOKEN');
      }
      
    } else if (apiKey) {
      // API key authentication
      user = await getUserByApiKey(apiKey, request.env.DB);
      
      if (!user) {
        return errorResponse('Invalid API key', 401, 'INVALID_API_KEY');
      }
      
    } else {
      return errorResponse('Authentication required', 401, 'AUTH_REQUIRED');
    }
    
    if (!user || !user.is_active) {
      return errorResponse('User not found or inactive', 401, 'USER_INACTIVE');
    }
    
    // Add user to request
    request.user = user;
    
  } catch (error) {
    console.error('Auth middleware error:', error);
    return errorResponse('Authentication error', 500, 'AUTH_ERROR');
  }
}

async function getUserById(userId, db) {
  const stmt = db.prepare(`
    SELECT id, username, email, role, is_active, settings 
    FROM users 
    WHERE id = ? AND is_active = 1
  `);
  
  const result = await stmt.bind(userId).first();
  return result;
}

async function getUserByApiKey(apiKey, db) {
  // Hash the API key for comparison
  const keyHash = await hashString(apiKey);
  
  const stmt = db.prepare(`
    SELECT u.id, u.username, u.email, u.role, u.is_active, u.settings,
           k.permissions, k.last_used_at, k.expires_at
    FROM users u
    JOIN api_keys k ON u.id = k.user_id
    WHERE k.key_hash = ? AND k.is_active = 1 AND u.is_active = 1
    AND (k.expires_at IS NULL OR k.expires_at > datetime('now'))
  `);
  
  const result = await stmt.bind(keyHash).first();
  
  if (result) {
    // Update last used timestamp
    const updateStmt = db.prepare(`
      UPDATE api_keys 
      SET last_used_at = datetime('now')
      WHERE key_hash = ?
    `);
    await updateStmt.bind(keyHash).run();
  }
  
  return result;
}

async function hashString(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
