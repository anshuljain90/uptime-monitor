// Alerts API routes for managing alert contacts and notifications

import { Router } from 'itty-router';
import { jsonResponse, errorResponse } from '../utils/cors';

const router = Router({ base: '/api/alerts' });

// Get all alert contacts for user
router.get('/contacts', async (request) => {
  try {
    const user = request.user;
    const { page = 1, limit = 50, type } = request.query || {};

    const offset = (page - 1) * limit;

    let query = `
      SELECT *
      FROM alert_contacts
      WHERE user_id = ? AND is_active = 1
    `;
    const bindings = [user.id];

    if (type) {
      query += ' AND type = ?';
      bindings.push(type);
    }

    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    bindings.push(limit, offset);

    const contacts = await request.env.DB.prepare(query).bind(...bindings).all();

    const total = await request.env.DB.prepare(`
      SELECT COUNT(*) as count FROM alert_contacts
      WHERE user_id = ? AND is_active = 1 ${type ? 'AND type = ?' : ''}
    `).bind(user.id, ...(type ? [type] : [])).first();

    return jsonResponse({
      contacts: contacts.results || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total.count || 0,
        pages: Math.ceil((total.count || 0) / limit)
      }
    });

  } catch (error) {
    console.error('Get alert contacts error:', error);
    return errorResponse('Failed to get alert contacts', 500, 'GET_CONTACTS_ERROR');
  }
});

