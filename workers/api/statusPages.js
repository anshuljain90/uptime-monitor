// Status Pages API routes

import { Router } from 'itty-router';
import { jsonResponse, errorResponse } from '../utils/cors';

const router = Router({ base: '/api/status-pages' });

// Get all status pages for user
router.get('/', async (request) => {
  try {
    const user = request.user;
    const { page = 1, limit = 50 } = request.query || {};

    const offset = (page - 1) * limit;

    const statusPages = await request.env.DB.prepare(`
      SELECT
        sp.*,
        COUNT(spm.monitor_id) as monitor_count,
        (
          SELECT COUNT(*)
          FROM status_page_subscribers sps
          WHERE sps.status_page_id = sp.id AND sps.is_active = 1
        ) as subscriber_count
      FROM status_pages sp
      LEFT JOIN status_page_monitors spm ON sp.id = spm.status_page_id
      WHERE sp.user_id = ? AND sp.is_active = 1
      GROUP BY sp.id
      ORDER BY sp.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(user.id, limit, offset).all();

    const total = await request.env.DB.prepare(`
      SELECT COUNT(*) as count FROM status_pages WHERE user_id = ? AND is_active = 1
    `).bind(user.id).first();

    return jsonResponse({
      statusPages: statusPages.results || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total.count || 0,
        pages: Math.ceil((total.count || 0) / limit)
      }
    });

  } catch (error) {
    console.error('Get status pages error:', error);
    return errorResponse('Failed to get status pages', 500, 'GET_STATUS_PAGES_ERROR');
  }
});

// Create new status page
router.post('/', async (request) => {
  try {
    const user = request.user;
    const {
      name,
      slug,
      description,
      domain,
      theme = 'light',
      is_public = true,
      show_uptime = true,
      show_incident_history = true,
      custom_css = '',
      monitor_ids = []
    } = await request.json();

    // Validation
    if (!name || !slug) {
      return errorResponse('Name and slug are required', 400, 'MISSING_FIELDS');
    }

    // Check if slug is unique
    const existingPage = await request.env.DB.prepare(`
      SELECT id FROM status_pages WHERE slug = ?
    `).bind(slug).first();

    if (existingPage) {
      return errorResponse('Slug already exists', 400, 'SLUG_EXISTS');
    }

    // Create status page
    const result = await request.env.DB.prepare(`
      INSERT INTO status_pages (
        user_id, name, slug, description, domain, theme,
        is_public, show_uptime, show_incident_history, custom_css
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      user.id, name, slug, description, domain, theme,
      is_public ? 1 : 0, show_uptime ? 1 : 0, show_incident_history ? 1 : 0, custom_css
    ).run();

    if (!result.success) {
      return errorResponse('Failed to create status page', 500, 'CREATE_FAILED');
    }

    const statusPageId = result.meta.last_row_id;

    // Add monitors to status page
    if (monitor_ids.length > 0) {
      const monitorQueries = monitor_ids.map(monitorId =>
        request.env.DB.prepare(`
          INSERT INTO status_page_monitors (status_page_id, monitor_id)
          VALUES (?, ?)
        `).bind(statusPageId, monitorId)
      );

      await Promise.all(monitorQueries.map(query => query.run()));
    }

    // Get the created status page with details
    const statusPage = await request.env.DB.prepare(`
      SELECT
        sp.*,
        COUNT(spm.monitor_id) as monitor_count
      FROM status_pages sp
      LEFT JOIN status_page_monitors spm ON sp.id = spm.status_page_id
      WHERE sp.id = ?
      GROUP BY sp.id
    `).bind(statusPageId).first();

    return jsonResponse({
      message: 'Status page created successfully',
      statusPage
    }, 201);

  } catch (error) {
    console.error('Create status page error:', error);
    return errorResponse('Failed to create status page', 500, 'CREATE_ERROR');
  }
});

// Get status page by ID
router.get('/:id', async (request) => {
  try {
    const user = request.user;
    const { id } = request.params;

    const statusPage = await request.env.DB.prepare(`
      SELECT
        sp.*,
        GROUP_CONCAT(spm.monitor_id) as monitor_ids
      FROM status_pages sp
      LEFT JOIN status_page_monitors spm ON sp.id = spm.status_page_id
      WHERE sp.id = ? AND sp.user_id = ? AND sp.is_active = 1
      GROUP BY sp.id
    `).bind(id, user.id).first();

    if (!statusPage) {
      return errorResponse('Status page not found', 404, 'NOT_FOUND');
    }

    // Parse monitor IDs
    statusPage.monitor_ids = statusPage.monitor_ids
      ? statusPage.monitor_ids.split(',').map(id => parseInt(id))
      : [];

    // Get monitors details
    if (statusPage.monitor_ids.length > 0) {
      const monitors = await request.env.DB.prepare(`
        SELECT id, name, url, type FROM monitors
        WHERE id IN (${statusPage.monitor_ids.map(() => '?').join(',')})
        AND user_id = ? AND is_active = 1
      `).bind(...statusPage.monitor_ids, user.id).all();

      statusPage.monitors = monitors.results || [];
    } else {
      statusPage.monitors = [];
    }

    return jsonResponse({ statusPage });

  } catch (error) {
    console.error('Get status page error:', error);
    return errorResponse('Failed to get status page', 500, 'GET_ERROR');
  }
});

// Update status page
router.put('/:id', async (request) => {
  try {
    const user = request.user;
    const { id } = request.params;
    const {
      name,
      slug,
      description,
      domain,
      theme,
      is_public,
      show_uptime,
      show_incident_history,
      custom_css,
      monitor_ids
    } = await request.json();

    // Check if status page exists
    const existingPage = await request.env.DB.prepare(`
      SELECT id FROM status_pages WHERE id = ? AND user_id = ? AND is_active = 1
    `).bind(id, user.id).first();

    if (!existingPage) {
      return errorResponse('Status page not found', 404, 'NOT_FOUND');
    }

    // Check slug uniqueness if changed
    if (slug) {
      const slugExists = await request.env.DB.prepare(`
        SELECT id FROM status_pages WHERE slug = ? AND id != ?
      `).bind(slug, id).first();

      if (slugExists) {
        return errorResponse('Slug already exists', 400, 'SLUG_EXISTS');
      }
    }

    // Build update query
    const updates = [];
    const bindings = [];

    if (name !== undefined) { updates.push('name = ?'); bindings.push(name); }
    if (slug !== undefined) { updates.push('slug = ?'); bindings.push(slug); }
    if (description !== undefined) { updates.push('description = ?'); bindings.push(description); }
    if (domain !== undefined) { updates.push('domain = ?'); bindings.push(domain); }
    if (theme !== undefined) { updates.push('theme = ?'); bindings.push(theme); }
    if (is_public !== undefined) { updates.push('is_public = ?'); bindings.push(is_public ? 1 : 0); }
    if (show_uptime !== undefined) { updates.push('show_uptime = ?'); bindings.push(show_uptime ? 1 : 0); }
    if (show_incident_history !== undefined) { updates.push('show_incident_history = ?'); bindings.push(show_incident_history ? 1 : 0); }
    if (custom_css !== undefined) { updates.push('custom_css = ?'); bindings.push(custom_css); }

    if (updates.length > 0) {
      updates.push('updated_at = datetime("now")');
      bindings.push(id);

      const query = `UPDATE status_pages SET ${updates.join(', ')} WHERE id = ?`;
      await request.env.DB.prepare(query).bind(...bindings).run();
    }

    // Update monitors if provided
    if (monitor_ids !== undefined) {
      // Remove existing monitors
      await request.env.DB.prepare(`
        DELETE FROM status_page_monitors WHERE status_page_id = ?
      `).bind(id).run();

      // Add new monitors
      if (monitor_ids.length > 0) {
        const monitorQueries = monitor_ids.map(monitorId =>
          request.env.DB.prepare(`
            INSERT INTO status_page_monitors (status_page_id, monitor_id)
            VALUES (?, ?)
          `).bind(id, monitorId)
        );

        await Promise.all(monitorQueries.map(query => query.run()));
      }
    }

    return jsonResponse({ message: 'Status page updated successfully' });

  } catch (error) {
    console.error('Update status page error:', error);
    return errorResponse('Failed to update status page', 500, 'UPDATE_ERROR');
  }
});

// Delete status page
router.delete('/:id', async (request) => {
  try {
    const user = request.user;
    const { id } = request.params;

    // Check if status page exists
    const statusPage = await request.env.DB.prepare(`
      SELECT id FROM status_pages WHERE id = ? AND user_id = ? AND is_active = 1
    `).bind(id, user.id).first();

    if (!statusPage) {
      return errorResponse('Status page not found', 404, 'NOT_FOUND');
    }

    // Soft delete
    await request.env.DB.prepare(`
      UPDATE status_pages SET is_active = 0, updated_at = datetime('now') WHERE id = ?
    `).bind(id).run();

    // Remove monitor associations
    await request.env.DB.prepare(`
      DELETE FROM status_page_monitors WHERE status_page_id = ?
    `).bind(id).run();

    // Deactivate subscribers
    await request.env.DB.prepare(`
      UPDATE status_page_subscribers SET is_active = 0 WHERE status_page_id = ?
    `).bind(id).run();

    return jsonResponse({ message: 'Status page deleted successfully' });

  } catch (error) {
    console.error('Delete status page error:', error);
    return errorResponse('Failed to delete status page', 500, 'DELETE_ERROR');
  }
});

export default router;