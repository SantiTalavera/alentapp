import { FastifyReply, FastifyRequest } from 'fastify';
import { CreateEquipmentLoanRequest, UpdateEquipmentLoanRequest } from '@alentapp/shared';
import { CreateEquipmentLoanUseCase } from '../application/loan/CreateEquipmentLoanUseCase.js';
import { GetEquipmentLoansUseCase } from '../application/loan/GetEquipmentLoansUseCase.js';
import { GetEquipmentLoanByIdUseCase } from '../application/loan/GetEquipmentLoanByIdUseCase.js';
import { UpdateEquipmentLoanUseCase } from '../application/loan/UpdateEquipmentLoanUseCase.js';

// Mensajes que mapean a 400 Bad Request (validaciones de formato / campos)
const BAD_REQUEST_MESSAGES = new Set([
    'El nombre del ítem es obligatorio',
    'El socio es obligatorio',
    'Formato de campos inválido',
    'Identificador de socio inválido',
    'La fecha de devolución no es válida',
    'Formato de identificador de socio inválido',
    'Formato de identificador de préstamo inválido',
    'El cuerpo de la solicitud no puede estar vacío',
]);

// Mensajes que mapean a 404 Not Found
const NOT_FOUND_MESSAGES = new Set([
    'Socio no encontrado',
    'El préstamo no existe',
]);

// Mensajes que mapean a 422 Unprocessable Entity (reglas de negocio)
const UNPROCESSABLE_MESSAGES = new Set([
    'El socio no está activo y no puede solicitar un préstamo',
    'Los socios con categoría Cadete no pueden solicitar préstamos de equipamiento. Solo categorías Pleno u Honorario están habilitadas.',
    'La fecha de devolución debe ser una fecha futura',
    'El préstamo ya se encuentra en un estado terminal y no puede ser modificado',
    'La fecha de devolución no puede ser anterior a la fecha de préstamo',
]);

function resolveHttpError(message: string): number {
    if (BAD_REQUEST_MESSAGES.has(message)) return 400;
    if (NOT_FOUND_MESSAGES.has(message)) return 404;
    if (UNPROCESSABLE_MESSAGES.has(message)) return 422;
    return 500;
}

export class EquipmentLoanController {
    constructor(
        private readonly createEquipmentLoanUseCase: CreateEquipmentLoanUseCase,
        private readonly getEquipmentLoansUseCase: GetEquipmentLoansUseCase,
        private readonly getEquipmentLoanByIdUseCase: GetEquipmentLoanByIdUseCase,
        private readonly updateEquipmentLoanUseCase: UpdateEquipmentLoanUseCase,
    ) { }

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

            const statusCode = resolveHttpError(message);
            return reply.code(statusCode).send({
                error: statusCode === 500 ? 'Error interno, reintente más tarde' : message,
            });
        }
    }

    async getAll(
        request: FastifyRequest<{ Querystring: { memberId?: string } }>,
        reply: FastifyReply,
    ) {
        try {
            const memberId = request.query.memberId;
            const loans = await this.getEquipmentLoansUseCase.execute(
                memberId !== undefined ? { memberId } : undefined,
            );
            return reply.code(200).send({ data: loans });
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Error interno, reintente más tarde';

            const statusCode = resolveHttpError(message);
            return reply.code(statusCode).send({
                error: statusCode === 500 ? 'Error interno, reintente más tarde' : message,
            });
        }
    }

    async getById(
        request: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply,
    ) {
        try {
            const loan = await this.getEquipmentLoanByIdUseCase.execute(request.params.id);
            return reply.code(200).send({ data: loan });
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Error interno, reintente más tarde';

            const statusCode = resolveHttpError(message);
            return reply.code(statusCode).send({
                error: statusCode === 500 ? 'Error interno, reintente más tarde' : message,
            });
        }
    }

    async update(
        request: FastifyRequest<{ Params: { id: string }; Body: UpdateEquipmentLoanRequest }>,
        reply: FastifyReply,
    ) {
        try {
            const loan = await this.updateEquipmentLoanUseCase.execute(request.params.id, request.body);
            return reply.code(200).send({ data: loan });
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Error interno, reintente más tarde';

            const statusCode = resolveHttpError(message);
            return reply.code(statusCode).send({
                error: statusCode === 500 ? 'Error interno, reintente más tarde' : message,
            });
        }
    }
}
