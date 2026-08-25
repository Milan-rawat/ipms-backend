const mongoose = require('mongoose');
const { env } = require('./env');

/**
 * Connect to MongoDB.
 * Fails explicitly if connection cannot be established.
 */
async function connectDB() {
  try {
    const conn = await mongoose.connect(env.mongoUri);
    console.log(`[MongoDB] Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`[MongoDB] Connection failed: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Disconnect from MongoDB gracefully.
 */
async function disconnectDB() {
  try {
    await mongoose.disconnect();
    console.log('[MongoDB] Disconnected');
  } catch (error) {
    console.error(`[MongoDB] Disconnect error: ${error.message}`);
  }
}

module.exports = { connectDB, disconnectDB };
