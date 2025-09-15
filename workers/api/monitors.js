// Monitors API routes

import { Router } from 'itty-router';
import { jsonResponse, errorResponse } from '../utils/cors';
import { testMonitor } from '../monitoring/checker';

const router = Router({ base: '/api/monitors' });

// Get all monitors for user
router.get('/', async (request) => {
  try {
    const user = request.user;
    const { page = 1, limit = 50, status, type } = request.query || {};
    
    let query = `
      SELECT 
        m.*,
        CASE 
          WHEN mc.status = 'up' THEN 'up'
          WHEN mc.status IS NULL THEN 'unknown'
          ELSE 'down'
        END as current_status,
        mc.response_time_ms as last_response_time,
        mc.checked_at as last_checked_at,
        mc.error_message as last_error,
        COALESCE(us.uptime_percentage, 100.0) as uptime_percentage_30d
      FROM monitors m
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
      WHERE m.user_id = ?
    `;
    
    const bindings = [user.id];
    
    // Filter by status
    if (status) {
      query += ` AND mc.status = ?`;
      bindings.push(status);
    }
    
    // Filter by type
    if (type) {
      query += ` AND m.type = ?`;
      bindings.push(type);
    }
    
    query += ` ORDER BY m.created_at DESC`;
    
    // Pagination
    const offset = (page - 1) * limit;
    query += ` LIMIT ? OFFSET ?`;
    bindings.push(limit, offset);
    
    const result = await request.env.DB.prepare(query).bind(...bindings).all();
    
    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM monitors WHERE user_id = ?`;
    const countResult = await request.env.DB.prepare(countQuery).bind(user.id).first();
    
    const monitors = result.results.map(monitor => ({
      ...monitor,
      regions: monitor.regions ? JSON.parse(monitor.regions) : ['auto'],
      headers: monitor.headers ? JSON.parse(monitor.headers) : {},
      settings: monitor.settings ? JSON.parse(monitor.settings) : {}
    }));
    
    return jsonResponse({
      monitors,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult.total,
        pages: Math.ceil(countResult.total / limit)
      }
    });
    
  } catch (error) {
    console.error('Get monitors error:', error);
    return errorResponse('Failed to get monitors', 500, 'GET_MONITORS_ERROR');
  }
});

// Create new monitor
router.post('/', async (request) => {
  try {
    const user = request.user;
    const monitorData = await request.json();
    
    // Validate required fields
    const { name, type, url, hostname, port } = monitorData;
    
    if (!name || !type) {
      return errorResponse('Name and type are required', 400, 'MISSING_FIELDS');
    }
    
    // Validate type-specific requirements
    if (['http', 'https', 'keyword'].includes(type) && !url) {
      return errorResponse('URL is required for HTTP/HTTPS/Keyword monitors', 400, 'MISSING_URL');
    }
    
    if (type === 'ping' && !hostname) {
      return errorResponse('Hostname is required for ping monitors', 400, 'MISSING_HOSTNAME');
    }
    
    if (type === 'port' && (!hostname || !port)) {
      return errorResponse('Hostname and port are required for port monitors', 400, 'MISSING_HOST_PORT');
    }
    
    if (type === 'keyword' && !monitorData.keyword) {
      return errorResponse('Keyword is required for keyword monitors', 400, 'MISSING_KEYWORD');
    }
    
    // Check monitor limits (free tier: 50 monitors)
    const countResult = await request.env.DB.prepare(`
      SELECT COUNT(*) as count FROM monitors WHERE user_id = ? AND is_active = 1
    `).bind(user.id).first();
    
    const monitorLimit = user.role === 'admin' ? 1000 : 50;
    if (countResult.count >= monitorLimit) {
      return errorResponse(`Monitor limit reached (${monitorLimit})`, 400, 'MONITOR_LIMIT');
    }
    
    // Set defaults
    const monitor = {
      user_id: user.id,
      name: name.trim(),
      type,
      url: url || null,
      hostname: hostname || null,
      port: port || null,
      keyword: monitorData.keyword || null,
      keyword_type: monitorData.keyword_type || 'exists',
      method: monitorData.method || 'GET',
      headers: JSON.stringify(monitorData.headers || {}),
      body: monitorData.body || null,
      auth_type: monitorData.auth_type || 'none',
      auth_username: monitorData.auth_username || null,
      auth_password: monitorData.auth_password || null,
      auth_token: monitorData.auth_token || null,
      interval_seconds: monitorData.interval_seconds || 300,
      timeout_seconds: monitorData.timeout_seconds || 30,
      retry_count: monitorData.retry_count || 3,
      follow_redirects: monitorData.follow_redirects !== false,
      verify_ssl: monitorData.verify_ssl !== false,
      expected_status_codes: monitorData.expected_status_codes || '200-299',
      regions: JSON.stringify(monitorData.regions || ['auto']),
      is_active: true
    };
    
    // Validate interval (free tier: 5 minutes minimum)
    const minInterval = user.role === 'admin' ? 30 : 300;
    if (monitor.interval_seconds < minInterval) {
      return errorResponse(`Minimum interval is ${minInterval} seconds`, 400, 'INVALID_INTERVAL');
    }
    
    // Insert monitor
    const result = await request.env.DB.prepare(`
      INSERT INTO monitors (
        user_id, name, type, url, hostname, port, keyword, keyword_type,
        method, headers, body, auth_type, auth_username, auth_password, auth_token,
        interval_seconds, timeout_seconds, retry_count, follow_redirects, verify_ssl,
        expected_status_codes, regions, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      monitor.user_id, monitor.name, monitor.type, monitor.url, monitor.hostname,
      monitor.port, monitor.keyword, monitor.keyword_type, monitor.method,
      monitor.headers, monitor.body, monitor.auth_type, monitor.auth_username,
      monitor.auth_password, monitor.auth_token, monitor.interval_seconds,
      monitor.timeout_seconds, monitor.retry_count, monitor.follow_redirects,
      monitor.verify_ssl, monitor.expected_status_codes, monitor.regions,
      monitor.is_active
    ).run();
    
    if (!result.success) {
      return errorResponse('Failed to create monitor', 500, 'CREATE_FAILED');
    }
    
    const monitorId = result.meta.last_row_id;
    
    // Get the created monitor
    const createdMonitor = await request.env.DB.prepare(`
      SELECT * FROM monitors WHERE id = ?
    `).bind(monitorId).first();
    
    return jsonResponse({
      message: 'Monitor created successfully',
      monitor: {
        ...createdMonitor,
        regions: JSON.parse(createdMonitor.regions),
        headers: JSON.parse(createdMonitor.headers)
      }
    }, 201);
    
  } catch (error) {
    console.error('Create monitor error:', error);
    return errorResponse('Failed to create monitor', 500, 'CREATE_MONITOR_ERROR');
  }
});

