import { DisciplineRepository } from '../../domain/DisciplineRepository.js';
import { DisciplineValidator } from '../../domain/services/DisciplineValidator.js';

const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(value: string): boolean {
    return UUID_REGEX.test(value.trim());
}

export class DeleteDisciplineUseCase {
    constructor(
        private readonly disciplineRepository: DisciplineRepository,
        private readonly validator: DisciplineValidator
    ) {}

    async execute(id: string): Promise<void> {
        if (!isValidUuid(id)) {
            throw new Error('Identificador de disciplina inválido');
        }

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
