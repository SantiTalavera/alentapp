import { DisciplineDTO } from '@alentapp/shared';

// Puerto de salida para persistencia de disciplinas.
// El dominio no depende de Prisma ni de Postgres: solo conoce este contrato.
export interface DisciplineRepository {
  create(discipline: Omit<DisciplineDTO, 'id'>): Promise<DisciplineDTO>;
  findById(id: string): Promise<DisciplineDTO | null>;
  findActiveTotalSuspensionsByMemberId(memberId: string, referenceDate?: Date): Promise<DisciplineDTO[]>;
  update(id: string, discipline: Partial<Omit<DisciplineDTO, 'id' | 'member_id'>>): Promise<DisciplineDTO>;
}
