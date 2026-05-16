import { FastifyReply, FastifyRequest } from 'fastify';
import { CreateMedicalCertificateRequest, UpdateMedicalCertificateRequest } from '@alentapp/shared';
import { CreateMedicalCertificateUseCase } from '../application/medical-certificate/CreateMedicalCertificateUseCase.js';
import { UpdateMedicalCertificateUseCase } from '../application/medical-certificate/UpdateMedicalCertificateUseCase.js';

const BAD_REQUEST_MESSAGES = new Set([
    'El socio es requerido',
    'La fecha de emisión es requerida',
    'La fecha de vencimiento es requerida',
    'La matrícula del médico es requerida',
    'Las fechas proporcionadas no son válidas',
    'La fecha de vencimiento debe ser posterior a la fecha de emisión',
]);

export class MedicalCertificateController {
    constructor(
        private readonly createMedicalCertificateUseCase: CreateMedicalCertificateUseCase,
        private readonly updateMedicalCertificateUseCase: UpdateMedicalCertificateUseCase
    ) { }

    async create(
        request: FastifyRequest<{ Body: CreateMedicalCertificateRequest }>,
        reply: FastifyReply
    ) {
        try {
            const certificate = await this.createMedicalCertificateUseCase.execute(request.body);
            return reply.code(201).send({ data: certificate });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Error interno, reintente más tarde';

            if (message === 'El socio no existe') {
                return reply.code(404).send({ error: message });
            }

            if (
                message === 'El socio es requerido' ||
                message === 'La fecha de emisión es requerida' ||
                message === 'La fecha de vencimiento es requerida' ||
                message === 'La matrícula del médico es requerida' ||
                message === 'Las fechas proporcionadas no son válidas' ||
                message === 'La fecha de vencimiento debe ser posterior a la fecha de emisión' ||
                message === 'La fecha de vencimiento debe ser posterior a la de emisión'
            ) {
                return reply.code(400).send({ error: message });
            }

            return reply.code(500).send({ error: 'Error interno, reintente más tarde' });
        }
    }

    async update(
        request: FastifyRequest<{ Params: { id: string }, Body: UpdateMedicalCertificateRequest & Record<string, unknown> }>,
        reply: FastifyReply
    ) {
        try {
            const { id } = request.params;
            const certificate = await this.updateMedicalCertificateUseCase.execute(id, request.body);
            return reply.code(200).send({ data: certificate });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Error interno, reintente más tarde';

            if (message === 'El certificado médico no existe') {
                return reply.code(404).send({ error: message });
            }

            if (
                message === 'Se debe enviar al menos un campo para actualizar' ||
                message === 'El socio titular del certificado no puede modificarse' ||
                message === 'La fecha de emisión es requerida' ||
                message === 'La fecha de vencimiento es requerida' ||
                message === 'La matrícula del médico es requerida' ||
                message === 'Las fechas proporcionadas no son válidas' ||
                message === 'La fecha de vencimiento debe ser posterior a la fecha de emisión' ||
                message === 'La fecha de vencimiento debe ser posterior a la de emisión'
            ) {
                return reply.code(400).send({ error: message });
            }

            return reply.code(500).send({ error: 'Error interno, reintente más tarde' });
        }
    }
}
