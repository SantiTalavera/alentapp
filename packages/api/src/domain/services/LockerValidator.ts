import { CreateLockerRequest } from '@alentapp/shared';

export class LockerValidator {
    validateCreateRequest(data: CreateLockerRequest): void {
        if (data.number === undefined || data.number === null) {
            throw new Error('campo requerido');
        }
        if (data.location === undefined || data.location === null || data.location.trim() === '') {
            throw new Error('campo requerido');
        }
        if (typeof data.number !== 'number' || Number.isNaN(data.number) || !Number.isInteger(data.number)) {
            throw new Error('El número de casillero debe ser un número entero');
        }
        if (data.number <= 0) {
            throw new Error('debe ser mayor a cero');
        }
    }
}
