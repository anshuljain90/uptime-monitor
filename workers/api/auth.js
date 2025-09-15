// Authentication API routes

import { Router } from 'itty-router';
import { jsonResponse, errorResponse } from '../utils/cors';
import { signJWT } from '../utils/jwt';

const router = Router({ base: '/api/auth' });

// Register new user
router.post('/register', async (request) => {
  try {
    const { username, email, password } = await request.json();
    
    // Validation
    if (!username || !email || !password) {
      return errorResponse('Username, email, and password are required', 400, 'MISSING_FIELDS');
    }
    
    if (password.length < 8) {
      return errorResponse('Password must be at least 8 characters long', 400, 'WEAK_PASSWORD');
    }
    
    // Check if user already exists
    const existingUser = await request.env.DB.prepare(`
      SELECT id FROM users WHERE username = ? OR email = ?
    `).bind(username, email).first();
    
    if (existingUser) {
      return errorResponse('Username or email already exists', 400, 'USER_EXISTS');
    }
    
    // Hash password
    const salt = crypto.randomUUID();
    const passwordHash = await hashPassword(password, salt);
    
    // Create user
    const result = await request.env.DB.prepare(`
      INSERT INTO users (username, email, password_hash, salt, role)
      VALUES (?, ?, ?, ?, ?)
    `).bind(username, email, passwordHash, salt, 'user').run();
    
    if (!result.success) {
      return errorResponse('Failed to create user', 500, 'CREATE_FAILED');
    }
    
    // Generate JWT
    const token = await signJWT(
      { userId: result.meta.last_row_id, username, email },
      request.env.JWT_SECRET
    );
    
    return jsonResponse({
      message: 'User created successfully',
      token,
      user: {
        id: result.meta.last_row_id,
        username,
        email,
        role: 'user'
      }
    }, 201);
    
  } catch (error) {
    console.error('Registration error:', error);
    return errorResponse('Registration failed', 500, 'REGISTRATION_ERROR');
  }
});

// Login user
router.post('/login', async (request) => {
  try {
    const { username, password } = await request.json();
    
    if (!username || !password) {
      return errorResponse('Username and password are required', 400, 'MISSING_CREDENTIALS');
    }
    
    // Get user
    const user = await request.env.DB.prepare(`
      SELECT id, username, email, password_hash, salt, role, is_active
      FROM users 
      WHERE (username = ? OR email = ?) AND is_active = 1
    `).bind(username, username).first();
    
    if (!user) {
      return errorResponse('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }
    
    // Verify password
    const passwordHash = await hashPassword(password, user.salt);
    if (passwordHash !== user.password_hash) {
      return errorResponse('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }
    
    // Update last login
    await request.env.DB.prepare(`
      UPDATE users SET last_login = datetime('now') WHERE id = ?
    `).bind(user.id).run();
    
    // Generate JWT
    const token = await signJWT(
      { userId: user.id, username: user.username, email: user.email },
      request.env.JWT_SECRET
    );
    
    return jsonResponse({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    return errorResponse('Login failed', 500, 'LOGIN_ERROR');
  }
});

// Get user profile
router.get('/profile', async (request) => {
  try {
    const user = request.user;
    
    // Get additional user stats
    const stats = await request.env.DB.prepare(`
      SELECT 
        COUNT(m.id) as monitor_count,
        COUNT(sp.id) as status_page_count,
        COUNT(ac.id) as alert_contact_count
      FROM users u
      LEFT JOIN monitors m ON u.id = m.user_id AND m.is_active = 1
      LEFT JOIN status_pages sp ON u.id = sp.user_id AND sp.is_active = 1
      LEFT JOIN alert_contacts ac ON u.id = ac.user_id AND ac.is_active = 1
      WHERE u.id = ?
    `).bind(user.id).first();
    
    return jsonResponse({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        created_at: user.created_at,
        last_login: user.last_login,
        settings: user.settings ? JSON.parse(user.settings) : {}
      },
      stats: {
        monitors: stats.monitor_count || 0,
        statusPages: stats.status_page_count || 0,
        alertContacts: stats.alert_contact_count || 0
      }
    });
    
  } catch (error) {
    console.error('Profile error:', error);
    return errorResponse('Failed to get profile', 500, 'PROFILE_ERROR');
  }
});

// Update user profile
router.put('/profile', async (request) => {
  try {
    const user = request.user;
    const { email, settings, currentPassword, newPassword } = await request.json();
    
    const updates = [];
    const bindings = [];
    
    // Update email if provided
    if (email && email !== user.email) {
      // Check if email is already taken
      const existingUser = await request.env.DB.prepare(`
        SELECT id FROM users WHERE email = ? AND id != ?
      `).bind(email, user.id).first();
      
      if (existingUser) {
        return errorResponse('Email already exists', 400, 'EMAIL_EXISTS');
      }
      
      updates.push('email = ?');
      bindings.push(email);
    }
    
    // Update settings if provided
    if (settings) {
      updates.push('settings = ?');
      bindings.push(JSON.stringify(settings));
    }
    
    // Update password if provided
    if (newPassword) {
      if (!currentPassword) {
        return errorResponse('Current password required to change password', 400, 'CURRENT_PASSWORD_REQUIRED');
      }
      
      // Verify current password
      const currentHash = await hashPassword(currentPassword, user.salt);
      if (currentHash !== user.password_hash) {
        return errorResponse('Current password is incorrect', 400, 'INCORRECT_PASSWORD');
      }
      
      if (newPassword.length < 8) {
        return errorResponse('New password must be at least 8 characters long', 400, 'WEAK_PASSWORD');
      }
      
      // Generate new salt and hash
      const newSalt = crypto.randomUUID();
      const newHash = await hashPassword(newPassword, newSalt);
      
      updates.push('password_hash = ?', 'salt = ?');
      bindings.push(newHash, newSalt);
    }
    
    if (updates.length === 0) {
      return errorResponse('Nothing to update', 400, 'NO_UPDATES');
    }
    
    // Update user
    updates.push('updated_at = datetime("now")');
    bindings.push(user.id);
    
    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    await request.env.DB.prepare(query).bind(...bindings).run();
    
    return jsonResponse({ message: 'Profile updated successfully' });
    
  } catch (error) {
    console.error('Profile update error:', error);
    return errorResponse('Failed to update profile', 500, 'UPDATE_ERROR');
  }
});

// Logout (client-side only - invalidate token)
router.post('/logout', async (request) => {
  return jsonResponse({ message: 'Logged out successfully' });
});

async function hashPassword(password, salt) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default router;
