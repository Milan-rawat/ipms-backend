const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

/**
 * Connect to in-memory MongoDB for testing.
 * Uses default binary version — downloads automatically in CI.
 */
async function connectTestDB() {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
}

/**
 * Clear all collections.
 */
async function clearTestDB() {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

/**
 * Disconnect and stop in-memory MongoDB.
 */
async function disconnectTestDB() {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
}

module.exports = { connectTestDB, clearTestDB, disconnectTestDB };
