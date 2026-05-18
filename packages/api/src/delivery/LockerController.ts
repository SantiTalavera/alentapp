import { FastifyReply, FastifyRequest } from 'fastify';
import { CreateLockerRequest } from '@alentapp/shared';
import { NewLockerUseCase } from '../application/locker/NewLockerUseCase.js';

const BAD_REQUEST_MESSAGES = new Set([
    'campo requerido',
    'debe ser mayor a cero',
    'El número de casillero debe ser un número entero',
]);

export class LockerController {
    constructor(private readonly newLockerUseCase: NewLockerUseCase) {}

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
}