// Get single monitor
router.get('/:id', async (request) => {
  try {
    const user = request.user;
    const { id } = request.params;
    
    const monitor = await request.env.DB.prepare(`
      SELECT 
        m.*,
        CASE 
          WHEN mc.status = 'up' THEN 'up'
          WHEN mc.status IS NULL THEN 'unknown'
          ELSE 'down'
        END as current_status,
        mc.response_time_ms as last_response_time,
        mc.checked_at as last_checked_at,
        mc.error_message as last_error
      FROM monitors m
      LEFT JOIN monitor_checks mc ON m.id = mc.monitor_id 
        AND mc.checked_at = (
          SELECT MAX(checked_at) 
          FROM monitor_checks mc2 
          WHERE mc2.monitor_id = m.id
        )
      WHERE m.id = ? AND m.user_id = ?
    `).bind(id, user.id).first();
    
    if (!monitor) {
      return errorResponse('Monitor not found', 404, 'MONITOR_NOT_FOUND');
    }
    
    return jsonResponse({
      monitor: {
        ...monitor,
        regions: JSON.parse(monitor.regions),
        headers: JSON.parse(monitor.headers)
      }
    });
    
  } catch (error) {
    console.error('Get monitor error:', error);
    return errorResponse('Failed to get monitor', 500, 'GET_MONITOR_ERROR');
  }
});

