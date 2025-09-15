// Statistics API routes for overview, monitor stats, and uptime data

import { Router } from 'itty-router';
import { jsonResponse, errorResponse } from '../utils/cors';

const router = Router({ base: '/api/statistics' });

// Get overview statistics
router.get('/overview', async (request) => {
  try {
    const user = request.user;

    // Get basic counts
    const counts = await request.env.DB.prepare(`
      SELECT
        COUNT(DISTINCT m.id) as total_monitors,
        COUNT(DISTINCT sp.id) as total_status_pages,
        COUNT(DISTINCT ac.id) as total_alert_contacts,
        COUNT(DISTINCT CASE WHEN mc.status = 'up' THEN m.id END) as monitors_up,
        COUNT(DISTINCT CASE WHEN mc.status = 'down' THEN m.id END) as monitors_down
      FROM monitors m
      LEFT JOIN status_pages sp ON m.user_id = sp.user_id AND sp.is_active = 1
      LEFT JOIN alert_contacts ac ON m.user_id = ac.user_id AND ac.is_active = 1
      LEFT JOIN (
        SELECT DISTINCT monitor_id, status
        FROM monitor_checks mc1
        WHERE checked_at = (
          SELECT MAX(checked_at)
          FROM monitor_checks mc2
          WHERE mc2.monitor_id = mc1.monitor_id
        )
      ) mc ON m.id = mc.monitor_id
      WHERE m.user_id = ? AND m.is_active = 1
    `).bind(user.id).first();

    // Get recent check statistics (last 24 hours)
    const recentStats = await request.env.DB.prepare(`
      SELECT
        COUNT(*) as total_checks_24h,
        COUNT(CASE WHEN status = 'up' THEN 1 END) as successful_checks_24h,
        COUNT(CASE WHEN status = 'down' THEN 1 END) as failed_checks_24h,
        AVG(response_time_ms) as avg_response_time_24h
      FROM monitor_checks mc
      JOIN monitors m ON mc.monitor_id = m.id
      WHERE m.user_id = ? AND mc.checked_at >= datetime('now', '-24 hours')
    `).bind(user.id).first();

    // Get uptime percentage for last 30 days
    const uptimeStats = await request.env.DB.prepare(`
      SELECT
        AVG(uptime_percentage) as avg_uptime_30d
      FROM uptime_stats us
      JOIN monitors m ON us.monitor_id = m.id
      WHERE m.user_id = ? AND us.date >= date('now', '-30 days')
    `).bind(user.id).first();

    // Get recent incidents
    const recentIncidents = await request.env.DB.prepare(`
      SELECT
        m.name as monitor_name,
        mc.status,
        mc.error_message,
        mc.checked_at,
        mc.response_time_ms
      FROM monitor_checks mc
      JOIN monitors m ON mc.monitor_id = m.id
      WHERE m.user_id = ? AND mc.status = 'down'
      ORDER BY mc.checked_at DESC
      LIMIT 10
    `).bind(user.id).all();

    return jsonResponse({
      overview: {
        monitors: {
          total: counts.total_monitors || 0,
          up: counts.monitors_up || 0,
          down: counts.monitors_down || 0,
          unknown: (counts.total_monitors || 0) - (counts.monitors_up || 0) - (counts.monitors_down || 0)
        },
        statusPages: counts.total_status_pages || 0,
        alertContacts: counts.total_alert_contacts || 0,
        uptime: {
          percentage30d: Math.round((uptimeStats.avg_uptime_30d || 100) * 100) / 100,
          avgResponseTime24h: Math.round(recentStats.avg_response_time_24h || 0)
        },
        checks: {
          total24h: recentStats.total_checks_24h || 0,
          successful24h: recentStats.successful_checks_24h || 0,
          failed24h: recentStats.failed_checks_24h || 0
        }
      },
      recentIncidents: recentIncidents.results || []
    });

  } catch (error) {
    console.error('Get overview statistics error:', error);
    return errorResponse('Failed to get overview statistics', 500, 'GET_OVERVIEW_ERROR');
  }
});