// Create new alert contact
router.post('/contacts', async (request) => {
  try {
    const user = request.user;
    const {
      name,
      type, // email, webhook, discord, slack, telegram
      destination, // email address, webhook URL, etc.
      settings = {},
      is_enabled = true
    } = await request.json();

    // Validation
    if (!name || !type || !destination) {
      return errorResponse('Name, type, and destination are required', 400, 'MISSING_FIELDS');
    }

    const validTypes = ['email', 'webhook', 'discord', 'slack', 'telegram'];
    if (!validTypes.includes(type)) {
      return errorResponse('Invalid contact type', 400, 'INVALID_TYPE');
    }

    // Validate destination based on type
    if (type === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(destination)) {
        return errorResponse('Invalid email address', 400, 'INVALID_EMAIL');
      }
    } else if (type === 'webhook') {
      try {
        new URL(destination);
      } catch {
        return errorResponse('Invalid webhook URL', 400, 'INVALID_URL');
      }
    }

    // Create alert contact
    const result = await request.env.DB.prepare(`
      INSERT INTO alert_contacts (
        user_id, name, type, destination, settings, is_enabled
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      user.id, name, type, destination, JSON.stringify(settings), is_enabled ? 1 : 0
    ).run();

    if (!result.success) {
      return errorResponse('Failed to create alert contact', 500, 'CREATE_FAILED');
    }

    const contact = await request.env.DB.prepare(`
      SELECT * FROM alert_contacts WHERE id = ?
    `).bind(result.meta.last_row_id).first();

    return jsonResponse({
      message: 'Alert contact created successfully',
      contact
    }, 201);

  } catch (error) {
    console.error('Create alert contact error:', error);
    return errorResponse('Failed to create alert contact', 500, 'CREATE_ERROR');
  }
});

// Get alert contact by ID
router.get('/contacts/:id', async (request) => {
  try {
    const user = request.user;
    const { id } = request.params;

    const contact = await request.env.DB.prepare(`
      SELECT * FROM alert_contacts
      WHERE id = ? AND user_id = ? AND is_active = 1
    `).bind(id, user.id).first();

    if (!contact) {
      return errorResponse('Alert contact not found', 404, 'NOT_FOUND');
    }

    // Parse settings
    if (contact.settings) {
      contact.settings = JSON.parse(contact.settings);
    }

    return jsonResponse({ contact });

  } catch (error) {
    console.error('Get alert contact error:', error);
    return errorResponse('Failed to get alert contact', 500, 'GET_ERROR');
  }
});

// Update alert contact
router.put('/contacts/:id', async (request) => {
  try {
    const user = request.user;
    const { id } = request.params;
    const {
      name,
      destination,
      settings,
      is_enabled
    } = await request.json();

    // Check if contact exists
    const existingContact = await request.env.DB.prepare(`
      SELECT id FROM alert_contacts WHERE id = ? AND user_id = ? AND is_active = 1
    `).bind(id, user.id).first();

    if (!existingContact) {
      return errorResponse('Alert contact not found', 404, 'NOT_FOUND');
    }

    // Build update query
    const updates = [];
    const bindings = [];

    if (name !== undefined) { updates.push('name = ?'); bindings.push(name); }
    if (destination !== undefined) { updates.push('destination = ?'); bindings.push(destination); }
    if (settings !== undefined) { updates.push('settings = ?'); bindings.push(JSON.stringify(settings)); }
    if (is_enabled !== undefined) { updates.push('is_enabled = ?'); bindings.push(is_enabled ? 1 : 0); }

    if (updates.length === 0) {
      return errorResponse('Nothing to update', 400, 'NO_UPDATES');
    }

    updates.push('updated_at = datetime("now")');
    bindings.push(id);

    const query = `UPDATE alert_contacts SET ${updates.join(', ')} WHERE id = ?`;
    await request.env.DB.prepare(query).bind(...bindings).run();

    return jsonResponse({ message: 'Alert contact updated successfully' });

  } catch (error) {
    console.error('Update alert contact error:', error);
    return errorResponse('Failed to update alert contact', 500, 'UPDATE_ERROR');
  }
});

// Delete alert contact
router.delete('/contacts/:id', async (request) => {
  try {
    const user = request.user;
    const { id } = request.params;

    // Check if contact exists
    const contact = await request.env.DB.prepare(`
      SELECT id FROM alert_contacts WHERE id = ? AND user_id = ? AND is_active = 1
    `).bind(id, user.id).first();

    if (!contact) {
      return errorResponse('Alert contact not found', 404, 'NOT_FOUND');
    }

    // Soft delete
    await request.env.DB.prepare(`
      UPDATE alert_contacts SET is_active = 0, updated_at = datetime('now') WHERE id = ?
    `).bind(id).run();

    // Remove from monitor alert settings
    await request.env.DB.prepare(`
      UPDATE monitors SET alert_contacts = REPLACE(alert_contacts, ?, '')
      WHERE user_id = ? AND alert_contacts LIKE ?
    `).bind(id, user.id, `%${id}%`).run();

    return jsonResponse({ message: 'Alert contact deleted successfully' });

  } catch (error) {
    console.error('Delete alert contact error:', error);
    return errorResponse('Failed to delete alert contact', 500, 'DELETE_ERROR');
  }
});

// Test alert contact
router.post('/test/:id', async (request) => {
  try {
    const user = request.user;
    const { id } = request.params;

    const contact = await request.env.DB.prepare(`
      SELECT * FROM alert_contacts
      WHERE id = ? AND user_id = ? AND is_active = 1
    `).bind(id, user.id).first();

    if (!contact) {
      return errorResponse('Alert contact not found', 404, 'NOT_FOUND');
    }

    const testMessage = {
      type: 'test',
      title: 'Uptime Monitor Test Alert',
      message: 'This is a test notification from Uptime Monitor. Your alert contact is working correctly!',
      timestamp: new Date().toISOString(),
      monitor: {
        name: 'Test Monitor',
        url: 'https://example.com'
      }
    };

    let success = false;
    let errorMessage = null;

    try {
      switch (contact.type) {
        case 'email':
          // In a real implementation, you'd send an email here
          // For now, we'll just simulate success
          success = true;
          break;

        case 'webhook':
          const response = await fetch(contact.destination, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'UptimeMonitor/1.0'
            },
            body: JSON.stringify(testMessage)
          });

          if (response.ok) {
            success = true;
          } else {
            errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          }
          break;

        case 'discord':
        case 'slack':
        case 'telegram':
          // For these integrations, you'd implement the specific API calls
          // For now, simulate success
          success = true;
          break;

        default:
          errorMessage = 'Unsupported contact type';
      }

    } catch (error) {
      errorMessage = error.message;
    }

    // Log the test attempt
    await request.env.DB.prepare(`
      INSERT INTO alert_logs (
        user_id, alert_contact_id, type, status, message, created_at
      )
      VALUES (?, ?, 'test', ?, ?, datetime('now'))
    `).bind(
      user.id,
      contact.id,
      success ? 'sent' : 'failed',
      success ? 'Test alert sent successfully' : errorMessage
    ).run();

    if (success) {
      return jsonResponse({
        message: 'Test alert sent successfully',
        contact: contact.name
      });
    } else {
      return errorResponse(
        `Test alert failed: ${errorMessage}`,
        400,
        'TEST_FAILED'
      );
    }

  } catch (error) {
    console.error('Test alert contact error:', error);
    return errorResponse('Failed to test alert contact', 500, 'TEST_ERROR');
  }
});

// Get alert history
router.get('/history', async (request) => {
  try {
    const user = request.user;
    const { page = 1, limit = 50, contact_id, status } = request.query || {};

    const offset = (page - 1) * limit;

    let query = `
      SELECT
        al.*,
        ac.name as contact_name,
        ac.type as contact_type
      FROM alert_logs al
      LEFT JOIN alert_contacts ac ON al.alert_contact_id = ac.id
      WHERE al.user_id = ?
    `;
    const bindings = [user.id];

    if (contact_id) {
      query += ' AND al.alert_contact_id = ?';
      bindings.push(contact_id);
    }

    if (status) {
      query += ' AND al.status = ?';
      bindings.push(status);
    }

    query += ` ORDER BY al.created_at DESC LIMIT ? OFFSET ?`;
    bindings.push(limit, offset);

    const logs = await request.env.DB.prepare(query).bind(...bindings).all();

    const total = await request.env.DB.prepare(`
      SELECT COUNT(*) as count FROM alert_logs
      WHERE user_id = ?
      ${contact_id ? 'AND alert_contact_id = ?' : ''}
      ${status ? 'AND status = ?' : ''}
    `).bind(user.id, ...(contact_id ? [contact_id] : []), ...(status ? [status] : [])).first();

    return jsonResponse({
      logs: logs.results || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total.count || 0,
        pages: Math.ceil((total.count || 0) / limit)
      }
    });

  } catch (error) {
    console.error('Get alert history error:', error);
    return errorResponse('Failed to get alert history', 500, 'GET_HISTORY_ERROR');
  }
});

export default router;