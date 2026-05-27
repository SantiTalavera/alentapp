import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CancelPaymentUseCase } from './CancelPaymentUseCase.js';
import { PaymentRepository } from '../../domain/PaymentRepository.js';
import { PaymentValidator } from '../../domain/services/PaymentValidator.js';
import { PaymentDTO } from '@alentapp/shared';

const MEMBER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const PAYMENT_ID = 'p1a2b3c4-d5e6-7890-abcd-ef1234567890';

function buildPaymentDTO(overrides: Partial<PaymentDTO> = {}): PaymentDTO {
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

const mockPaymentRepo = {
    create: vi.fn(),
    findAll: vi.fn(),
    findById: vi.fn(),
    findByPeriod: vi.fn(),
    update: vi.fn(),
    cancel: vi.fn(),
} as unknown as PaymentRepository;

const mockPaymentValidator = {
    validateNewPayment: vi.fn(),
    validateId: vi.fn(),
    validateCreateRequest: vi.fn(),
    validateFilters: vi.fn(),
    validateUpdateRequest: vi.fn(),
    validateUpdateTransition: vi.fn(),
    validateCancel: vi.fn(),
} as unknown as PaymentValidator;

describe('CancelPaymentUseCase — tests unitarios', () => {
    const useCase = new CancelPaymentUseCase(mockPaymentRepo, mockPaymentValidator);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // Test [1] — pago inexistente
    it('debe lanzar un error "Pago no encontrado" si el pago no existe en el repositorio', async () => {
        vi.mocked(mockPaymentRepo.findById).mockResolvedValueOnce(null);

        await expect(useCase.execute(PAYMENT_ID)).rejects.toThrow('Pago no encontrado');
        expect(mockPaymentRepo.cancel).not.toHaveBeenCalled();
    });

    // Test [2] — propagar error de validación (pago no cancelable)
    it('debe propagar el error del validador si el pago no se puede cancelar', async () => {
        const existingPayment = buildPaymentDTO({ status: 'Paid', payment_date: '2026-05-27T00:00:00.000Z' });
        vi.mocked(mockPaymentRepo.findById).mockResolvedValueOnce(existingPayment);
        vi.mocked(mockPaymentValidator.validateCancel).mockImplementationOnce(() => {
            throw new Error('No se puede cancelar un pago ya efectuado');
        });

        await expect(useCase.execute(PAYMENT_ID)).rejects.toThrow('No se puede cancelar un pago ya efectuado');
        expect(mockPaymentRepo.cancel).not.toHaveBeenCalled();
    });

    // Test [3] — pago Pending → 200 con status Canceled
    it('debe cancelar exitosamente un pago pendiente y retornar el DTO cancelado', async () => {
        const existingPayment = buildPaymentDTO({ status: 'Pending', payment_date: null });
        const expectedPayment = buildPaymentDTO({ status: 'Canceled', payment_date: null });

        vi.mocked(mockPaymentRepo.findById).mockResolvedValueOnce(existingPayment);
        vi.mocked(mockPaymentValidator.validateCancel).mockReturnValue(undefined);
        vi.mocked(mockPaymentRepo.cancel).mockResolvedValueOnce(expectedPayment);

        const result = await useCase.execute(PAYMENT_ID);

        expect(result.status).toBe('Canceled');
        expect(mockPaymentRepo.cancel).toHaveBeenCalledWith(PAYMENT_ID);
    });
});
