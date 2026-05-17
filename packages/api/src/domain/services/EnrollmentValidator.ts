import { EnrollmentRepository } from '../EnrollmentRepository.js';
import { MemberRepository } from '../MemberRepository.js';
import { SportRepository } from '../SportRepository.js';

export class EnrollmentValidator {
    constructor(
        private readonly enrollmentRepository: EnrollmentRepository,
        private readonly memberRepository: MemberRepository,
        private readonly sportRepository: SportRepository
    ) {}

    async validateNewEnrollment(
        member_id: string,
        sport_id: string
    ): Promise<void> {
        const member = await this.memberRepository.findById(member_id);
        if (!member) {
            throw new Error('Socio no encontrado');
        }
        if (member.status !== 'Activo') {
            throw new Error(
                'El socio no está habilitado para inscribirse'
            );
        }

        const sport = await this.sportRepository.findById(sport_id);
        if (!sport) {
            throw new Error('Deporte no encontrado');
        }
        if (sport.deleted_at !== null) {
            throw new Error(
                'No se puede inscribir en un deporte eliminado'
            );
        }

        const duplicate =
            await this.enrollmentRepository.findActiveByMemberAndSport(
                member_id,
                sport_id
            );
        if (duplicate) {
            throw new Error(
                'El socio ya está inscripto en este deporte'
            );
        }

        const activeCount =
            await this.enrollmentRepository.countActiveBySportId(sport_id);
        if (activeCount >= sport.max_capacity) {
            throw new Error(
                'No hay cupo disponible para este deporte'
            );
        }
    }
}
