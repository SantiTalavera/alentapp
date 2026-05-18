import { EquipmentLoanDTO } from '@alentapp/shared';
import { EquipmentLoanRepository } from '../../domain/EquipmentLoanRepository.js';

export class DeleteEquipmentLoanUseCase {
    constructor(
        private readonly equipmentLoanRepository: EquipmentLoanRepository,
    ) {}

    async execute(id: string): Promise<EquipmentLoanDTO> {
        const loan = await this.equipmentLoanRepository.findById(id);

        if (!loan) {
            throw new Error('El préstamo no existe');
        }

        if (loan.status === 'Devuelto' || loan.status === 'Dañado') {
            throw new Error('No se puede eliminar un préstamo con estado Returned/Damaged');
        }

        return await this.equipmentLoanRepository.softDelete(id);
    }
}
