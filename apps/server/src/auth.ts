import crypto from 'node:crypto';
import { db } from './db.js';

const SECRET = process.env.HXSG_SECRET || 'hxsg-classic-friends-server-secret-change-me';

export interface AuthPayload {
  accountId: number;
  username: string;
  isGm: boolean;
  exp: number;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, key] = stored.split(':');
  if (!salt || !key) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(key, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

export function signToken(payload: Omit<AuthPayload, 'exp'>): string {
  const full: AuthPayload = {
    ...payload,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 30, // 30 days
  };
  const body = Buffer.from(JSON.stringify(full)).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyToken(token: string | undefined | null): AuthPayload | null {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as AuthPayload;
    if (parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function registerAccount(usernameRaw: string, password: string) {
  const username = usernameRaw.trim();
  if (username.length < 3 || username.length > 20) {
    throw new Error('账号长度需在 3~20 个字符之间');
  }
  if (password.length < 4 || password.length > 32) {
    throw new Error('密码长度需在 4~32 个字符之间');
  }
  const existing = db.prepare('SELECT id FROM accounts WHERE username = ?').get(username);
  if (existing) {
    throw new Error('该账号已被注册');
  }
  const countRow = db.prepare('SELECT COUNT(*) as cnt FROM accounts').get() as { cnt: number };
  const isGm = countRow.cnt === 0 ? 1 : 0; // First account is auto-GM for friend server admin
  const pwHash = hashPassword(password);
  const info = db
    .prepare('INSERT INTO accounts (username, password_hash, is_gm, created_at) VALUES (?, ?, ?, ?)')
    .run(username, pwHash, isGm, Date.now());
  const accountId = Number(info.lastInsertRowid);
  return {
    accountId,
    username,
    isGm: Boolean(isGm),
    token: signToken({ accountId, username, isGm: Boolean(isGm) }),
  };
}

export function loginAccount(usernameRaw: string, password: string) {
  const username = usernameRaw.trim();
  const row = db
    .prepare('SELECT id, username, password_hash, is_gm FROM accounts WHERE username = ?')
    .get(username) as
    | { id: number; username: string; password_hash: string; is_gm: number }
    | undefined;
  if (!row || !verifyPassword(password, row.password_hash)) {
    throw new Error('账号或密码错误');
  }
  return {
    accountId: row.id,
    username: row.username,
    isGm: Boolean(row.is_gm),
    token: signToken({ accountId: row.id, username: row.username, isGm: Boolean(row.is_gm) }),
  };
}
