import {
  getSDK,
  type HttpRequestOptions,
  type JsonValue,
  type MiniAppSDK,
  type MiniAppTheme,
  type MiniAppUser,
} from '@discourse-mini-app/sdk';
import type { ChatChannel, ChatMessage, OnlinePlayerSummary } from '@hxsg/shared';

export type PlatformUser = MiniAppUser;
export type PlatformTheme = MiniAppTheme;

export interface PlatformInitResult {
  isMapp: boolean;
  user: PlatformUser | null;
  theme: PlatformTheme | null;
}

export interface RealtimeHandlers {
  onHistory: (history: ChatMessage[]) => void;
  onMessage: (message: ChatMessage) => void;
  onMapPlayers: (players: OnlinePlayerSummary[]) => void;
}

export class WsTransportError extends Error {
  constructor(message = '实时连接暂不可用') {
    super(message);
    this.name = 'WsTransportError';
  }
}

export interface RealtimeHandle {
  sendChat: (channel: ChatChannel, content: string, recipientName?: string) => void;
  request: <T>(
    type: string,
    payload?: Record<string, unknown>,
    timeoutMs?: number,
  ) => Promise<T>;
  isConnected: () => boolean;
  close: () => void;
}

export function isMappRuntime(): boolean {
  return (
    typeof globalThis !== 'undefined' &&
    Boolean((globalThis as { miniApp?: unknown }).miniApp)
  );
}

let sdkInstance: MiniAppSDK | null = null;
let readySignaled = false;
let themeUnsub: (() => void) | null = null;
const memoryStorage = new Map<string, string>();

function getOptionalSDK(): MiniAppSDK | null {
  if (!isMappRuntime()) return null;
  if (!sdkInstance) {
    sdkInstance = getSDK();
  }
  return sdkInstance;
}

export async function initPlatform(
  onThemeChange?: (theme: PlatformTheme) => void,
): Promise<PlatformInitResult> {
  const sdk = getOptionalSDK();
  if (!sdk) {
    return { isMapp: false, user: null, theme: null };
  }

  await sdk.ready;

  let theme: PlatformTheme | null = null;
  if (sdk.permissions.has('theme.read')) {
    themeUnsub?.();
    themeUnsub = sdk.theme.onChange((next) => {
      onThemeChange?.(next);
    });
    try {
      theme = await sdk.theme.get();
      onThemeChange?.(theme);
    } catch {
      theme = null;
    }
  }

  let user: PlatformUser | null = null;
  if (sdk.permissions.has('user.read')) {
    try {
      user = await sdk.user.getCurrent();
    } catch {
      user = null;
    }
  }

  return { isMapp: true, user, theme };
}

export async function signalPlatformReady(): Promise<void> {
  if (readySignaled) return;
  readySignaled = true;
  const sdk = getOptionalSDK();
  if (!sdk) return;
  try {
    await sdk.lifecycle.ready();
  } catch {
    // Never block UI if lifecycle.ready rejects after unload
  }
}

export function disposePlatform(): void {
  themeUnsub?.();
  themeUnsub = null;
}

export const platformStorage = {
  async getItem(key: string): Promise<string | null> {
    const sdk = getOptionalSDK();
    if (sdk) {
      if (sdk.permissions.has('storage.read')) {
        try {
          return await sdk.localStorage.getItem(key);
        } catch {
          return memoryStorage.get(key) ?? null;
        }
      }
      return memoryStorage.get(key) ?? null;
    }
    try {
      return window.localStorage.getItem(key);
    } catch {
      return memoryStorage.get(key) ?? null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    memoryStorage.set(key, value);
    const sdk = getOptionalSDK();
    if (sdk) {
      if (sdk.permissions.has('storage.write')) {
        try {
          await sdk.localStorage.setItem(key, value);
        } catch {
          // Ignore storage quota/unavailable errors
        }
      }
      return;
    }
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Ignore storage errors
    }
  },

  async removeItem(key: string): Promise<void> {
    memoryStorage.delete(key);
    const sdk = getOptionalSDK();
    if (sdk) {
      if (sdk.permissions.has('storage.write')) {
        try {
          await sdk.localStorage.removeItem(key);
        } catch {
          // Ignore
        }
      }
      return;
    }
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore
    }
  },
};

