import { EnrollmentDTO, UpdateEnrollmentRequest } from '@alentapp/shared';
import { EnrollmentRepository } from '../../domain/EnrollmentRepository.js';
import { EnrollmentValidator } from '../../domain/services/EnrollmentValidator.js';

const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
    return UUID_REGEX.test(value);
}

export class UpdateEnrollmentUseCase {
    constructor(
        private readonly enrollmentRepository: EnrollmentRepository,
        private readonly enrollmentValidator: EnrollmentValidator
    ) {}

    async execute(
        id: string,
        rawBody: unknown
    ): Promise<EnrollmentDTO> {
        const trimmedId = id.trim();
        if (!isUuid(trimmedId)) {
            throw new Error('Identificador de inscripción inválido');
        }

        const enrollment = await this.enrollmentRepository.findById(trimmedId);
        if (!enrollment) {
            throw new Error('Inscripción no encontrada');
        }
        if (enrollment.deleted_at !== null) {
            throw new Error('No se puede modificar una inscripción eliminada');
        }

        const data: UpdateEnrollmentRequest =
            this.enrollmentValidator.validateUpdateEnrollmentBody(rawBody);

        if (data.is_active === enrollment.is_active) {
            return enrollment;
        }

        if (enrollment.is_active && data.is_active === false) {
            return this.enrollmentRepository.update(trimmedId, {
                is_active: false,
            });
        }

        if (!enrollment.is_active && data.is_active === true) {
            await this.enrollmentValidator.validateEnrollmentReactivation(
                enrollment.member_id,
                enrollment.sport_id,
                enrollment.id
            );
            return this.enrollmentRepository.update(trimmedId, {
                is_active: true,
            });
        }
    }
}
