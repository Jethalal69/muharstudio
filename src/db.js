/**
 * MUHAR STUDIO — Unified Database Persistence Layer
 * Supports PostgreSQL (Vercel Serverless / Cloud DB like Neon/Supabase)
 * with automatic fallback to local SQLite for development & offline testing.
 */

const fs = require('fs');
const path = require('path');
const config = require('./config');

let pgPool = null;
let sqliteDb = null;
let initPromise = null;
let sqliteInitialized = false;

// ============================================================================
// 1. DYNAMIC ENVIRONMENT & DRIVER HELPERS
// ============================================================================

/**
 * Check dynamically if PostgreSQL is configured via environment variables
 */
function isPostgresConfigured() {
  const url = (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.NEON_DATABASE_URL ||
    process.env.SUPABASE_DATABASE_URL ||
    process.env.PGURI ||
    config.databaseUrl ||
    ''
  ).trim();
  return Boolean(url);
}

/**
 * Get current PostgreSQL connection string
 */
function getDatabaseUrl() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.NEON_DATABASE_URL ||
    process.env.SUPABASE_DATABASE_URL ||
    process.env.PGURI ||
    config.databaseUrl ||
    ''
  ).trim();
}

/**
 * Check if running in a serverless / Vercel cloud environment
 */
function isServerlessEnvironment() {
  return Boolean(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.NOW_REGION ||
    process.env.LAMBDA_TASK_ROOT ||
    config.isVercel
  );
}

/**
 * Lazily obtain or initialize PostgreSQL Pool
 */
function getPool() {
  if (pgPool) return pgPool;

  const dbUrl = getDatabaseUrl();
  if (!dbUrl) return null;

  const { Pool } = require('pg');
  const needsSsl = !dbUrl.includes('localhost') && !dbUrl.includes('127.0.0.1');

  pgPool = new Pool({
    connectionString: dbUrl,
    ssl: needsSsl ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });

  return pgPool;
}

/**
 * Lazily obtain or initialize local SQLite instance (ONLY in local development)
 */
