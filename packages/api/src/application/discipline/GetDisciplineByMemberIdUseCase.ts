import { DisciplineDTO } from '@alentapp/shared';
import { DisciplineRepository } from '../../domain/DisciplineRepository.js';
import { MemberRepository } from '../../domain/MemberRepository.js';

const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(value: string): boolean {
    return UUID_REGEX.test(value.trim());
}

export class GetDisciplinesByMemberUseCase {
    constructor(
        private readonly disciplineRepository: DisciplineRepository,
        private readonly memberRepository: MemberRepository
    ) {}

    async execute(memberId: string): Promise<DisciplineDTO[]> {
        if (!isValidUuid(memberId)) {
            throw new Error('Identificador de socio inválido');
        }

        const normalizedMemberId = memberId.trim();

        const member = await this.memberRepository.findById(normalizedMemberId);
        if (!member) {
            throw new Error('El socio no existe');
        }

        return this.disciplineRepository.findByMemberId(normalizedMemberId);
    }
}