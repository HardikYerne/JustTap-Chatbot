import { MongoClient, Db } from 'mongodb';

import { env } from '../config/env.js';

let client: MongoClient;
let db: Db;

export async function connectMongo() {
  client = new MongoClient(env.MONGODB_URI);

  await client.connect();

  db = client.db(env.MONGODB_DB);

  await ensureIndexes();
  await ensureVectorSearchIndex();

  return db;
}

export function mongoDb() {
  if (!db) {
    throw new Error('MongoDB is not connected');
  }

  return db;
}

export async function closeMongo() {
  if (client) {
    await client.close();
  }
}

async function ensureIndexes() {
  const knowledge = db.collection('knowledge');
  const conversations = db.collection('conversations');
  const messages = db.collection('messages');
  const tickets = db.collection('tickets');
  const ticketMessages = db.collection('ticket_messages');
  const chatbotCache = db.collection('chatbot_cache');

  await knowledge.createIndex({
    category: 1,
    sub_service: 1,
    intent: 1
  });

  await knowledge.createIndex({ language: 1 });
  await knowledge.createIndex({ keywords: 1 });

  await conversations.createIndex(
    { sessionId: 1 },
    { unique: true }
  );

  await messages.createIndex({
    sessionId: 1,
    createdAt: 1
  });
