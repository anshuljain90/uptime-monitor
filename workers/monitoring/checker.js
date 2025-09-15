// Core monitoring logic for checking website/service status

export async function runMonitoringCheck(monitor, env) {
  try {
    console.log(`Checking monitor: ${monitor.name} (${monitor.type})`);
    
    let result;
    
    switch (monitor.type) {
      case 'http':
      case 'https':
        result = await checkHTTP(monitor);
        break;
      case 'ping':
        result = await checkPing(monitor);
        break;
      case 'port':
        result = await checkPort(monitor);
        break;
      case 'keyword':
        result = await checkKeyword(monitor);
        break;
      case 'ssl':
        result = await checkSSL(monitor);
        break;
      case 'heartbeat':
        result = await checkHeartbeat(monitor, env);
        break;
      default:
        throw new Error(`Unsupported monitor type: ${monitor.type}`);
    }
    
    // Save check result
    await saveCheckResult(monitor.id, result, env);
    
    // Handle status changes and notifications
    await handleStatusChange(monitor, result, env);
    
    return result;
    
  } catch (error) {
    console.error(`Error checking monitor ${monitor.id}:`, error);
    
    const errorResult = {
      status: 'error',
      response_time_ms: null,
      status_code: null,
      error_message: error.message,
      checked_at: new Date().toISOString(),
      region: 'unknown'
    };
    
    await saveCheckResult(monitor.id, errorResult, env);
    return errorResult;
  }
}

async function checkHTTP(monitor) {
  const startTime = Date.now();
  const url = monitor.url;
  
  // Parse headers
  const headers = monitor.headers ? JSON.parse(monitor.headers) : {};
  
  // Add authentication headers
  if (monitor.auth_type === 'basic' && monitor.auth_username && monitor.auth_password) {
    const credentials = btoa(`${monitor.auth_username}:${monitor.auth_password}`);
    headers['Authorization'] = `Basic ${credentials}`;
  } else if (monitor.auth_type === 'bearer' && monitor.auth_token) {
    headers['Authorization'] = `Bearer ${monitor.auth_token}`;
  }
  
  // Set up request options
  const options = {
    method: monitor.method || 'GET',
    headers,
    redirect: monitor.follow_redirects ? 'follow' : 'manual',
    signal: AbortSignal.timeout(monitor.timeout_seconds * 1000)
  };
  
  // Add body for POST/PUT requests
  if (['POST', 'PUT', 'PATCH'].includes(monitor.method) && monitor.body) {
    options.body = monitor.body;
    if (!headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
  }
  
  try {
    const response = await fetch(url, options);
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    // Check if status code is expected
    const statusCode = response.status;
    const expectedCodes = parseStatusCodes(monitor.expected_status_codes);
    const isStatusOk = expectedCodes.includes(statusCode);
    
    return {
      status: isStatusOk ? 'up' : 'down',
      response_time_ms: responseTime,
      status_code: statusCode,
      error_message: isStatusOk ? null : `Unexpected status code: ${statusCode}`,
      checked_at: new Date().toISOString(),
      region: getRegion()
    };
    
  } catch (error) {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    let errorMessage = error.message;
    if (error.name === 'AbortError' || error.message.includes('timeout')) {
      errorMessage = `Request timeout after ${monitor.timeout_seconds}s`;
    }
    
    return {
      status: 'timeout',
      response_time_ms: responseTime,
      status_code: null,
      error_message: errorMessage,
      checked_at: new Date().toISOString(),
      region: getRegion()
    };
  }
}

async function checkKeyword(monitor) {
  // First do HTTP check
  const httpResult = await checkHTTP(monitor);
  
  if (httpResult.status !== 'up') {
    return httpResult;
  }
  
  try {
    // Fetch content to check for keyword
    const response = await fetch(monitor.url, {
      timeout: monitor.timeout_seconds * 1000
    });
    
    const content = await response.text();
    const keyword = monitor.keyword;
    const keywordType = monitor.keyword_type || 'exists';
    
    const keywordFound = content.includes(keyword);
    const isOk = keywordType === 'exists' ? keywordFound : !keywordFound;
    
    return {
      ...httpResult,
      status: isOk ? 'up' : 'down',
      keyword_found: keywordFound,
      error_message: isOk ? null : `Keyword "${keyword}" ${keywordType === 'exists' ? 'not found' : 'found'}`
    };
    
  } catch (error) {
    return {
      ...httpResult,
      status: 'error',
      error_message: `Keyword check failed: ${error.message}`
    };
  }
}

async function checkPing(monitor) {
  // Since we can't do real ICMP ping in Workers, we'll do a TCP connection test
  const startTime = Date.now();
  const hostname = monitor.hostname;
  const port = monitor.port || 80;
  
  try {
    // Use HTTP HEAD request as ping substitute
    const url = `http://${hostname}:${port}`;
    const response = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(monitor.timeout_seconds * 1000)
    });
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    return {
      status: 'up',
      response_time_ms: responseTime,
      status_code: response.status,
      error_message: null,
      checked_at: new Date().toISOString(),
      region: getRegion()
    };
    
  } catch (error) {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    return {
      status: 'down',
      response_time_ms: responseTime,
      status_code: null,
      error_message: error.message,
      checked_at: new Date().toISOString(),
      region: getRegion()
    };
  }
}

