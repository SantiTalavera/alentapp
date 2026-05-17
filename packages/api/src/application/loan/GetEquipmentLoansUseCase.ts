import { EquipmentLoanDTO } from '@alentapp/shared';
import { EquipmentLoanRepository } from '../../domain/EquipmentLoanRepository.js';
import { EquipmentLoanValidator } from '../../domain/services/EquipmentLoanValidator.js';

export class GetEquipmentLoansUseCase {
    constructor(
        private readonly equipmentLoanRepository: EquipmentLoanRepository,
        private readonly equipmentLoanValidator: EquipmentLoanValidator,
    ) { }

    async execute(filters?: { memberId?: string }): Promise<EquipmentLoanDTO[]> {
        // Si llega un memberId como filtro, valida que sea UUID válido
        if (filters?.memberId !== undefined && filters.memberId.trim() !== '') {
            this.equipmentLoanValidator.validateMemberId(filters.memberId.trim());
            return this.equipmentLoanRepository.findAll({ memberId: filters.memberId.trim() });
        }

        return this.equipmentLoanRepository.findAll();
    }
}
