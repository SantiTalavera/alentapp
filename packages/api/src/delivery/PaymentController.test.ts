import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentController } from './PaymentController.js';
import { PaymentDTO } from '@alentapp/shared';

const MEMBER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const PAYMENT_ID = 'p1a2b3c4-d5e6-7890-abcd-ef1234567890';

function buildPayment(overrides: Partial<PaymentDTO> = {}): PaymentDTO {
    return {
        id: PAYMENT_ID,
        member_id: MEMBER_ID,
        amount: 1500,
        month: 5,
        year: 2026,
        due_date: '2026-05-31T00:00:00.000Z',
        status: 'Pending',
        payment_date: null,
        ...overrides,
    };
}

const mockCreateUseCase = { execute: vi.fn() };
const mockGetPaymentsUseCase = { execute: vi.fn() };
const mockGetPaymentByIdUseCase = { execute: vi.fn() };
const mockUpdatePaymentUseCase = { execute: vi.fn() };
const mockCancelPaymentUseCase = { execute: vi.fn() };

const controller = new PaymentController(
    mockCreateUseCase as any,
    mockGetPaymentsUseCase as any,
    mockGetPaymentByIdUseCase as any,
    mockUpdatePaymentUseCase as any,
    mockCancelPaymentUseCase as any
);

function buildMockReply() {
    const reply = {
        code: vi.fn(),
        send: vi.fn(),
    };
    reply.code.mockReturnValue(reply);
    return reply;
}

describe('PaymentController — create() unit tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('debe responder con código 201 y el PaymentDTO cuando el pago es creado exitosamente', async () => {
        const payment = buildPayment();
        mockCreateUseCase.execute.mockResolvedValueOnce(payment);

        const mockReply = buildMockReply();
        const mockRequest = {
            body: { member_id: MEMBER_ID, amount: 1500, month: 5, year: 2026, due_date: '2026-05-31T00:00:00.000Z' },
        };

        await controller.create(mockRequest as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(201);
        expect(mockReply.send).toHaveBeenCalledWith({ data: payment });
    });

    it('debe responder con código 404 cuando el socio no existe', async () => {
        mockCreateUseCase.execute.mockRejectedValueOnce(new Error('Socio no encontrado'));

        const mockReply = buildMockReply();
        const mockRequest = {
            body: { member_id: MEMBER_ID, amount: 1500, month: 5, year: 2026, due_date: '2026-05-31T00:00:00.000Z' },
        };

        await controller.create(mockRequest as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(404);
        expect(mockReply.send).toHaveBeenCalledWith({ error: 'Socio no encontrado' });
    });

    it('debe responder con código 409 cuando ya existe un pago para el período', async () => {
        mockCreateUseCase.execute.mockRejectedValueOnce(new Error('Ya existe un pago para este período'));

        const mockReply = buildMockReply();
        const mockRequest = {
            body: { member_id: MEMBER_ID, amount: 1500, month: 5, year: 2026, due_date: '2026-05-31T00:00:00.000Z' },
        };

        await controller.create(mockRequest as any, mockReply as any);

        expect(mockReply.code).toHaveBeenCalledWith(409);
        expect(mockReply.send).toHaveBeenCalledWith({ error: 'Ya existe un pago para este período' });
    });
});
