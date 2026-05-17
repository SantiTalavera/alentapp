import { UpdateEnrollmentRequest } from '@alentapp/shared';
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

    validateUpdateEnrollmentBody(raw: unknown): UpdateEnrollmentRequest {
        if (
            raw === null ||
            raw === undefined ||
            typeof raw !== 'object' ||
            Array.isArray(raw)
        ) {
            throw new Error('Se requiere al menos un campo para actualizar');
        }

        const body = raw as Record<string, unknown>;
        const keys = Object.keys(body);
        if (keys.length === 0) {
            throw new Error('Se requiere al menos un campo para actualizar');
        }

        for (const key of keys) {
            if (key !== 'is_active') {
                throw new Error('Campo no permitido para modificación');
            }
        }

        if (!('is_active' in body)) {
            throw new Error('Se requiere al menos un campo para actualizar');
        }

        const isActive = body['is_active'];
        if (typeof isActive !== 'boolean') {
            throw new Error('El campo is_active debe ser booleano');
        }

        return { is_active: isActive };
    }

    async validateEnrollmentReactivation(
        memberId: string,
        sportId: string,
        currentEnrollmentId: string
    ): Promise<void> {
        const member = await this.memberRepository.findById(memberId);
        if (!member || member.status !== 'Activo') {
            throw new Error('El socio no está habilitado');
        }

        const sport = await this.sportRepository.findById(sportId);
        if (!sport || sport.deleted_at !== null) {
            throw new Error('El deporte no está disponible');
        }

        const duplicate =
            await this.enrollmentRepository.findActiveByMemberAndSport(
                memberId,
                sportId
            );
        if (duplicate && duplicate.id !== currentEnrollmentId) {
            throw new Error(
                'Ya existe una inscripción activa para este deporte'
            );
        }

        const activeCount =
            await this.enrollmentRepository.countActiveBySportId(sportId);
        if (activeCount >= sport.max_capacity) {
            throw new Error(
                'No hay cupo disponible para este deporte'
            );
        }
    }
}
