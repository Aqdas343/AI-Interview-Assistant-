const redis = require('redis');
const config = require('../config');
const logger = require('./logger');

let client;
let isRedisActive = false;
const fallbackCache = new Map();

// Initialize the external Redis client
const initRedis = async () => {
  client = redis.createClient({
    url: config.redisUrl,
    socket: {
      connectTimeout: 5000 // Ensure we don't hang if Redis isn't running locally
    }
  });

  client.on('error', (err) => {
    // Only log warning once to prevent spam
    if (isRedisActive) {
      logger.warn('[Redis Error] Connection lost. Falling back to local Map cache.');
    }
    isRedisActive = false;
  });

  client.on('connect', () => {
    logger.info('✅ Redis Connected. Distributed cache is active.');
    isRedisActive = true;
  });

  try {
    await client.connect();
  } catch (err) {
    logger.warn('⚠️ Redis not available locally. Transparent scaling to In-Memory Map cache.');
    isRedisActive = false;
  }
};

// We wrap the cache operations to route to Redis if possible, or Fallback automatically
const getCache = async (key) => {
  if (isRedisActive) {
    try {
      const data = await client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (e) { return fallbackCache.get(key); }
  } else {
    return fallbackCache.get(key) || null;
  }
};

const setCache = async (key, value, expirationSeconds = 3600) => {
  if (isRedisActive) {
    try {
      await client.setEx(key, expirationSeconds, JSON.stringify(value));
    } catch (e) { fallbackCache.set(key, value); }
  } else {
    fallbackCache.set(key, value);
    // Mimic simple TTL cleanup locally
    setTimeout(() => fallbackCache.delete(key), expirationSeconds * 1000);
  }
};

const clearCache = async (key) => {
  if (isRedisActive) {
    try { await client.del(key); } catch (e) {}
  }
  fallbackCache.delete(key);
};

// Initialize instantly upon importing
initRedis();

module.exports = {
  getCache,
  setCache,
  clearCache,
  isRedisActive: () => isRedisActive,
};
