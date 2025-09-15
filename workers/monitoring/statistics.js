// Statistics calculation functions for uptime monitoring

/**
 * Calculate and update daily statistics for all monitors
 * @param {Object} env - Cloudflare environment object with DB access
 */
export async function calculateStats(env) {
  try {
    console.log('Calculating daily statistics...');

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    // Check if stats for today have already been calculated
    const existingStats = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM uptime_stats WHERE date = ?
    `).bind(today).first();

    if (existingStats.count > 0) {
      console.log('Statistics for today already calculated, skipping...');
      return;
    }

    // Get all active monitors
    const monitors = await env.DB.prepare(`
      SELECT id FROM monitors WHERE is_active = 1
    `).all();

    if (!monitors.results || monitors.results.length === 0) {
      console.log('No active monitors found');
      return;
    }

    // Calculate stats for each monitor
    for (const monitor of monitors.results) {
      await calculateMonitorStats(monitor.id, today, env);
    }

    // Clean up old statistics (keep last 365 days)
    await env.DB.prepare(`
      DELETE FROM uptime_stats
      WHERE date < date('now', '-365 days')
    `).run();

    // Update monitor summary statistics
    await updateMonitorSummaryStats(env);

    console.log('Daily statistics calculation completed');

  } catch (error) {
    console.error('Error calculating statistics:', error);
  }
}

/**
 * Calculate statistics for a specific monitor for a specific date
 * @param {number} monitorId - Monitor ID
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {Object} env - Cloudflare environment object
 */
async function calculateMonitorStats(monitorId, date, env) {
  try {
    // Get all checks for the monitor for the specified date
    const checks = await env.DB.prepare(`
      SELECT
        status,
        response_time_ms,
        checked_at
      FROM monitor_checks
      WHERE monitor_id = ?
      AND date(checked_at) = ?
      ORDER BY checked_at
    `).bind(monitorId, date).all();

    if (!checks.results || checks.results.length === 0) {
      console.log(`No checks found for monitor ${monitorId} on ${date}`);
      return;
    }

    const checkResults = checks.results;
    const totalChecks = checkResults.length;
    const upChecks = checkResults.filter(c => c.status === 'up').length;
    const downChecks = checkResults.filter(c => c.status === 'down').length;

    // Calculate uptime percentage
    const uptimePercentage = totalChecks > 0 ? (upChecks / totalChecks) * 100 : 0;

    // Calculate response time statistics (only for successful checks)
    const successfulChecks = checkResults.filter(c => c.status === 'up' && c.response_time_ms);
    let avgResponseTime = 0;
    let minResponseTime = 0;
    let maxResponseTime = 0;

    if (successfulChecks.length > 0) {
      const responseTimes = successfulChecks.map(c => c.response_time_ms);
      avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      minResponseTime = Math.min(...responseTimes);
      maxResponseTime = Math.max(...responseTimes);
    }

    // Calculate downtime periods
    const downtimeInfo = calculateDowntime(checkResults);

    // Insert or update statistics
    await env.DB.prepare(`
      INSERT OR REPLACE INTO uptime_stats (
        monitor_id, date, total_checks, up_checks, down_checks,
        uptime_percentage, avg_response_time, min_response_time, max_response_time,
        downtime_duration, downtime_incidents
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      monitorId,
      date,
      totalChecks,
      upChecks,
      downChecks,
      Math.round(uptimePercentage * 100) / 100,
      Math.round(avgResponseTime),
      minResponseTime,
      maxResponseTime,
      downtimeInfo.totalDuration,
      downtimeInfo.incidents
    ).run();

    console.log(`Stats calculated for monitor ${monitorId} on ${date}: ${uptimePercentage.toFixed(2)}% uptime`);

  } catch (error) {
    console.error(`Error calculating stats for monitor ${monitorId}:`, error);
  }
}

/**
 * Calculate downtime duration and incidents from check results
 * @param {Array} checks - Array of check results ordered by time
 * @returns {Object} Downtime information
 */