function getSqliteDb() {
  if (sqliteDb) return sqliteDb;

  if (isServerlessEnvironment() || config.isProduction) {
    throw new Error(
      'PostgreSQL connection URL is required in production / Vercel serverless environment. ' +
      'Please configure DATABASE_URL or POSTGRES_URL in your Vercel Project Settings.'
    );
  }

  const Database = require('better-sqlite3');
  const dbDir = path.dirname(config.databasePath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  sqliteDb = new Database(config.databasePath);
  sqliteDb.pragma('journal_mode = WAL');
  sqliteDb.pragma('synchronous = NORMAL');
  sqliteDb.pragma('foreign_keys = ON');

  if (!sqliteInitialized) {
    initSqliteSchema(sqliteDb);
    sqliteInitialized = true;
  }

  return sqliteDb;
}

/**
 * Initialize SQLite Schema
 * @param {Object} [targetDb]
 */
function initSqliteSchema(targetDb) {
  const db = targetDb || sqliteDb;
  db.exec(`
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

  const existingBusiness = db.prepare("SELECT id FROM businesses WHERE name = 'MUHAR STUDIO' LIMIT 1").get();
  if (!existingBusiness) {
    db.prepare(`
      INSERT INTO businesses (name, timezone, status)
      VALUES ('MUHAR STUDIO', 'Asia/Kolkata', 'active')
    `).run();
  }
}

/**
 * Initialize PostgreSQL Schema
 * @param {Object} [pool]
 */
async function initPostgresSchema(pool) {
  const targetPool = pool || getPool();
  if (!targetPool) {
    throw new Error('PostgreSQL Pool is not available for schema initialization.');
  }

  const client = await targetPool.connect();
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
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Ensure database is initialized before executing query
 */
async function ensureInit() {
  if (isPostgresConfigured()) {
    const pool = getPool();
    if (!pool) {
      throw new Error('PostgreSQL database URL is not configured. Please set DATABASE_URL.');
    }
    if (!initPromise) {
      initPromise = initPostgresSchema(pool).catch(err => {
        initPromise = null;
        throw err;
      });
    }
    await initPromise;
  } else {
    getSqliteDb();
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

  if (isPostgresConfigured()) {
    const pool = getPool();
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
    const res = await pool.query(query, values);
    const row = res.rows[0];
    return { id: row.id, ...data };
  } else {
    const sqlite = getSqliteDb();
    const stmt = sqlite.prepare(`
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

  if (isPostgresConfigured()) {
    const pool = getPool();
    await pool.query('UPDATE inquiries SET email_sent = $1 WHERE id = $2', [sent ? 1 : 0, id]);
  } else {
    const sqlite = getSqliteDb();
    const stmt = sqlite.prepare('UPDATE inquiries SET email_sent = ? WHERE id = ?');
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

  if (isPostgresConfigured()) {
    const pool = getPool();
    const res = await pool.query('UPDATE inquiries SET status = $1 WHERE id = $2 RETURNING *', [status, id]);
    return res.rows[0] || null;
  } else {
    const sqlite = getSqliteDb();
    const stmt = sqlite.prepare('UPDATE inquiries SET status = ? WHERE id = ?');
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

  if (isPostgresConfigured()) {
    const pool = getPool();
    const res = await pool.query('DELETE FROM inquiries WHERE id = $1', [id]);
    return (res.rowCount || 0) > 0;
  } else {
    const sqlite = getSqliteDb();
    const stmt = sqlite.prepare('DELETE FROM inquiries WHERE id = ?');
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

  if (isPostgresConfigured()) {
    const pool = getPool();
    const res = await pool.query('SELECT * FROM inquiries ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
    return res.rows;
  } else {
    const sqlite = getSqliteDb();
    const stmt = sqlite.prepare('SELECT * FROM inquiries ORDER BY created_at DESC LIMIT ? OFFSET ?');
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

  if (isPostgresConfigured()) {
    const pool = getPool();
    const res = await pool.query('SELECT * FROM inquiries WHERE id = $1', [id]);
    return res.rows[0] || null;
  } else {
    const sqlite = getSqliteDb();
    const stmt = sqlite.prepare('SELECT * FROM inquiries WHERE id = ?');
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

  if (isPostgresConfigured()) {
    const pool = getPool();
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
    const countRes = await pool.query(countQuery, values);
    const total = parseInt(countRes.rows[0].count, 10) || 0;

    const dataQuery = `SELECT * FROM inquiries ${whereSql} ${orderSql} LIMIT $${valIdx++} OFFSET $${valIdx++}`;
    const dataValues = [...values, parsedLimit, parsedOffset];
    const dataRes = await pool.query(dataQuery, dataValues);

    return {
      inquiries: dataRes.rows,
      total
    };
  } else {
    const sqlite = getSqliteDb();
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

    const inquiries = sqlite.prepare(query).all(bindings);

    const countBindings = { ...bindings };
    delete countBindings.limit;
    delete countBindings.offset;
    const countRow = sqlite.prepare(countQuery).get(countBindings);

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

  if (isPostgresConfigured()) {
    const pool = getPool();
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
    const res = await pool.query(query);
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
    const sqlite = getSqliteDb();
    const totalRow = sqlite.prepare(`SELECT COUNT(*) AS total FROM inquiries`).get();
    const newRow = sqlite.prepare(`SELECT COUNT(*) AS count FROM inquiries WHERE status = 'new'`).get();
    const contactedRow = sqlite.prepare(`SELECT COUNT(*) AS count FROM inquiries WHERE status = 'contacted'`).get();
    const archivedRow = sqlite.prepare(`SELECT COUNT(*) AS count FROM inquiries WHERE status = 'archived'`).get();
    const consultationRow = sqlite.prepare(`SELECT COUNT(*) AS count FROM inquiries WHERE type = 'consultation'`).get();
    const contactRow = sqlite.prepare(`SELECT COUNT(*) AS count FROM inquiries WHERE type = 'contact'`).get();

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

  if (isPostgresConfigured()) {
    const pool = getPool();
    const res = await pool.query('SELECT * FROM businesses WHERE id = $1', [id]);
    return res.rows[0] || null;
  } else {
    const sqlite = getSqliteDb();
    const stmt = sqlite.prepare('SELECT * FROM businesses WHERE id = ?');
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

  if (isPostgresConfigured()) {
    const pool = getPool();
    const res = await pool.query('SELECT * FROM businesses WHERE name = $1', [name]);
    return res.rows[0] || null;
  } else {
    const sqlite = getSqliteDb();
    const stmt = sqlite.prepare('SELECT * FROM businesses WHERE name = ?');
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

  if (isPostgresConfigured()) {
    const pool = getPool();
    const res = await pool.query('SELECT value FROM business_settings WHERE business_id = $1 AND key = $2', [businessId, key]);
    return res.rows[0] ? res.rows[0].value : defaultValue;
  } else {
    const sqlite = getSqliteDb();
    const stmt = sqlite.prepare('SELECT value FROM business_settings WHERE business_id = ? AND key = ?');
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

  if (isPostgresConfigured()) {
    const pool = getPool();
    const res = await pool.query('SELECT key, value FROM business_settings WHERE business_id = $1', [businessId]);
    const settings = {};
    for (const row of res.rows) {
      settings[row.key] = row.value;
    }
    return settings;
  } else {
    const sqlite = getSqliteDb();
    const stmt = sqlite.prepare('SELECT key, value FROM business_settings WHERE business_id = ?');
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

  if (isPostgresConfigured()) {
    const pool = getPool();
    const query = `
      INSERT INTO business_settings (business_id, key, value, updated_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT(business_id, key) DO UPDATE SET
        value = EXCLUDED.value,
        updated_at = CURRENT_TIMESTAMP
    `;
    await pool.query(query, [businessId, key, String(value)]);
    return { businessId, key, value };
  } else {
    const sqlite = getSqliteDb();
    const stmt = sqlite.prepare(`
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

  if (isPostgresConfigured()) {
    const pool = getPool();
    const res = await pool.query('SELECT * FROM voice_agents WHERE provider = $1 AND provider_agent_id = $2', [provider, providerAgentId]);
    return res.rows[0] || null;
  } else {
    const sqlite = getSqliteDb();
    const stmt = sqlite.prepare('SELECT * FROM voice_agents WHERE provider = ? AND provider_agent_id = ?');
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

  if (isPostgresConfigured()) {
    const pool = getPool();
    const res = await pool.query('SELECT * FROM phone_numbers WHERE phone_number = $1', [phoneNumber]);
    return res.rows[0] || null;
  } else {
    const sqlite = getSqliteDb();
    const stmt = sqlite.prepare('SELECT * FROM phone_numbers WHERE phone_number = ?');
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
    if (isPostgresConfigured()) {
      const pool = getPool();
      if (!pool) return false;
      const res = await pool.query('SELECT 1 AS ok');
      return res.rows.length > 0 && (res.rows[0].ok === 1 || res.rows[0].ok === '1');
    } else {
      const sqlite = getSqliteDb();
      const ping = sqlite.prepare('SELECT 1 AS ok').get();
      return Boolean(ping && ping.ok === 1);
    }
  } catch {
    return false;
  }
}

module.exports = {
  get db() {
    return getSqliteDb();
  },
  get pool() {
    return getPool();
  },
  get isPostgres() {
    return isPostgresConfigured();
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
