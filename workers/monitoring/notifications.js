// Notification processing functions for alerts and status updates

/**
 * Process pending notifications for monitors that have changed status
 * @param {Object} env - Cloudflare environment object with DB and secrets
 */
export async function processNotifications(env) {
  try {
    console.log('Processing notifications...');

    // Get monitors that need notifications (status changed recently)
    const monitorsNeedingNotification = await env.DB.prepare(`
      SELECT DISTINCT
        m.id,
        m.name,
        m.url,
        m.user_id,
        m.alert_contacts,
        m.alert_settings,
        mc.status as current_status,
        mc.error_message,
        mc.response_time_ms,
        mc.checked_at,
        prev_mc.status as previous_status
      FROM monitors m
      JOIN monitor_checks mc ON m.id = mc.monitor_id
      LEFT JOIN monitor_checks prev_mc ON m.id = prev_mc.monitor_id
        AND prev_mc.checked_at = (
          SELECT MAX(checked_at)
          FROM monitor_checks mc2
          WHERE mc2.monitor_id = m.id AND mc2.checked_at < mc.checked_at
        )
      WHERE mc.checked_at = (
        SELECT MAX(checked_at)
        FROM monitor_checks mc3
        WHERE mc3.monitor_id = m.id
      )
      AND mc.checked_at >= datetime('now', '-10 minutes')
      AND (
        (mc.status = 'down' AND prev_mc.status = 'up') OR
        (mc.status = 'up' AND prev_mc.status = 'down') OR
        prev_mc.status IS NULL
      )
      AND m.alert_contacts IS NOT NULL
      AND m.alert_contacts != ''
    `).all();

    console.log(`Found ${monitorsNeedingNotification.results?.length || 0} monitors needing notifications`);

    for (const monitor of monitorsNeedingNotification.results || []) {
      await processMonitorNotification(monitor, env);
    }

    // Clean up old notification logs (keep last 30 days)
    await env.DB.prepare(`
      DELETE FROM alert_logs
      WHERE created_at < datetime('now', '-30 days')
    `).run();

    console.log('Notifications processing completed');

  } catch (error) {
    console.error('Error processing notifications:', error);
  }
}

/**
 * Process notification for a specific monitor
 * @param {Object} monitor - Monitor object with alert details
 * @param {Object} env - Cloudflare environment object
 */
async function processMonitorNotification(monitor, env) {
  try {
    const alertContactIds = monitor.alert_contacts.split(',').filter(id => id.trim());
    const alertSettings = monitor.alert_settings ? JSON.parse(monitor.alert_settings) : {};

    // Get alert contacts
    if (alertContactIds.length === 0) return;

    const contacts = await env.DB.prepare(`
      SELECT * FROM alert_contacts
      WHERE id IN (${alertContactIds.map(() => '?').join(',')})
      AND is_active = 1 AND is_enabled = 1
    `).bind(...alertContactIds).all();

    if (!contacts.results || contacts.results.length === 0) {
      console.log(`No active alert contacts found for monitor ${monitor.id}`);
      return;
    }

    // Determine notification type
    const isDown = monitor.current_status === 'down';
    const isRecovered = monitor.current_status === 'up' && monitor.previous_status === 'down';

    // Check if we should send notification based on settings
    const shouldNotifyDown = alertSettings.notify_on_down !== false;
    const shouldNotifyUp = alertSettings.notify_on_up !== false;

    if (isDown && !shouldNotifyDown) return;
    if (isRecovered && !shouldNotifyUp) return;

    // Prepare notification message
    const notification = {
      type: isDown ? 'down' : (isRecovered ? 'recovery' : 'status_change'),
      title: isDown
        ? `🚨 ${monitor.name} is DOWN`
        : `✅ ${monitor.name} is back UP`,
      message: formatNotificationMessage(monitor, isDown, isRecovered),
      timestamp: new Date().toISOString(),
      monitor: {
        id: monitor.id,
        name: monitor.name,
        url: monitor.url,
        status: monitor.current_status,
        responseTime: monitor.response_time_ms,
        error: monitor.error_message
      }
    };

    // Send notification to each contact
    for (const contact of contacts.results) {
      try {
        const success = await sendNotification(contact, notification, env);

        // Log the notification attempt
        await env.DB.prepare(`
          INSERT INTO alert_logs (
            user_id, alert_contact_id, monitor_id, type, status, message, created_at
          )
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        `).bind(
          monitor.user_id,
          contact.id,
          monitor.id,
          notification.type,
          success ? 'sent' : 'failed',
          success ? notification.title : 'Failed to send notification'
        ).run();

      } catch (error) {
        console.error(`Failed to send notification to contact ${contact.id}:`, error);

        // Log the failure
        await env.DB.prepare(`
          INSERT INTO alert_logs (
            user_id, alert_contact_id, monitor_id, type, status, message, created_at
          )
          VALUES (?, ?, ?, ?, 'failed', ?, datetime('now'))
        `).bind(
          monitor.user_id,
          contact.id,
          monitor.id,
          notification.type,
          error.message
        ).run();
      }
    }

  } catch (error) {
    console.error(`Error processing notification for monitor ${monitor.id}:`, error);
  }
}

