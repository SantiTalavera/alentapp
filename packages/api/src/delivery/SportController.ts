import { FastifyReply, FastifyRequest } from 'fastify';
import { CreateSportRequest, UpdateSportRequest } from '@alentapp/shared';
import { NewSportUseCase } from '../application/sport/NewSportUseCase.js';
import { GetSportsUseCase } from '../application/sport/GetSportsUseCase.js';
import { GetSportByIdUseCase } from '../application/sport/GetSportByIdUseCase.js';
import { UpdateSportUseCase } from '../application/sport/UpdateSportUseCase.js';

const BAD_REQUEST_MESSAGES = new Set([
    'El nombre del deporte es obligatorio',
    'La descripción del deporte es obligatoria',
    'La capacidad máxima debe ser mayor a cero',
    'La capacidad máxima debe ser un número entero',
    'El precio adicional debe ser mayor o igual a cero',
    'El precio adicional es obligatorio',
    'El precio adicional no puede ser negativo',
    'El campo requiere certificado médico debe ser verdadero o falso',
    'Se requiere al menos un campo para actualizar',
    'El nombre del deporte no puede modificarse',
    'No se puede modificar el campo deleted_at',
    'Se enviaron campos no permitidos',
]);

export class SportController {
    constructor(
        private readonly newSportUseCase: NewSportUseCase,
        private readonly getSportsUseCase: GetSportsUseCase,
        private readonly getSportByIdUseCase: GetSportByIdUseCase,
        private readonly updateSportUseCase: UpdateSportUseCase,
    ) {}

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

    async getAll(_request: FastifyRequest, reply: FastifyReply) {
        try {
            const sports = await this.getSportsUseCase.execute();
            return reply.code(200).send({ data: sports });
        } catch (_error) {
            return reply.code(500).send({ error: 'Error interno, reintente más tarde' });
        }
    }

    async getById(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
        try {
            const sport = await this.getSportByIdUseCase.execute(request.params.id);
            return reply.code(200).send({ data: sport });
        } catch (error) {
            const message =
                error instanceof Error ? error.message : 'Error interno, reintente más tarde';

            if (message === 'Identificador de deporte inválido') {
                return reply.code(400).send({ error: message });
            }

            if (message === 'Deporte no encontrado') {
                return reply.code(404).send({ error: message });
            }

            return reply.code(500).send({ error: 'Error interno, reintente más tarde' });
        }
    }

    async update(
        request: FastifyRequest<{ Params: { id: string }; Body: UpdateSportRequest }>,
        reply: FastifyReply
    ) {
        try {
            const sport = await this.updateSportUseCase.execute(request.params.id, request.body);
            return reply.code(200).send({ data: sport });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Error interno, reintente más tarde';

            if (message === 'Identificador de deporte inválido') {
                return reply.code(400).send({ error: message });
            }

            if (message === 'Deporte no encontrado') {
                return reply.code(404).send({ error: message });
            }

            if (message === 'No se puede modificar un deporte eliminado') {
                return reply.code(409).send({ error: message });
            }

            if (BAD_REQUEST_MESSAGES.has(message)) {
                return reply.code(400).send({ error: message });
            }

            return reply.code(500).send({ error: 'Error interno, reintente más tarde' });
        }
    }
}
