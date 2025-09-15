// Public API routes (no authentication required)

import { Router } from 'itty-router';
import { jsonResponse, errorResponse } from '../utils/cors';

const router = Router({ base: '/api/public' });

// Get public status page data
router.get('/status/:slug', async (request) => {
  try {
    const { slug } = request.params;
    
    // Get status page
    const statusPage = await request.env.DB.prepare(`
      SELECT * FROM status_pages 
      WHERE slug = ? AND is_public = 1 AND is_active = 1
    `).bind(slug).first();
    
    if (!statusPage) {
      return errorResponse('Status page not found', 404, 'STATUS_PAGE_NOT_FOUND');
    }
    
    // Check password protection
    if (statusPage.password_hash) {
      const password = request.headers.get('X-Status-Password');
      if (!password || !await verifyPassword(password, statusPage.password_hash)) {
        return errorResponse('Password required', 401, 'PASSWORD_REQUIRED');
      }
    }
    
    // Get monitors for this status page
    const monitorsResult = await request.env.DB.prepare(`
      SELECT 
        m.id, m.name, m.type, m.url,
        spm.display_order, spm.show_uptime, spm.show_response_time,
        CASE 
          WHEN mc.status = 'up' THEN 'up'
          WHEN mc.status IS NULL THEN 'unknown'
          ELSE 'down'
        END as current_status,
        mc.response_time_ms as last_response_time,
        mc.checked_at as last_checked_at,
        COALESCE(us.uptime_percentage, 100.0) as uptime_percentage_30d
      FROM status_page_monitors spm
      JOIN monitors m ON spm.monitor_id = m.id
      LEFT JOIN monitor_checks mc ON m.id = mc.monitor_id 
        AND mc.checked_at = (
          SELECT MAX(checked_at) 
          FROM monitor_checks mc2 
          WHERE mc2.monitor_id = m.id
        )
      LEFT JOIN (
        SELECT 
          monitor_id,
          AVG(uptime_percentage) as uptime_percentage
        FROM uptime_stats 
        WHERE date >= date('now', '-30 days')
        GROUP BY monitor_id
      ) us ON m.id = us.monitor_id
      WHERE spm.status_page_id = ? AND m.is_active = 1
      ORDER BY spm.display_order, m.name
    `).bind(statusPage.id).all();
    
    // Get recent incidents for all monitors
    const incidentsResult = await request.env.DB.prepare(`
      SELECT 
        i.*, m.name as monitor_name
      FROM incidents i
      JOIN monitors m ON i.monitor_id = m.id
      JOIN status_page_monitors spm ON m.id = spm.monitor_id
      WHERE spm.status_page_id = ? 
      AND i.started_at >= date('now', '-7 days')
      ORDER BY i.started_at DESC
      LIMIT 10
    `).bind(statusPage.id).all();
    
    // Get uptime history for the specified period
    const historyDays = statusPage.history_days || 90;
    const uptimeHistory = await getUptimeHistory(statusPage.id, historyDays, request.env.DB);
    
    return jsonResponse({
      statusPage: {
        id: statusPage.id,
        name: statusPage.name,
        slug: statusPage.slug,
        custom_domain: statusPage.custom_domain,
        logo_url: statusPage.logo_url,
        favicon_url: statusPage.favicon_url,
        brand_color: statusPage.brand_color,
        theme: statusPage.theme,
        timezone: statusPage.timezone,
        layout: statusPage.layout,
        show_uptime_percentage: statusPage.show_uptime_percentage,
        show_response_times: statusPage.show_response_times,
        history_days: statusPage.history_days,
        allow_subscriptions: statusPage.allow_subscriptions,
        custom_css: statusPage.custom_css
      },
      monitors: monitorsResult.results,
      incidents: incidentsResult.results,
      uptimeHistory,
      lastUpdated: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Get public status page error:', error);
    return errorResponse('Failed to get status page', 500, 'STATUS_PAGE_ERROR');
  }
});

// Subscribe to status page updates
router.post('/status/:slug/subscribe', async (request) => {
  try {
    const { slug } = request.params;
    const { email } = await request.json();
    
    if (!email || !isValidEmail(email)) {
      return errorResponse('Valid email address required', 400, 'INVALID_EMAIL');
    }
    
    // Get status page
    const statusPage = await request.env.DB.prepare(`
      SELECT id, allow_subscriptions FROM status_pages 
      WHERE slug = ? AND is_public = 1 AND is_active = 1
    `).bind(slug).first();
    
    if (!statusPage) {
      return errorResponse('Status page not found', 404, 'STATUS_PAGE_NOT_FOUND');
    }
    
    if (!statusPage.allow_subscriptions) {
      return errorResponse('Subscriptions not allowed', 400, 'SUBSCRIPTIONS_DISABLED');
    }
    
    // Check if already subscribed
    const existing = await request.env.DB.prepare(`
      SELECT id FROM status_page_subscribers 
      WHERE status_page_id = ? AND email = ? AND unsubscribed_at IS NULL
    `).bind(statusPage.id, email).first();
    
    if (existing) {
      return errorResponse('Email already subscribed', 400, 'ALREADY_SUBSCRIBED');
    }
    
    // Create subscription
    const verificationToken = crypto.randomUUID();
    
    await request.env.DB.prepare(`
      INSERT INTO status_page_subscribers (status_page_id, email, verification_token)
      VALUES (?, ?, ?)
    `).bind(statusPage.id, email, verificationToken).run();
    
    // TODO: Send verification email
    
    return jsonResponse({
      message: 'Subscription created. Please check your email to verify.',
      email
    }, 201);
    
  } catch (error) {
    console.error('Subscribe error:', error);
    return errorResponse('Failed to subscribe', 500, 'SUBSCRIBE_ERROR');
  }
});

// Verify subscription
router.get('/status/:slug/verify/:token', async (request) => {
  try {
    const { slug, token } = request.params;
    
    // Get status page
    const statusPage = await request.env.DB.prepare(`
      SELECT id FROM status_pages 
      WHERE slug = ? AND is_public = 1 AND is_active = 1
    `).bind(slug).first();
    
    if (!statusPage) {
      return errorResponse('Status page not found', 404, 'STATUS_PAGE_NOT_FOUND');
    }
    
    // Verify token
    const subscriber = await request.env.DB.prepare(`
      SELECT id FROM status_page_subscribers 
      WHERE status_page_id = ? AND verification_token = ? AND verified = 0
    `).bind(statusPage.id, token).first();
    
    if (!subscriber) {
      return errorResponse('Invalid verification token', 400, 'INVALID_TOKEN');
    }
    
    // Mark as verified
    await request.env.DB.prepare(`
      UPDATE status_page_subscribers 
      SET verified = 1, verification_token = NULL 
      WHERE id = ?
    `).bind(subscriber.id).run();
    
    return jsonResponse({
      message: 'Email verified successfully'
    });
    
  } catch (error) {
    console.error('Verify subscription error:', error);
    return errorResponse('Failed to verify subscription', 500, 'VERIFY_ERROR');
  }
});

// Unsubscribe
router.get('/status/:slug/unsubscribe/:email/:token', async (request) => {
  try {
    const { slug, email, token } = request.params;
    
    // Get status page
    const statusPage = await request.env.DB.prepare(`
      SELECT id FROM status_pages 
      WHERE slug = ? AND is_public = 1 AND is_active = 1
    `).bind(slug).first();
    
    if (!statusPage) {
      return errorResponse('Status page not found', 404, 'STATUS_PAGE_NOT_FOUND');
    }
    
    // Verify unsubscribe token (simple hash of email + page id)
    const expectedToken = await generateUnsubscribeToken(email, statusPage.id);
    if (token !== expectedToken) {
      return errorResponse('Invalid unsubscribe token', 400, 'INVALID_TOKEN');
    }
    
    // Unsubscribe
    await request.env.DB.prepare(`
      UPDATE status_page_subscribers 
      SET unsubscribed_at = datetime('now') 
      WHERE status_page_id = ? AND email = ?
    `).bind(statusPage.id, email).run();
    
    return jsonResponse({
      message: 'Successfully unsubscribed'
    });
    
  } catch (error) {
    console.error('Unsubscribe error:', error);
    return errorResponse('Failed to unsubscribe', 500, 'UNSUBSCRIBE_ERROR');
  }
});

// Get monitor uptime history for status page charts
router.get('/status/:slug/history/:monitorId', async (request) => {
  try {
    const { slug, monitorId } = request.params;
    const { days = 30 } = request.query || {};
    
    // Verify monitor belongs to status page
    const monitor = await request.env.DB.prepare(`
      SELECT m.id FROM monitors m
      JOIN status_page_monitors spm ON m.id = spm.monitor_id
      JOIN status_pages sp ON spm.status_page_id = sp.id
      WHERE sp.slug = ? AND m.id = ? AND sp.is_public = 1 AND sp.is_active = 1
    `).bind(slug, monitorId).first();
    
    if (!monitor) {
      return errorResponse('Monitor not found', 404, 'MONITOR_NOT_FOUND');
    }
    
    // Get daily uptime stats
    const stats = await request.env.DB.prepare(`
      SELECT date, uptime_percentage, avg_response_time_ms, total_checks, successful_checks
      FROM uptime_stats
      WHERE monitor_id = ? AND date >= date('now', '-' || ? || ' days')
      ORDER BY date DESC
    `).bind(monitorId, days).all();
    
    // Get recent checks for more granular data
    const recentChecks = await request.env.DB.prepare(`
      SELECT checked_at, status, response_time_ms
      FROM monitor_checks
      WHERE monitor_id = ? AND checked_at >= datetime('now', '-24 hours')
      ORDER BY checked_at DESC
      LIMIT 288 -- Every 5 minutes for 24 hours
    `).bind(monitorId).all();
    
    return jsonResponse({
      dailyStats: stats.results,
      recentChecks: recentChecks.results
    });
    
  } catch (error) {
    console.error('Get monitor history error:', error);
    return errorResponse('Failed to get monitor history', 500, 'HISTORY_ERROR');
  }
});

// Get overall status summary
router.get('/status/:slug/summary', async (request) => {
  try {
    const { slug } = request.params;
    
    // Get status page
    const statusPage = await request.env.DB.prepare(`
      SELECT id FROM status_pages 
      WHERE slug = ? AND is_public = 1 AND is_active = 1
    `).bind(slug).first();
    
    if (!statusPage) {
      return errorResponse('Status page not found', 404, 'STATUS_PAGE_NOT_FOUND');
    }
    
    // Get monitor statuses
    const monitorsResult = await request.env.DB.prepare(`
      SELECT 
        COUNT(*) as total_monitors,
        COUNT(CASE WHEN mc.status = 'up' THEN 1 END) as up_monitors,
        COUNT(CASE WHEN mc.status != 'up' OR mc.status IS NULL THEN 1 END) as down_monitors,
        AVG(CASE WHEN mc.status = 'up' THEN mc.response_time_ms END) as avg_response_time
      FROM status_page_monitors spm
      JOIN monitors m ON spm.monitor_id = m.id
      LEFT JOIN monitor_checks mc ON m.id = mc.monitor_id 
        AND mc.checked_at = (
          SELECT MAX(checked_at) 
          FROM monitor_checks mc2 
          WHERE mc2.monitor_id = m.id
        )
      WHERE spm.status_page_id = ? AND m.is_active = 1
    `).bind(statusPage.id).first();
    
    // Determine overall status
    let overallStatus = 'operational';
    if (monitorsResult.down_monitors > 0) {
      if (monitorsResult.down_monitors === monitorsResult.total_monitors) {
        overallStatus = 'major_outage';
      } else if (monitorsResult.down_monitors >= monitorsResult.total_monitors / 2) {
        overallStatus = 'partial_outage';
      } else {
        overallStatus = 'degraded_performance';
      }
    }
    
    // Get active incidents
    const activeIncidents = await request.env.DB.prepare(`
      SELECT COUNT(*) as count FROM incidents i
      JOIN monitors m ON i.monitor_id = m.id
      JOIN status_page_monitors spm ON m.id = spm.monitor_id
      WHERE spm.status_page_id = ? AND i.resolved_at IS NULL
    `).bind(statusPage.id).first();
    
    return jsonResponse({
      overallStatus,
      totalMonitors: monitorsResult.total_monitors,
      upMonitors: monitorsResult.up_monitors,
      downMonitors: monitorsResult.down_monitors,
      avgResponseTime: Math.round(monitorsResult.avg_response_time || 0),
      activeIncidents: activeIncidents.count,
      lastUpdated: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Get status summary error:', error);
    return errorResponse('Failed to get status summary', 500, 'SUMMARY_ERROR');
  }
});

async function getUptimeHistory(statusPageId, days, db) {
  try {
    const history = await db.prepare(`
      SELECT 
        us.date,
        us.monitor_id,
        m.name as monitor_name,
        us.uptime_percentage,
        us.total_checks,
        us.successful_checks
      FROM uptime_stats us
      JOIN monitors m ON us.monitor_id = m.id
      JOIN status_page_monitors spm ON m.id = spm.monitor_id
      WHERE spm.status_page_id = ? 
      AND us.date >= date('now', '-' || ? || ' days')
      ORDER BY us.date DESC, m.name
    `).bind(statusPageId, days).all();
    
    // Group by date
    const grouped = {};
    for (const record of history.results) {
      if (!grouped[record.date]) {
        grouped[record.date] = [];
      }
      grouped[record.date].push(record);
    }
    
    return grouped;
    
  } catch (error) {
    console.error('Error getting uptime history:', error);
    return {};
  }
}

async function verifyPassword(password, hash) {
  // Simple password verification - in production, use proper hashing
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const generatedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return generatedHash === hash;
}

async function generateUnsubscribeToken(email, statusPageId) {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${email}:${statusPageId}:unsubscribe`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export default router;
