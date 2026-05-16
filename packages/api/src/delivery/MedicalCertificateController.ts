import { FastifyReply, FastifyRequest } from 'fastify';
import { CreateMedicalCertificateRequest } from '@alentapp/shared';
import { CreateMedicalCertificateUseCase } from '../application/medical-certificate/CreateMedicalCertificateUseCase.js';

const BAD_REQUEST_MESSAGES = new Set([
    'El socio es requerido',
    'La fecha de emisión es requerida',
    'La fecha de vencimiento es requerida',
    'La matrícula del médico es requerida',
    'Las fechas proporcionadas no son válidas',
    'La fecha de vencimiento debe ser posterior a la fecha de emisión',
]);

export class MedicalCertificateController {
    constructor(private readonly createMedicalCertificateUseCase: CreateMedicalCertificateUseCase) { }

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
}