// Get detailed statistics for a specific monitor
router.get('/monitors/:id', async (request) => {
  try {
    const user = request.user;
    const { id } = request.params;
    const { period = '7d' } = request.query || {};

    // Validate monitor ownership
    const monitor = await request.env.DB.prepare(`
      SELECT id, name, url FROM monitors
      WHERE id = ? AND user_id = ? AND is_active = 1
    `).bind(id, user.id).first();

    if (!monitor) {
      return errorResponse('Monitor not found', 404, 'NOT_FOUND');
    }

    // Determine date range based on period
    let dateFilter = '';
    let groupBy = '';
    let dateFormat = '';

    switch (period) {
      case '24h':
        dateFilter = "datetime('now', '-24 hours')";
        groupBy = "strftime('%Y-%m-%d %H', checked_at)";
        dateFormat = '%Y-%m-%d %H:00';
        break;
      case '7d':
        dateFilter = "date('now', '-7 days')";
        groupBy = "date(checked_at)";
        dateFormat = '%Y-%m-%d';
        break;
      case '30d':
        dateFilter = "date('now', '-30 days')";
        groupBy = "date(checked_at)";
        dateFormat = '%Y-%m-%d';
        break;
      case '90d':
        dateFilter = "date('now', '-90 days')";
        groupBy = "strftime('%Y-%W', checked_at)";
        dateFormat = '%Y-W%W';
        break;
      default:
        dateFilter = "date('now', '-7 days')";
        groupBy = "date(checked_at)";
        dateFormat = '%Y-%m-%d';
    }

    // Get check statistics by time period
    const checkStats = await request.env.DB.prepare(`
      SELECT
        ${groupBy} as period,
        COUNT(*) as total_checks,
        COUNT(CASE WHEN status = 'up' THEN 1 END) as successful_checks,
        COUNT(CASE WHEN status = 'down' THEN 1 END) as failed_checks,
        AVG(response_time_ms) as avg_response_time,
        MIN(response_time_ms) as min_response_time,
        MAX(response_time_ms) as max_response_time
      FROM monitor_checks
      WHERE monitor_id = ? AND checked_at >= ${dateFilter}
      GROUP BY ${groupBy}
      ORDER BY period
    `).bind(id).all();

    // Get overall statistics for the period
    const overallStats = await request.env.DB.prepare(`
      SELECT
        COUNT(*) as total_checks,
        COUNT(CASE WHEN status = 'up' THEN 1 END) as successful_checks,
        COUNT(CASE WHEN status = 'down' THEN 1 END) as failed_checks,
        AVG(response_time_ms) as avg_response_time,
        MIN(response_time_ms) as min_response_time,
        MAX(response_time_ms) as max_response_time,
        (COUNT(CASE WHEN status = 'up' THEN 1 END) * 100.0 / COUNT(*)) as uptime_percentage
      FROM monitor_checks
      WHERE monitor_id = ? AND checked_at >= ${dateFilter}
    `).bind(id).first();

    // Get recent checks
    const recentChecks = await request.env.DB.prepare(`
      SELECT
        status,
        response_time_ms,
        error_message,
        checked_at,
        status_code
      FROM monitor_checks
      WHERE monitor_id = ?
      ORDER BY checked_at DESC
      LIMIT 100
    `).bind(id).all();

    // Get incidents (periods of downtime)
    const incidents = await request.env.DB.prepare(`
      SELECT
        status,
        error_message,
        checked_at,
        response_time_ms,
        status_code
      FROM monitor_checks
      WHERE monitor_id = ? AND status = 'down' AND checked_at >= ${dateFilter}
      ORDER BY checked_at DESC
      LIMIT 50
    `).bind(id).all();

    return jsonResponse({
      monitor,
      period,
      statistics: {
        overall: {
          totalChecks: overallStats.total_checks || 0,
          successfulChecks: overallStats.successful_checks || 0,
          failedChecks: overallStats.failed_checks || 0,
          uptimePercentage: Math.round((overallStats.uptime_percentage || 100) * 100) / 100,
          responseTime: {
            avg: Math.round(overallStats.avg_response_time || 0),
            min: overallStats.min_response_time || 0,
            max: overallStats.max_response_time || 0
          }
        },
        timeline: checkStats.results || [],
        recentChecks: recentChecks.results || [],
        incidents: incidents.results || []
      }
    });

  } catch (error) {
    console.error('Get monitor statistics error:', error);
    return errorResponse('Failed to get monitor statistics', 500, 'GET_MONITOR_STATS_ERROR');
  }
});

