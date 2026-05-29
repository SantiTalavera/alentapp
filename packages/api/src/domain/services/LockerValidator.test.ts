import { describe, it, expect } from 'vitest';
import { LockerValidator } from './LockerValidator.js';
import { CreateLockerRequest } from '@alentapp/shared';

describe('LockerValidator (Responsabilidad: Validaciones de Datos de Entrada)', () => {
    const validator = new LockerValidator();

    describe('validateCreateRequest', () => {
        it('debe pasar exitosamente si los datos de creación son válidos', () => {
            const validData: CreateLockerRequest = {
                number: 10,
                location: 'Pasillo A',
            };
            expect(() => validator.validateCreateRequest(validData)).not.toThrow();
        });

        it('debe lanzar error "campo requerido" si falta el número de casillero o es nulo', () => {
            const dataMissingNumber = {
                location: 'Pasillo A',
            } as unknown as CreateLockerRequest;

            expect(() => validator.validateCreateRequest(dataMissingNumber)).toThrow('campo requerido');
        });

        it('debe lanzar error "campo requerido" si falta la ubicación o es vacía', () => {
            const dataMissingLocation = {
                number: 10,
            } as unknown as CreateLockerRequest;

            const dataEmptyLocation = {
                number: 10,
                location: '    ',
            } as CreateLockerRequest;

            expect(() => validator.validateCreateRequest(dataMissingLocation)).toThrow('campo requerido');
            expect(() => validator.validateCreateRequest(dataEmptyLocation)).toThrow('campo requerido');
        });

        it('debe lanzar error "El número de casillero debe ser un número entero" si no es entero o es NaN', () => {
            const dataDecimalNumber = {
                number: 10.5,
                location: 'Pasillo A',
            } as CreateLockerRequest;

            const dataNaNNumber = {
                number: NaN,
                location: 'Pasillo A',
            } as CreateLockerRequest;

            expect(() => validator.validateCreateRequest(dataDecimalNumber)).toThrow('El número de casillero debe ser un número entero');
            expect(() => validator.validateCreateRequest(dataNaNNumber)).toThrow('El número de casillero debe ser un número entero');
        });

        it('debe lanzar error "debe ser mayor a cero" si el número de casillero es 0 o negativo', () => {
            const dataZeroNumber = {
                number: 0,
                location: 'Pasillo A',
            } as CreateLockerRequest;

            const dataNegativeNumber = {
                number: -5,
                location: 'Pasillo A',
            } as CreateLockerRequest;

            expect(() => validator.validateCreateRequest(dataZeroNumber)).toThrow('debe ser mayor a cero');
            expect(() => validator.validateCreateRequest(dataNegativeNumber)).toThrow('debe ser mayor a cero');
        });
    });

    describe('validateUpdateRequest', () => {
        const currentLocker = {
            id: 'uuid-1',
            number: 10,
            location: 'Pasillo A',
            status: 'Available',
            member_id: null,
            is_active: true,
        } as any;

        it('debe pasar exitosamente si los datos de actualización son válidos', () => {
            const validData: any = {
                number: 10,
                location: 'Pasillo A',
                status: 'Available',
                member_id: null,
            };
            expect(() => validator.validateUpdateRequest(validData, currentLocker)).not.toThrow();
        });

        it('debe lanzar error "campo requerido" si falta el número de casillero', () => {
            const invalidData = {
                location: 'Pasillo A',
                status: 'Available',
                member_id: null,
            } as any;
            expect(() => validator.validateUpdateRequest(invalidData, currentLocker)).toThrow('campo requerido');
        });

        it('debe lanzar error "debe ser mayor a cero" si el número es <= 0', () => {
            const invalidData = {
                number: 0,
                location: 'Pasillo A',
                status: 'Available',
                member_id: null,
            } as any;
            expect(() => validator.validateUpdateRequest(invalidData, currentLocker)).toThrow('debe ser mayor a cero');
        });

        it('debe lanzar error "estado no válido" si el estado no es correcto', () => {
            const invalidData = {
                number: 10,
                location: 'Pasillo A',
                status: 'InvalidStatus',
                member_id: null,
            } as any;
            expect(() => validator.validateUpdateRequest(invalidData, currentLocker)).toThrow('estado no válido');
        });

        it('debe lanzar error si se intenta asignar un socio a un casillero en mantenimiento', () => {
            const invalidData = {
                number: 10,
                location: 'Pasillo A',
                status: 'Maintenance',
                member_id: 'member-123',
            } as any;
            expect(() => validator.validateUpdateRequest(invalidData, currentLocker)).toThrow('casillero en mantenimiento no puede tener socio');
        });
    });
});
