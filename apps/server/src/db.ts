import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const dataDir = process.env.HXSG_DATA_DIR || path.resolve(process.cwd(), '../../data');
fs.mkdirSync(dataDir, { recursive: true });

const defaultDbFile =
  process.env.HXSG_MAPP_CHANNEL === 'sandbox' ? 'hxsg-sandbox.db' : 'hxsg.db';
export const dbPath = path.join(dataDir, process.env.HXSG_DB_FILE || defaultDbFile);
export const db = new DatabaseSync(dbPath);

// Tuned for 200+ players on a 2C4G server
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA busy_timeout = 5000;
  PRAGMA foreign_keys = ON;
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    is_gm INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    realm_id TEXT NOT NULL,
    name TEXT NOT NULL,
    role_class TEXT NOT NULL,
    gender TEXT NOT NULL,
    portrait TEXT NOT NULL,
    level INTEGER NOT NULL DEFAULT 1,
    exp INTEGER NOT NULL DEFAULT 0,
    hp INTEGER NOT NULL,
    max_hp INTEGER NOT NULL,
    mp INTEGER NOT NULL,
    max_mp INTEGER NOT NULL,
    atk INTEGER NOT NULL,
    def INTEGER NOT NULL,
    spd INTEGER NOT NULL,
    silver INTEGER NOT NULL DEFAULT 500,
    gold INTEGER NOT NULL DEFAULT 100,
    map_id TEXT NOT NULL DEFAULT 'xuchang',
    free_points INTEGER NOT NULL DEFAULT 4,
    pt_vit INTEGER NOT NULL DEFAULT 0,
    pt_str INTEGER NOT NULL DEFAULT 0,
    pt_int INTEGER NOT NULL DEFAULT 0,
    pt_agi INTEGER NOT NULL DEFAULT 0,
    res_points INTEGER NOT NULL DEFAULT 5,
    res_phys INTEGER NOT NULL DEFAULT 0,
    res_chaos INTEGER NOT NULL DEFAULT 0,
    res_seal INTEGER NOT NULL DEFAULT 0,
    res_trap INTEGER NOT NULL DEFAULT 0,
    res_magic INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(account_id, realm_id),
    UNIQUE(realm_id, name),
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS character_skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER NOT NULL,
    skill_id TEXT NOT NULL,
    proficiency INTEGER NOT NULL DEFAULT 0,
    UNIQUE(character_id, skill_id),
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS generals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER NOT NULL,
    template_id TEXT NOT NULL,
    name TEXT NOT NULL,
    role_class TEXT NOT NULL,
    sprite_key TEXT NOT NULL,
    avatar_key TEXT NOT NULL,
    level INTEGER NOT NULL DEFAULT 1,
    exp INTEGER NOT NULL DEFAULT 0,
    hp INTEGER NOT NULL,
    max_hp INTEGER NOT NULL,
    mp INTEGER NOT NULL,
    max_mp INTEGER NOT NULL,
    atk INTEGER NOT NULL,
    spd INTEGER NOT NULL,
    growth REAL NOT NULL DEFAULT 1.0,
    slot INTEGER DEFAULT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER NOT NULL,
    item_id TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    UNIQUE(character_id, item_id),
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS character_equipment (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER NOT NULL,
    template_id TEXT NOT NULL,
    name TEXT NOT NULL,
    slot TEXT NOT NULL,
    quality TEXT NOT NULL,
    icon TEXT NOT NULL,
    level_req INTEGER NOT NULL DEFAULT 1,
    hp_bonus INTEGER NOT NULL DEFAULT 0,
    mp_bonus INTEGER NOT NULL DEFAULT 0,
    atk_bonus INTEGER NOT NULL DEFAULT 0,
    def_bonus INTEGER NOT NULL DEFAULT 0,
    spd_bonus INTEGER NOT NULL DEFAULT 0,
    res_phys INTEGER NOT NULL DEFAULT 0,
    res_chaos INTEGER NOT NULL DEFAULT 0,
    res_seal INTEGER NOT NULL DEFAULT 0,
    res_trap INTEGER NOT NULL DEFAULT 0,
    res_magic INTEGER NOT NULL DEFAULT 0,
    sell_silver INTEGER NOT NULL DEFAULT 50,
    equipped INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_char_equip_char ON character_equipment(character_id);

  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    realm_id TEXT NOT NULL,
    channel TEXT NOT NULL,
    sender_id INTEGER NOT NULL,
    sender_name TEXT NOT NULL,
    is_system INTEGER NOT NULL DEFAULT 0,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_characters_realm ON characters(realm_id);
  CREATE INDEX IF NOT EXISTS idx_chat_realm_channel ON chat_messages(realm_id, channel, created_at DESC);
`);

// Safe online schema migration for existing DBs created in Phase 1
const existingCols = new Set(
  (db.prepare('PRAGMA table_info(characters)').all() as unknown as Array<{ name: string }>).map(
    (c) => c.name,
  ),
);

const newCols: Array<[string, string]> = [
  ['free_points', 'INTEGER NOT NULL DEFAULT 4'],
  ['pt_vit', 'INTEGER NOT NULL DEFAULT 0'],
  ['pt_str', 'INTEGER NOT NULL DEFAULT 0'],
  ['pt_int', 'INTEGER NOT NULL DEFAULT 0'],
  ['pt_agi', 'INTEGER NOT NULL DEFAULT 0'],
  ['res_points', 'INTEGER NOT NULL DEFAULT 5'],
  ['res_phys', 'INTEGER NOT NULL DEFAULT 0'],
  ['res_chaos', 'INTEGER NOT NULL DEFAULT 0'],
  ['res_seal', 'INTEGER NOT NULL DEFAULT 0'],
  ['res_trap', 'INTEGER NOT NULL DEFAULT 0'],
  ['res_magic', 'INTEGER NOT NULL DEFAULT 0'],
];

for (const [col, def] of newCols) {
  if (!existingCols.has(col)) {
    db.exec(`ALTER TABLE characters ADD COLUMN ${col} ${def}`);
  }
}

// Safe online schema migration for Discourse Mini App platform-linked accounts
const existingAccountCols = new Set(
  (db.prepare('PRAGMA table_info(accounts)').all() as unknown as Array<{ name: string }>).map(
    (c) => c.name,
  ),
);

const newAccountCols: Array<[string, string]> = [
  ['platform_iss', 'TEXT'],
  ['platform_sub', 'TEXT'],
  ['platform_channel', 'TEXT'],
];

for (const [col, def] of newAccountCols) {
  if (!existingAccountCols.has(col)) {
    db.exec(`ALTER TABLE accounts ADD COLUMN ${col} ${def}`);
  }
}

db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_platform
  ON accounts(platform_iss, platform_sub, platform_channel)
  WHERE platform_iss IS NOT NULL;
`);
