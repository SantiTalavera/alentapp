import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetPaymentsUseCase } from './GetPaymentsUseCase.js';
import { PaymentRepository } from '../../domain/PaymentRepository.js';
import { PaymentValidator } from '../../domain/services/PaymentValidator.js';
import { PaymentDTO } from '@alentapp/shared';

const MEMBER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

function buildPaymentDTO(overrides: Partial<PaymentDTO> = {}): PaymentDTO {
    return {
        id: 'payment-id-1',
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

describe('GetPaymentsUseCase — tests unitarios', () => {
    const useCase = new GetPaymentsUseCase(mockPaymentRepo, mockPaymentValidator);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // Test [1] — sin filtros
    it('debe retornar la lista completa de pagos cuando no se envían filtros', async () => {
        const expectedPayments = [buildPaymentDTO({ id: 'p-1' }), buildPaymentDTO({ id: 'p-2' })];
        vi.mocked(mockPaymentValidator.validateFilters).mockReturnValue(undefined);
        vi.mocked(mockPaymentRepo.findAll).mockResolvedValueOnce(expectedPayments);

        const result = await useCase.execute({});

        expect(result).toEqual(expectedPayments);
        expect(mockPaymentValidator.validateFilters).toHaveBeenCalledWith({});
        expect(mockPaymentRepo.findAll).toHaveBeenCalledWith({});
    });

    // Test [2] — con filtros válidos
    it('debe retornar los pagos filtrados cuando se envían filtros válidos', async () => {
        const filters = { memberId: MEMBER_ID, status: 'Pending' };
        const expectedPayments = [buildPaymentDTO({ id: 'p-1', status: 'Pending' })];
        vi.mocked(mockPaymentValidator.validateFilters).mockReturnValue(undefined);
        vi.mocked(mockPaymentRepo.findAll).mockResolvedValueOnce(expectedPayments);

        const result = await useCase.execute(filters);

        expect(result).toEqual(expectedPayments);
        expect(mockPaymentValidator.validateFilters).toHaveBeenCalledWith(filters);
        expect(mockPaymentRepo.findAll).toHaveBeenCalledWith(filters);
    });

    // Test [3] — propagar error del validador ante filtros inválidos
    it('debe propagar el error del validador si los filtros son inválidos', async () => {
        const filters = { status: 'InvalidStatus' };
        vi.mocked(mockPaymentValidator.validateFilters).mockImplementationOnce(() => {
            throw new Error('Estado de pago no válido');
        });

        await expect(useCase.execute(filters)).rejects.toThrow('Estado de pago no válido');
        expect(mockPaymentRepo.findAll).not.toHaveBeenCalled();
    });
});
