import { FastifyReply, FastifyRequest } from 'fastify';
import { CreateEnrollmentRequest } from '@alentapp/shared';
import { CreateEnrollmentUseCase } from '../application/enrollment/CreateEnrollmentUseCase.js';

const BAD_REQUEST_MESSAGES = new Set([
    'El socio es obligatorio',
    'El deporte es obligatorio',
    'Identificador inválido',
]);

const NOT_FOUND_MESSAGES = new Set([
    'Socio no encontrado',
    'Deporte no encontrado',
]);

const CONFLICT_MESSAGES = new Set([
    'No se puede inscribir en un deporte eliminado',
    'El socio no está habilitado para inscribirse',
    'El socio ya está inscripto en este deporte',
    'No hay cupo disponible para este deporte',
]);

export class EnrollmentController {
    constructor(
        private readonly createEnrollmentUseCase: CreateEnrollmentUseCase
    ) {}

    async create(
        request: FastifyRequest<{ Body: CreateEnrollmentRequest }>,
        reply: FastifyReply
    ) {
        try {
            const enrollment =
                await this.createEnrollmentUseCase.execute(request.body);
            return reply.code(201).send({ data: enrollment });
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Error interno, reintente más tarde';

            if (BAD_REQUEST_MESSAGES.has(message)) {
                return reply.code(400).send({ error: message });
            }

            if (NOT_FOUND_MESSAGES.has(message)) {
                return reply.code(404).send({ error: message });
            }

            if (CONFLICT_MESSAGES.has(message)) {
                return reply.code(409).send({ error: message });
            }

            return reply
                .code(500)
                .send({ error: 'Error interno, reintente más tarde' });
        }
    }
}
