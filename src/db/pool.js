// src/db/pool.js
const { Pool } = require('pg');

// Debug: log what DATABASE_URL looks like (masked)
const dbUrl = process.env.DATABASE_URL;
if (dbUrl) {
  const masked = dbUrl.replace(/:([^:@]+)@/, ':****@');
  console.log('🔗 Using DATABASE_URL:', masked);
} else {
  console.log('⚠️  DATABASE_URL not set — falling back to individual vars');
  console.log('   DB_HOST:', process.env.DB_HOST || '(not set)');
}

const getPoolConfig = () => {
  if (dbUrl) {
    return {
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },
    };
  }
  return {
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME     || 'globallinkers',
    user:     process.env.DB_USER     || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  };
};

const pool = new Pool({
  ...getPoolConfig(),
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected DB pool error:', err.message);
});

const query = (text, params) => pool.query(text, params);
const getClient = () => pool.connect();

const testConnection = async () => {
  try {
    const res = await pool.query('SELECT NOW() as now, current_database() as db');
    console.log(`✅ PostgreSQL connected — DB: ${res.rows[0].db} at ${res.rows[0].now}`);
  } catch (err) {
    console.error('❌ PostgreSQL connection failed:', err.message);
  }
};

module.exports = { pool, query, getClient, testConnection };
