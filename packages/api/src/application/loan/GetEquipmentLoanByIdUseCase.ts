import { EquipmentLoanDTO } from '@alentapp/shared';
import { EquipmentLoanRepository } from '../../domain/EquipmentLoanRepository.js';
import { EquipmentLoanValidator } from '../../domain/services/EquipmentLoanValidator.js';

export class GetEquipmentLoanByIdUseCase {
    constructor(
        private readonly equipmentLoanRepository: EquipmentLoanRepository,
        private readonly equipmentLoanValidator: EquipmentLoanValidator,
    ) {}

    async execute(id: string): Promise<EquipmentLoanDTO> {
        // Valida que el id tenga formato UUID antes de consultar la base
        this.equipmentLoanValidator.validateId(id.trim());

        const loan = await this.equipmentLoanRepository.findById(id.trim());

        if (loan === null) {
            throw new Error('El préstamo no existe');
        }

        return loan;
    }
}
