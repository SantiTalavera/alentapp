import { FastifyReply, FastifyRequest } from 'fastify';
import { CreatePaymentRequest } from '@alentapp/shared';
import { CreatePaymentUseCase } from '../application/payment/CreatePaymentUseCase.js';
import { GetPaymentsUseCase } from '../application/payment/GetPaymentsUseCase.js';
import { GetPaymentByIdUseCase } from '../application/payment/GetPaymentByIdUseCase.js';

import { CancelPaymentUseCase } from '../application/payment/CancelPaymentUseCase.js';

const BAD_REQUEST_MESSAGES = new Set([
    'Campo requerido: member_id',
    'Campo requerido: amount',
    'Campo requerido: month',
    'Campo requerido: year',
    'Campo requerido: due_date',
    'Monto debe ser mayor a cero',
    'Mes inválido',
    'Estado de pago no válido',
    'Formato de id de socio inválido',
    'Formato de id inválido'
]);

export class PaymentController {
    constructor(
        private readonly createPaymentUseCase: CreatePaymentUseCase,
        private readonly getPaymentsUseCase: GetPaymentsUseCase,
        private readonly getPaymentByIdUseCase: GetPaymentByIdUseCase,
        private readonly cancelPaymentUseCase: CancelPaymentUseCase
    ) { }

    async delete(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
        try {
            const payment = await this.cancelPaymentUseCase.execute(request.params.id);
            return reply.code(200).send({ data: payment });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Error interno';
            if (message === 'Pago no encontrado') {
                return reply.code(404).send({ error: message });
            }
            if (message === 'El pago ya se encuentra cancelado') {
                return reply.code(409).send({ error: message });
            }
            if (message === 'No se puede cancelar un pago ya efectuado') {
                return reply.code(422).send({ error: message });
            }
            return reply.code(500).send({ error: 'Error interno' });
        }
    }

    async getAll(request: FastifyRequest<{ Querystring: { memberId?: string, status?: string, month?: string, year?: string } }>, reply: FastifyReply) {
        try {
            const filters: any = {};
            if (request.query.memberId) filters.memberId = request.query.memberId;
            if (request.query.status) filters.status = request.query.status;
            if (request.query.month) filters.month = parseInt(request.query.month, 10);
            if (request.query.year) filters.year = parseInt(request.query.year, 10);

            const payments = await this.getPaymentsUseCase.execute(filters);
            return reply.code(200).send({ data: payments });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Error interno';
            if (BAD_REQUEST_MESSAGES.has(message)) {
                return reply.code(400).send({ error: message });
            }
            return reply.code(500).send({ error: 'Error interno' });
        }
    }

    async getById(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
        try {
            const payment = await this.getPaymentByIdUseCase.execute(request.params.id);
            return reply.code(200).send({ data: payment });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Error interno';
            if (message === 'Pago no encontrado') {
                return reply.code(404).send({ error: message });
            }
            if (BAD_REQUEST_MESSAGES.has(message)) {
                return reply.code(400).send({ error: message });
            }
            return reply.code(500).send({ error: 'Error interno' });
        }
    }

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
