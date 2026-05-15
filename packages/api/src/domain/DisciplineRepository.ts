import { DisciplineDTO } from '@alentapp/shared';

// Puerto de salida para persistencia de disciplinas.
// El dominio no depende de Prisma ni de Postgres: solo conoce este contrato.
export interface DisciplineRepository {
  create(discipline: Omit<DisciplineDTO, 'id'>): Promise<DisciplineDTO>;
  findActiveTotalSuspensionsByMemberId(memberId: string, referenceDate?: Date): Promise<DisciplineDTO[]>;
}
