import { EnrollmentDTO } from '@alentapp/shared';
import {
    EnrollmentFilters,
    EnrollmentRepository,
} from '../../domain/EnrollmentRepository.js';

const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
    return UUID_REGEX.test(value);
}

export type GetEnrollmentsQueryInput = {
    memberId?: string;
    sportId?: string;
    isActive?: string;
};

export class GetEnrollmentsUseCase {
    constructor(private readonly enrollmentRepository: EnrollmentRepository) {}

    async execute(raw: GetEnrollmentsQueryInput): Promise<EnrollmentDTO[]> {
        const filters: EnrollmentFilters = {};

        if (raw.memberId !== undefined) {
            const trimmedMember = raw.memberId.trim();
            if (!isUuid(trimmedMember)) {
                throw new Error('Identificador de socio inválido');
            }
            filters.memberId = trimmedMember;
        }

        if (raw.sportId !== undefined) {
            const trimmedSport = raw.sportId.trim();
            if (!isUuid(trimmedSport)) {
                throw new Error('Identificador de deporte inválido');
            }
            filters.sportId = trimmedSport;
        }

        if (raw.isActive !== undefined) {
            if (raw.isActive !== 'true' && raw.isActive !== 'false') {
                throw new Error('Filtro de vigencia inválido');
            }
            filters.isActive = raw.isActive === 'true';
        }

        return this.enrollmentRepository.findAll(filters);
    }
}
