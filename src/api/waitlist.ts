import { getApi } from './client';
import type { SlotRef } from './types';

export async function listWaitlist(token: string) {
  return (await getApi()).listWaitlist(token);
}
export async function joinWaitlist(token: string, input: SlotRef) {
  return (await getApi()).joinWaitlist(token, input);
}
export async function leaveWaitlist(token: string, id: number) {
  return (await getApi()).leaveWaitlist(token, id);
}
export async function acceptOffer(token: string, id: number) {
  return (await getApi()).acceptOffer(token, id);
}
export async function declineOffer(token: string, id: number) {
  return (await getApi()).declineOffer(token, id);
}
