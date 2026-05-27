import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreatePaymentUseCase } from './CreatePaymentUseCase.js';
import { PaymentRepository } from '../../domain/PaymentRepository.js';
import { PaymentValidator } from '../../domain/services/PaymentValidator.js';
import { CreatePaymentRequest, PaymentDTO } from '@alentapp/shared';

const MEMBER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const PAYMENT_ID = 'p1a2b3c4-d5e6-7890-abcd-ef1234567890';

function buildCreateRequest(overrides: Partial<CreatePaymentRequest> = {}): CreatePaymentRequest {
    return {
        member_id: MEMBER_ID,
        amount: 1500,
        month: 5,
        year: 2026,
        due_date: '2026-05-31T00:00:00.000Z',
        ...overrides,
    };
}

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

describe('CreatePaymentUseCase — tests unitarios', () => {
    const useCase = new CreatePaymentUseCase(mockPaymentRepo, mockPaymentValidator);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // Test [1] — member_id inexistente
    it('debe lanzar un error "Socio no encontrado" si el socio no existe', async () => {
        vi.mocked(mockPaymentValidator.validateNewPayment).mockRejectedValueOnce(
            new Error('Socio no encontrado')
        );

        const request = buildCreateRequest();

        await expect(useCase.execute(request)).rejects.toThrow('Socio no encontrado');
        expect(mockPaymentRepo.create).not.toHaveBeenCalled();
    });

    // Test [2] — período duplicado
    it('debe lanzar un error "Ya existe un pago para este período" si el período está duplicado', async () => {
        vi.mocked(mockPaymentValidator.validateNewPayment).mockRejectedValueOnce(
            new Error('Ya existe un pago para este período')
        );

        const request = buildCreateRequest();

        await expect(useCase.execute(request)).rejects.toThrow('Ya existe un pago para este período');
        expect(mockPaymentRepo.create).not.toHaveBeenCalled();
    });

    // Test [3] — datos válidos
    it('debe retornar un PaymentDTO con status Pending y payment_date null cuando los datos son válidos', async () => {
        const request = buildCreateRequest();
        const expectedPayment = buildPaymentDTO({
            ...request,
            status: 'Pending',
            payment_date: null,
        });

        vi.mocked(mockPaymentValidator.validateNewPayment).mockResolvedValueOnce(undefined);
        vi.mocked(mockPaymentRepo.create).mockResolvedValueOnce(expectedPayment);

        const result = await useCase.execute(request);

        expect(result.status).toBe('Pending');
        expect(result.payment_date).toBeNull();
        expect(result.member_id).toBe(request.member_id);
        expect(mockPaymentRepo.create).toHaveBeenCalledWith({
            ...request,
            status: 'Pending',
            payment_date: null,
        });
    });
});
