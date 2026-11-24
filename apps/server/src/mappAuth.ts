import crypto, { type JsonWebKey } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import {
  PlatformAuthError,
  verifyPlatformRequest,
  verifyPlatformWebSocketRequest,
  type PlatformIdentity,
} from '@discourse-mini-app/sdk/server';
import type { AuthPayload } from './auth.js';
import { db } from './db.js';

export interface MappServerConfig {
  enabled: boolean;
  issuer: string;
  issuerOrigin: string;
  jwksUrl: string;
  audience: string;
  appId: string;
  channel: 'production' | 'sandbox';
  staticPublicKey: string | JsonWebKey | null;
  gmSubs: Set<string>;
}

function parseStaticKey(raw: string | undefined): string | JsonWebKey | null {
  if (!raw?.trim()) return null;
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) {
    try {
      return JSON.parse(trimmed) as JsonWebKey;
    } catch {
      return null;
    }
  }
  return trimmed.replace(/\\n/g, '\n');
}

function loadMappConfig(): MappServerConfig {
  const issuer = (process.env.HXSG_MAPP_ISSUER || '').trim().replace(/\/+$/, '');
  const audience = (process.env.HXSG_MAPP_AUDIENCE || '').trim().replace(/\/+$/, '');
  const appId = (process.env.HXSG_MAPP_APP_ID || '').trim();
  const channel: 'production' | 'sandbox' =
    process.env.HXSG_MAPP_CHANNEL === 'sandbox' ? 'sandbox' : 'production';
  const staticPublicKey = parseStaticKey(process.env.HXSG_MAPP_PUBLIC_KEY);
  const gmSubs = new Set(
    (process.env.HXSG_MAPP_GM_SUBS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );

  let issuerOrigin = '';
  let enabled = false;
  if (issuer && audience && appId) {
    try {
      issuerOrigin = new URL(issuer).origin;
      enabled = true;
    } catch {
      enabled = false;
    }
  }

  const jwksUrl = (process.env.HXSG_MAPP_JWKS_URL || '').trim() || (issuer ? `${issuer}/mini-app-api/jwks` : '');

  return {
    enabled,
    issuer,
    issuerOrigin,
    jwksUrl,
    audience,
    appId,
    channel,
    staticPublicKey,
    gmSubs,
  };
}

export const mappConfig = loadMappConfig();

interface CachedKeyEntry {
  key: JsonWebKey;
  kid: string;
  fetchedAt: number;
}

const JWKS_TTL_MS = 30 * 60 * 1000;
const JWKS_REFRESH_COOLDOWN_MS = 30 * 1000;
const RETAINED_OLD_KEY_MS = 20 * 60 * 1000;

const cachedKeysByKid = new Map<string, CachedKeyEntry>();
let lastJwksFetchAt = 0;
let inflightJwksFetch: Promise<void> | null = null;

function isValidDiscourseJwk(key: unknown): key is JsonWebKey & { kid: string } {
  if (!key || typeof key !== 'object') return false;
  const k = key as Record<string, unknown>;
  return (
    k.kty === 'EC' &&
    k.crv === 'P-256' &&
    k.alg === 'ES256' &&
    k.use === 'sig' &&
    typeof k.kid === 'string' &&
    k.kid.length > 0 &&
    typeof k.x === 'string' &&
    typeof k.y === 'string' &&
    !Object.hasOwn(k, 'd')
  );
}

async function refreshJwks(force = false): Promise<void> {
  if (!mappConfig.enabled || mappConfig.staticPublicKey) return;
  const now = Date.now();
  if (!force && lastJwksFetchAt > 0 && now - lastJwksFetchAt < JWKS_TTL_MS && cachedKeysByKid.size > 0) {
    return;
  }
  if (force && lastJwksFetchAt > 0 && now - lastJwksFetchAt < JWKS_REFRESH_COOLDOWN_MS) {
    return;
  }
  if (inflightJwksFetch) {
    await inflightJwksFetch;
    return;
  }

  inflightJwksFetch = (async () => {
    try {
      const response = await fetch(mappConfig.jwksUrl, {
        headers: { Accept: 'application/json' },
        redirect: 'error',
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        throw new Error(`JWKS request failed: ${response.status}`);
      }
      const body = (await response.json()) as { keys?: unknown[] } | null;
      const validKeys = Array.isArray(body?.keys) ? body.keys.filter(isValidDiscourseJwk) : [];
      if (validKeys.length === 0) {
        throw new Error('Invalid community JWKS');
      }
      const fetchedAt = Date.now();
      for (const k of validKeys) {
        cachedKeysByKid.set(k.kid, { key: k, kid: k.kid, fetchedAt });
      }
      // Prune expired rotated keys
      for (const [kid, entry] of cachedKeysByKid) {
        if (fetchedAt - entry.fetchedAt > RETAINED_OLD_KEY_MS && !validKeys.some((v) => v.kid === kid)) {
          cachedKeysByKid.delete(kid);
        }
      }
      lastJwksFetchAt = fetchedAt;
    } finally {
      inflightJwksFetch = null;
    }
  })();

  await inflightJwksFetch;
}

function peekJwtKid(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as {
      kid?: unknown;
    };
    return typeof header?.kid === 'string' && header.kid.length > 0 ? header.kid : null;
  } catch {
    return null;
  }
}

async function resolvePublicKeyForToken(token: string): Promise<string | JsonWebKey> {
  if (mappConfig.staticPublicKey) return mappConfig.staticPublicKey;

  const kid = peekJwtKid(token);
  await refreshJwks(false);

  if (kid && cachedKeysByKid.has(kid)) {
    return cachedKeysByKid.get(kid)!.key;
  }

  // Unknown kid: perform one cooldown-gated refresh
  await refreshJwks(true);
  if (kid && cachedKeysByKid.has(kid)) {
    return cachedKeysByKid.get(kid)!.key;
  }

  const latest = Array.from(cachedKeysByKid.values()).sort((a, b) => b.fetchedAt - a.fetchedAt)[0];
  if (!latest) {
    throw new PlatformAuthError();
  }
  return latest.key;
}

function buildExternalUrl(request: IncomingMessage): string {
  if (!request.url || !request.url.startsWith('/')) {
    throw new PlatformAuthError();
  }
  return `${mappConfig.audience}${request.url}`;
}

export function isJwtFormat(token: string | undefined | null): boolean {
  if (!token) return false;
  return token.split('.').length === 3;
}

export async function verifyMappHttpRequest(request: IncomingMessage): Promise<PlatformIdentity> {
  if (!mappConfig.enabled) {
    throw new PlatformAuthError();
  }
  const authorization = request.headers.authorization ?? '';
  if (!authorization.startsWith('Bearer ')) {
    throw new PlatformAuthError();
  }
  const rawToken = authorization.slice(7);
  const publicKey = await resolvePublicKeyForToken(rawToken);
  return verifyPlatformRequest({
    authorization,
    publicKey,
    issuer: mappConfig.issuer,
    audience: mappConfig.audience,
    appId: mappConfig.appId,
    channel: mappConfig.channel,
    scope: 'network.request',
    method: (request.method || 'GET').toUpperCase(),
    url: buildExternalUrl(request),
  });
}

export async function verifyMappWsUpgrade(request: IncomingMessage): Promise<PlatformIdentity> {
  if (!mappConfig.enabled) {
    throw new PlatformAuthError();
  }
  if (request.headers.origin !== mappConfig.issuerOrigin) {
    throw new PlatformAuthError();
  }
  const externalUrl = buildExternalUrl(request);
  const parsed = new URL(externalUrl);
  const rawToken = parsed.searchParams.get('mini_app_token') ?? '';
  if (!rawToken) {
    throw new PlatformAuthError();
  }
  const publicKey = await resolvePublicKeyForToken(rawToken);
  return verifyPlatformWebSocketRequest({
    publicKey,
    issuer: mappConfig.issuer,
    audience: mappConfig.audience,
    appId: mappConfig.appId,
    channel: mappConfig.channel,
    url: externalUrl,
  });
}

export function resolvePlatformAccount(identity: PlatformIdentity): AuthPayload {
  const existing = db
    .prepare(
      `SELECT id, username, is_gm
       FROM accounts
       WHERE platform_iss = ? AND platform_sub = ? AND platform_channel = ?`,
    )
    .get(identity.iss, identity.sub, identity.channel) as
    | { id: number; username: string; is_gm: number }
    | undefined;

  const envIsGm = mappConfig.gmSubs.has(identity.sub);

  if (existing) {
    return {
      accountId: existing.id,
      username: existing.username,
      isGm: Boolean(existing.is_gm) || envIsGm,
      exp: identity.exp * 1000,
      authSource: 'platform',
      trustLevel: identity.trust_level,
    };
  }

  let username = `ld_${identity.sub}`;
  const conflict = db.prepare('SELECT id FROM accounts WHERE username = ?').get(username);
  if (conflict) {
    username = `ld_${identity.sub}_${crypto.randomBytes(2).toString('hex')}`;
  }

  const countRow = db.prepare('SELECT COUNT(*) as cnt FROM accounts').get() as { cnt: number };
  const isGm = envIsGm || countRow.cnt === 0 ? 1 : 0;

  const info = db
    .prepare(
      `INSERT INTO accounts (username, password_hash, is_gm, created_at, platform_iss, platform_sub, platform_channel)
       VALUES (?, '!platform!', ?, ?, ?, ?, ?)`,
    )
    .run(username, isGm, Date.now(), identity.iss, identity.sub, identity.channel);

  return {
    accountId: Number(info.lastInsertRowid),
    username,
    isGm: Boolean(isGm),
    exp: identity.exp * 1000,
    authSource: 'platform',
    trustLevel: identity.trust_level,
  };
}
