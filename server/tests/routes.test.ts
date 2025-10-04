import type { Application } from 'express';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { connectMongo, disconnectMongo } from '../src/db';
import { Message } from '../src/models/Message';

let mongo: MongoMemoryServer;
let app: Application;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri();
  process.env.MONGO_URI = uri;
  await connectMongo(uri);
  const mod = await import('../src/index');
  app = mod.default;
});

beforeEach(async () => {
  await Message.deleteMany({});
});

afterAll(async () => {
  await disconnectMongo();
  if (mongo) {
    await mongo.stop();
  }
});

describe('Oppnd backend routes', () => {
  test('health endpoint', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('sent workflow and history', async () => {
    const payload = {
      messageId: 'msg-123',
      userHash: 'userhash',
      subjectSnippet: 'Teste Oppnd'
    };

    const sentRes = await request(app).post('/events/sent').send(payload);
    expect(sentRes.status).toBe(200);
    expect(sentRes.body.states.sentAt).toBeTruthy();

    const pixelRes = await request(app).get('/t/pixel').query({ mid: 'msg-123', u: 'userhash' });
    expect(pixelRes.status).toBe(200);
    expect(pixelRes.headers['content-type']).toContain('image/gif');

    const historyRes = await request(app).get('/events/history').query({ u: 'userhash' });
    expect(historyRes.status).toBe(200);
    expect(historyRes.body.messages[0].messageId).toBe('msg-123');
  });

  test('pixel requires delay before marking as read', async () => {
    const messageId = 'msg-grace';
    const userHash = 'userhash';

    const firstHit = await request(app).get('/t/pixel').query({ mid: messageId, u: userHash });
    expect(firstHit.status).toBe(200);

    let stored = await Message.findOne({ messageId, userHash }).lean();
    expect(stored?.states?.deliveredAt).toBeTruthy();
    expect(stored?.states?.readAt).toBeFalsy();

    await request(app).get('/t/pixel').query({ mid: messageId, u: userHash });
    stored = await Message.findOne({ messageId, userHash }).lean();
    expect(stored?.states?.readAt).toBeFalsy();

    const past = new Date(Date.now() - 360000);
    await Message.updateOne({ messageId, userHash }, { $set: { 'states.deliveredAt': past } });

    await request(app).get('/t/pixel').query({ mid: messageId, u: userHash });
    stored = await Message.findOne({ messageId, userHash }).lean();
    expect(stored?.states?.readAt).toBeTruthy();
  });
});

