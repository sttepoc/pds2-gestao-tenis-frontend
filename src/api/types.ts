export type User = { id: number; name: string; email: string; created_at: string };
export type Session = { token: string; expiresAt: string; user: User };
export type RegisterInput = {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
};
export type MemberStatus = 'active' | 'inactive';
export type Member = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  status: MemberStatus;
  created_at: string;
  updated_at: string;
};
export type CreateMemberInput = { name: string; email: string; phone?: string | null; status?: MemberStatus };
export type UpdateMemberInput = Partial<CreateMemberInput>;
export type MemberQuery = { page?: number; page_size?: number; status?: MemberStatus; q?: string };
export type MemberList = {
  data: Member[];
  meta: { page: number; page_size: number; total: number; total_pages: number };
};

export type Surface = 'clay' | 'hard' | 'grass' | 'synthetic';
export type MaintenanceWindow = { id: number; starts_at: string; ends_at: string; reason: string };
export type Court = { id: number; name: string; surface: Surface; covered: boolean; maintenance: MaintenanceWindow[] };
export type CourtInput = { name: string; surface: Surface; covered: boolean };
export type MaintenanceInput = { starts_at: string; ends_at: string; reason: string; cancel_bookings?: boolean };
export type Player = { id: number; name: string };
export type SlotStatus = 'free' | 'booked' | 'mine' | 'maintenance';
export type Slot = {
  court_id: number;
  starts_at: string;
  ends_at: string;
  status: SlotStatus;
  booking_id: number | null;
  waitlist_size: number;
  waitlist_entry_id: number | null;
};
export type Schedule = { date: string; courts: Court[]; slots: Slot[] };
export type Attendance = 'pending' | 'confirmed' | 'declined';
export type Participant = Player & { attendance: Attendance };
export type Booking = {
  id: number;
  court: { id: number; name: string };
  starts_at: string;
  ends_at: string;
  status: 'active' | 'cancelled' | 'completed';
  organizer: Player;
  participants: Participant[];
  my_role: 'organizer' | 'participant';
};
export type BookingInput = { court_id: number; starts_at: string; participant_ids: number[] };
export type SlotRef = { court_id: number; starts_at: string };
export type WaitlistEntry = {
  id: number;
  court: { id: number; name: string };
  starts_at: string;
  ends_at: string;
  position: number;
  offer: { expires_at: string } | null;
};

/** Contrato único usado tanto pela API HTTP quanto pelo simulador. */
export interface ApiServices {
  login(email: string, password: string): Promise<Session>;
  fetchCurrentUser(token: string): Promise<User>;
  logout(token: string): Promise<void>;
  register(input: RegisterInput): Promise<User>;
  listMembers(token: string, query?: MemberQuery): Promise<MemberList>;
  getMember(token: string, id: number): Promise<Member>;
  createMember(token: string, input: CreateMemberInput): Promise<Member>;
  updateMember(token: string, id: number, input: UpdateMemberInput): Promise<Member>;
  deleteMember(token: string, id: number): Promise<void>;
  listCourts(token: string): Promise<Court[]>;
  createCourt(token: string, input: CourtInput): Promise<Court>;
  updateCourt(token: string, id: number, input: Partial<CourtInput>): Promise<Court>;
  addMaintenance(token: string, courtId: number, input: MaintenanceInput): Promise<Court>;
  removeMaintenance(token: string, courtId: number, maintenanceId: number): Promise<Court>;
  getSchedule(token: string, date: string): Promise<Schedule>;
  searchPlayers(token: string, q: string): Promise<Player[]>;
  createBooking(token: string, input: BookingInput): Promise<Booking>;
  listBookings(token: string, scope: 'upcoming' | 'past'): Promise<Booking[]>;
  getBooking(token: string, id: number): Promise<Booking>;
  cancelBooking(token: string, id: number): Promise<Booking>;
  rescheduleBooking(token: string, id: number, input: SlotRef): Promise<Booking>;
  respondAttendance(token: string, id: number, response: 'confirmed' | 'declined'): Promise<Booking>;
  listWaitlist(token: string): Promise<WaitlistEntry[]>;
  joinWaitlist(token: string, input: SlotRef): Promise<WaitlistEntry>;
  leaveWaitlist(token: string, id: number): Promise<void>;
  acceptOffer(token: string, id: number): Promise<Booking>;
  declineOffer(token: string, id: number): Promise<void>;
}