async function checkPort(monitor) {
  const startTime = Date.now();
  const hostname = monitor.hostname;
  const port = monitor.port;
  
  try {
    // Try to establish TCP connection
    const socket = connect({
      hostname,
      port,
      timeout: monitor.timeout_seconds * 1000
    });
    
    await socket.opened;
    socket.close();
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    return {
      status: 'up',
      response_time_ms: responseTime,
      status_code: null,
      error_message: null,
      checked_at: new Date().toISOString(),
      region: getRegion()
    };
    
  } catch (error) {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    return {
      status: 'down',
      response_time_ms: responseTime,
      status_code: null,
      error_message: `Port ${port} closed or unreachable: ${error.message}`,
      checked_at: new Date().toISOString(),
      region: getRegion()
    };
  }
}

async function checkSSL(monitor) {
  const url = monitor.url || `https://${monitor.hostname}`;
  
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(monitor.timeout_seconds * 1000)
    });
    
    // Get certificate info from response headers
    const certInfo = response.headers.get('cf-ray'); // Cloudflare provides cert info
    
    // For now, we'll assume SSL is valid if HTTPS request succeeds
    // In a real implementation, you'd extract actual certificate details
    return {
      status: 'up',
      response_time_ms: 0,
      status_code: response.status,
      error_message: null,
      ssl_days_remaining: 30, // Placeholder
      checked_at: new Date().toISOString(),
      region: getRegion()
    };
    
  } catch (error) {
    return {
      status: 'down',
      response_time_ms: 0,
      status_code: null,
      error_message: `SSL check failed: ${error.message}`,
      ssl_days_remaining: 0,
      checked_at: new Date().toISOString(),
      region: getRegion()
    };
  }
}

async function checkHeartbeat(monitor, env) {
  // Heartbeat monitors expect regular pings from the monitored service
  // Check if we've received a heartbeat within the expected interval
  
  const heartbeatKey = `heartbeat:${monitor.id}`;
  const lastHeartbeat = await env.UPTIME_MONITOR_KV.get(heartbeatKey);
  
  if (!lastHeartbeat) {
    return {
      status: 'down',
      response_time_ms: 0,
      status_code: null,
      error_message: 'No heartbeat received',
      checked_at: new Date().toISOString(),
      region: getRegion()
    };
  }
  
  const lastHeartbeatTime = new Date(lastHeartbeat);
  const now = new Date();
  const timeDiff = (now - lastHeartbeatTime) / 1000; // seconds
  
  const maxInterval = monitor.interval_seconds * 2; // Allow 2x the interval
  
  return {
    status: timeDiff <= maxInterval ? 'up' : 'down',
    response_time_ms: Math.round(timeDiff * 1000),
    status_code: null,
    error_message: timeDiff > maxInterval ? `Heartbeat overdue by ${Math.round(timeDiff - maxInterval)}s` : null,
    checked_at: new Date().toISOString(),
    region: getRegion()
  };
}

