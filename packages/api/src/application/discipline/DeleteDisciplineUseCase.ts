import { DisciplineRepository } from '../../domain/DisciplineRepository.js';
import { DisciplineValidator } from '../../domain/services/DisciplineValidator.js';

export class DeleteDisciplineUseCase {
    constructor(
        private readonly disciplineRepository: DisciplineRepository,
        private readonly validator: DisciplineValidator
    ) {}

    async execute(id: string): Promise<void> {
        this.validator.validateDisciplineId(id);
        const normalizedId = id.trim();

        const discipline = await this.disciplineRepository.findById(normalizedId);
        if (!discipline) {
            throw new Error('La disciplina no existe');
        }

        const isActiveTotalSuspension =
            discipline.is_total_suspension &&
            this.validator.isActive(discipline.start_date, discipline.end_date);

        if (!isActiveTotalSuspension || discipline.previous_member_status === null) {
            await this.disciplineRepository.delete(normalizedId);
            return;
        }

        const activeTotalSuspensions =
            await this.disciplineRepository.findActiveTotalSuspensionsByMemberId(
                discipline.member_id
            );

        const otherActiveTotalSuspensions = activeTotalSuspensions.filter(
            (activeDiscipline) => activeDiscipline.id !== discipline.id
        );

        if (otherActiveTotalSuspensions.length > 0) {
            await this.disciplineRepository.delete(normalizedId);
            return;
        }

        await this.disciplineRepository.deleteWithMemberStatus(
            normalizedId,
            discipline.member_id,
            discipline.previous_member_status
        );
    }
}
