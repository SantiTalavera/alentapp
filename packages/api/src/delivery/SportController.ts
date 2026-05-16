import { FastifyReply, FastifyRequest } from 'fastify';
import { CreateSportRequest } from '@alentapp/shared';
import { NewSportUseCase } from '../application/sport/NewSportUseCase.js';

const BAD_REQUEST_MESSAGES = new Set([
    'El nombre del deporte es obligatorio',
    'La descripción del deporte es obligatoria',
    'La capacidad máxima debe ser mayor a cero',
    'La capacidad máxima debe ser un número entero',
    'El precio adicional debe ser mayor o igual a cero',
    'El precio adicional es obligatorio',
    'El campo requiere certificado médico debe ser verdadero o falso',
]);

export class SportController {
    constructor(private readonly newSportUseCase: NewSportUseCase) {}

    async create(request: FastifyRequest<{ Body: CreateSportRequest }>, reply: FastifyReply) {
        try {
            const sport = await this.newSportUseCase.execute(request.body);
            return reply.code(201).send({ data: sport });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Error interno, reintente más tarde';

            if (message === 'Ya existe un deporte con ese nombre') {
                return reply.code(409).send({ error: message });
            }

            if (BAD_REQUEST_MESSAGES.has(message)) {
                return reply.code(400).send({ error: message });
            }

            return reply.code(500).send({ error: 'Error interno, reintente más tarde' });
        }
    }
}
