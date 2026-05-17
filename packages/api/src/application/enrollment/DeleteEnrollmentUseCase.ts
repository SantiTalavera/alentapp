import { EnrollmentDTO } from '@alentapp/shared';
import { EnrollmentRepository } from '../../domain/EnrollmentRepository.js';

const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
    return UUID_REGEX.test(value);
}

export class DeleteEnrollmentUseCase {
    constructor(private readonly enrollmentRepository: EnrollmentRepository) {}

    async execute(id: string): Promise<EnrollmentDTO> {
        const trimmedId = id.trim();
        if (!isUuid(trimmedId)) {
            throw new Error('Identificador de inscripción inválido');
        }

        const enrollment = await this.enrollmentRepository.findById(trimmedId);
        if (!enrollment) {
            throw new Error('Inscripción no encontrada');
        }
        if (enrollment.deleted_at !== null) {
            throw new Error('La inscripción ya fue eliminada');
        }

        return this.enrollmentRepository.softDelete(trimmedId);
    }
}
