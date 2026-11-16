const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type IceServerConfig = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

const DEFAULT_STUN = 'stun:stun.l.google.com:19302';

function parseUrls(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** STUN público no cliente — sem credencial TURN exposta. */
export function getPublicStunIceServers(): IceServerConfig[] {
  const stunUrls = parseUrls(process.env.NEXT_PUBLIC_ICE_STUN_URLS);
  if (stunUrls.length) {
    return [{ urls: stunUrls }];
  }
  return [{ urls: DEFAULT_STUN }];
}

let cachedAuthServers: IceServerConfig[] | null = null;
let cachedForToken: string | null = null;

/** ICE completo (incl. TURN) via endpoint autenticado da API. */
export async function resolveIceServers(authToken: string | null): Promise<IceServerConfig[]> {
  const base = getPublicStunIceServers();
  if (!authToken) return base;
  if (cachedForToken === authToken && cachedAuthServers) {
    return cachedAuthServers;
  }
  try {
    const res = await fetch(`${API_URL}/api/chat/ice-servers`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!res.ok) return base;
    const data = (await res.json()) as { iceServers?: IceServerConfig[] };
    const merged =
      data.iceServers?.length ? data.iceServers : base;
    cachedForToken = authToken;
    cachedAuthServers = merged;
    return merged;
  } catch {
    return base;
  }
}