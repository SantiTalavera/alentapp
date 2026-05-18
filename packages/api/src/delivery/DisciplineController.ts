import { FastifyReply, FastifyRequest } from 'fastify';
import { CreateDisciplineRequest, UpdateDisciplineRequest } from '@alentapp/shared';
import { NewDisciplineUseCase } from '../application/discipline/NewDisciplineUseCase.js';
import { UpdateDisciplineUseCase } from '../application/discipline/UpdateDisciplineUseCase.js';
import { GetDisciplineByIdUseCase } from '../application/discipline/GetDisciplineByIdUseCase.js';
import { GetDisciplineByMemberIdUseCase } from '../application/discipline/GetDisciplineByMemberIdUseCase.js';

export class DisciplineController {
    constructor(
        private readonly newDisciplineUseCase: NewDisciplineUseCase,
        private readonly updateDisciplineUseCase: UpdateDisciplineUseCase,
        private readonly getDisciplineByIdUseCase: GetDisciplineByIdUseCase,
        private readonly getDisciplineByMemberIdUseCase: GetDisciplineByMemberIdUseCase
    ) {}

    async create(
        request: FastifyRequest<{ Body: CreateDisciplineRequest }>,
        reply: FastifyReply
    ) {
        try {
            const discipline = await this.newDisciplineUseCase.execute(request.body);
            return reply.code(201).send({ data: discipline });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Error interno, reintente más tarde';

            if (message === 'El socio no existe') {
                return reply.code(404).send({ error: message });
            }

            if (
                message === 'El socio es requerido' ||
                message === 'El motivo de la disciplina es requerido' ||
                message === 'La fecha de inicio es requerida' ||
                message === 'La fecha de fin es requerida' ||
                message === 'La fecha de fin debe ser posterior a la fecha de inicio' ||
                message === 'El campo suspensión total debe ser verdadero o falso' ||
                message === 'El estado previo del socio debe ser Activo o Moroso'
            ) {
                return reply.code(400).send({ error: message });
            }

            return reply.code(500).send({ error: 'Error interno, reintente más tarde' });
        }
    }

    async update(
        request: FastifyRequest<{
            Params: { id: string };
            Body: UpdateDisciplineRequest & Record<string, unknown>;
        }>,
        reply: FastifyReply
    ) {
        try {
            const { id } = request.params;
            const discipline = await this.updateDisciplineUseCase.execute(id, request.body);
            return reply.code(200).send({ data: discipline });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Error interno, reintente más tarde';

            if (
                message === 'La disciplina no existe' ||
                message === 'El socio no existe'
            ) {
                return reply.code(404).send({ error: message });
            }

            if (
                message === 'Se debe enviar al menos un campo para actualizar' ||
                message === 'El socio de la disciplina no puede modificarse' ||
                message === 'El motivo de la disciplina es requerido' ||
                message === 'La fecha de inicio es requerida' ||
                message === 'La fecha de fin es requerida' ||
                message === 'La fecha de fin debe ser posterior a la fecha de inicio' ||
                message === 'El campo suspensión total debe ser verdadero o falso' ||
                message === 'El estado previo del socio debe ser Activo o Moroso'
            ) {
                return reply.code(400).send({ error: message });
            }

            return reply.code(500).send({ error: 'Error interno, reintente más tarde' });
        }
    }

    async getByMemberId(
        request: FastifyRequest<{ Params: { memberId: string } }>,
        reply: FastifyReply
    ) {
        try {
            const { memberId } = request.params;
            const disciplines = await this.getDisciplineByMemberIdUseCase.execute(memberId);
            return reply.code(200).send({ data: disciplines });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Error interno, reintente más tarde';

            if (message === 'El socio no existe') {
                return reply.code(404).send({ error: message });
            }

            if (message === 'Identificador de socio inválido') {
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
            const { id } = request.params;
            const discipline = await this.getDisciplineByIdUseCase.execute(id);
            return reply.code(200).send({ data: discipline });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Error interno, reintente más tarde';

            if (message === 'Disciplina no encontrada') {
                return reply.code(404).send({ error: message });
            }

            if (message === 'Identificador de disciplina inválido') {
                return reply.code(400).send({ error: message });
            }

            return reply.code(500).send({ error: 'Error interno, reintente más tarde' });
        }
    }    
}
