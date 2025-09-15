-- UptimeGuard Database Schema for Cloudflare D1

-- Users table for authentication
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user', 'notify-only')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT 1,
    email_verified BOOLEAN DEFAULT 0,
    last_login DATETIME,
    settings TEXT -- JSON string for user preferences
);

-- Monitors table - core monitoring configuration
CREATE TABLE monitors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('http', 'https', 'ping', 'port', 'keyword', 'ssl', 'heartbeat')),
    url TEXT, -- for HTTP/HTTPS/Keyword monitors
    hostname TEXT, -- for ping monitors
    port INTEGER, -- for port monitors
    keyword TEXT, -- for keyword monitors
    keyword_type TEXT CHECK (keyword_type IN ('exists', 'not_exists')),
    method TEXT DEFAULT 'GET' CHECK (method IN ('GET', 'POST', 'PUT', 'DELETE', 'HEAD')),
    headers TEXT, -- JSON string for custom headers
    body TEXT, -- for POST/PUT requests
    auth_type TEXT CHECK (auth_type IN ('none', 'basic', 'bearer')),
    auth_username TEXT,
    auth_password TEXT,
    auth_token TEXT,
    interval_seconds INTEGER DEFAULT 300 CHECK (interval_seconds IN (30, 60, 300, 600, 1800, 3600)),
    timeout_seconds INTEGER DEFAULT 30,
    retry_count INTEGER DEFAULT 3,
    follow_redirects BOOLEAN DEFAULT 1,
    verify_ssl BOOLEAN DEFAULT 1,
    expected_status_codes TEXT DEFAULT '200-299', -- Range like "200-299" or specific "200,201,302"
    regions TEXT DEFAULT 'auto', -- JSON array of monitoring regions
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Monitor checks - results of individual monitoring attempts
CREATE TABLE monitor_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    monitor_id INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('up', 'down', 'timeout', 'error')),
    response_time_ms INTEGER,
    status_code INTEGER,
    error_message TEXT,
    checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    region TEXT,
    ssl_days_remaining INTEGER, -- for SSL monitors
    keyword_found BOOLEAN, -- for keyword monitors
    FOREIGN KEY (monitor_id) REFERENCES monitors (id) ON DELETE CASCADE
);

-- Incidents - periods of downtime
CREATE TABLE incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    monitor_id INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('investigating', 'identified', 'monitoring', 'resolved')),
    started_at DATETIME NOT NULL,
    resolved_at DATETIME,
    duration_seconds INTEGER,
    cause TEXT,
    impact TEXT CHECK (impact IN ('minor', 'major', 'critical')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (monitor_id) REFERENCES monitors (id) ON DELETE CASCADE
);

-- Alert contacts - notification endpoints
CREATE TABLE alert_contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('email', 'webhook', 'slack', 'discord', 'teams', 'telegram')),
    value TEXT NOT NULL, -- email address, webhook URL, etc.
    settings TEXT, -- JSON for additional settings (Slack channel, etc.)
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Monitor alert contacts - many-to-many relationship
CREATE TABLE monitor_alert_contacts (
    monitor_id INTEGER NOT NULL,
    alert_contact_id INTEGER NOT NULL,
    notify_on_down BOOLEAN DEFAULT 1,
    notify_on_up BOOLEAN DEFAULT 1,
    delay_minutes INTEGER DEFAULT 0,
    PRIMARY KEY (monitor_id, alert_contact_id),
    FOREIGN KEY (monitor_id) REFERENCES monitors (id) ON DELETE CASCADE,
    FOREIGN KEY (alert_contact_id) REFERENCES alert_contacts (id) ON DELETE CASCADE
);

-- Status pages - public status displays
CREATE TABLE status_pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    custom_domain TEXT,
    password_hash TEXT, -- for password-protected pages
    logo_url TEXT,
    favicon_url TEXT,
    brand_color TEXT DEFAULT '#3b82f6',
    theme TEXT DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'auto')),
    timezone TEXT DEFAULT 'UTC',
    layout TEXT DEFAULT 'modern' CHECK (layout IN ('modern', 'compact', 'minimal')),
    show_uptime_percentage BOOLEAN DEFAULT 1,
    show_response_times BOOLEAN DEFAULT 1,
    history_days INTEGER DEFAULT 90 CHECK (history_days IN (7, 30, 90)),
    allow_subscriptions BOOLEAN DEFAULT 1,
    google_analytics_id TEXT,
    custom_css TEXT,
    custom_js TEXT,
    is_public BOOLEAN DEFAULT 1,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Status page monitors - which monitors to show on each status page
CREATE TABLE status_page_monitors (
    status_page_id INTEGER NOT NULL,
    monitor_id INTEGER NOT NULL,
    display_order INTEGER DEFAULT 0,
    show_uptime BOOLEAN DEFAULT 1,
    show_response_time BOOLEAN DEFAULT 1,
    PRIMARY KEY (status_page_id, monitor_id),
    FOREIGN KEY (status_page_id) REFERENCES status_pages (id) ON DELETE CASCADE,
    FOREIGN KEY (monitor_id) REFERENCES monitors (id) ON DELETE CASCADE
);

