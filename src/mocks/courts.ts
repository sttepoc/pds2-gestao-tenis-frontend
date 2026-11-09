import { ApiError } from '../api/error';
import type { ApiServices, Court, CourtInput, Surface } from '../api/types';
import type { MockContext } from './context';

const SURFACES: Surface[] = ['clay', 'hard', 'grass', 'synthetic'];
const KEYS = ['name', 'surface', 'covered'];

function invalid(field: string, message: string): never {
  throw new ApiError('Os dados informados são inválidos.', 422, { [field]: [message] });
}

const copy = (court: Court): Court => ({ ...court, maintenance: court.maintenance.map((item) => ({ ...item })) });

export function courtHandlers(ctx: MockContext): Pick<ApiServices, 'listCourts' | 'createCourt' | 'updateCourt'> {
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
  };
}
