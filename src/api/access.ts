import { ApiError } from './error';
import { listMembers } from './members';

/** A API atual não expõe is_admin: a permissão vem de uma operação protegida. */
export async function checkMemberAccess(token: string): Promise<'allowed' | 'denied'> {
  try {
    await listMembers(token, { page_size: 1 });
    return 'allowed';
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) return 'denied';
    throw error;
  }
}
