/**
 * MUHAR STUDIO — SQLite Database Manager
 * Embedded persistence for studio inquiries with automatic schema initialization
 * and full administrative query capabilities.
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('./config');

// Ensure data directory exists
const dbDir = path.dirname(config.databasePath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Connect to SQLite
const db = new Database(config.databasePath);

// Enable Write-Ahead Logging (WAL) for high performance & concurrency
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');

// Initialize schema (Existing inquiries + AI Voice Receptionist tables)
db.exec(`
  CREATE TABLE IF NOT EXISTS inquiries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,                -- 'consultation' or 'contact'
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    project_type TEXT,
    budget TEXT,
    message TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    status TEXT DEFAULT 'new',         -- 'new', 'contacted', 'archived'
    email_sent INTEGER DEFAULT 0,      -- 1 if notification sent, 0 otherwise
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_inquiries_created_at ON inquiries(created_at);
  CREATE INDEX IF NOT EXISTS idx_inquiries_type ON inquiries(type);
  CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(status);

  -- 1. Businesses
  CREATE TABLE IF NOT EXISTS businesses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    status TEXT NOT NULL DEFAULT 'active',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_businesses_status ON businesses(status);

  -- 2. Voice Agents
  CREATE TABLE IF NOT EXISTS voice_agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    provider TEXT NOT NULL,
    provider_agent_id TEXT,
    name TEXT NOT NULL,
    language TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_voice_agents_business_id ON voice_agents(business_id);

  -- 3. Phone Numbers
  CREATE TABLE IF NOT EXISTS phone_numbers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    voice_agent_id INTEGER,
    phone_number TEXT NOT NULL,
    provider TEXT NOT NULL,
    provider_phone_id TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    FOREIGN KEY (voice_agent_id) REFERENCES voice_agents(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_phone_numbers_business_id ON phone_numbers(business_id);
  CREATE INDEX IF NOT EXISTS idx_phone_numbers_phone_number ON phone_numbers(phone_number);

  -- 4. Calls
  CREATE TABLE IF NOT EXISTS calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    voice_agent_id INTEGER,
    phone_number_id INTEGER,
    provider TEXT NOT NULL,
    provider_call_id TEXT,
    direction TEXT NOT NULL DEFAULT 'inbound',
    caller_number TEXT,
    called_number TEXT,
    status TEXT NOT NULL DEFAULT 'initiated',
    started_at DATETIME,
    ended_at DATETIME,
    duration_seconds INTEGER,
    recording_url TEXT,
    transcript TEXT,
    summary TEXT,
    intent TEXT,
    outcome TEXT,
    lead_score INTEGER,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    FOREIGN KEY (voice_agent_id) REFERENCES voice_agents(id) ON DELETE SET NULL,
    FOREIGN KEY (phone_number_id) REFERENCES phone_numbers(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_calls_business_id ON calls(business_id);
  CREATE INDEX IF NOT EXISTS idx_calls_provider_call_id ON calls(provider_call_id);
  CREATE INDEX IF NOT EXISTS idx_calls_caller_number ON calls(caller_number);
  CREATE INDEX IF NOT EXISTS idx_calls_created_at ON calls(created_at);

  -- 5. Call Events
  CREATE TABLE IF NOT EXISTS call_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    call_id INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    provider_event_id TEXT,
    payload TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (call_id) REFERENCES calls(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_call_events_call_id ON call_events(call_id);
  CREATE INDEX IF NOT EXISTS idx_call_events_provider_event_id ON call_events(provider_event_id);

  -- 6. Business Settings (Key-Value metadata per business: fallback numbers, operating hours, etc.)
  CREATE TABLE IF NOT EXISTS business_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    UNIQUE(business_id, key)
  );

  CREATE INDEX IF NOT EXISTS idx_business_settings_business_id ON business_settings(business_id);
  CREATE INDEX IF NOT EXISTS idx_business_settings_key ON business_settings(key);
`);

// Idempotent initial seed for default studio business
const existingBusiness = db.prepare("SELECT id FROM businesses WHERE name = 'MUHAR STUDIO' LIMIT 1").get();
if (!existingBusiness) {
  db.prepare(`
    INSERT INTO businesses (name, timezone, status)
    VALUES ('MUHAR STUDIO', 'Asia/Kolkata', 'active')
  `).run();
}

/**
 * Save a new inquiry to the database
 * @param {Object} data
 * @returns {Object} Inserted record info
 */
