import { FastifyReply, FastifyRequest } from 'fastify';
import { CreateMedicalCertificateRequest, UpdateMedicalCertificateRequest } from '@alentapp/shared';
import { CreateMedicalCertificateUseCase } from '../application/medical-certificate/CreateMedicalCertificateUseCase.js';
import { UpdateMedicalCertificateUseCase } from '../application/medical-certificate/UpdateMedicalCertificateUseCase.js';
import { DeleteMedicalCertificateUseCase } from '../application/medical-certificate/DeleteMedicalCertificateUseCase.js';
import { GetMedicalCertificatesByMemberUseCase } from '../application/medical-certificate/GetMedicalCertificatesByMemberUseCase.js';
import { GetMedicalCertificateByIdUseCase } from '../application/medical-certificate/GetMedicalCertificateByIdUseCase.js';

const BAD_REQUEST_MESSAGES = new Set([
    'El socio es requerido',
    'La fecha de emisión es requerida',
    'La fecha de vencimiento es requerida',
    'La matrícula del médico es requerida',
    'Las fechas proporcionadas no son válidas',
    'La fecha de vencimiento debe ser posterior a la fecha de emisión',
    'La fecha de vencimiento debe ser posterior a la de emisión',
    'Se debe enviar al menos un campo para actualizar',
    'El socio titular del certificado no puede modificarse',
]);

export class MedicalCertificateController {
    constructor(
        private readonly createMedicalCertificateUseCase: CreateMedicalCertificateUseCase,
        private readonly updateMedicalCertificateUseCase: UpdateMedicalCertificateUseCase,
        private readonly deleteMedicalCertificateUseCase: DeleteMedicalCertificateUseCase,
        private readonly getMedicalCertificatesByMemberUseCase: GetMedicalCertificatesByMemberUseCase,
        private readonly getMedicalCertificateByIdUseCase: GetMedicalCertificateByIdUseCase
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

            if (BAD_REQUEST_MESSAGES.has(message)) {
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
            const { id } = request.params;
            await this.deleteMedicalCertificateUseCase.execute(id);
            return reply.code(204).send();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Error interno, reintente más tarde';

            if (message === 'El certificado médico no existe') {
                return reply.code(404).send({ error: message });
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
            const certificates = await this.getMedicalCertificatesByMemberUseCase.execute(memberId);
            return reply.code(200).send({ data: certificates });
        } catch (error) {
            return reply.code(500).send({ error: 'Error interno, reintente más tarde' });
        }
    }

    async getById(
        request: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply
    ) {
        try {
            const { id } = request.params;
            const certificate = await this.getMedicalCertificateByIdUseCase.execute(id);
            return reply.code(200).send({ data: certificate });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Error interno, reintente más tarde';

            if (message === 'Certificado no encontrado') {
                return reply.code(404).send({ error: message });
            }

            return reply.code(500).send({ error: 'Error interno, reintente más tarde' });
        }
    }
}
