import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

mongoose.set('strictQuery', true);

let connectPromise: Promise<typeof mongoose> | null = null;
let memoryServer: MongoMemoryServer | null = null;

function isMemoryUri(uri: string): boolean {
  return uri === 'memory' || uri.startsWith('memory://');
}

function resolveMemoryDbName(uri: string): string {
  if (uri === 'memory') {
    return 'oppnd';
  }
  const suffix = uri.replace('memory://', '').trim();
  return suffix || 'oppnd';
}

async function connectInMemory(uri: string): Promise<typeof mongoose> {
  const dbName = resolveMemoryDbName(uri);
  memoryServer = await MongoMemoryServer.create({
    instance: {
      dbName
    }
  });
  const memoryUri = memoryServer.getUri();
  console.warn(`[Oppnd] Started in-memory MongoDB (${dbName}) at ${memoryUri}`);
  return mongoose.connect(memoryUri, {
    serverSelectionTimeoutMS: 5000
  });
}

export async function connectMongo(uri: string): Promise<typeof mongoose> {
  if (!connectPromise) {
    connectPromise = isMemoryUri(uri)
      ? connectInMemory(uri)
      : mongoose.connect(uri, {
          serverSelectionTimeoutMS: 5000
        });
  }
  return connectPromise;
}

export async function disconnectMongo(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
  connectPromise = null;
}