function calculateDowntime(checks) {
  let totalDuration = 0; // in minutes
  let incidents = 0;
  let isInDowntime = false;
  let downtimeStart = null;

  for (let i = 0; i < checks.length; i++) {
    const check = checks[i];
    const isDown = check.status === 'down';

    if (isDown && !isInDowntime) {
      // Start of downtime
      isInDowntime = true;
      downtimeStart = new Date(check.checked_at);
      incidents++;
    } else if (!isDown && isInDowntime) {
      // End of downtime
      isInDowntime = false;
      if (downtimeStart) {
        const downtimeEnd = new Date(check.checked_at);
        const duration = (downtimeEnd - downtimeStart) / (1000 * 60); // convert to minutes
        totalDuration += duration;
      }
    }
  }

  // If still in downtime at end of period, calculate duration to end of day
  if (isInDowntime && downtimeStart) {
    const lastCheck = new Date(checks[checks.length - 1].checked_at);
    const duration = (lastCheck - downtimeStart) / (1000 * 60);
    totalDuration += duration;
  }

  return {
    totalDuration: Math.round(totalDuration),
    incidents
  };
}

/**
 * Update summary statistics for all monitors
 * @param {Object} env - Cloudflare environment object
 */
async function updateMonitorSummaryStats(env) {
  try {
    console.log('Updating monitor summary statistics...');

    const monitors = await env.DB.prepare(`
      SELECT id FROM monitors WHERE is_active = 1
    `).all();

    if (!monitors.results) return;

    for (const monitor of monitors.results) {
      // Calculate 30-day average uptime
      const uptime30d = await env.DB.prepare(`
        SELECT AVG(uptime_percentage) as avg_uptime
        FROM uptime_stats
        WHERE monitor_id = ? AND date >= date('now', '-30 days')
      `).bind(monitor.id).first();

      // Calculate 7-day average uptime
      const uptime7d = await env.DB.prepare(`
        SELECT AVG(uptime_percentage) as avg_uptime
        FROM uptime_stats
        WHERE monitor_id = ? AND date >= date('now', '-7 days')
      `).bind(monitor.id).first();

      // Calculate 30-day average response time
      const responseTime30d = await env.DB.prepare(`
        SELECT AVG(avg_response_time) as avg_response_time
        FROM uptime_stats
        WHERE monitor_id = ? AND date >= date('now', '-30 days')
      `).bind(monitor.id).first();

      // Update monitor with calculated stats
      await env.DB.prepare(`
        UPDATE monitors SET
          uptime_30d = ?,
          uptime_7d = ?,
          avg_response_time_30d = ?,
          stats_updated_at = datetime('now')
        WHERE id = ?
      `).bind(
        Math.round((uptime30d.avg_uptime || 100) * 100) / 100,
        Math.round((uptime7d.avg_uptime || 100) * 100) / 100,
        Math.round(responseTime30d.avg_response_time || 0),
        monitor.id
      ).run();
    }

    console.log('Monitor summary statistics updated');

  } catch (error) {
    console.error('Error updating monitor summary stats:', error);
  }
}

/**
 * Calculate statistics for a specific time period
 * @param {number} monitorId - Monitor ID
 * @param {string} period - Time period (1h, 24h, 7d, 30d)
 * @param {Object} env - Cloudflare environment object
 * @returns {Object} Statistics object
 */
