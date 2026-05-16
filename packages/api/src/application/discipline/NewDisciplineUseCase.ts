import { CreateDisciplineRequest, DisciplineDTO } from '@alentapp/shared';
import { DisciplineRepository } from '../../domain/DisciplineRepository.js';
import { MemberRepository } from '../../domain/MemberRepository.js';
import { DisciplineValidator } from '../../domain/services/DisciplineValidator.js';

export class NewDisciplineUseCase {
    constructor(
        private readonly disciplineRepo: DisciplineRepository,
        private readonly memberRepo: MemberRepository,
        private readonly validator: DisciplineValidator
    ) {}

    async execute(data: CreateDisciplineRequest): Promise<DisciplineDTO> {
        this.validator.validateCreateRequest(data);

        const member = await this.memberRepo.findById(data.member_id);
        if (!member) {
            throw new Error('El socio no existe');
        }

        let previousMemberStatus: DisciplineDTO['previous_member_status'] = null;

        const isActiveTotalSuspension =
            data.is_total_suspension &&
            this.validator.isActive(data.start_date, data.end_date);

        if (isActiveTotalSuspension) {
            const activeTotalSuspensions =
                await this.disciplineRepo.findActiveTotalSuspensionsByMemberId(data.member_id);

            const existingPreviousStatus =
                activeTotalSuspensions.find((discipline) => discipline.previous_member_status !== null)
                    ?.previous_member_status ?? null;

            previousMemberStatus =
                existingPreviousStatus ?? (member.status === 'Suspendido' ? null : member.status);

            this.validator.validatePreviousMemberStatus(previousMemberStatus);

            await this.memberRepo.update(data.member_id, { status: 'Suspendido' });
        }

        return this.disciplineRepo.create({
            member_id: data.member_id,
            reason: data.reason,
            start_date: data.start_date,
            end_date: data.end_date,
            is_total_suspension: data.is_total_suspension,
            previous_member_status: previousMemberStatus,
        });
    }
}
