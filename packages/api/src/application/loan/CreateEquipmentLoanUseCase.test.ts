import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateEquipmentLoanUseCase } from './CreateEquipmentLoanUseCase.js';
import { EquipmentLoanRepository } from '../../domain/EquipmentLoanRepository.js';
import { EquipmentLoanValidator } from '../../domain/services/EquipmentLoanValidator.js';
import { EquipmentLoanDTO, MemberDTO } from '@alentapp/shared';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_MEMBER_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

/** Construye un MemberDTO de prueba con los campos que requiere el validador. */
function buildMember(overrides: Partial<MemberDTO> = {}): MemberDTO {
    return {
        id: VALID_MEMBER_UUID,
        dni: '12345678',
        name: 'Socio de Prueba',
        email: 'socio@test.com',
        birthdate: '1990-01-01',
        category: 'Pleno',
        status: 'Activo',
        created_at: '2024-01-01T00:00:00.000Z',
        ...overrides,
    };
}

/** Construye un EquipmentLoanDTO de prueba que simula la respuesta del repositorio. */
function buildLoanDTO(overrides: Partial<EquipmentLoanDTO> = {}): EquipmentLoanDTO {
    return {
        id: 'loan-uuid-0001',
        item_name: 'Raqueta de Tenis',
        status: 'Prestado',
        loan_date: new Date().toISOString(),
        due_date: null,
        member_id: VALID_MEMBER_UUID,
        deleted_at: null,
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Mocks de infraestructura (puertos)
// ---------------------------------------------------------------------------

const mockEquipmentLoanRepo = {
    create: vi.fn(),
    findById: vi.fn(),
    findAll: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
} as unknown as EquipmentLoanRepository;

const mockEquipmentLoanValidator = {
    validate: vi.fn(),
    validateMemberId: vi.fn(),
    validateId: vi.fn(),
    validateStatusTransition: vi.fn(),
} as unknown as EquipmentLoanValidator;

// ---------------------------------------------------------------------------
// Suite de tests unitarios
// ---------------------------------------------------------------------------

describe('CreateEquipmentLoanUseCase — tests unitarios', () => {
    const useCase = new CreateEquipmentLoanUseCase(
        mockEquipmentLoanRepo,
        mockEquipmentLoanValidator,
    );

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // -------------------------------------------------------------------------
    // Test [1] – member_id inexistente → el validador lanza "Socio no encontrado"
    // -------------------------------------------------------------------------
    it('debe lanzar un error "Socio no encontrado" cuando el member_id no existe en el sistema', async () => {
        // El validador simula que el socio no fue encontrado en la BD
        vi.mocked(mockEquipmentLoanValidator.validate).mockRejectedValueOnce(
            new Error('Socio no encontrado'),
        );

        await expect(
            useCase.execute({
                item_name: 'Pelota de Fútbol',
                member_id: VALID_MEMBER_UUID,
            }),
        ).rejects.toThrow('Socio no encontrado');

        // El repositorio NO debe haberse invocado porque falló la validación
        expect(mockEquipmentLoanRepo.create).not.toHaveBeenCalled();
    });

    // -------------------------------------------------------------------------
    // Test [2] – Socio con status Moroso → el validador lanza regla de negocio
    // -------------------------------------------------------------------------
    it('debe lanzar un error de regla de negocio cuando el socio tiene status Moroso (Delinquent)', async () => {
        // El validador detecta que el socio no está "Activo"
        vi.mocked(mockEquipmentLoanValidator.validate).mockRejectedValueOnce(
            new Error('El socio no está activo y no puede solicitar un préstamo'),
        );

        await expect(
            useCase.execute({
                item_name: 'Guantes de Boxeo',
                member_id: VALID_MEMBER_UUID,
            }),
        ).rejects.toThrow('El socio no está activo y no puede solicitar un préstamo');

        expect(mockEquipmentLoanRepo.create).not.toHaveBeenCalled();
    });

    // -------------------------------------------------------------------------
    // Test [3] – Socio con categoría Cadete → el validador lanza regla de negocio
    // -------------------------------------------------------------------------
    it('debe lanzar el mensaje específico de categoría Cadete cuando el socio no está habilitado para solicitar préstamos', async () => {
        const expectedMessage =
            'Los socios con categoría Cadete no pueden solicitar préstamos de equipamiento. Solo categorías Pleno u Honorario están habilitadas.';

        vi.mocked(mockEquipmentLoanValidator.validate).mockRejectedValueOnce(
            new Error(expectedMessage),
        );

        await expect(
            useCase.execute({
                item_name: 'Bicicleta',
                member_id: VALID_MEMBER_UUID,
            }),
        ).rejects.toThrow(expectedMessage);

        expect(mockEquipmentLoanRepo.create).not.toHaveBeenCalled();
    });

    // -------------------------------------------------------------------------
    // Test [4] - Socio Pleno (Senior) activo → retorna EquipmentLoanDTO con status "Prestado"
    // -------------------------------------------------------------------------
    it('debe retornar un EquipmentLoanDTO con status "Prestado" cuando el socio Pleno está activo', async () => {
        const expectedLoan = buildLoanDTO({ item_name: 'Raqueta de Tenis' });

        // El validador pasa sin errores
        vi.mocked(mockEquipmentLoanValidator.validate).mockResolvedValueOnce(undefined);
        // El repositorio devuelve el préstamo creado
        vi.mocked(mockEquipmentLoanRepo.create).mockResolvedValueOnce(expectedLoan);

        const result = await useCase.execute({
            item_name: 'Raqueta de Tenis',
            member_id: VALID_MEMBER_UUID,
        });

        expect(result.status).toBe('Prestado');
        expect(result.item_name).toBe('Raqueta de Tenis');
        expect(result.member_id).toBe(VALID_MEMBER_UUID);
        expect(result.id).toBeDefined();

        // Verificamos que el repositorio fue llamado con los datos correctos
        expect(mockEquipmentLoanRepo.create).toHaveBeenCalledWith(
            expect.objectContaining({
                item_name: 'Raqueta de Tenis',
                member_id: VALID_MEMBER_UUID,
            }),
        );
    });
});
