import { CreateLockerRequest, UpdateLockerRequest } from '@alentapp/shared';
import { Locker } from '../Locker.js';

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

    validateUpdateRequest(data: UpdateLockerRequest, currentLocker: Locker): void {
        if (data.number === undefined || data.number === null) {
            throw new Error('campo requerido');
        }
        if (typeof data.number !== 'number' || Number.isNaN(data.number) || !Number.isInteger(data.number)) {
            throw new Error('El número de casillero debe ser un número entero');
        }
        if (data.number <= 0) {
            throw new Error('debe ser mayor a cero');
        }
        if (data.location === undefined || data.location === null || data.location.trim() === '') {
            throw new Error('campo requerido');
        }
        if (!['Available', 'Occupied', 'Maintenance'].includes(data.status)) {
            throw new Error('estado no válido');
        }

        const isNewStatusMaintenance = data.status === 'Maintenance';
        const hasMemberId = data.member_id !== null && data.member_id !== undefined;

        if (isNewStatusMaintenance && hasMemberId) {
            throw new Error('casillero en mantenimiento no puede tener socio');
        }

        if (hasMemberId && (isNewStatusMaintenance || currentLocker.status === 'Maintenance')) {
            throw new Error('no se puede asignar socio en este estado');
        }

        if (isNewStatusMaintenance && currentLocker.member_id !== null) {
            throw new Error('casillero en mantenimiento no puede tener socio');
        }
    }
}
