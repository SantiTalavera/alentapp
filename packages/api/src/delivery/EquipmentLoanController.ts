import { FastifyReply, FastifyRequest } from 'fastify';
import { CreateEquipmentLoanRequest } from '@alentapp/shared';
import { CreateEquipmentLoanUseCase } from '../application/loan/CreateEquipmentLoanUseCase.js';

// Mensajes que mapean a 400 Bad Request (validaciones de formato / campos)
const BAD_REQUEST_MESSAGES = new Set([
    'El nombre del ítem es obligatorio',
    'El socio es obligatorio',
    'Formato de campos inválido',
    'Identificador de socio inválido',
    'La fecha de devolución no es válida',
]);

// Mensajes que mapean a 404 Not Found
const NOT_FOUND_MESSAGES = new Set([
    'Socio no encontrado',
]);

// Mensajes que mapean a 422 Unprocessable Entity (reglas de negocio)
const UNPROCESSABLE_MESSAGES = new Set([
    'El socio no está activo y no puede solicitar un préstamo',
    'Los socios con categoría Cadete no pueden solicitar préstamos de equipamiento. Solo categorías Pleno u Honorario están habilitadas.',
    'La fecha de devolución debe ser una fecha futura',
]);

export class EquipmentLoanController {
    constructor(
        private readonly createEquipmentLoanUseCase: CreateEquipmentLoanUseCase,
    ) {}

    async create(
        request: FastifyRequest<{ Body: CreateEquipmentLoanRequest }>,
        reply: FastifyReply,
    ) {
        try {
            const loan = await this.createEquipmentLoanUseCase.execute(request.body);
            return reply.code(201).send({ data: loan });
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Error interno, reintente más tarde';

            if (BAD_REQUEST_MESSAGES.has(message)) {
                return reply.code(400).send({ error: message });
            }

            if (NOT_FOUND_MESSAGES.has(message)) {
                return reply.code(404).send({ error: message });
            }

            if (UNPROCESSABLE_MESSAGES.has(message)) {
                return reply.code(422).send({ error: message });
            }

            return reply.code(500).send({ error: 'Error interno, reintente más tarde' });
        }
    }
}
