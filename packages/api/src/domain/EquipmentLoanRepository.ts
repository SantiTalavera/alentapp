import { EquipmentLoanDTO } from '@alentapp/shared';

// Puerto de salida — el dominio declara qué necesita sin importarle la implementación.

export interface EquipmentLoanRepository {
    create(data: Pick<EquipmentLoanDTO, 'item_name' | 'due_date' | 'member_id'>): Promise<EquipmentLoanDTO>;
    findById(id: string): Promise<EquipmentLoanDTO | null>;
    findAll(filters?: { memberId?: string }): Promise<EquipmentLoanDTO[]>;
    update(id: string, data: Partial<Pick<EquipmentLoanDTO, 'status' | 'due_date'>>): Promise<EquipmentLoanDTO>;
    softDelete(id: string): Promise<EquipmentLoanDTO>;
}
