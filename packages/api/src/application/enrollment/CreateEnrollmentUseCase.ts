import {
    CreateEnrollmentRequest,
    EnrollmentDTO,
} from '@alentapp/shared';
import { EnrollmentRepository } from '../../domain/EnrollmentRepository.js';
import { EnrollmentValidator } from '../../domain/services/EnrollmentValidator.js';

const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
    return UUID_REGEX.test(value);
}

export class CreateEnrollmentUseCase {
    constructor(
        private readonly enrollmentRepository: EnrollmentRepository,
        private readonly enrollmentValidator: EnrollmentValidator
    ) {}

    async execute(data?: CreateEnrollmentRequest | null): Promise<EnrollmentDTO> {
        const payload = data ?? {};
        const memberRaw = payload.member_id;
        const sportRaw = payload.sport_id;

        if (
            memberRaw === undefined ||
            memberRaw === null ||
            (typeof memberRaw === 'string' && memberRaw.trim() === '')
        ) {
            throw new Error('El socio es obligatorio');
        }
        if (
            sportRaw === undefined ||
            sportRaw === null ||
            (typeof sportRaw === 'string' && sportRaw.trim() === '')
        ) {
            throw new Error('El deporte es obligatorio');
        }

        if (typeof memberRaw !== 'string' || typeof sportRaw !== 'string') {
            throw new Error('Identificador inválido');
        }

        const member_id = memberRaw.trim();
        const sport_id = sportRaw.trim();

        if (!isUuid(member_id) || !isUuid(sport_id)) {
            throw new Error('Identificador inválido');
        }

        await this.enrollmentValidator.validateNewEnrollment(
            member_id,
            sport_id
        );

        return this.enrollmentRepository.create({ member_id, sport_id });
    }
}
