import { request } from './http';
import type { ApiServices, Member, User } from './types';

const authorization = (token: string) => ({ Authorization: `Bearer ${token}` });
const json = (method: string, input: unknown, token?: string): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json', ...(token ? authorization(token) : {}) },
  body: JSON.stringify(input),
});

export const realApi: ApiServices = {
  async login(email, password) {
    const data = await request<{ access_token: string; expires_at: string; user: User }>(
      '/auth/login', json('POST', { email, password }),
    );
    return { token: data.access_token, expiresAt: data.expires_at, user: data.user };
  },
  async fetchCurrentUser(token) {
    return (await request<{ data: User }>('/auth/me', { headers: authorization(token) })).data;
  },
  logout: (token) => request('/auth/logout', { method: 'POST', headers: authorization(token) }),
  async register(input) {
    return (await request<{ data: User }>('/auth/register', json('POST', input))).data;
  },
  listMembers(token, query = {}) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) params.set(key, String(value));
    }
    return request(`/members${params.size ? `?${params}` : ''}`, { headers: authorization(token) });
  },
  async getMember(token, id) {
    return (await request<{ data: Member }>(`/members/${id}`, { headers: authorization(token) })).data;
  },
  async createMember(token, input) {
    return (await request<{ data: Member }>('/members', json('POST', input, token))).data;
  },
  async updateMember(token, id, input) {
    return (await request<{ data: Member }>(`/members/${id}`, json('PATCH', input, token))).data;
  },
  deleteMember: (token, id) => request(`/members/${id}`, { method: 'DELETE', headers: authorization(token) }),
};