function saveInquiry(data) {
  const stmt = db.prepare(`
    INSERT INTO inquiries (
      type, name, email, phone, project_type, budget, message, ip_address, user_agent, email_sent
    ) VALUES (
      @type, @name, @email, @phone, @project_type, @budget, @message, @ip_address, @user_agent, @email_sent
    )
  `);

  const info = stmt.run({
    type: data.type || 'consultation',
    name: data.name,
    email: data.email,
    phone: data.phone || null,
    project_type: data.projectType || null,
    budget: data.budget || null,
    message: data.message,
    ip_address: data.ipAddress || null,
    user_agent: data.userAgent || null,
    email_sent: data.emailSent ? 1 : 0
  });

  return { id: info.lastInsertRowid, ...data };
}

/**
 * Update email notification status
 * @param {number} id 
 * @param {boolean} sent 
 */
function updateEmailStatus(id, sent) {
  const stmt = db.prepare(`UPDATE inquiries SET email_sent = ? WHERE id = ?`);
  stmt.run(sent ? 1 : 0, id);
}

/**
 * Update inquiry status ('new', 'contacted', 'archived')
 * @param {number} id
 * @param {string} status
 * @returns {Object|null} Updated inquiry record
 */
function updateInquiryStatus(id, status) {
  const validStatuses = ['new', 'contacted', 'archived'];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status '${status}'. Must be one of: ${validStatuses.join(', ')}`);
  }

  const stmt = db.prepare(`UPDATE inquiries SET status = ? WHERE id = ?`);
  const info = stmt.run(status, id);

  if (info.changes === 0) return null;
  return getInquiryById(id);
}

/**
 * Delete an inquiry by ID
 * @param {number} id
 * @returns {boolean}
 */
function deleteInquiry(id) {
  const stmt = db.prepare(`DELETE FROM inquiries WHERE id = ?`);
  const info = stmt.run(id);
  return info.changes > 0;
}

/**
 * Retrieve recent inquiries with optional limit
 * @param {Object} [options]
 * @returns {Array}
 */
function getInquiries(options = {}) {
  const limit = options.limit || 50;
  const offset = options.offset || 0;
  const stmt = db.prepare(`
    SELECT * FROM inquiries 
    ORDER BY created_at DESC 
    LIMIT ? OFFSET ?
  `);
  return stmt.all(limit, offset);
}

/**
 * Get inquiry by ID
 * @param {number} id
 * @returns {Object|null}
 */
function getInquiryById(id) {
  const stmt = db.prepare(`SELECT * FROM inquiries WHERE id = ?`);
  return stmt.get(id) || null;
}

/**
 * Filter and search inquiries for Admin Dashboard
 * @param {Object} params { type, status, sort, search, limit, offset }
 * @returns {{ inquiries: Array, total: number }}
 */
function getFilteredInquiries(params = {}) {
  const {
    type,
    status,
    sort = 'newest',
    search,
    limit = 50,
    offset = 0
  } = params;

  let query = `SELECT * FROM inquiries WHERE 1=1`;
  let countQuery = `SELECT COUNT(*) AS count FROM inquiries WHERE 1=1`;
  const bindings = {};

  if (type && type !== 'all') {
    query += ` AND type = @type`;
    countQuery += ` AND type = @type`;
    bindings.type = type;
  }

  if (status && status !== 'all') {
    query += ` AND status = @status`;
    countQuery += ` AND status = @status`;
    bindings.status = status;
  }

  if (search && typeof search === 'string' && search.trim() !== '') {
    query += ` AND (name LIKE @search OR email LIKE @search OR message LIKE @search OR phone LIKE @search)`;
    countQuery += ` AND (name LIKE @search OR email LIKE @search OR message LIKE @search OR phone LIKE @search)`;
    bindings.search = `%${search.trim()}%`;
  }

  // Sorting
  if (sort === 'oldest') {
    query += ` ORDER BY created_at ASC`;
  } else {
    query += ` ORDER BY created_at DESC`;
  }

  query += ` LIMIT @limit OFFSET @offset`;
  bindings.limit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  bindings.offset = Math.max(parseInt(offset, 10) || 0, 0);

  const inquiries = db.prepare(query).all(bindings);
  
  // Clean bindings for count query
  const countBindings = { ...bindings };
  delete countBindings.limit;
  delete countBindings.offset;
  const countRow = db.prepare(countQuery).get(countBindings);

  return {
    inquiries,
    total: countRow ? countRow.count : 0
  };
}

/**
 * Calculate statistical overview for Admin Dashboard KPI cards
 * @returns {Object}
 */
function getInquiryStats() {
  const totalRow = db.prepare(`SELECT COUNT(*) AS total FROM inquiries`).get();
  const newRow = db.prepare(`SELECT COUNT(*) AS count FROM inquiries WHERE status = 'new'`).get();
  const contactedRow = db.prepare(`SELECT COUNT(*) AS count FROM inquiries WHERE status = 'contacted'`).get();
  const archivedRow = db.prepare(`SELECT COUNT(*) AS count FROM inquiries WHERE status = 'archived'`).get();
  const consultationRow = db.prepare(`SELECT COUNT(*) AS count FROM inquiries WHERE type = 'consultation'`).get();
  const contactRow = db.prepare(`SELECT COUNT(*) AS count FROM inquiries WHERE type = 'contact'`).get();

  return {
    total: totalRow ? totalRow.total : 0,
    new: newRow ? newRow.count : 0,
    contacted: contactedRow ? contactedRow.count : 0,
    archived: archivedRow ? archivedRow.count : 0,
    consultations: consultationRow ? consultationRow.count : 0,
    contacts: contactRow ? contactRow.count : 0
  };
}

/**
 * Get business by ID
 * @param {number} id
 * @returns {Object|null}
 */
function getBusinessById(id) {
  const stmt = db.prepare('SELECT * FROM businesses WHERE id = ?');
  return stmt.get(id) || null;
}

/**
 * Get business by Name
 * @param {string} name
 * @returns {Object|null}
 */
function getBusinessByName(name) {
  const stmt = db.prepare('SELECT * FROM businesses WHERE name = ?');
  return stmt.get(name) || null;
}

/**
 * Get single business setting value
 * @param {number} businessId
 * @param {string} key
 * @param {any} [defaultValue=null]
 * @returns {string|null}
 */
function getBusinessSetting(businessId, key, defaultValue = null) {
  const stmt = db.prepare('SELECT value FROM business_settings WHERE business_id = ? AND key = ?');
  const row = stmt.get(businessId, key);
  return row ? row.value : defaultValue;
}

/**
 * Get all settings for a business as a key-value object
 * @param {number} businessId
 * @returns {Object}
 */
function getBusinessSettings(businessId) {
  const stmt = db.prepare('SELECT key, value FROM business_settings WHERE business_id = ?');
  const rows = stmt.all(businessId);
  const settings = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  return settings;
}

/**
 * Set or update a business setting
 * @param {number} businessId
 * @param {string} key
 * @param {string} value
 * @returns {Object}
 */
function setBusinessSetting(businessId, key, value) {
  const stmt = db.prepare(`
    INSERT INTO business_settings (business_id, key, value, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(business_id, key) DO UPDATE SET
      value = excluded.value,
      updated_at = CURRENT_TIMESTAMP
  `);
  stmt.run(businessId, key, String(value));
  return { businessId, key, value };
}

/**
 * Lookup voice agent by provider and provider agent ID
 * @param {string} provider
 * @param {string} providerAgentId
 * @returns {Object|null}
 */
function getVoiceAgentByProviderId(provider, providerAgentId) {
  const stmt = db.prepare('SELECT * FROM voice_agents WHERE provider = ? AND provider_agent_id = ?');
  return stmt.get(provider, providerAgentId) || null;
}

/**
 * Lookup phone number record
 * @param {string} phoneNumber
 * @returns {Object|null}
 */
function getPhoneNumberRecord(phoneNumber) {
  const stmt = db.prepare('SELECT * FROM phone_numbers WHERE phone_number = ?');
  return stmt.get(phoneNumber) || null;
}

module.exports = {
  db,
  saveInquiry,
  updateEmailStatus,
  updateInquiryStatus,
  deleteInquiry,
  getInquiries,
  getInquiryById,
  getFilteredInquiries,
  getInquiryStats,
  getBusinessById,
  getBusinessByName,
  getBusinessSetting,
  getBusinessSettings,
  setBusinessSetting,
  getVoiceAgentByProviderId,
  getPhoneNumberRecord
};

