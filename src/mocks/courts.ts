import { ApiError } from '../api/error';
import type { ApiServices, Court, CourtInput, MaintenanceInput, Surface } from '../api/types';
import type { MockContext } from './context';

const SURFACES: Surface[] = ['clay', 'hard', 'grass', 'synthetic'];
const KEYS = ['name', 'surface', 'covered'];
const MAINTENANCE_KEYS = ['starts_at', 'ends_at', 'reason', 'cancel_bookings'];
const HOUR = 3600000;

function invalid(field: string, message: string): never {
  throw new ApiError('Os dados informados são inválidos.', 422, { [field]: [message] });
}

const copy = (court: Court): Court => ({ ...court, maintenance: court.maintenance.map((item) => ({ ...item })) });

export function courtHandlers(ctx: MockContext): Pick<ApiServices, 'listCourts' | 'createCourt' | 'updateCourt' | 'addMaintenance' | 'removeMaintenance'> {
  function validate(input: Partial<CourtInput>, partial: boolean): Partial<CourtInput> {
    for (const key of Object.keys(input)) {
      if (!KEYS.includes(key)) invalid(key, 'Este campo não pode ser informado.');
    }
    const values: Partial<CourtInput> = {};
    if (!partial || 'name' in input) {
      const name = typeof input.name === 'string' ? input.name.trim() : '';
      const size = Array.from(name).length;
      if (size < 1 || size > 60) invalid('name', 'Informe um nome de 1 a 60 caracteres.');
      values.name = name;
    }
    if (!partial || 'surface' in input) {
      if (!SURFACES.includes(input.surface as Surface)) invalid('surface', 'Escolha um piso válido.');
      values.surface = input.surface;
    }
    if (!partial || 'covered' in input) {
      if (typeof input.covered !== 'boolean') invalid('covered', 'Informe se a quadra é coberta.');
      values.covered = input.covered;
    }
    return values;
  }

  function uniqueName(name: string | undefined, id?: number) {
    if (name && ctx.db.courts.some((court) => court.id !== id && court.name.toLowerCase() === name.toLowerCase())) {
      const message = 'Já existe uma quadra com este nome.';
      throw new ApiError(message, 409, { name: [message] });
    }
  }

  function findCourt(id: number) {
    const court = Number.isSafeInteger(id) ? ctx.db.courts.find((item) => item.id === id) : undefined;
    if (!court) throw new ApiError('Quadra não encontrada.', 404);
    return court;
  }

  return {
    async listCourts(token) {
      await ctx.wait();
      ctx.authenticate(token);
      return ctx.db.courts.map(copy);
    },
    async createCourt(token, input) {
      await ctx.wait();
      ctx.authenticate(token, true);
      const values = validate(input, false);
      uniqueName(values.name);
      const court: Court = {
        id: ctx.db.nextId++, name: values.name!, surface: values.surface!, covered: values.covered!, maintenance: [],
      };
      ctx.db.courts.push(court);
      ctx.persist();
      return copy(court);
    },
    async updateCourt(token, id, input) {
      await ctx.wait();
      ctx.authenticate(token, true);
      const values = validate(input, true);
      const court = Number.isSafeInteger(id) ? ctx.db.courts.find((item) => item.id === id) : undefined;
      if (!court) throw new ApiError('Quadra não encontrada.', 404);
      uniqueName(values.name, id);
      Object.assign(court, values);
      ctx.persist();
      return copy(court);
    },
    async addMaintenance(token, id, input: MaintenanceInput) {
      await ctx.wait();
      ctx.authenticate(token, true);
      for (const key of Object.keys(input)) {
        if (!MAINTENANCE_KEYS.includes(key)) invalid(key, 'Este campo não pode ser informado.');
      }
      const start = typeof input.starts_at === 'string' ? Date.parse(input.starts_at) : NaN;
      const end = typeof input.ends_at === 'string' ? Date.parse(input.ends_at) : NaN;
      if (Number.isNaN(start)) invalid('starts_at', 'Informe o início da manutenção.');
      if (Number.isNaN(end)) invalid('ends_at', 'Informe o fim da manutenção.');
      if (end <= start) invalid('ends_at', 'O fim precisa ser depois do início.');
      const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
      const size = Array.from(reason).length;
      if (size < 1 || size > 200) invalid('reason', 'Informe um motivo de 1 a 200 caracteres.');
      if (input.cancel_bookings !== undefined && typeof input.cancel_bookings !== 'boolean') {
        invalid('cancel_bookings', 'Valor inválido.');
      }
      const court = findCourt(id);
      // Sobreposição: início < fim do outro e início do outro < fim.
      const affected = ctx.db.bookings.filter((item) => item.court_id === court.id && item.status === 'active'
        && start < Date.parse(item.ends_at) && Date.parse(item.starts_at) < end);
      if (affected.length > 0 && input.cancel_bookings !== true) {
        const message = `Há ${affected.length} reserva(s) nesse período.`;
        throw new ApiError(message, 409, { cancel_bookings: [message] });
      }
      for (const booking of affected) booking.status = 'cancelled';
      ctx.db.waitlist = ctx.db.waitlist.filter((entry) => !(entry.court_id === court.id
        && start < Date.parse(entry.starts_at) + HOUR && Date.parse(entry.starts_at) < end));
      court.maintenance.push({
        id: ctx.db.nextId++,
        starts_at: new Date(start).toISOString(),
        ends_at: new Date(end).toISOString(),
        reason,
      });
      ctx.persist();
      return copy(court);
    },
    async removeMaintenance(token, id, maintenanceId) {
      await ctx.wait();
      ctx.authenticate(token, true);
      const court = findCourt(id);
      const index = court.maintenance.findIndex((item) => item.id === maintenanceId);
      if (index < 0) throw new ApiError('Manutenção não encontrada.', 404);
      court.maintenance.splice(index, 1);
      ctx.persist();
      return copy(court);
    },
  };
}
