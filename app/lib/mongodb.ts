import { MongoClient, Db } from 'mongodb'

const MONGODB_URI =
  process.env.MONGODB_URI ||
  'mongodb://web_user:web_password@mongodb:27017/web_database?authSource=web_database'
const MONGODB_DB = process.env.MONGODB_DB || 'web_database'

let _client: MongoClient | null = null
let _db: Db | null = null

export async function getMongoDb(): Promise<Db> {
  if (_db) return _db

  _client = new MongoClient(MONGODB_URI)
  await _client.connect()
  _db = _client.db(MONGODB_DB)
  return _db
}

export const COLLECTIONS = {
  USER_CREDENTIALS: 'UserCredentials',
  USER_CONFIGS: 'UserConfigs',
  CHARACTER_CONFIGS: 'CharacterConfigs',
} as const
