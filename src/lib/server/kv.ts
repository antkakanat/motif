import { env } from '$env/dynamic/private';
import * as fs from 'fs';
import * as path from 'path';

const SIM_DB_PATH = path.resolve('scratch/kv_sim.json');

// Ensure scratch directory exists
function ensureScratchDir() {
  const dir = path.dirname(SIM_DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Simulated KV file operations
function readSimDb(): Record<string, any> {
  ensureScratchDir();
  if (!fs.existsSync(SIM_DB_PATH)) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(SIM_DB_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

function writeSimDb(db: Record<string, any>): void {
  ensureScratchDir();
  fs.writeFileSync(SIM_DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
}

/**
 * Get value from Vercel KV or simulated local database
 */
export async function kvGet<T>(key: string): Promise<T | null> {
  const url = env.KV_REST_API_URL;
  const token = env.KV_REST_API_TOKEN;

  if (url && token) {
    try {
      const response = await fetch(`${url}/get/${key}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error(`KV API returned ${response.status}`);
      }
      const data = await response.json();
      // Upstash REST API returns { result: "value_string" }
      if (data.result) {
        return JSON.parse(data.result) as T;
      }
      return null;
    } catch (err) {
      console.error('[KV Server] Vercel KV error:', err);
      // Fallback to local simulation if live fails in dev
      return getSimulated<T>(key);
    }
  }

  return getSimulated<T>(key);
}

/**
 * Set value in Vercel KV or simulated local database
 */
export async function kvSet<T>(key: string, value: T): Promise<void> {
  const url = env.KV_REST_API_URL;
  const token = env.KV_REST_API_TOKEN;
  const valString = JSON.stringify(value);

  if (url && token) {
    try {
      const response = await fetch(`${url}/set/${key}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([valString]) // Upstash SET expects value arguments
      });
      if (!response.ok) {
        throw new Error(`KV API set returned ${response.status}`);
      }
      return;
    } catch (err) {
      console.error('[KV Server] Vercel KV error:', err);
      setSimulated(key, value);
      return;
    }
  }

  setSimulated(key, value);
}

function getSimulated<T>(key: string): T | null {
  const db = readSimDb();
  if (key in db) {
    return db[key] as T;
  }
  return null;
}

function setSimulated<T>(key: string, value: T): void {
  const db = readSimDb();
  db[key] = value;
  writeSimDb(db);
}