function toStrictJsonValue(value: unknown): JsonValue {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (Array.isArray(value)) {
    return value.map((item) => toStrictJsonValue(item));
  }
  if (typeof value === 'object' && value !== null) {
    const out: { [key: string]: JsonValue } = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined || typeof v === 'function' || typeof v === 'symbol') {
        continue;
      }
      out[k] = toStrictJsonValue(v);
    }
    return out;
  }
  return null;
}

export async function platformHttpRequest<T>(
  endpointName: string,
  webPath: string,
  opts: {
    method?: 'GET' | 'POST';
    query?: Record<string, string>;
    body?: unknown;
    token?: string | null;
  } = {},
): Promise<T> {
  const method = opts.method ?? 'GET';
  const sdk = getOptionalSDK();

  if (sdk) {
    if (!sdk.permissions.has('network.request')) {
      throw new Error('未获得网络请求权限（network.request）');
    }
    const requestOptions: HttpRequestOptions<'json'> = {
      method,
      responseType: 'json',
    };
    if (opts.query) {
      const cleanQuery: Record<string, string> = {};
      for (const [k, v] of Object.entries(opts.query)) {
        if (v !== undefined && v !== null) {
          cleanQuery[k] = String(v);
        }
      }
      if (Object.keys(cleanQuery).length > 0) {
        requestOptions.query = cleanQuery;
      }
    }
    if (method === 'POST') {
      requestOptions.json = toStrictJsonValue(opts.body ?? {});
    }
    const res = await sdk.http.request(endpointName, requestOptions);
    const data = res.body as Record<string, unknown> | null;
    if (res.status < 200 || res.status >= 300) {
      throw new Error(
        (typeof data?.error === 'string' && data.error) || `请求失败 (${res.status})`,
      );
    }
    return res.body as T;
  }

  let url = webPath;
  if (opts.query && Object.keys(opts.query).length > 0) {
    const qs = new URLSearchParams(opts.query).toString();
    url = `${webPath}?${qs}`;
  }

  const headers: Record<string, string> = {};
  if (method === 'POST') {
    headers['Content-Type'] = 'application/json';
  }
  if (opts.token) {
    headers.Authorization = `Bearer ${opts.token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: method === 'POST' ? JSON.stringify(opts.body ?? {}) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `请求失败 (${res.status})`);
  }
  return data as T;
}

interface PendingRpc {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  timer: number;
}

function handleRealtimePacket(
  raw: unknown,
  handlers: RealtimeHandlers,
  pendingRpcs: Map<string, PendingRpc>,
) {
  let msg = raw;
  if (typeof msg === 'string') {
    try {
      msg = JSON.parse(msg);
    } catch {
      return;
    }
  }
  if (!msg || typeof msg !== 'object') return;
  const pkt = msg as {
    type?: string;
    data?: unknown;
    reqId?: string;
    ok?: boolean;
    error?: string;
  };
  if (pkt.type === 'rpc:result' && typeof pkt.reqId === 'string') {
    const pending = pendingRpcs.get(pkt.reqId);
    if (!pending) return;
    pendingRpcs.delete(pkt.reqId);
    window.clearTimeout(pending.timer);
    if (pkt.ok) {
      pending.resolve(pkt.data);
    } else {
      pending.reject(new Error(pkt.error || '指令执行失败'));
    }
    return;
  }
  if (pkt.type === 'chat:history' && Array.isArray(pkt.data)) {
    handlers.onHistory(pkt.data as ChatMessage[]);
  } else if (pkt.type === 'chat:message' && pkt.data) {
    handlers.onMessage(pkt.data as ChatMessage);
  } else if (pkt.type === 'map:players' && Array.isArray(pkt.data)) {
    handlers.onMapPlayers(pkt.data as OnlinePlayerSummary[]);
  }
}

export function connectPlatformRealtime(
  realmId: string,
  token: string | null,
  handlers: RealtimeHandlers,
): RealtimeHandle {
  let closed = false;
  let reconnectTimer: number | null = null;
  let pingTimer: number | null = null;
  let attempt = 0;
  let rpcSeq = 0;
  const pendingRpcs = new Map<string, PendingRpc>();

  const rejectAllPending = (reason: string) => {
    for (const [id, pending] of pendingRpcs.entries()) {
      pendingRpcs.delete(id);
      window.clearTimeout(pending.timer);
      pending.reject(new WsTransportError(reason));
    }
  };

  const sdk = getOptionalSDK();
  if (sdk) {
    let activeConn: Awaited<ReturnType<MiniAppSDK['webSocket']['connect']>> | null = null;
    let offMessage: (() => void) | null = null;
    let offClose: (() => void) | null = null;

    const cleanupConn = () => {
      offMessage?.();
      offClose?.();
      offMessage = null;
      offClose = null;
      if (pingTimer) {
        window.clearInterval(pingTimer);
        pingTimer = null;
      }
      rejectAllPending('WebSocket 连接已断开');
    };

    const scheduleReconnect = () => {
      if (closed) return;
      const delay = Math.min(10_000, 1200 * 2 ** Math.min(attempt, 3));
      attempt += 1;
      reconnectTimer = window.setTimeout(() => {
        void openMappSocket();
      }, delay);
    };

    const openMappSocket = async () => {
      if (closed || !sdk.permissions.has('network.websocket')) return;
      try {
        const conn = await sdk.webSocket.connect('realtime', {
          query: { realmId },
        });
        if (closed) {
          void conn.close(1000, 'closed').catch(() => {});
          return;
        }
        attempt = 0;
        activeConn = conn;
        offMessage = conn.on('message', (data) => handleRealtimePacket(data, handlers, pendingRpcs));
        offClose = conn.on('close', () => {
          cleanupConn();
          activeConn = null;
          scheduleReconnect();
        });
        pingTimer = window.setInterval(() => {
          void conn.send({ type: 'ping' }).catch(() => {});
        }, 25_000);
      } catch {
        scheduleReconnect();
      }
    };

    void openMappSocket();

    return {
      sendChat(channel, content, recipientName) {
        void activeConn
          ?.send(
            toStrictJsonValue(
              recipientName
                ? { type: 'chat:send', channel, content, recipientName }
                : { type: 'chat:send', channel, content },
            ),
          )
          .catch(() => {});
      },
      request<T>(type: string, payload?: Record<string, unknown>, timeoutMs = 8000): Promise<T> {
        const conn = activeConn;
        if (!conn) {
          return Promise.reject(new WsTransportError('WebSocket 尚未就绪'));
        }
        const reqId = `r_${Date.now().toString(36)}_${++rpcSeq}`;
        return new Promise<T>((resolve, reject) => {
          const timer = window.setTimeout(() => {
            if (pendingRpcs.delete(reqId)) {
              reject(new WsTransportError('实时请求超时'));
            }
          }, timeoutMs);
          pendingRpcs.set(reqId, {
            resolve: (v) => resolve(v as T),
            reject,
            timer,
          });
          void conn
            .send(toStrictJsonValue({ ...(payload ?? {}), type, reqId }))
            .catch(() => {
              const p = pendingRpcs.get(reqId);
              if (p) {
                pendingRpcs.delete(reqId);
                window.clearTimeout(p.timer);
                p.reject(new WsTransportError('实时发送失败'));
              }
            });
        });
      },
      isConnected() {
        return activeConn !== null;
      },
      close() {
        closed = true;
        if (reconnectTimer) window.clearTimeout(reconnectTimer);
        cleanupConn();
        const conn = activeConn;
        activeConn = null;
        if (conn) {
          void conn.close(1000, 'leave').catch(() => {});
        }
      },
    };
  }

  // Standalone Web native WebSocket
  let ws: WebSocket | null = null;

  const scheduleReconnect = () => {
    if (closed || !token) return;
    const delay = Math.min(10_000, 1000 * 2 ** Math.min(attempt, 3));
    attempt += 1;
    reconnectTimer = window.setTimeout(openWebSocket, delay);
  };

  const openWebSocket = () => {
    if (closed || !token) return;
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const qs = new URLSearchParams({ realmId, token }).toString();
    const sock = new WebSocket(`${proto}//${window.location.host}/ws?${qs}`);
    ws = sock;

    sock.onopen = () => {
      attempt = 0;
      pingTimer = window.setInterval(() => {
        if (sock.readyState === WebSocket.OPEN) {
          sock.send(JSON.stringify({ type: 'ping' }));
        }
      }, 25_000);
    };

    sock.onmessage = (ev) => {
      handleRealtimePacket(ev.data, handlers, pendingRpcs);
    };

    sock.onclose = () => {
      if (pingTimer) {
        window.clearInterval(pingTimer);
        pingTimer = null;
      }
      if (ws === sock) ws = null;
      rejectAllPending('WebSocket 连接已断开');
      scheduleReconnect();
    };
  };

  openWebSocket();

  return {
    sendChat(channel, content, recipientName) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'chat:send', channel, content, recipientName }));
      }
    },
    request<T>(type: string, payload?: Record<string, unknown>, timeoutMs = 8000): Promise<T> {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        return Promise.reject(new WsTransportError('WebSocket 尚未就绪'));
      }
      const reqId = `r_${Date.now().toString(36)}_${++rpcSeq}`;
      return new Promise<T>((resolve, reject) => {
        const timer = window.setTimeout(() => {
          if (pendingRpcs.delete(reqId)) {
            reject(new WsTransportError('实时请求超时'));
          }
        }, timeoutMs);
        pendingRpcs.set(reqId, {
          resolve: (v) => resolve(v as T),
          reject,
          timer,
        });
        try {
          ws!.send(JSON.stringify({ ...(payload ?? {}), type, reqId }));
        } catch {
          pendingRpcs.delete(reqId);
          window.clearTimeout(timer);
          reject(new WsTransportError('实时发送失败'));
        }
      });
    },
    isConnected() {
      return Boolean(ws && ws.readyState === WebSocket.OPEN);
    },
    close() {
      closed = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (pingTimer) window.clearInterval(pingTimer);
      rejectAllPending('WebSocket 已关闭');
      if (ws) {
        ws.close(1000, 'leave');
        ws = null;
      }
    },
  };
}

