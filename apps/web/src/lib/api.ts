const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type User = { id: string; email: string; name: string | null };

export type Channel = {
  id: string;
  name: string | null;
  slug: string;
  type: 'PUBLIC' | 'PRIVATE' | 'DM' | string;
  description: string | null;
  isDefault?: boolean;
  members?: User[];
};

export type Message = {
  id: string;
  channelId: string;
  body: string;
  createdAt: string;
  author: User;
};

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers ?? {}),
  };
  if (token) {
    (headers as Record<string, string>).Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${API_URL}/api${path}`, {
    ...options,
    headers,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<T>;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ accessToken: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (email: string, name: string, password: string) =>
    request<{ accessToken: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, name, password }),
    }),
  me: (token: string) => request<User>('/auth/me', {}, token),
  users: (token: string) => request<User[]>('/users', {}, token),
  channels: (token: string) => request<Channel[]>('/channels', {}, token),
  createChannel: (
    token: string,
    data: {
      name: string;
      description?: string;
      type?: 'PUBLIC' | 'PRIVATE';
      memberIds?: string[];
    },
  ) =>
    request<Channel>(
      '/channels',
      { method: 'POST', body: JSON.stringify(data) },
      token,
    ),
  createDm: (token: string, otherUserId: string) =>
    request<Channel>(
      '/channels/dm',
      { method: 'POST', body: JSON.stringify({ otherUserId }) },
      token,
    ),
  messages: (token: string, channelId: string) =>
    request<Message[]>(`/channels/${channelId}/messages`, {}, token),
  sendMessage: (token: string, channelId: string, body: string) =>
    request<Message>(
      `/channels/${channelId}/messages`,
      { method: 'POST', body: JSON.stringify({ body }) },
      token,
    ),
};
