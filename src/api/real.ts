import { pathId, request } from './http';
import type { ApiServices, Booking, Court, CourtInput, Member, Player, Schedule, User, WaitlistEntry } from './types';

const authorization = (token: string) => ({ Authorization: `Bearer ${token}` });
const json = (method: string, input: unknown, token?: string): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json', ...(token ? authorization(token) : {}) },
  body: JSON.stringify(input),
});
const send = (method: string, token: string): RequestInit => ({ method, headers: authorization(token) });
async function unwrap<T>(path: string, init: RequestInit): Promise<T> {
  return (await request<{ data: T }>(path, init)).data;
}

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

  // Corpos montados campo a campo: nada além do contrato chega ao servidor.
  listCourts: async (token) => unwrap<Court[]>('/courts', send('GET', token)),
  createCourt: async (token, input) =>
    unwrap<Court>('/courts', json('POST', { name: input.name, surface: input.surface, covered: input.covered }, token)),
  async updateCourt(token, id, input) {
    const body: Partial<CourtInput> = {};
    if (input.name !== undefined) body.name = input.name;
    if (input.surface !== undefined) body.surface = input.surface;
    if (input.covered !== undefined) body.covered = input.covered;
    return unwrap<Court>(`/courts/${pathId(id)}`, json('PATCH', body, token));
  },
  async addMaintenance(token, courtId, input) {
    const body = { starts_at: input.starts_at, ends_at: input.ends_at, reason: input.reason,
      ...(input.cancel_bookings !== undefined ? { cancel_bookings: input.cancel_bookings } : {}) };
    return unwrap<Court>(`/courts/${pathId(courtId)}/maintenance`, json('POST', body, token));
  },
  removeMaintenance: async (token, courtId, maintenanceId) =>
    unwrap<Court>(`/courts/${pathId(courtId)}/maintenance/${pathId(maintenanceId)}`, send('DELETE', token)),
  getSchedule: async (token, date) => unwrap<Schedule>(`/schedule?${new URLSearchParams({ date })}`, send('GET', token)),
  searchPlayers: async (token, q) => unwrap<Player[]>(`/players?${new URLSearchParams({ q })}`, send('GET', token)),
  createBooking: async (token, input) => unwrap<Booking>('/bookings', json('POST', {
    court_id: input.court_id, starts_at: input.starts_at, participant_ids: input.participant_ids,
  }, token)),
  listBookings: async (token, scope) => unwrap<Booking[]>(`/bookings?${new URLSearchParams({ scope })}`, send('GET', token)),
  getBooking: async (token, id) => unwrap<Booking>(`/bookings/${pathId(id)}`, send('GET', token)),
  cancelBooking: async (token, id) => unwrap<Booking>(`/bookings/${pathId(id)}/cancel`, send('POST', token)),
  rescheduleBooking: async (token, id, input) =>
    unwrap<Booking>(`/bookings/${pathId(id)}`, json('PATCH', { court_id: input.court_id, starts_at: input.starts_at }, token)),
  respondAttendance: async (token, id, response) =>
    unwrap<Booking>(`/bookings/${pathId(id)}/attendance`, json('PUT', { response }, token)),
  listWaitlist: async (token) => unwrap<WaitlistEntry[]>('/waitlist', send('GET', token)),
  joinWaitlist: async (token, input) =>
    unwrap<WaitlistEntry>('/waitlist', json('POST', { court_id: input.court_id, starts_at: input.starts_at }, token)),
  leaveWaitlist: async (token, id) => request<void>(`/waitlist/${pathId(id)}`, send('DELETE', token)),
  acceptOffer: async (token, id) => unwrap<Booking>(`/waitlist/${pathId(id)}/accept`, send('POST', token)),
  declineOffer: async (token, id) => request<void>(`/waitlist/${pathId(id)}/decline`, send('POST', token)),
};
