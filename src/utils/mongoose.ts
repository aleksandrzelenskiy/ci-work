import mongoose, { Connection, ConnectOptions } from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || '';

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI не определён. Добавьте его в файл .env');
}

interface GlobalMongoose {
  mongoose: {
    conn: Connection | null;
    promise: Promise<Connection> | null;
  };
}

declare const global: typeof globalThis & GlobalMongoose;

const globalMongoose = global.mongoose || { conn: null, promise: null };
global.mongoose = globalMongoose;

async function dbConnect(): Promise<Connection> {
  if (globalMongoose.conn) {
    console.log('Mongoose already connected.');
    return globalMongoose.conn;
  }

  if (!globalMongoose.promise) {
    globalMongoose.promise = mongoose
      .connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 30000,
        useNewUrlParser: true,
        useUnifiedTopology: true,
      } as ConnectOptions)
      .then((mongoose) => {
        console.log(
          `Mongoose connected to database: ${mongoose.connection.host}`
        );
        return mongoose.connection;
      })
      .catch((error) => {
        console.error('Error connecting to MongoDB:', error);
        throw new Error('Failed to connect to MongoDB');
      });
  }

  globalMongoose.conn = await globalMongoose.promise;
  return globalMongoose.conn;
}

export default dbConnect;