export async function calculatePeriodStats(monitorId, period, env) {
  try {
    let dateFilter = '';

    switch (period) {
      case '1h':
        dateFilter = "datetime('now', '-1 hour')";
        break;
      case '24h':
        dateFilter = "datetime('now', '-24 hours')";
        break;
      case '7d':
        dateFilter = "datetime('now', '-7 days')";
        break;
      case '30d':
        dateFilter = "datetime('now', '-30 days')";
        break;
      default:
        dateFilter = "datetime('now', '-24 hours')";
    }

    const stats = await env.DB.prepare(`
      SELECT
        COUNT(*) as total_checks,
        COUNT(CASE WHEN status = 'up' THEN 1 END) as up_checks,
        COUNT(CASE WHEN status = 'down' THEN 1 END) as down_checks,
        AVG(CASE WHEN status = 'up' THEN response_time_ms END) as avg_response_time,
        MIN(CASE WHEN status = 'up' THEN response_time_ms END) as min_response_time,
        MAX(CASE WHEN status = 'up' THEN response_time_ms END) as max_response_time
      FROM monitor_checks
      WHERE monitor_id = ? AND checked_at >= ${dateFilter}
    `).bind(monitorId).first();

    const uptimePercentage = stats.total_checks > 0
      ? (stats.up_checks / stats.total_checks) * 100
      : 0;

    return {
      period,
      totalChecks: stats.total_checks || 0,
      upChecks: stats.up_checks || 0,
      downChecks: stats.down_checks || 0,
      uptimePercentage: Math.round(uptimePercentage * 100) / 100,
      responseTime: {
        avg: Math.round(stats.avg_response_time || 0),
        min: stats.min_response_time || 0,
        max: stats.max_response_time || 0
      }
    };

  } catch (error) {
    console.error(`Error calculating ${period} stats for monitor ${monitorId}:`, error);
    return null;
  }
}

/**
 * Get uptime trend data for charts
 * @param {number} monitorId - Monitor ID
 * @param {number} days - Number of days to include
 * @param {Object} env - Cloudflare environment object
 * @returns {Array} Array of daily uptime data
 */
export async function getUptimeTrend(monitorId, days, env) {
  try {
    const trendData = await env.DB.prepare(`
      SELECT
        date,
        uptime_percentage,
        avg_response_time,
        downtime_incidents
      FROM uptime_stats
      WHERE monitor_id = ? AND date >= date('now', '-${days} days')
      ORDER BY date
    `).bind(monitorId).all();

    return trendData.results || [];

  } catch (error) {
    console.error(`Error getting uptime trend for monitor ${monitorId}:`, error);
    return [];
  }
}

/**
 * Calculate global statistics across all monitors for a user
 * @param {number} userId - User ID
 * @param {Object} env - Cloudflare environment object
 * @returns {Object} Global statistics
 */
export async function calculateGlobalStats(userId, env) {
  try {
    // Get monitor counts
    const monitorCounts = await env.DB.prepare(`
      SELECT
        COUNT(*) as total_monitors,
        COUNT(CASE WHEN uptime_30d >= 99.9 THEN 1 END) as excellent_monitors,
        COUNT(CASE WHEN uptime_30d >= 99.0 AND uptime_30d < 99.9 THEN 1 END) as good_monitors,
        COUNT(CASE WHEN uptime_30d < 99.0 THEN 1 END) as poor_monitors,
        AVG(uptime_30d) as avg_uptime_30d,
        AVG(avg_response_time_30d) as avg_response_time_30d
      FROM monitors
      WHERE user_id = ? AND is_active = 1
    `).bind(userId).first();

    // Get recent incident count
    const recentIncidents = await env.DB.prepare(`
      SELECT COUNT(*) as incident_count
      FROM monitor_checks mc
      JOIN monitors m ON mc.monitor_id = m.id
      WHERE m.user_id = ? AND mc.status = 'down'
      AND mc.checked_at >= datetime('now', '-7 days')
    `).bind(userId).first();

    // Get total checks in last 24 hours
    const recentChecks = await env.DB.prepare(`
      SELECT COUNT(*) as check_count
      FROM monitor_checks mc
      JOIN monitors m ON mc.monitor_id = m.id
      WHERE m.user_id = ? AND mc.checked_at >= datetime('now', '-24 hours')
    `).bind(userId).first();

    return {
      monitors: {
        total: monitorCounts.total_monitors || 0,
        excellent: monitorCounts.excellent_monitors || 0,
        good: monitorCounts.good_monitors || 0,
        poor: monitorCounts.poor_monitors || 0
      },
      averages: {
        uptime30d: Math.round((monitorCounts.avg_uptime_30d || 100) * 100) / 100,
        responseTime30d: Math.round(monitorCounts.avg_response_time_30d || 0)
      },
      activity: {
        incidentsLast7d: recentIncidents.incident_count || 0,
        checksLast24h: recentChecks.check_count || 0
      }
    };

  } catch (error) {
    console.error(`Error calculating global stats for user ${userId}:`, error);
    return null;
  }
}