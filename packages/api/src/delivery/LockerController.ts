import { FastifyReply, FastifyRequest } from 'fastify';
import { CreateLockerRequest, UpdateLockerRequest } from '@alentapp/shared';
import { NewLockerUseCase } from '../application/locker/NewLockerUseCase.js';
import { UpdateLockerUseCase } from '../application/locker/UpdateLockerUseCase.js';
import { DeleteLockerUseCase } from '../application/locker/DeleteLockerUseCase.js';
import { GetLockersUseCase } from '../application/locker/GetLockersUseCase.js';
import { GetLockerByIdUseCase } from '../application/locker/GetLockerByIdUseCase.js';

const BAD_REQUEST_MESSAGES = new Set([
    'campo requerido',
    'debe ser mayor a cero',
    'El número de casillero debe ser un número entero',
    'estado no válido',
]);

const UNPROCESSABLE_ENTITY_MESSAGES = new Set([
    'casillero en mantenimiento no puede tener socio',
    'no se puede asignar socio en este estado',
]);

export class LockerController {
    constructor(
        private readonly newLockerUseCase: NewLockerUseCase,
        private readonly updateLockerUseCase: UpdateLockerUseCase,
        private readonly deleteLockerUseCase: DeleteLockerUseCase,
        private readonly getLockersUseCase: GetLockersUseCase,
        private readonly getLockerByIdUseCase: GetLockerByIdUseCase
    ) {}

    async create(request: FastifyRequest<{ Body: CreateLockerRequest }>, reply: FastifyReply) {
        try {
            const locker = await this.newLockerUseCase.execute(request.body);
            return reply.code(201).send({ data: locker });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Error interno';

            if (message === 'número de casillero ya registrado') {
                return reply.code(409).send({ error: message });
            }

            if (BAD_REQUEST_MESSAGES.has(message)) {
                return reply.code(400).send({ error: message });
            }

            return reply.code(500).send({ error: 'Error interno' });
        }
    }

    async update(
        request: FastifyRequest<{ Params: { id: string }; Body: UpdateLockerRequest }>,
        reply: FastifyReply
    ) {
        try {
            const locker = await this.updateLockerUseCase.execute(request.params.id, request.body);
            return reply.code(200).send({ data: locker });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Error interno';

            if (message === 'casillero no encontrado') {
                return reply.code(404).send({ error: message });
            }

            if (message === 'número ya está en uso') {
                return reply.code(409).send({ error: message });
            }

            if (BAD_REQUEST_MESSAGES.has(message)) {
                return reply.code(400).send({ error: message });
            }

            if (UNPROCESSABLE_ENTITY_MESSAGES.has(message)) {
                return reply.code(422).send({ error: message });
            }

            return reply.code(500).send({ error: 'Error interno' });
        }
    }

    async delete(
        request: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply
    ) {
        try {
            const locker = await this.deleteLockerUseCase.execute(request.params.id);
            return reply.code(200).send({ data: locker });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Error interno';

            if (message === 'casillero no encontrado') {
                return reply.code(404).send({ error: message });
            }

            if (message === 'el casillero ya fue dado de baja') {
                return reply.code(409).send({ error: message });
            }

            return reply.code(500).send({ error: 'Error interno' });
        }
    }

    async getAll(
        request: FastifyRequest<{ Querystring: { status?: string } }>,
        reply: FastifyReply
    ) {
        try {
            const lockers = await this.getLockersUseCase.execute(request.query);
            return reply.code(200).send({ data: lockers });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Error interno';

            if (message === 'Estado de casillero no válido') {
                return reply.code(400).send({ error: message });
            }

            return reply.code(500).send({ error: 'Error interno' });
        }
    }

    async getById(
        request: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply
    ) {
        try {
            const locker = await this.getLockerByIdUseCase.execute(request.params.id);
            return reply.code(200).send({ data: locker });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Error interno';

            if (message === 'formato de id inválido') {
                return reply.code(400).send({ error: message });
            }

            if (message === 'casillero no encontrado') {
                return reply.code(404).send({ error: message });
            }

            return reply.code(500).send({ error: 'Error interno' });
        }
    }
}
