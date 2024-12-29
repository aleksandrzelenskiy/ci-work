import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || '';
const options = {};

if (!uri) {
  throw new Error(
    'Please define the MONGODB_URI environment variable inside .env.local'
  );
}

// Глобальная переменная для хранения клиента MongoDB
let client: MongoClient;
let clientPromise: Promise<MongoClient>;

// Проверяем, находится ли приложение в режиме разработки
if (process.env.NODE_ENV === 'development') {
  // Используем глобальный объект для предотвращения повторного подключения
  const globalWithMongoClient = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>;
  };

  if (!globalWithMongoClient._mongoClientPromise) {
    client = new MongoClient(uri, options);
    globalWithMongoClient._mongoClientPromise = client.connect();
  }

  clientPromise = globalWithMongoClient._mongoClientPromise;
} else {
  // В режиме production создаём новое подключение
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export default clientPromise;