async function saveCheckResult(monitorId, result, env) {
  try {
    await env.DB.prepare(`
      INSERT INTO monitor_checks (
        monitor_id, status, response_time_ms, status_code, error_message, 
        checked_at, region, ssl_days_remaining, keyword_found
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      monitorId,
      result.status,
      result.response_time_ms,
      result.status_code,
      result.error_message,
      result.checked_at,
      result.region,
      result.ssl_days_remaining || null,
      result.keyword_found || null
    ).run();
    
    // Update daily statistics
    await updateDailyStats(monitorId, result, env);
    
  } catch (error) {
    console.error('Error saving check result:', error);
  }
}

async function updateDailyStats(monitorId, result, env) {
  const today = new Date().toISOString().split('T')[0];
  
  try {
    // Upsert daily stats
    await env.DB.prepare(`
      INSERT INTO uptime_stats (
        monitor_id, date, total_checks, successful_checks, 
        avg_response_time_ms, min_response_time_ms, max_response_time_ms
      ) VALUES (?, ?, 1, ?, ?, ?, ?)
      ON CONFLICT(monitor_id, date) DO UPDATE SET
        total_checks = total_checks + 1,
        successful_checks = successful_checks + ?,
        avg_response_time_ms = (avg_response_time_ms * (total_checks - 1) + ?) / total_checks,
        min_response_time_ms = MIN(min_response_time_ms, ?),
        max_response_time_ms = MAX(max_response_time_ms, ?)
    `).bind(
      monitorId,
      today,
      result.status === 'up' ? 1 : 0,
      result.response_time_ms || 0,
      result.response_time_ms || 0,
      result.response_time_ms || 0,
      result.status === 'up' ? 1 : 0,
      result.response_time_ms || 0,
      result.response_time_ms || 0,
      result.response_time_ms || 0
    ).run();
    
    // Recalculate uptime percentage
    const stats = await env.DB.prepare(`
      SELECT total_checks, successful_checks 
      FROM uptime_stats 
      WHERE monitor_id = ? AND date = ?
    `).bind(monitorId, today).first();
    
    if (stats) {
      const uptimePercent = (stats.successful_checks / stats.total_checks) * 100;
      await env.DB.prepare(`
        UPDATE uptime_stats 
        SET uptime_percentage = ? 
        WHERE monitor_id = ? AND date = ?
      `).bind(uptimePercent, monitorId, today).run();
    }
    
  } catch (error) {
    console.error('Error updating daily stats:', error);
  }
}

async function handleStatusChange(monitor, result, env) {
  try {
    // Get last status
    const lastCheck = await env.DB.prepare(`
      SELECT status FROM monitor_checks 
      WHERE monitor_id = ? AND id != (SELECT MAX(id) FROM monitor_checks WHERE monitor_id = ?)
      ORDER BY checked_at DESC 
      LIMIT 1
    `).bind(monitor.id, monitor.id).first();
    
    const lastStatus = lastCheck?.status || 'unknown';
    const currentStatus = result.status;
    
    // Check if status changed
    if (lastStatus !== currentStatus) {
      console.log(`Status change for monitor ${monitor.id}: ${lastStatus} -> ${currentStatus}`);
      
      if (currentStatus === 'down' || currentStatus === 'error' || currentStatus === 'timeout') {
        // Start new incident
        await createIncident(monitor.id, result, env);
      } else if (currentStatus === 'up' && ['down', 'error', 'timeout'].includes(lastStatus)) {
        // Resolve incident
        await resolveIncident(monitor.id, env);
      }
      
      // Queue notifications
      await queueNotifications(monitor, currentStatus, lastStatus, env);
    }
    
  } catch (error) {
    console.error('Error handling status change:', error);
  }
}

async function createIncident(monitorId, result, env) {
  try {
    await env.DB.prepare(`
      INSERT INTO incidents (monitor_id, status, started_at, cause)
      VALUES (?, ?, ?, ?)
    `).bind(
      monitorId,
      'investigating',
      result.checked_at,
      result.error_message || `Monitor status: ${result.status}`
    ).run();
    
  } catch (error) {
    console.error('Error creating incident:', error);
  }
}

async function resolveIncident(monitorId, env) {
  try {
    const now = new Date().toISOString();
    
    await env.DB.prepare(`
      UPDATE incidents 
      SET status = 'resolved', resolved_at = ?, 
          duration_seconds = (strftime('%s', ?) - strftime('%s', started_at))
      WHERE monitor_id = ? AND resolved_at IS NULL
    `).bind(now, now, monitorId).run();
    
  } catch (error) {
    console.error('Error resolving incident:', error);
  }
}

async function queueNotifications(monitor, currentStatus, lastStatus, env) {
  try {
    // Get alert contacts for this monitor
    const contacts = await env.DB.prepare(`
      SELECT ac.*, mac.notify_on_down, mac.notify_on_up, mac.delay_minutes
      FROM alert_contacts ac
      JOIN monitor_alert_contacts mac ON ac.id = mac.alert_contact_id
      WHERE mac.monitor_id = ? AND ac.is_active = 1
    `).bind(monitor.id).all();
    
    for (const contact of contacts.results) {
      let shouldNotify = false;
      
      if (currentStatus !== 'up' && contact.notify_on_down) {
        shouldNotify = true;
      } else if (currentStatus === 'up' && lastStatus !== 'up' && contact.notify_on_up) {
        shouldNotify = true;
      }
      
      if (shouldNotify) {
        // Queue notification (we'll process these in a separate function)
        const notificationKey = `notification:${Date.now()}:${monitor.id}:${contact.id}`;
        await env.UPTIME_MONITOR_KV.put(notificationKey, JSON.stringify({
          monitorId: monitor.id,
          monitorName: monitor.name,
          contactId: contact.id,
          status: currentStatus,
          previousStatus: lastStatus,
          delayMinutes: contact.delay_minutes || 0,
          timestamp: new Date().toISOString()
        }), { expirationTtl: 86400 }); // 24 hour TTL
      }
    }
    
  } catch (error) {
    console.error('Error queuing notifications:', error);
  }
}

function parseStatusCodes(codes) {
  if (!codes) return [200];
  
  const result = [];
  const parts = codes.split(',');
  
  for (const part of parts) {
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(x => parseInt(x.trim()));
      for (let i = start; i <= end; i++) {
        result.push(i);
      }
    } else {
      result.push(parseInt(part.trim()));
    }
  }
  
  return result;
}

function getRegion() {
  // In a real implementation, you'd detect the actual region
  // For now, return a default
  return 'cf-auto';
}

// Export test function for manual testing
export async function testMonitor(monitor, env) {
  return await runMonitoringCheck(monitor, env);
}
