import { FastifyReply, FastifyRequest } from 'fastify';
import {
    CreateEnrollmentRequest,
    UpdateEnrollmentRequest,
} from '@alentapp/shared';
import { CreateEnrollmentUseCase } from '../application/enrollment/CreateEnrollmentUseCase.js';
import { UpdateEnrollmentUseCase } from '../application/enrollment/UpdateEnrollmentUseCase.js';
import { GetEnrollmentsUseCase } from '../application/enrollment/GetEnrollmentsUseCase.js';
import { GetEnrollmentByIdUseCase } from '../application/enrollment/GetEnrollmentByIdUseCase.js';
import { DeleteEnrollmentUseCase } from '../application/enrollment/DeleteEnrollmentUseCase.js';

const BAD_REQUEST_MESSAGES = new Set([
    'El socio es obligatorio',
    'El deporte es obligatorio',
    'Identificador inválido',
    'Identificador de inscripción inválido',
    'Se requiere al menos un campo para actualizar',
    'Campo no permitido para modificación',
    'El campo is_active debe ser booleano',
    'Identificador de socio inválido',
    'Identificador de deporte inválido',
    'Filtro de vigencia inválido',
]);

const NOT_FOUND_MESSAGES = new Set([
    'Socio no encontrado',
    'Deporte no encontrado',
    'Inscripción no encontrada',
]);

const CONFLICT_MESSAGES = new Set([
    'No se puede inscribir en un deporte eliminado',
    'El socio no está habilitado para inscribirse',
    'El socio ya está inscripto en este deporte',
    'No hay cupo disponible para este deporte',
    'El socio no está habilitado',
    'El deporte no está disponible',
    'Ya existe una inscripción activa para este deporte',
    'La inscripción ya fue eliminada',
]);

export class EnrollmentController {
    constructor(
        private readonly createEnrollmentUseCase: CreateEnrollmentUseCase,
        private readonly updateEnrollmentUseCase: UpdateEnrollmentUseCase,
        private readonly getEnrollmentsUseCase: GetEnrollmentsUseCase,
        private readonly getEnrollmentByIdUseCase: GetEnrollmentByIdUseCase,
        private readonly deleteEnrollmentUseCase: DeleteEnrollmentUseCase
    ) {}

    async getAll(
        request: FastifyRequest<{
            Querystring: {
                memberId?: string;
                sportId?: string;
                isActive?: string;
            };
        }>,
        reply: FastifyReply
    ) {
        try {
            const list = await this.getEnrollmentsUseCase.execute({
                memberId: request.query.memberId,
                sportId: request.query.sportId,
                isActive: request.query.isActive,
            });
            return reply.code(200).send({ data: list });
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Error interno, reintente más tarde';

            if (BAD_REQUEST_MESSAGES.has(message)) {
                return reply.code(400).send({ error: message });
            }

            return reply.code(500).send({ error: 'Error interno, reintente más tarde' });
        }
    }

    async getById(
        request: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply
    ) {
        try {
            const enrollment = await this.getEnrollmentByIdUseCase.execute(
                request.params.id
            );
            return reply.code(200).send({ data: enrollment });
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

            return reply.code(500).send({ error: 'Error interno, reintente más tarde' });
        }
    }

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

            return reply.code(500).send({ error: 'Error interno, reintente más tarde' });
        }
    }

    async update(
        request: FastifyRequest<{
            Params: { id: string };
            Body: UpdateEnrollmentRequest & Record<string, unknown>;
        }>,
        reply: FastifyReply
    ) {
        try {
            const enrollment = await this.updateEnrollmentUseCase.execute(
                request.params.id,
                request.body
            );
            return reply.code(200).send({ data: enrollment });
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Error interno, reintente más tarde';

            if (message === 'Identificador de inscripción inválido') {
                return reply.code(400).send({ error: message });
            }

            if (message === 'Inscripción no encontrada') {
                return reply.code(404).send({ error: message });
            }

            if (message === 'No se puede modificar una inscripción eliminada') {
                return reply.code(409).send({ error: message });
            }

            if (CONFLICT_MESSAGES.has(message)) {
                return reply.code(409).send({ error: message });
            }

            if (BAD_REQUEST_MESSAGES.has(message)) {
                return reply.code(400).send({ error: message });
            }

            return reply.code(500).send({ error: 'Error interno, reintente más tarde' });
        }
    }

    async delete(
        request: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply
    ) {
        try {
            const enrollment = await this.deleteEnrollmentUseCase.execute(
                request.params.id
            );
            return reply.code(200).send({ data: enrollment });
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Error interno, reintente más tarde';

            if (
                message === 'Identificador de inscripción inválido'
            ) {
                return reply.code(400).send({ error: message });
            }

            if (message === 'Inscripción no encontrada') {
                return reply.code(404).send({ error: message });
            }

            if (message === 'La inscripción ya fue eliminada') {
                return reply.code(409).send({ error: message });
            }

            return reply.code(500).send({ error: 'Error interno, reintente más tarde' });
        }
    }
}
