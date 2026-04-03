/**
 * Client MongoDB partagé (variable d’environnement MONGO_URL).
 */

const { MongoClient } = require('mongodb');

let client = null;
let db = null;

function envTrim(v) {
  if (v == null || v === undefined) return '';
  return String(v)
    .trim()
    .replace(/^\uFEFF/, '');
}

/**
 * @returns {Promise<{ client: MongoClient, db: import('mongodb').Db }>}
 */
async function connectMongo() {
  const url = envTrim(process.env.MONGO_URL);
  if (!url) {
    throw new Error('MONGO_URL manquant');
  }
  if (client && db) return { client, db };

  client = new MongoClient(url);
  await client.connect();
  const dbName = envTrim(process.env.MONGO_DB_NAME) || 'sayuri_rank';
  db = client.db(dbName);
  return { client, db };
}

function getDb() {
  if (!db) throw new Error('Mongo non connecté — appelle connectMongo() au démarrage');
  return db;
}

async function closeMongo() {
  if (client) {
    await client.close().catch(() => {});
    client = null;
    db = null;
  }
}

module.exports = {
  connectMongo,
  getDb,
  closeMongo,
};
