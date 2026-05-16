import { DisciplineDTO, UpdateDisciplineRequest } from '@alentapp/shared';
import { DisciplineRepository } from '../../domain/DisciplineRepository.js';
import { MemberRepository } from '../../domain/MemberRepository.js';
import { DisciplineValidator } from '../../domain/services/DisciplineValidator.js';

type UpdateDisciplineInput = UpdateDisciplineRequest & Record<string, unknown>;

export class UpdateDisciplineUseCase {
    constructor(
        private readonly disciplineRepo: DisciplineRepository,
        private readonly memberRepo: MemberRepository,
        private readonly validator: DisciplineValidator
    ) {}

    async execute(id: string, data: UpdateDisciplineInput): Promise<DisciplineDTO> {
        this.validator.validateUpdateRequest(data);

        const currentDiscipline = await this.disciplineRepo.findById(id);
        if (!currentDiscipline) {
            throw new Error('La disciplina no existe');
        }

        const resultingDiscipline = {
            ...currentDiscipline,
            ...data,
        };

        this.validator.validateResultingDateRange(
            resultingDiscipline.start_date,
            resultingDiscipline.end_date
        );

        const wasActiveTotalSuspension =
            currentDiscipline.is_total_suspension &&
            this.validator.isActive(currentDiscipline.start_date, currentDiscipline.end_date);

        const isActiveTotalSuspension =
            resultingDiscipline.is_total_suspension &&
            this.validator.isActive(resultingDiscipline.start_date, resultingDiscipline.end_date);

        const updateData: Partial<Omit<DisciplineDTO, 'id' | 'member_id'>> = {
            reason: resultingDiscipline.reason,
            start_date: resultingDiscipline.start_date,
            end_date: resultingDiscipline.end_date,
            is_total_suspension: resultingDiscipline.is_total_suspension,
            previous_member_status: currentDiscipline.previous_member_status,
        };

        if (!wasActiveTotalSuspension && isActiveTotalSuspension) {
            const member = await this.memberRepo.findById(currentDiscipline.member_id);
            if (!member) {
                throw new Error('El socio no existe');
            }

            const activeTotalSuspensions =
                await this.disciplineRepo.findActiveTotalSuspensionsByMemberId(
                    currentDiscipline.member_id
                );

            const otherActiveTotalSuspensions = activeTotalSuspensions.filter(
                (discipline) => discipline.id !== currentDiscipline.id
            );

            const existingPreviousStatus =
                otherActiveTotalSuspensions.find(
                    (discipline) => discipline.previous_member_status !== null
                )?.previous_member_status ?? null;

            const previousMemberStatus =
                existingPreviousStatus ?? (member.status === 'Suspendido' ? null : member.status);

            this.validator.validatePreviousMemberStatus(previousMemberStatus);

            updateData.previous_member_status = previousMemberStatus;

            await this.memberRepo.update(currentDiscipline.member_id, {
                status: 'Suspendido',
            });
        }

        if (wasActiveTotalSuspension && !isActiveTotalSuspension) {
            const activeTotalSuspensions =
                await this.disciplineRepo.findActiveTotalSuspensionsByMemberId(
                    currentDiscipline.member_id
                );

            const otherActiveTotalSuspensions = activeTotalSuspensions.filter(
                (discipline) => discipline.id !== currentDiscipline.id
            );

            if (
                otherActiveTotalSuspensions.length === 0 &&
                currentDiscipline.previous_member_status !== null
            ) {
                await this.memberRepo.update(currentDiscipline.member_id, {
                    status: currentDiscipline.previous_member_status,
                });
            }

            updateData.previous_member_status = null;
        }

        return this.disciplineRepo.update(id, updateData);
    }
}