// ============================================================
// Dual-mode Static Asset Loader (Web URL vs MAPP SDK Blob URL)
// ============================================================

const assetUrlCache = new Map<string, string>();
const assetUrlPending = new Map<string, Promise<string>>();
const assetImageCache = new Map<string, HTMLImageElement | null>();
const assetImagePending = new Map<string, Promise<HTMLImageElement | null>>();

export function normalizeAssetPath(relPath: string): string {
  return relPath.replace(/^\/+/, '').replace(/^assets\/hxsg\//, '');
}

function guessImageMime(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.avif')) return 'image/avif';
  return 'image/png';
}

export function getAssetUrlSync(relPath: string): string | null {
  const clean = normalizeAssetPath(relPath);
  if (!isMappRuntime()) {
    return `/assets/hxsg/${clean}`;
  }
  return assetUrlCache.get(clean) ?? null;
}

export function resolveAssetUrl(relPath: string): Promise<string> {
  const clean = normalizeAssetPath(relPath);
  if (!isMappRuntime()) {
    return Promise.resolve(`/assets/hxsg/${clean}`);
  }

  const cached = assetUrlCache.get(clean);
  if (cached) return Promise.resolve(cached);

  const pending = assetUrlPending.get(clean);
  if (pending) return pending;

  const sdk = getOptionalSDK()!;
  const virtualPath = `assets/hxsg/${clean}`;
  const job = sdk.assets
    .readBytes(virtualPath)
    .then((bytes) => {
      const safeBytes = new Uint8Array(bytes.byteLength);
      safeBytes.set(bytes);
      const blob = new Blob([safeBytes], { type: guessImageMime(clean) });
      const blobUrl = URL.createObjectURL(blob);
      assetUrlCache.set(clean, blobUrl);
      return blobUrl;
    })
    .finally(() => {
      assetUrlPending.delete(clean);
    });

  assetUrlPending.set(clean, job);
  return job;
}

export function getCachedAssetImage(relPath: string): HTMLImageElement | null | undefined {
  const clean = normalizeAssetPath(relPath);
  return assetImageCache.has(clean) ? assetImageCache.get(clean) : undefined;
}

export function loadAssetImage(relPath: string): Promise<HTMLImageElement | null> {
  const clean = normalizeAssetPath(relPath);
  if (assetImageCache.has(clean)) {
    return Promise.resolve(assetImageCache.get(clean) ?? null);
  }
  const pending = assetImagePending.get(clean);
  if (pending) return pending;

  const job = resolveAssetUrl(clean)
    .then(
      (url) =>
        new Promise<HTMLImageElement | null>((resolve) => {
          const img = new Image();
          img.onload = () => {
            assetImageCache.set(clean, img);
            resolve(img);
          };
          img.onerror = () => {
            assetImageCache.set(clean, null);
            resolve(null);
          };
          img.src = url;
        }),
    )
    .catch(() => {
      assetImageCache.set(clean, null);
      return null;
    })
    .finally(() => {
      assetImagePending.delete(clean);
    });

  assetImagePending.set(clean, job);
  return job;
}
