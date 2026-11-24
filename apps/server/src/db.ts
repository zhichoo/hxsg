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

  CREATE TABLE IF NOT EXISTS character_main_quests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER NOT NULL,
    quest_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    progress INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    UNIQUE(character_id, quest_id),
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS character_paohuan (
    character_id INTEGER PRIMARY KEY,
    ring INTEGER NOT NULL DEFAULT 1,
    completed_rounds INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'idle',
    task_type TEXT,
    target_id TEXT,
    target_name TEXT,
    target_map_id TEXT,
    required_count INTEGER NOT NULL DEFAULT 1,
    progress INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS market_listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    realm_id TEXT NOT NULL,
    seller_id INTEGER NOT NULL,
    seller_name TEXT NOT NULL,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    currency TEXT NOT NULL,
    price INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    buyer_id INTEGER,
    buyer_name TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (seller_id) REFERENCES characters(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_market_realm_status ON market_listings(realm_id, status, created_at DESC);

  CREATE TABLE IF NOT EXISTS mails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    realm_id TEXT NOT NULL,
    sender_id INTEGER NOT NULL,
    sender_name TEXT NOT NULL,
    recipient_id INTEGER NOT NULL,
    recipient_name TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    attach_silver INTEGER NOT NULL DEFAULT 0,
    attach_gold INTEGER NOT NULL DEFAULT 0,
    claimed INTEGER NOT NULL DEFAULT 0,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (recipient_id) REFERENCES characters(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_mails_recipient ON mails(recipient_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS casino_rounds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    realm_id TEXT NOT NULL,
    game TEXT NOT NULL,
    round_no INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    opened_at INTEGER NOT NULL,
    draw_at INTEGER NOT NULL,
    settled_at INTEGER,
    dice_1 INTEGER,
    dice_2 INTEGER,
    dice_3 INTEGER,
    dice_sum INTEGER,
    is_baozi INTEGER NOT NULL DEFAULT 0,
    chibi_winner TEXT,
    chibi_report TEXT,
    total_bets INTEGER NOT NULL DEFAULT 0,
    total_silver_bet INTEGER NOT NULL DEFAULT 0,
    total_gold_bet INTEGER NOT NULL DEFAULT 0,
    total_silver_payout INTEGER NOT NULL DEFAULT 0,
    total_gold_payout INTEGER NOT NULL DEFAULT 0,
    UNIQUE(realm_id, game, round_no)
  );

  CREATE INDEX IF NOT EXISTS idx_casino_rounds_lookup
    ON casino_rounds(realm_id, game, round_no DESC);

  CREATE TABLE IF NOT EXISTS casino_bets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    round_id INTEGER NOT NULL,
    realm_id TEXT NOT NULL,
    game TEXT NOT NULL,
    round_no INTEGER NOT NULL,
    character_id INTEGER NOT NULL,
    character_name TEXT NOT NULL,
    choice TEXT NOT NULL,
    currency TEXT NOT NULL,
    amount INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    payout INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    settled_at INTEGER,
    FOREIGN KEY (round_id) REFERENCES casino_rounds(id) ON DELETE CASCADE,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_casino_bets_round ON casino_bets(round_id);
  CREATE INDEX IF NOT EXISTS idx_casino_bets_char ON casino_bets(character_id, game, id DESC);

  CREATE TABLE IF NOT EXISTS friends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    realm_id TEXT NOT NULL,
    character_id INTEGER NOT NULL,
    friend_character_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE(character_id, friend_character_id),
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    FOREIGN KEY (friend_character_id) REFERENCES characters(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_friends_char ON friends(character_id);
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
  ['tower_floor', 'INTEGER NOT NULL DEFAULT 0'],
  ['tower_sweep_date', 'TEXT DEFAULT NULL'],
  ['bank_silver', 'INTEGER NOT NULL DEFAULT 0'],
  ['bank_gold', 'INTEGER NOT NULL DEFAULT 0'],
  ['arena_wins', 'INTEGER NOT NULL DEFAULT 0'],
  ['arena_losses', 'INTEGER NOT NULL DEFAULT 0'],
  ['arena_daily_rewards', 'INTEGER NOT NULL DEFAULT 0'],
  ['arena_reward_date', 'TEXT DEFAULT NULL'],
  ['keju_date', 'TEXT DEFAULT NULL'],
  ['keju_answered', 'INTEGER NOT NULL DEFAULT 0'],
  ['keju_correct', 'INTEGER NOT NULL DEFAULT 0'],
  ['escort_date', 'TEXT DEFAULT NULL'],
  ['escort_status', "TEXT NOT NULL DEFAULT 'idle'"],
  ['escort_origin_map_id', 'TEXT DEFAULT NULL'],
  ['escort_target_map_id', 'TEXT DEFAULT NULL'],
  ['world_boss_date', 'TEXT DEFAULT NULL'],
  ['paohuan_gold_date', 'TEXT DEFAULT NULL'],
  ['paohuan_gold_rounds', 'INTEGER NOT NULL DEFAULT 0'],
  ['rebirth', 'INTEGER NOT NULL DEFAULT 0'],
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

// Safe online schema migration for generals depth (Module C)
const existingGeneralCols = new Set(
  (db.prepare('PRAGMA table_info(generals)').all() as unknown as Array<{ name: string }>).map(
    (c) => c.name,
  ),
);

const newGeneralCols: Array<[string, string]> = [
  ['base_hp', 'INTEGER NOT NULL DEFAULT 0'],
  ['base_mp', 'INTEGER NOT NULL DEFAULT 0'],
  ['base_atk', 'INTEGER NOT NULL DEFAULT 0'],
  ['base_spd', 'INTEGER NOT NULL DEFAULT 0'],
  ['rebirth', 'INTEGER NOT NULL DEFAULT 0'],
  ['rarity', "TEXT NOT NULL DEFAULT 'common'"],
  ['skill_id', "TEXT NOT NULL DEFAULT 'liandao'"],
  ['skill2_id', 'TEXT DEFAULT NULL'],
  ['intimacy', 'INTEGER NOT NULL DEFAULT 0'],
  ['loyalty', 'INTEGER NOT NULL DEFAULT 100'],
];

for (const [col, def] of newGeneralCols) {
  if (!existingGeneralCols.has(col)) {
    db.exec(`ALTER TABLE generals ADD COLUMN ${col} ${def}`);
  }
}

// Online migration for equipment: set_id + random roll_pct
const existingEquipCols = new Set(
  (db.prepare('PRAGMA table_info(character_equipment)').all() as unknown as Array<{ name: string }>).map(
    (c) => c.name,
  ),
);
const newEquipCols: Array<[string, string]> = [
  ['set_id', 'TEXT DEFAULT NULL'],
  ['roll_pct', 'INTEGER NOT NULL DEFAULT 100'],
];
for (const [col, def] of newEquipCols) {
  if (!existingEquipCols.has(col)) {
    db.exec(`ALTER TABLE character_equipment ADD COLUMN ${col} ${def}`);
  }
}
// If an existing DB ever had equipment attached to a general, release it cleanly back to bag
if (existingEquipCols.has('equipped_general_id')) {
  db.exec('UPDATE character_equipment SET equipped_general_id = NULL WHERE equipped_general_id IS NOT NULL');
}

// Online migration for private chat messages
const existingChatCols = new Set(
  (db.prepare('PRAGMA table_info(chat_messages)').all() as unknown as Array<{ name: string }>).map(
    (c) => c.name,
  ),
);
const newChatCols: Array<[string, string]> = [
  ['recipient_id', 'INTEGER DEFAULT NULL'],
  ['recipient_name', 'TEXT DEFAULT NULL'],
];
for (const [col, def] of newChatCols) {
  if (!existingChatCols.has(col)) {
    db.exec(`ALTER TABLE chat_messages ADD COLUMN ${col} ${def}`);
  }
}
