/**
 * RealtySprint AI — Backend Configuration
 * All values sourced from environment variables.
 * No secrets are hardcoded here.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

module.exports = {
  // Server
  port:       process.env.PORT       || 4000,
  env:        process.env.NODE_ENV   || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:8000',
  aiModel:    process.env.OPENAI_MODEL || 'gpt-4o-mini',

  // Database
  db: {
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME     || 'realtysprint',
    user:     process.env.DB_USER     || 'realtysprint_user',
    password: process.env.DB_PASSWORD || '',
    poolMax:  parseInt(process.env.DB_POOL_MAX || '10', 10),
    ssl:      process.env.DB_SSL === 'true',
  },
};