// Update monitor
router.put('/:id', async (request) => {
  try {
    const user = request.user;
    const { id } = request.params;
    const updates = await request.json();
    
    // Check if monitor exists and belongs to user
    const monitor = await request.env.DB.prepare(`
      SELECT * FROM monitors WHERE id = ? AND user_id = ?
    `).bind(id, user.id).first();
    
    if (!monitor) {
      return errorResponse('Monitor not found', 404, 'MONITOR_NOT_FOUND');
    }
    
    // Build update query
    const allowedFields = [
      'name', 'url', 'hostname', 'port', 'keyword', 'keyword_type', 'method',
      'headers', 'body', 'auth_type', 'auth_username', 'auth_password', 'auth_token',
      'interval_seconds', 'timeout_seconds', 'retry_count', 'follow_redirects',
      'verify_ssl', 'expected_status_codes', 'regions', 'is_active'
    ];
    
    const updateFields = [];
    const bindings = [];
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        updateFields.push(`${key} = ?`);
        
        // Special handling for JSON fields
        if (['headers', 'regions'].includes(key)) {
          bindings.push(JSON.stringify(value));
        } else {
          bindings.push(value);
        }
      }
    }
    
    if (updateFields.length === 0) {
      return errorResponse('No valid fields to update', 400, 'NO_UPDATES');
    }
    
    // Validate interval if being updated
    if (updates.interval_seconds) {
      const minInterval = user.role === 'admin' ? 30 : 300;
      if (updates.interval_seconds < minInterval) {
        return errorResponse(`Minimum interval is ${minInterval} seconds`, 400, 'INVALID_INTERVAL');
      }
    }
    
    updateFields.push('updated_at = datetime("now")');
    bindings.push(id);
    
    const query = `UPDATE monitors SET ${updateFields.join(', ')} WHERE id = ?`;
    await request.env.DB.prepare(query).bind(...bindings).run();
    
    return jsonResponse({ message: 'Monitor updated successfully' });
    
  } catch (error) {
    console.error('Update monitor error:', error);
    return errorResponse('Failed to update monitor', 500, 'UPDATE_MONITOR_ERROR');
  }
});

// Delete monitor
router.delete('/:id', async (request) => {
  try {
    const user = request.user;
    const { id } = request.params;
    
    // Check if monitor exists and belongs to user
    const monitor = await request.env.DB.prepare(`
      SELECT id FROM monitors WHERE id = ? AND user_id = ?
    `).bind(id, user.id).first();
    
    if (!monitor) {
      return errorResponse('Monitor not found', 404, 'MONITOR_NOT_FOUND');
    }
    
    // Delete monitor (cascade will handle related records)
    await request.env.DB.prepare(`DELETE FROM monitors WHERE id = ?`).bind(id).run();
    
    return jsonResponse({ message: 'Monitor deleted successfully' });
    
  } catch (error) {
    console.error('Delete monitor error:', error);
    return errorResponse('Failed to delete monitor', 500, 'DELETE_MONITOR_ERROR');
  }
});

// Get monitor checks/history
router.get('/:id/checks', async (request) => {
  try {
    const user = request.user;
    const { id } = request.params;
    const { page = 1, limit = 100, status, from, to } = request.query || {};
    
    // Check if monitor belongs to user
    const monitor = await request.env.DB.prepare(`
      SELECT id FROM monitors WHERE id = ? AND user_id = ?
    `).bind(id, user.id).first();
    
    if (!monitor) {
      return errorResponse('Monitor not found', 404, 'MONITOR_NOT_FOUND');
    }
    
    let query = `
      SELECT * FROM monitor_checks 
      WHERE monitor_id = ?
    `;
    const bindings = [id];
    
    // Filter by status
    if (status) {
      query += ` AND status = ?`;
      bindings.push(status);
    }
    
    // Filter by date range
    if (from) {
      query += ` AND checked_at >= ?`;
      bindings.push(from);
    }
    
    if (to) {
      query += ` AND checked_at <= ?`;
      bindings.push(to);
    }
    
    query += ` ORDER BY checked_at DESC`;
    
    // Pagination
    const offset = (page - 1) * limit;
    query += ` LIMIT ? OFFSET ?`;
    bindings.push(limit, offset);
    
    const result = await request.env.DB.prepare(query).bind(...bindings).all();
    
    return jsonResponse({
      checks: result.results,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
    
  } catch (error) {
    console.error('Get checks error:', error);
    return errorResponse('Failed to get checks', 500, 'GET_CHECKS_ERROR');
  }
});

// Test monitor manually
router.post('/:id/test', async (request) => {
  try {
    const user = request.user;
    const { id } = request.params;
    
    // Get monitor
    const monitor = await request.env.DB.prepare(`
      SELECT * FROM monitors WHERE id = ? AND user_id = ?
    `).bind(id, user.id).first();
    
    if (!monitor) {
      return errorResponse('Monitor not found', 404, 'MONITOR_NOT_FOUND');
    }
    
    // Run test
    const result = await testMonitor(monitor, request.env);
    
    return jsonResponse({
      message: 'Monitor test completed',
      result
    });
    
  } catch (error) {
    console.error('Test monitor error:', error);
    return errorResponse('Failed to test monitor', 500, 'TEST_MONITOR_ERROR');
  }
});

export default router;
