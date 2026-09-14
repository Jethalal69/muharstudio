/**
 * MUHAR STUDIO — Unified Database Persistence Layer
 * Supports PostgreSQL (Vercel Serverless / Cloud DB like Neon/Supabase)
 * with automatic fallback to local SQLite for development & offline testing.
 */

const fs = require('fs');
const path = require('path');
const config = require('./config');

let isPostgres = config.isPostgres;
let pgPool = null;
let sqliteDb = null;
let initPromise = null;

// ============================================================================
// 1. INITIALIZATION & SCHEMA DEFINITION
// ============================================================================

if (isPostgres) {
  const { Pool } = require('pg');
  const needsSsl = !config.databaseUrl.includes('localhost') && !config.databaseUrl.includes('127.0.0.1');

  pgPool = new Pool({
    connectionString: config.databaseUrl,
    ssl: needsSsl ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });

  initPromise = initPostgresSchema();
} else {
  const Database = require('better-sqlite3');
  const dbDir = path.dirname(config.databasePath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  sqliteDb = new Database(config.databasePath);
  sqliteDb.pragma('journal_mode = WAL');
  sqliteDb.pragma('synchronous = NORMAL');
  sqliteDb.pragma('foreign_keys = ON');

  initSqliteSchema();
}

/**
 * Initialize SQLite Schema
 */
function initSqliteSchema() {
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS inquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      project_type TEXT,
      budget TEXT,
      message TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      status TEXT DEFAULT 'new',
      email_sent INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_inquiries_created_at ON inquiries(created_at);
    CREATE INDEX IF NOT EXISTS idx_inquiries_type ON inquiries(type);
    CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(status);

    CREATE TABLE IF NOT EXISTS businesses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
      status TEXT NOT NULL DEFAULT 'active',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_businesses_status ON businesses(status);

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

  const existingBusiness = sqliteDb.prepare("SELECT id FROM businesses WHERE name = 'MUHAR STUDIO' LIMIT 1").get();
  if (!existingBusiness) {
    sqliteDb.prepare(`
      INSERT INTO businesses (name, timezone, status)
      VALUES ('MUHAR STUDIO', 'Asia/Kolkata', 'active')
    `).run();
  }
}

/**
 * Initialize PostgreSQL Schema
 */
async function initPostgresSchema() {
  const client = await pgPool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS inquiries (
        id SERIAL PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        project_type VARCHAR(100),
        budget VARCHAR(100),
        message TEXT NOT NULL,
        ip_address VARCHAR(100),
        user_agent TEXT,
        status VARCHAR(50) DEFAULT 'new',
        email_sent INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_inquiries_created_at ON inquiries(created_at);
      CREATE INDEX IF NOT EXISTS idx_inquiries_type ON inquiries(type);
      CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(status);

      CREATE TABLE IF NOT EXISTS businesses (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        timezone VARCHAR(100) DEFAULT 'Asia/Kolkata',
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_businesses_status ON businesses(status);

      CREATE TABLE IF NOT EXISTS voice_agents (
        id SERIAL PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        provider VARCHAR(50) NOT NULL,
        provider_agent_id VARCHAR(255),
        name VARCHAR(255) NOT NULL,
        language VARCHAR(50),
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_voice_agents_business_id ON voice_agents(business_id);

      CREATE TABLE IF NOT EXISTS phone_numbers (
        id SERIAL PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        voice_agent_id INTEGER REFERENCES voice_agents(id) ON DELETE SET NULL,
        phone_number VARCHAR(50) NOT NULL,
        provider VARCHAR(50) NOT NULL,
        provider_phone_id VARCHAR(255),
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_phone_numbers_business_id ON phone_numbers(business_id);
      CREATE INDEX IF NOT EXISTS idx_phone_numbers_phone_number ON phone_numbers(phone_number);

      CREATE TABLE IF NOT EXISTS calls (
        id SERIAL PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        voice_agent_id INTEGER REFERENCES voice_agents(id) ON DELETE SET NULL,
        phone_number_id INTEGER REFERENCES phone_numbers(id) ON DELETE SET NULL,
        provider VARCHAR(50) NOT NULL,
        provider_call_id VARCHAR(255),
        direction VARCHAR(50) DEFAULT 'inbound',
        caller_number VARCHAR(50),
        called_number VARCHAR(50),
        status VARCHAR(50) DEFAULT 'initiated',
        started_at TIMESTAMPTZ,
        ended_at TIMESTAMPTZ,
        duration_seconds INTEGER,
        recording_url TEXT,
        transcript TEXT,
        summary TEXT,
        intent VARCHAR(100),
        outcome VARCHAR(100),
        lead_score INTEGER,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_calls_business_id ON calls(business_id);
      CREATE INDEX IF NOT EXISTS idx_calls_provider_call_id ON calls(provider_call_id);
      CREATE INDEX IF NOT EXISTS idx_calls_caller_number ON calls(caller_number);
      CREATE INDEX IF NOT EXISTS idx_calls_created_at ON calls(created_at);

      CREATE TABLE IF NOT EXISTS call_events (
        id SERIAL PRIMARY KEY,
        call_id INTEGER NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
        event_type VARCHAR(100) NOT NULL,
        provider_event_id VARCHAR(255),
        payload TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_call_events_call_id ON call_events(call_id);
      CREATE INDEX IF NOT EXISTS idx_call_events_provider_event_id ON call_events(provider_event_id);

      CREATE TABLE IF NOT EXISTS business_settings (
        id SERIAL PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        key VARCHAR(255) NOT NULL,
        value TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(business_id, key)
      );

      CREATE INDEX IF NOT EXISTS idx_business_settings_business_id ON business_settings(business_id);
      CREATE INDEX IF NOT EXISTS idx_business_settings_key ON business_settings(key);
    `);

    const res = await client.query("SELECT id FROM businesses WHERE name = 'MUHAR STUDIO' LIMIT 1");
    if (res.rows.length === 0) {
      await client.query(`
        INSERT INTO businesses (name, timezone, status)
        VALUES ('MUHAR STUDIO', 'Asia/Kolkata', 'active')
      `);
    }
  } catch (err) {
    console.error('[Database Init Error - PostgreSQL]', err.message);
  } finally {
    client.release();
  }
}

/**
 * Ensure database is initialized before executing query
 */
async function ensureInit() {
  if (isPostgres && initPromise) {
    await initPromise;
  }
}

// ============================================================================
// 2. UNIFIED INQUIRY OPERATIONS
// ============================================================================

/**
 * Save a new inquiry
 * @param {Object} data
 * @returns {Promise<Object>} Inserted record info
 */
async function saveInquiry(data) {
  await ensureInit();

  if (isPostgres) {
    const query = `
      INSERT INTO inquiries (
        type, name, email, phone, project_type, budget, message, ip_address, user_agent, email_sent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, type, name, email, phone, project_type, budget, message, ip_address, user_agent, status, email_sent, created_at
    `;
    const values = [
      data.type || 'consultation',
      data.name,
      data.email,
      data.phone || null,
      data.projectType || null,
      data.budget || null,
      data.message,
      data.ipAddress || null,
      data.userAgent || null,
      data.emailSent ? 1 : 0
    ];
    const res = await pgPool.query(query, values);
    const row = res.rows[0];
    return { id: row.id, ...data };
  } else {
    const stmt = sqliteDb.prepare(`
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
}

/**
 * Update email notification status
 * @param {number} id
 * @param {boolean} sent
 */
async function updateEmailStatus(id, sent) {
  await ensureInit();

  if (isPostgres) {
    await pgPool.query('UPDATE inquiries SET email_sent = $1 WHERE id = $2', [sent ? 1 : 0, id]);
  } else {
    const stmt = sqliteDb.prepare('UPDATE inquiries SET email_sent = ? WHERE id = ?');
    stmt.run(sent ? 1 : 0, id);
  }
}

/**
 * Update inquiry status ('new', 'contacted', 'archived')
 * @param {number} id
 * @param {string} status
 * @returns {Promise<Object|null>}
 */
async function updateInquiryStatus(id, status) {
  await ensureInit();

  const validStatuses = ['new', 'contacted', 'archived'];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status '${status}'. Must be one of: ${validStatuses.join(', ')}`);
  }

  if (isPostgres) {
    const res = await pgPool.query('UPDATE inquiries SET status = $1 WHERE id = $2 RETURNING *', [status, id]);
    return res.rows[0] || null;
  } else {
    const stmt = sqliteDb.prepare('UPDATE inquiries SET status = ? WHERE id = ?');
    const info = stmt.run(status, id);
    if (info.changes === 0) return null;
    return getInquiryById(id);
  }
}

/**
 * Delete an inquiry by ID
 * @param {number} id
 * @returns {Promise<boolean>}
 */
async function deleteInquiry(id) {
  await ensureInit();

  if (isPostgres) {
    const res = await pgPool.query('DELETE FROM inquiries WHERE id = $1', [id]);
    return (res.rowCount || 0) > 0;
  } else {
    const stmt = sqliteDb.prepare('DELETE FROM inquiries WHERE id = ?');
    const info = stmt.run(id);
    return info.changes > 0;
  }
}

/**
 * Retrieve inquiries with limit and offset
 * @param {Object} [options]
 * @returns {Promise<Array>}
 */
async function getInquiries(options = {}) {
  await ensureInit();

  const limit = options.limit || 50;
  const offset = options.offset || 0;

  if (isPostgres) {
    const res = await pgPool.query('SELECT * FROM inquiries ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
    return res.rows;
  } else {
    const stmt = sqliteDb.prepare('SELECT * FROM inquiries ORDER BY created_at DESC LIMIT ? OFFSET ?');
    return stmt.all(limit, offset);
  }
}

/**
 * Get inquiry by ID
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
async function getInquiryById(id) {
  await ensureInit();

  if (isPostgres) {
    const res = await pgPool.query('SELECT * FROM inquiries WHERE id = $1', [id]);
    return res.rows[0] || null;
  } else {
    const stmt = sqliteDb.prepare('SELECT * FROM inquiries WHERE id = ?');
    return stmt.get(id) || null;
  }
}

/**
 * Filter and search inquiries for Admin Dashboard
 * @param {Object} params { type, status, sort, search, limit, offset }
 * @returns {Promise<{ inquiries: Array, total: number }>}
 */
async function getFilteredInquiries(params = {}) {
  await ensureInit();

  const {
    type,
    status,
    sort = 'newest',
    search,
    limit = 50,
    offset = 0
  } = params;

  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);

  if (isPostgres) {
    let whereClauses = [];
    let values = [];
    let valIdx = 1;

    if (type && type !== 'all') {
      whereClauses.push(`type = $${valIdx++}`);
      values.push(type);
    }

    if (status && status !== 'all') {
      whereClauses.push(`status = $${valIdx++}`);
      values.push(status);
    }

    if (search && typeof search === 'string' && search.trim() !== '') {
      whereClauses.push(`(name ILIKE $${valIdx} OR email ILIKE $${valIdx} OR message ILIKE $${valIdx} OR phone ILIKE $${valIdx})`);
      values.push(`%${search.trim()}%`);
      valIdx++;
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const orderSql = sort === 'oldest' ? 'ORDER BY created_at ASC' : 'ORDER BY created_at DESC';

    const countQuery = `SELECT COUNT(*) AS count FROM inquiries ${whereSql}`;
    const countRes = await pgPool.query(countQuery, values);
    const total = parseInt(countRes.rows[0].count, 10) || 0;

    const dataQuery = `SELECT * FROM inquiries ${whereSql} ${orderSql} LIMIT $${valIdx++} OFFSET $${valIdx++}`;
    const dataValues = [...values, parsedLimit, parsedOffset];
    const dataRes = await pgPool.query(dataQuery, dataValues);

    return {
      inquiries: dataRes.rows,
      total
    };
  } else {
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

    if (sort === 'oldest') {
      query += ` ORDER BY created_at ASC`;
    } else {
      query += ` ORDER BY created_at DESC`;
    }

    query += ` LIMIT @limit OFFSET @offset`;
    bindings.limit = parsedLimit;
    bindings.offset = parsedOffset;

    const inquiries = sqliteDb.prepare(query).all(bindings);

    const countBindings = { ...bindings };
    delete countBindings.limit;
    delete countBindings.offset;
    const countRow = sqliteDb.prepare(countQuery).get(countBindings);

    return {
      inquiries,
      total: countRow ? countRow.count : 0
    };
  }
}

/**
 * Calculate statistical overview for Admin Dashboard KPI cards
 * @returns {Promise<Object>}
 */
async function getInquiryStats() {
  await ensureInit();

  if (isPostgres) {
    const query = `
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'new') AS new,
        COUNT(*) FILTER (WHERE status = 'contacted') AS contacted,
        COUNT(*) FILTER (WHERE status = 'archived') AS archived,
        COUNT(*) FILTER (WHERE type = 'consultation') AS consultations,
        COUNT(*) FILTER (WHERE type = 'contact') AS contacts
      FROM inquiries
    `;
    const res = await pgPool.query(query);
    const row = res.rows[0] || {};

    return {
      total: parseInt(row.total, 10) || 0,
      new: parseInt(row.new, 10) || 0,
      contacted: parseInt(row.contacted, 10) || 0,
      archived: parseInt(row.archived, 10) || 0,
      consultations: parseInt(row.consultations, 10) || 0,
      contacts: parseInt(row.contacts, 10) || 0
    };
  } else {
    const totalRow = sqliteDb.prepare(`SELECT COUNT(*) AS total FROM inquiries`).get();
    const newRow = sqliteDb.prepare(`SELECT COUNT(*) AS count FROM inquiries WHERE status = 'new'`).get();
    const contactedRow = sqliteDb.prepare(`SELECT COUNT(*) AS count FROM inquiries WHERE status = 'contacted'`).get();
    const archivedRow = sqliteDb.prepare(`SELECT COUNT(*) AS count FROM inquiries WHERE status = 'archived'`).get();
    const consultationRow = sqliteDb.prepare(`SELECT COUNT(*) AS count FROM inquiries WHERE type = 'consultation'`).get();
    const contactRow = sqliteDb.prepare(`SELECT COUNT(*) AS count FROM inquiries WHERE type = 'contact'`).get();

    return {
      total: totalRow ? totalRow.total : 0,
      new: newRow ? newRow.count : 0,
      contacted: contactedRow ? contactedRow.count : 0,
      archived: archivedRow ? archivedRow.count : 0,
      consultations: consultationRow ? consultationRow.count : 0,
      contacts: contactRow ? contactRow.count : 0
    };
  }
}

// ============================================================================
// 3. BUSINESS & VOICE AGENT LOOKUP HELPERS
// ============================================================================

/**
 * Get business by ID
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
async function getBusinessById(id) {
  await ensureInit();

  if (isPostgres) {
    const res = await pgPool.query('SELECT * FROM businesses WHERE id = $1', [id]);
    return res.rows[0] || null;
  } else {
    const stmt = sqliteDb.prepare('SELECT * FROM businesses WHERE id = ?');
    return stmt.get(id) || null;
  }
}

/**
 * Get business by Name
 * @param {string} name
 * @returns {Promise<Object|null>}
 */
async function getBusinessByName(name) {
  await ensureInit();

  if (isPostgres) {
    const res = await pgPool.query('SELECT * FROM businesses WHERE name = $1', [name]);
    return res.rows[0] || null;
  } else {
    const stmt = sqliteDb.prepare('SELECT * FROM businesses WHERE name = ?');
    return stmt.get(name) || null;
  }
}

/**
 * Get single business setting value
 * @param {number} businessId
 * @param {string} key
 * @param {any} [defaultValue=null]
 * @returns {Promise<string|null>}
 */
async function getBusinessSetting(businessId, key, defaultValue = null) {
  await ensureInit();

  if (isPostgres) {
    const res = await pgPool.query('SELECT value FROM business_settings WHERE business_id = $1 AND key = $2', [businessId, key]);
    return res.rows[0] ? res.rows[0].value : defaultValue;
  } else {
    const stmt = sqliteDb.prepare('SELECT value FROM business_settings WHERE business_id = ? AND key = ?');
    const row = stmt.get(businessId, key);
    return row ? row.value : defaultValue;
  }
}

/**
 * Get all settings for a business as a key-value object
 * @param {number} businessId
 * @returns {Promise<Object>}
 */
async function getBusinessSettings(businessId) {
  await ensureInit();

  if (isPostgres) {
    const res = await pgPool.query('SELECT key, value FROM business_settings WHERE business_id = $1', [businessId]);
    const settings = {};
    for (const row of res.rows) {
      settings[row.key] = row.value;
    }
    return settings;
  } else {
    const stmt = sqliteDb.prepare('SELECT key, value FROM business_settings WHERE business_id = ?');
    const rows = stmt.all(businessId);
    const settings = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    return settings;
  }
}

/**
 * Set or update a business setting
 * @param {number} businessId
 * @param {string} key
 * @param {string} value
 * @returns {Promise<Object>}
 */
async function setBusinessSetting(businessId, key, value) {
  await ensureInit();

  if (isPostgres) {
    const query = `
      INSERT INTO business_settings (business_id, key, value, updated_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT(business_id, key) DO UPDATE SET
        value = EXCLUDED.value,
        updated_at = CURRENT_TIMESTAMP
    `;
    await pgPool.query(query, [businessId, key, String(value)]);
    return { businessId, key, value };
  } else {
    const stmt = sqliteDb.prepare(`
      INSERT INTO business_settings (business_id, key, value, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(business_id, key) DO UPDATE SET
        value = excluded.value,
        updated_at = CURRENT_TIMESTAMP
    `);
    stmt.run(businessId, key, String(value));
    return { businessId, key, value };
  }
}

/**
 * Lookup voice agent by provider and provider agent ID
 * @param {string} provider
 * @param {string} providerAgentId
 * @returns {Promise<Object|null>}
 */
async function getVoiceAgentByProviderId(provider, providerAgentId) {
  await ensureInit();

  if (isPostgres) {
    const res = await pgPool.query('SELECT * FROM voice_agents WHERE provider = $1 AND provider_agent_id = $2', [provider, providerAgentId]);
    return res.rows[0] || null;
  } else {
    const stmt = sqliteDb.prepare('SELECT * FROM voice_agents WHERE provider = ? AND provider_agent_id = ?');
    return stmt.get(provider, providerAgentId) || null;
  }
}

/**
 * Lookup phone number record
 * @param {string} phoneNumber
 * @returns {Promise<Object|null>}
 */
async function getPhoneNumberRecord(phoneNumber) {
  await ensureInit();

  if (isPostgres) {
    const res = await pgPool.query('SELECT * FROM phone_numbers WHERE phone_number = $1', [phoneNumber]);
    return res.rows[0] || null;
  } else {
    const stmt = sqliteDb.prepare('SELECT * FROM phone_numbers WHERE phone_number = ?');
    return stmt.get(phoneNumber) || null;
  }
}

/**
 * Ping database connection for health checks
 * @returns {Promise<boolean>}
 */
async function pingDatabase() {
  try {
    await ensureInit();
    if (isPostgres) {
      const res = await pgPool.query('SELECT 1 AS ok');
      return res.rows.length > 0 && res.rows[0].ok === 1;
    } else {
      const ping = sqliteDb.prepare('SELECT 1 AS ok').get();
      return ping && ping.ok === 1;
    }
  } catch {
    return false;
  }
}

module.exports = {
  get db() {
    return sqliteDb;
  },
  get isPostgres() {
    return isPostgres;
  },
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
  getPhoneNumberRecord,
  pingDatabase
};
