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
}