/**
 * Format notification message based on monitor status
 * @param {Object} monitor - Monitor object
 * @param {boolean} isDown - Whether the monitor is down
 * @param {boolean} isRecovered - Whether the monitor has recovered
 * @returns {string} Formatted message
 */
function formatNotificationMessage(monitor, isDown, isRecovered) {
  if (isDown) {
    return `Monitor "${monitor.name}" (${monitor.url}) is currently DOWN.\n\n` +
           `Error: ${monitor.error_message || 'Unknown error'}\n` +
           `Time: ${new Date(monitor.checked_at).toLocaleString()}\n` +
           `Duration: Just detected`;
  } else if (isRecovered) {
    return `Monitor "${monitor.name}" (${monitor.url}) has RECOVERED and is now UP.\n\n` +
           `Response time: ${monitor.response_time_ms}ms\n` +
           `Time: ${new Date(monitor.checked_at).toLocaleString()}`;
  } else {
    return `Monitor "${monitor.name}" (${monitor.url}) status: ${monitor.current_status.toUpperCase()}\n\n` +
           `Response time: ${monitor.response_time_ms}ms\n` +
           `Time: ${new Date(monitor.checked_at).toLocaleString()}`;
  }
}

/**
 * Send notification via specific contact method
 * @param {Object} contact - Alert contact object
 * @param {Object} notification - Notification payload
 * @param {Object} env - Cloudflare environment object
 * @returns {boolean} Success status
 */
async function sendNotification(contact, notification, env) {
  const contactSettings = contact.settings ? JSON.parse(contact.settings) : {};

  switch (contact.type) {
    case 'email':
      return await sendEmailNotification(contact, notification, env);

    case 'webhook':
      return await sendWebhookNotification(contact, notification, contactSettings);

    case 'discord':
      return await sendDiscordNotification(contact, notification, contactSettings);

    case 'slack':
      return await sendSlackNotification(contact, notification, contactSettings);

    case 'telegram':
      return await sendTelegramNotification(contact, notification, contactSettings);

    default:
      console.error(`Unknown contact type: ${contact.type}`);
      return false;
  }
}

/**
 * Send email notification
 * @param {Object} contact - Email contact
 * @param {Object} notification - Notification payload
 * @param {Object} env - Environment with email settings
 * @returns {boolean} Success status
 */
async function sendEmailNotification(contact, notification, env) {
  try {
    // In a real implementation, you would integrate with an email service
    // like SendGrid, AWS SES, or Cloudflare's Email API
    // For now, we'll simulate success
    console.log(`Sending email to ${contact.destination}: ${notification.title}`);
    return true;
  } catch (error) {
    console.error('Email notification error:', error);
    return false;
  }
}

