import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetPaymentByIdUseCase } from './GetPaymentByIdUseCase.js';
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

describe('GetPaymentByIdUseCase — tests unitarios', () => {
    const useCase = new GetPaymentByIdUseCase(mockPaymentRepo, mockPaymentValidator);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // Test [1] — caso exitoso
    it('debe retornar el pago correspondiente si existe en el repositorio', async () => {
        const expectedPayment = buildPaymentDTO();
        vi.mocked(mockPaymentValidator.validateId).mockReturnValue(undefined);
        vi.mocked(mockPaymentRepo.findById).mockResolvedValueOnce(expectedPayment);

        const result = await useCase.execute(PAYMENT_ID);

        expect(result).toEqual(expectedPayment);
        expect(mockPaymentValidator.validateId).toHaveBeenCalledWith(PAYMENT_ID);
        expect(mockPaymentRepo.findById).toHaveBeenCalledWith(PAYMENT_ID);
    });

    // Test [2] — pago inexistente → throws "Pago no encontrado"
    it('debe lanzar un error "Pago no encontrado" si el pago no existe', async () => {
        vi.mocked(mockPaymentValidator.validateId).mockReturnValue(undefined);
        vi.mocked(mockPaymentRepo.findById).mockResolvedValueOnce(null);

        await expect(useCase.execute(PAYMENT_ID)).rejects.toThrow('Pago no encontrado');
        expect(mockPaymentRepo.findById).toHaveBeenCalledWith(PAYMENT_ID);
    });

    // Test [3] — formato id inválido → error de validación
    it('debe propagar el error del validador si el id es inválido', async () => {
        const invalidId = 'invalid-id-123';
        vi.mocked(mockPaymentValidator.validateId).mockImplementationOnce(() => {
            throw new Error('Formato de id inválido');
        });

        await expect(useCase.execute(invalidId)).rejects.toThrow('Formato de id inválido');
        expect(mockPaymentRepo.findById).not.toHaveBeenCalled();
    });
});
