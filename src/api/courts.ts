import { getApi } from './client';
import type { CourtInput, MaintenanceInput } from './types';

export async function listCourts(token: string) {
  return (await getApi()).listCourts(token);
}
export async function createCourt(token: string, input: CourtInput) {
  return (await getApi()).createCourt(token, input);
}
export async function updateCourt(token: string, id: number, input: Partial<CourtInput>) {
  return (await getApi()).updateCourt(token, id, input);
}
export async function addMaintenance(token: string, courtId: number, input: MaintenanceInput) {
  return (await getApi()).addMaintenance(token, courtId, input);
}
export async function removeMaintenance(token: string, courtId: number, maintenanceId: number) {
  return (await getApi()).removeMaintenance(token, courtId, maintenanceId);
}