/**
 * Send webhook notification
 * @param {Object} contact - Webhook contact
 * @param {Object} notification - Notification payload
 * @param {Object} settings - Webhook settings
 * @returns {boolean} Success status
 */
async function sendWebhookNotification(contact, notification, settings) {
  try {
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'UptimeMonitor/1.0',
      ...(settings.headers || {})
    };

    // Add authentication if specified
    if (settings.auth_token) {
      headers['Authorization'] = `Bearer ${settings.auth_token}`;
    }

    const response = await fetch(contact.destination, {
      method: settings.method || 'POST',
      headers,
      body: JSON.stringify(notification)
    });

    return response.ok;

  } catch (error) {
    console.error('Webhook notification error:', error);
    return false;
  }
}

/**
 * Send Discord notification
 * @param {Object} contact - Discord webhook contact
 * @param {Object} notification - Notification payload
 * @param {Object} settings - Discord settings
 * @returns {boolean} Success status
 */
async function sendDiscordNotification(contact, notification, settings) {
  try {
    const embed = {
      title: notification.title,
      description: notification.message,
      color: notification.type === 'down' ? 0xff0000 : 0x00ff00,
      timestamp: notification.timestamp,
      fields: [
        {
          name: 'Monitor',
          value: notification.monitor.name,
          inline: true
        },
        {
          name: 'URL',
          value: notification.monitor.url,
          inline: true
        },
        {
          name: 'Status',
          value: notification.monitor.status.toUpperCase(),
          inline: true
        }
      ]
    };

    if (notification.monitor.responseTime) {
      embed.fields.push({
        name: 'Response Time',
        value: `${notification.monitor.responseTime}ms`,
        inline: true
      });
    }

    const payload = {
      embeds: [embed],
      username: settings.username || 'UptimeMonitor'
    };

    const response = await fetch(contact.destination, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    return response.ok;

  } catch (error) {
    console.error('Discord notification error:', error);
    return false;
  }
}

/**
 * Send Slack notification
 * @param {Object} contact - Slack webhook contact
 * @param {Object} notification - Notification payload
 * @param {Object} settings - Slack settings
 * @returns {boolean} Success status
 */
async function sendSlackNotification(contact, notification, settings) {
  try {
    const color = notification.type === 'down' ? 'danger' : 'good';

    const attachment = {
      color,
      title: notification.title,
      text: notification.message,
      ts: Math.floor(Date.now() / 1000),
      fields: [
        {
          title: 'Monitor',
          value: notification.monitor.name,
          short: true
        },
        {
          title: 'URL',
          value: notification.monitor.url,
          short: true
        },
        {
          title: 'Status',
          value: notification.monitor.status.toUpperCase(),
          short: true
        }
      ]
    };

    if (notification.monitor.responseTime) {
      attachment.fields.push({
        title: 'Response Time',
        value: `${notification.monitor.responseTime}ms`,
        short: true
      });
    }

    const payload = {
      attachments: [attachment],
      username: settings.username || 'UptimeMonitor',
      icon_emoji: settings.icon || ':warning:'
    };

    const response = await fetch(contact.destination, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    return response.ok;

  } catch (error) {
    console.error('Slack notification error:', error);
    return false;
  }
}

/**
 * Send Telegram notification
 * @param {Object} contact - Telegram contact
 * @param {Object} notification - Notification payload
 * @param {Object} settings - Telegram settings
 * @returns {boolean} Success status
 */
async function sendTelegramNotification(contact, notification, settings) {
  try {
    const botToken = settings.bot_token;
    const chatId = settings.chat_id;

    if (!botToken || !chatId) {
      console.error('Missing Telegram bot token or chat ID');
      return false;
    }

    const message = `${notification.title}\n\n${notification.message}`;

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
      })
    });

    return response.ok;

  } catch (error) {
    console.error('Telegram notification error:', error);
    return false;
  }
}