-- Status page subscribers
CREATE TABLE status_page_subscribers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status_page_id INTEGER NOT NULL,
    email TEXT NOT NULL,
    verified BOOLEAN DEFAULT 0,
    verification_token TEXT,
    subscribed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    unsubscribed_at DATETIME,
    FOREIGN KEY (status_page_id) REFERENCES status_pages (id) ON DELETE CASCADE
);

-- Maintenance windows - scheduled maintenance
CREATE TABLE maintenance_windows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    scheduled_start DATETIME NOT NULL,
    scheduled_end DATETIME NOT NULL,
    actual_start DATETIME,
    actual_end DATETIME,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Maintenance window monitors - which monitors are affected
CREATE TABLE maintenance_window_monitors (
    maintenance_window_id INTEGER NOT NULL,
    monitor_id INTEGER NOT NULL,
    PRIMARY KEY (maintenance_window_id, monitor_id),
    FOREIGN KEY (maintenance_window_id) REFERENCES maintenance_windows (id) ON DELETE CASCADE,
    FOREIGN KEY (monitor_id) REFERENCES monitors (id) ON DELETE CASCADE
);

-- API keys for programmatic access
CREATE TABLE api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    key_hash TEXT UNIQUE NOT NULL,
    key_prefix TEXT NOT NULL, -- first 8 chars for display
    permissions TEXT NOT NULL, -- JSON array of permissions
    last_used_at DATETIME,
    expires_at DATETIME,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Notification logs
CREATE TABLE notification_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    monitor_id INTEGER NOT NULL,
    alert_contact_id INTEGER NOT NULL,
    incident_id INTEGER,
    type TEXT NOT NULL CHECK (type IN ('down', 'up', 'ssl_expiry', 'domain_expiry')),
    status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'bounced')),
    error_message TEXT,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (monitor_id) REFERENCES monitors (id) ON DELETE CASCADE,
    FOREIGN KEY (alert_contact_id) REFERENCES alert_contacts (id) ON DELETE CASCADE,
    FOREIGN KEY (incident_id) REFERENCES incidents (id) ON DELETE SET NULL
);

-- Uptime statistics - pre-calculated for performance
CREATE TABLE uptime_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    monitor_id INTEGER NOT NULL,
    date DATE NOT NULL,
    total_checks INTEGER DEFAULT 0,
    successful_checks INTEGER DEFAULT 0,
    uptime_percentage REAL DEFAULT 100.0,
    avg_response_time_ms REAL,
    min_response_time_ms INTEGER,
    max_response_time_ms INTEGER,
    downtime_seconds INTEGER DEFAULT 0,
    UNIQUE(monitor_id, date),
    FOREIGN KEY (monitor_id) REFERENCES monitors (id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_monitors_user_id ON monitors(user_id);
CREATE INDEX idx_monitors_type ON monitors(type);
CREATE INDEX idx_monitors_active ON monitors(is_active);
CREATE INDEX idx_monitor_checks_monitor_id ON monitor_checks(monitor_id);
CREATE INDEX idx_monitor_checks_checked_at ON monitor_checks(checked_at);
CREATE INDEX idx_monitor_checks_status ON monitor_checks(status);
CREATE INDEX idx_incidents_monitor_id ON incidents(monitor_id);
CREATE INDEX idx_incidents_started_at ON incidents(started_at);
CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_alert_contacts_user_id ON alert_contacts(user_id);
CREATE INDEX idx_status_pages_user_id ON status_pages(user_id);
CREATE INDEX idx_status_pages_slug ON status_pages(slug);
CREATE INDEX idx_status_pages_active ON status_pages(is_active);
CREATE INDEX idx_uptime_stats_monitor_date ON uptime_stats(monitor_id, date);
CREATE INDEX idx_notification_logs_monitor_id ON notification_logs(monitor_id);
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_active ON api_keys(is_active);

-- Views for common queries
CREATE VIEW monitor_status AS
SELECT 
    m.*,
    CASE 
        WHEN mc.status = 'up' THEN 'up'
        WHEN mc.status IS NULL THEN 'unknown'
        ELSE 'down'
    END as current_status,
    mc.response_time_ms as last_response_time,
    mc.checked_at as last_checked_at,
    us.uptime_percentage as uptime_percentage_30d
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
) us ON m.id = us.monitor_id;

-- Trigger to update updated_at timestamps
CREATE TRIGGER update_monitors_updated_at 
    AFTER UPDATE ON monitors 
    FOR EACH ROW 
BEGIN 
    UPDATE monitors SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_incidents_updated_at 
    AFTER UPDATE ON incidents 
    FOR EACH ROW 
BEGIN 
    UPDATE incidents SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_status_pages_updated_at 
    AFTER UPDATE ON status_pages 
    FOR EACH ROW 
BEGIN 
    UPDATE status_pages SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Insert default admin user (password: admin123 - CHANGE THIS!)
INSERT INTO users (username, email, password_hash, salt, role, email_verified) 
VALUES (
    'admin',
    'admin@example.com',
    'sha256_hash_here', -- Replace with actual hash
    'random_salt_here', -- Replace with actual salt
    'admin',
    1
);
