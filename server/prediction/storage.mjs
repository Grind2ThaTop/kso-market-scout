import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_FILE = path.resolve('server/data/integrations.v2.json');

const DEFAULT_DB = {
  integrations: {},
  feeSnapshots: {},
};

export async function readDb() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return structuredClone(DEFAULT_DB);
  }
}

export async function writeDb(db) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(db, null, 2), 'utf8');
}
