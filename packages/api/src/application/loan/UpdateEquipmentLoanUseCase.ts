import { EquipmentLoanDTO, UpdateEquipmentLoanRequest } from '@alentapp/shared';
import { EquipmentLoanRepository } from '../../domain/EquipmentLoanRepository.js';
import { EquipmentLoanValidator } from '../../domain/services/EquipmentLoanValidator.js';

export class UpdateEquipmentLoanUseCase {
    constructor(
        private readonly equipmentLoanRepository: EquipmentLoanRepository,
        private readonly equipmentLoanValidator: EquipmentLoanValidator,
    ) {}

    async execute(id: string, data: UpdateEquipmentLoanRequest): Promise<EquipmentLoanDTO> {
        this.equipmentLoanValidator.validateId(id.trim());

        if (Object.keys(data).length === 0 || (data.status === undefined && data.due_date === undefined)) {
            throw new Error('El cuerpo de la solicitud no puede estar vacío');
        }

        const loan = await this.equipmentLoanRepository.findById(id.trim());
        
        if (loan === null) {
            throw new Error('El préstamo no existe');
        }

        if (data.status !== undefined && data.status !== loan.status) {
            this.equipmentLoanValidator.validateStatusTransition(loan.status, data.status);
        }

        if (data.due_date !== undefined && data.due_date !== null) {
             const due = new Date(data.due_date);
             if (isNaN(due.getTime())) {
                 throw new Error('La fecha de devolución no es válida');
             }
             
             // Comparamos solo la parte de la fecha (YYYY-MM-DD) para ignorar la hora
             const loanDateStr = loan.loan_date.split('T')[0];
             const dueDateStr = data.due_date.split('T')[0];
             
             if (dueDateStr < loanDateStr) {
                 throw new Error('La fecha de devolución no puede ser anterior a la fecha de préstamo');
             }
        }

        return this.equipmentLoanRepository.update(id.trim(), {
             ...(data.status !== undefined && { status: data.status }),
             ...(data.due_date !== undefined && { due_date: data.due_date })
        });
    }
}