// Get uptime data for charts
router.get('/uptime/:id', async (request) => {
  try {
    const user = request.user;
    const { id } = request.params;
    const { period = '30d', resolution = 'daily' } = request.query || {};

    // Validate monitor ownership
    const monitor = await request.env.DB.prepare(`
      SELECT id, name FROM monitors
      WHERE id = ? AND user_id = ? AND is_active = 1
    `).bind(id, user.id).first();

    if (!monitor) {
      return errorResponse('Monitor not found', 404, 'NOT_FOUND');
    }

    let dateFilter = '';
    let groupBy = '';

    // Determine resolution and date filter
    if (resolution === 'hourly' && period === '24h') {
      dateFilter = "datetime('now', '-24 hours')";
      groupBy = "strftime('%Y-%m-%d %H', checked_at)";
    } else if (resolution === 'daily') {
      switch (period) {
        case '7d':
          dateFilter = "date('now', '-7 days')";
          break;
        case '30d':
          dateFilter = "date('now', '-30 days')";
          break;
        case '90d':
          dateFilter = "date('now', '-90 days')";
          break;
        default:
          dateFilter = "date('now', '-30 days')";
      }
      groupBy = "date(checked_at)";
    } else {
      dateFilter = "date('now', '-30 days')";
      groupBy = "date(checked_at)";
    }

    // Get uptime data
    const uptimeData = await request.env.DB.prepare(`
      SELECT
        ${groupBy} as period,
        COUNT(*) as total_checks,
        COUNT(CASE WHEN status = 'up' THEN 1 END) as up_checks,
        (COUNT(CASE WHEN status = 'up' THEN 1 END) * 100.0 / COUNT(*)) as uptime_percentage,
        AVG(CASE WHEN status = 'up' THEN response_time_ms END) as avg_response_time
      FROM monitor_checks
      WHERE monitor_id = ? AND checked_at >= ${dateFilter}
      GROUP BY ${groupBy}
      ORDER BY period
    `).bind(id).all();

    // Calculate overall uptime for the period
    const overallUptime = await request.env.DB.prepare(`
      SELECT
        (COUNT(CASE WHEN status = 'up' THEN 1 END) * 100.0 / COUNT(*)) as uptime_percentage
      FROM monitor_checks
      WHERE monitor_id = ? AND checked_at >= ${dateFilter}
    `).bind(id).first();

    // Get status page view - last 90 days of daily uptime for status page display
    const statusData = await request.env.DB.prepare(`
      SELECT
        date(checked_at) as date,
        (COUNT(CASE WHEN status = 'up' THEN 1 END) * 100.0 / COUNT(*)) as uptime
      FROM monitor_checks
      WHERE monitor_id = ? AND checked_at >= date('now', '-90 days')
      GROUP BY date(checked_at)
      ORDER BY date
    `).bind(id).all();

    return jsonResponse({
      monitor,
      period,
      resolution,
      overallUptime: Math.round((overallUptime.uptime_percentage || 100) * 100) / 100,
      data: uptimeData.results || [],
      statusPageData: statusData.results || []
    });

  } catch (error) {
    console.error('Get uptime data error:', error);
    return errorResponse('Failed to get uptime data', 500, 'GET_UPTIME_ERROR');
  }
});

// Get response time statistics
router.get('/response-time/:id', async (request) => {
  try {
    const user = request.user;
    const { id } = request.params;
    const { period = '24h' } = request.query || {};

    // Validate monitor ownership
    const monitor = await request.env.DB.prepare(`
      SELECT id, name FROM monitors
      WHERE id = ? AND user_id = ? AND is_active = 1
    `).bind(id, user.id).first();

    if (!monitor) {
      return errorResponse('Monitor not found', 404, 'NOT_FOUND');
    }

    let dateFilter = '';
    let groupBy = '';

    switch (period) {
      case '24h':
        dateFilter = "datetime('now', '-24 hours')";
        groupBy = "strftime('%Y-%m-%d %H', checked_at)";
        break;
      case '7d':
        dateFilter = "date('now', '-7 days')";
        groupBy = "strftime('%Y-%m-%d %H', checked_at)";
        break;
      case '30d':
        dateFilter = "date('now', '-30 days')";
        groupBy = "date(checked_at)";
        break;
      default:
        dateFilter = "datetime('now', '-24 hours')";
        groupBy = "strftime('%Y-%m-%d %H', checked_at)";
    }

    const responseTimeData = await request.env.DB.prepare(`
      SELECT
        ${groupBy} as period,
        AVG(response_time_ms) as avg_response_time,
        MIN(response_time_ms) as min_response_time,
        MAX(response_time_ms) as max_response_time,
        COUNT(*) as check_count
      FROM monitor_checks
      WHERE monitor_id = ? AND checked_at >= ${dateFilter} AND status = 'up'
      GROUP BY ${groupBy}
      ORDER BY period
    `).bind(id).all();

    return jsonResponse({
      monitor,
      period,
      data: responseTimeData.results || []
    });

  } catch (error) {
    console.error('Get response time data error:', error);
    return errorResponse('Failed to get response time data', 500, 'GET_RESPONSE_TIME_ERROR');
  }
});

export default router;