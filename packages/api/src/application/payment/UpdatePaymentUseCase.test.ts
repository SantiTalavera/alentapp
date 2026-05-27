import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdatePaymentUseCase } from './UpdatePaymentUseCase.js';
import { PaymentRepository } from '../../domain/PaymentRepository.js';
import { PaymentValidator } from '../../domain/services/PaymentValidator.js';
import { PaymentDTO, UpdatePaymentRequest } from '@alentapp/shared';

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

describe('UpdatePaymentUseCase — tests unitarios', () => {
    const useCase = new UpdatePaymentUseCase(mockPaymentRepo, mockPaymentValidator);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // Test [1] — pago inexistente → 404 / Error "Pago no encontrado"
    it('debe lanzar un error "Pago no encontrado" si el pago no existe en el repositorio', async () => {
        vi.mocked(mockPaymentValidator.validateUpdateRequest).mockReturnValue(undefined);
        vi.mocked(mockPaymentRepo.findById).mockResolvedValueOnce(null);

        const request: UpdatePaymentRequest = { amount: 2000 };

        await expect(useCase.execute(PAYMENT_ID, request)).rejects.toThrow('Pago no encontrado');
        expect(mockPaymentRepo.update).not.toHaveBeenCalled();
    });

    // Test [2] — transición Pending→Paid → asigna payment_date automáticamente
    it('debe asignar automáticamente payment_date al pasar del estado Pending a Paid', async () => {
        const existingPayment = buildPaymentDTO({ status: 'Pending', payment_date: null });
        const request: UpdatePaymentRequest = { status: 'Paid' };

        vi.mocked(mockPaymentValidator.validateUpdateRequest).mockReturnValue(undefined);
        vi.mocked(mockPaymentRepo.findById).mockResolvedValueOnce(existingPayment);
        vi.mocked(mockPaymentValidator.validateUpdateTransition).mockReturnValue(undefined);
        vi.mocked(mockPaymentRepo.update).mockImplementationOnce(async (id, data) => buildPaymentDTO({ ...existingPayment, ...data }));

        const result = await useCase.execute(PAYMENT_ID, request);

        expect(result.status).toBe('Paid');
        expect(result.payment_date).not.toBeNull();
        expect(result.payment_date).toBeDefined();
        // Verificar que se haya llamado al repositorio para actualizar
        expect(mockPaymentRepo.update).toHaveBeenCalledWith(
            PAYMENT_ID,
            expect.objectContaining({
                status: 'Paid',
                payment_date: expect.any(String),
            })
        );
    });

    // Test [3] — propagar error del validador ante transición inválida (ej. Paid -> Pending)
    it('debe propagar el error del validador cuando la transición de estado es inválida', async () => {
        const existingPayment = buildPaymentDTO({ status: 'Paid', payment_date: '2026-05-27T00:00:00.000Z' });
        const request: UpdatePaymentRequest = { status: 'Canceled' };

        vi.mocked(mockPaymentValidator.validateUpdateRequest).mockReturnValue(undefined);
        vi.mocked(mockPaymentRepo.findById).mockResolvedValueOnce(existingPayment);
        vi.mocked(mockPaymentValidator.validateUpdateTransition).mockImplementationOnce(() => {
            throw new Error('Transición de estado no permitida');
        });

        await expect(useCase.execute(PAYMENT_ID, request)).rejects.toThrow('Transición de estado no permitida');
        expect(mockPaymentRepo.update).not.toHaveBeenCalled();
    });
});
