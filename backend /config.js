const { Pool } = require('pg');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not configured.');
}

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is not configured.');
}

if (!process.env.ADMIN_REGISTRATION_SECRET) {
  throw new Error('ADMIN_REGISTRATION_SECRET is not configured.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ?
    { rejectUnauthorized: false } :
    false
});

module.exports = {
  pool,
  jwtSecret: process.env.JWT_SECRET,
  adminSecret: process.env.ADMIN_REGISTRATION_SECRET
};