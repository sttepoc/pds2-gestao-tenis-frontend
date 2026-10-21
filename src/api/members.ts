import { getApi } from './client';
import type { CreateMemberInput, MemberQuery, UpdateMemberInput } from './types';

export async function listMembers(token: string, query?: MemberQuery) {
  return (await getApi()).listMembers(token, query);
}
export async function getMember(token: string, id: number) {
  return (await getApi()).getMember(token, id);
}
export async function createMember(token: string, input: CreateMemberInput) {
  return (await getApi()).createMember(token, input);
}
export async function updateMember(token: string, id: number, input: UpdateMemberInput) {
  return (await getApi()).updateMember(token, id, input);
}
export async function deleteMember(token: string, id: number) {
  return (await getApi()).deleteMember(token, id);
}
