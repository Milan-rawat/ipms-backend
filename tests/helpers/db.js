const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

/**
 * Connect to in-memory MongoDB for testing.
 * Uses locally cached binary (7.0.14) to avoid large downloads.
 */
async function connectTestDB() {
  mongoServer = await MongoMemoryServer.create({
    binary: {
      version: '7.0.14',
    },
  });
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
