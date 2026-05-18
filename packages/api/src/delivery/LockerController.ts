import { FastifyReply, FastifyRequest } from 'fastify';
import { CreateLockerRequest, UpdateLockerRequest } from '@alentapp/shared';
import { NewLockerUseCase } from '../application/locker/NewLockerUseCase.js';
import { UpdateLockerUseCase } from '../application/locker/UpdateLockerUseCase.js';

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
        private readonly updateLockerUseCase: UpdateLockerUseCase
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
}
