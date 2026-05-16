import { FastifyReply, FastifyRequest } from 'fastify';
import { CreatePaymentRequest } from '@alentapp/shared';
import { CreatePaymentUseCase } from '../application/payment/CreatePaymentUseCase.js';

const BAD_REQUEST_MESSAGES = new Set([
    'Campo requerido: member_id',
    'Campo requerido: amount',
    'Campo requerido: month',
    'Campo requerido: year',
    'Campo requerido: due_date',
    'Monto debe ser mayor a cero',
    'Mes inválido'
]);

export class PaymentController {
    constructor(
        private readonly createPaymentUseCase: CreatePaymentUseCase
    ) { }

    async create(
        request: FastifyRequest<{ Body: CreatePaymentRequest }>,
        reply: FastifyReply
    ) {
        try {
            const payment = await this.createPaymentUseCase.execute(request.body);
            return reply.code(201).send({ data: payment });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Error interno, reintente más tarde';

            if (message === 'Socio no encontrado') {
                return reply.code(404).send({ error: message });
            }

            if (BAD_REQUEST_MESSAGES.has(message)) {
                return reply.code(400).send({ error: message });
            }

            if (message === 'Ya existe un pago para este período') {
                return reply.code(409).send({ error: message });
            }

            return reply.code(500).send({ error: 'Error interno, reintente más tarde' });
        }
    }
}
