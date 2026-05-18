import { DisciplineDTO, MemberStatus } from '@alentapp/shared';

// Puerto de salida para persistencia de disciplinas.
// El dominio no depende de Prisma ni de Postgres: solo conoce este contrato.
export interface DisciplineRepository {
  create(discipline: Omit<DisciplineDTO, 'id'>): Promise<DisciplineDTO>;
  findById(id: string): Promise<DisciplineDTO | null>;
  findByMemberId(memberId: string): Promise<DisciplineDTO[]>;
  findActiveTotalSuspensionsByMemberId(memberId: string, referenceDate?: Date): Promise<DisciplineDTO[]>;
  update(id: string, discipline: Partial<Omit<DisciplineDTO, 'id' | 'member_id'>>): Promise<DisciplineDTO>;
  //Se agrega este metodo para actualizar la disciplina y el estado del socio en una sola transaccion
  updateWithMemberStatus(
    id: string,
    discipline: Partial<Omit<DisciplineDTO, 'id' | 'member_id'>>,
    memberId: string,
    memberStatus: MemberStatus
  ): Promise<DisciplineDTO>;
  //Borrado fisico
  delete(id: string): Promise<void>;
  //Borrado fisico y actualiza el estado del socio si se trataba de una suspension total
  deleteWithMemberStatus(
    id: string,
    memberId: string,
    memberStatus: MemberStatus
  ): Promise<void>;

}
