import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentValidator } from './PaymentValidator.js';
import { PaymentRepository } from '../PaymentRepository.js';
import { MemberRepository } from '../MemberRepository.js';
import { CreatePaymentRequest, PaymentDTO, UpdatePaymentRequest } from '@alentapp/shared';

const VALID_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const INVALID_UUID = 'invalid-uuid-12345';

const mockPaymentRepo = {
    create: vi.fn(),
    findAll: vi.fn(),
    findById: vi.fn(),
    findByPeriod: vi.fn(),
    update: vi.fn(),
    cancel: vi.fn(),
} as unknown as PaymentRepository;

const mockMemberRepo = {
    findById: vi.fn(),
    findAll: vi.fn(),
    findByDni: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
} as unknown as MemberRepository;

describe('PaymentValidator', () => {
    const validator = new PaymentValidator(mockPaymentRepo, mockMemberRepo);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('validateId', () => {
        it('debe pasar si el id es un UUID válido', () => {
            expect(() => validator.validateId(VALID_UUID)).not.toThrow();
        });

        it('debe lanzar un error si el id no es un UUID válido', () => {
            expect(() => validator.validateId(INVALID_UUID)).toThrow('Formato de id inválido');
        });
    });

    describe('validateCreateRequest', () => {
        const buildValidRequest = (): CreatePaymentRequest => ({
            member_id: VALID_UUID,
            amount: 2000,
            month: 5,
            year: 2026,
            due_date: '2026-05-31T00:00:00.000Z',
        });

        it('debe pasar si el request contiene todos los datos válidos', () => {
            expect(() => validator.validateCreateRequest(buildValidRequest())).not.toThrow();
        });

        it('debe lanzar error si falta member_id', () => {
            const req = buildValidRequest();
            delete (req as any).member_id;
            expect(() => validator.validateCreateRequest(req)).toThrow('Campo requerido: member_id');
        });

        it('debe lanzar error si falta amount', () => {
            const req = buildValidRequest();
            delete (req as any).amount;
            expect(() => validator.validateCreateRequest(req)).toThrow('Campo requerido: amount');
        });

        it('debe lanzar error si falta month', () => {
            const req = buildValidRequest();
            delete (req as any).month;
            expect(() => validator.validateCreateRequest(req)).toThrow('Campo requerido: month');
        });

        it('debe lanzar error si falta year', () => {
            const req = buildValidRequest();
            delete (req as any).year;
            expect(() => validator.validateCreateRequest(req)).toThrow('Campo requerido: year');
        });

        it('debe lanzar error si falta due_date', () => {
            const req = buildValidRequest();
            delete (req as any).due_date;
            expect(() => validator.validateCreateRequest(req)).toThrow('Campo requerido: due_date');
        });

        it('debe lanzar error si el monto es menor o igual a cero', () => {
            const req = buildValidRequest();
            req.amount = 0;
            expect(() => validator.validateCreateRequest(req)).toThrow('Monto debe ser mayor a cero');
            
            req.amount = -100;
            expect(() => validator.validateCreateRequest(req)).toThrow('Monto debe ser mayor a cero');
        });

        it('debe lanzar error si el mes es inválido', () => {
            const req = buildValidRequest();
            req.month = 0;
            expect(() => validator.validateCreateRequest(req)).toThrow('Mes inválido');

            req.month = 13;
            expect(() => validator.validateCreateRequest(req)).toThrow('Mes inválido');
        });
    });

    describe('validateNewPayment', () => {
        const req: CreatePaymentRequest = {
            member_id: VALID_UUID,
            amount: 2000,
            month: 5,
            year: 2026,
            due_date: '2026-05-31T00:00:00.000Z',
        };

        it('debe pasar si el socio existe y el período no está duplicado', async () => {
            vi.mocked(mockMemberRepo.findById).mockResolvedValueOnce({ id: VALID_UUID } as any);
            vi.mocked(mockPaymentRepo.findByPeriod).mockResolvedValueOnce(null);

            await expect(validator.validateNewPayment(req)).resolves.not.toThrow();
        });

        it('debe lanzar error si el socio no existe', async () => {
            vi.mocked(mockMemberRepo.findById).mockResolvedValueOnce(null);

            await expect(validator.validateNewPayment(req)).rejects.toThrow('Socio no encontrado');
        });

        it('debe lanzar error si ya existe un pago para ese período', async () => {
            vi.mocked(mockMemberRepo.findById).mockResolvedValueOnce({ id: VALID_UUID } as any);
            vi.mocked(mockPaymentRepo.findByPeriod).mockResolvedValueOnce({ id: 'existing-payment-id' } as any);

            await expect(validator.validateNewPayment(req)).rejects.toThrow('Ya existe un pago para este período');
        });
    });

    describe('validateFilters', () => {
        it('debe pasar con filtros válidos', () => {
            expect(() => validator.validateFilters({
                memberId: VALID_UUID,
                status: 'Paid',
                month: 5,
                year: 2026,
            })).not.toThrow();
        });

        it('debe lanzar error si el estado de pago es inválido', () => {
            expect(() => validator.validateFilters({ status: 'InvalidStatus' })).toThrow('Estado de pago no válido');
        });

        it('debe lanzar error si el formato del id de socio es inválido', () => {
            expect(() => validator.validateFilters({ memberId: INVALID_UUID })).toThrow('Formato de id de socio inválido');
        });

        it('debe lanzar error si el mes es inválido', () => {
            expect(() => validator.validateFilters({ month: 13 })).toThrow('Mes inválido');
        });
    });

    describe('validateUpdateRequest', () => {
        it('debe lanzar error si se incluye member_id en los datos a actualizar', () => {
            const updateData: UpdatePaymentRequest = { member_id: VALID_UUID } as any;
            expect(() => validator.validateUpdateRequest(updateData)).toThrow('El campo member_id es inmutable');
        });

        it('debe lanzar error si se incluye payment_date en los datos a actualizar', () => {
            const updateData: UpdatePaymentRequest = { payment_date: '2026-05-27T00:00:00.000Z' } as any;
            expect(() => validator.validateUpdateRequest(updateData)).toThrow('No se acepta payment_date en el request');
        });

        it('debe lanzar error si el amount es menor o igual a cero', () => {
            const updateData: UpdatePaymentRequest = { amount: 0 };
            expect(() => validator.validateUpdateRequest(updateData)).toThrow('Monto debe ser mayor a cero');
        });
    });

    describe('validateUpdateTransition', () => {
        const paidPayment: PaymentDTO = {
            id: 'payment-1',
            member_id: VALID_UUID,
            amount: 2000,
            month: 5,
            year: 2026,
            due_date: '2026-05-31T00:00:00.000Z',
            status: 'Paid',
            payment_date: '2026-05-27T00:00:00.000Z',
        };

        const canceledPayment: PaymentDTO = {
            id: 'payment-2',
            member_id: VALID_UUID,
            amount: 2000,
            month: 5,
            year: 2026,
            due_date: '2026-05-31T00:00:00.000Z',
            status: 'Canceled',
            payment_date: null,
        };

        it('debe lanzar error si el pago ya está pagado y se intenta marcar de nuevo como pagado', () => {
            expect(() => validator.validateUpdateTransition(paidPayment, { status: 'Paid' })).toThrow('El pago ya fue registrado como pagado');
        });

        it('debe lanzar error si el pago ya está pagado y se intenta cancelar', () => {
            expect(() => validator.validateUpdateTransition(paidPayment, { status: 'Canceled' })).toThrow('Transición de estado no permitida');
        });

        it('debe lanzar error si el pago ya está pagado y se intentan actualizar campos como amount o due_date', () => {
            expect(() => validator.validateUpdateTransition(paidPayment, { amount: 3000 })).toThrow('El pago no puede modificarse en su estado actual');
        });

        it('debe lanzar error si el pago ya está cancelado y se intenta cambiar de estado', () => {
            expect(() => validator.validateUpdateTransition(canceledPayment, { status: 'Paid' })).toThrow('Transición de estado no permitida');
        });
    });

    describe('validateCancel', () => {
        const pendingPayment: PaymentDTO = {
            id: 'p-1',
            member_id: VALID_UUID,
            amount: 2000,
            month: 5,
            year: 2026,
            due_date: '2026-05-31T00:00:00.000Z',
            status: 'Pending',
            payment_date: null,
        };

        const paidPayment: PaymentDTO = {
            id: 'p-2',
            member_id: VALID_UUID,
            amount: 2000,
            month: 5,
            year: 2026,
            due_date: '2026-05-31T00:00:00.000Z',
            status: 'Paid',
            payment_date: '2026-05-27T00:00:00.000Z',
        };

        const canceledPayment: PaymentDTO = {
            id: 'p-3',
            member_id: VALID_UUID,
            amount: 2000,
            month: 5,
            year: 2026,
            due_date: '2026-05-31T00:00:00.000Z',
            status: 'Canceled',
            payment_date: null,
        };

        it('debe permitir la cancelación de un pago pendiente', () => {
            expect(() => validator.validateCancel(pendingPayment)).not.toThrow();
        });

        it('debe lanzar error si el pago ya está cancelado', () => {
            expect(() => validator.validateCancel(canceledPayment)).toThrow('El pago ya se encuentra cancelado');
        });

        it('debe lanzar error si el pago ya está pagado', () => {
            expect(() => validator.validateCancel(paidPayment)).toThrow('No se puede cancelar un pago ya efectuado');
        });
    });
});
