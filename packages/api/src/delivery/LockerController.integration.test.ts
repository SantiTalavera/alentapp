import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { CreateLockerRequest } from '@alentapp/shared';

// Mockeamos el repositorio PostgresLockerRepository para testear la integración sin DB real
// Flow completo: Fastify (HTTP) -> LockerController -> NewLockerUseCase -> LockerValidator -> PostgresLockerRepository (Mock)
vi.mock('../infrastructure/PostgresLockerRepository.js', () => {
    return {
        PostgresLockerRepository: class {
            async findByNumber(number: number) {
                // Simulamos que el número 10 ya está ocupado/registrado
                if (number === 10) {
                    return {
                        id: 'uuid-existing',
                        number: 10,
                        location: 'Pasillo A',
                        status: 'Available',
                        member_id: null,
                        is_active: true,
                    };
                }
                return null;
            }

            async create(data: any) {
                return {
                    id: 'uuid-new-locker',
                    ...data,
                    status: data.status || 'Available',
                    is_active: data.is_active !== undefined ? data.is_active : true,
                };
            }

            async findById(id: string) {
                if (id === 'uuid-active') {
                    return {
                        id: 'uuid-active',
                        number: 123,
                        location: 'Pasillo A',
                        status: 'Available',
                        member_id: null,
                        is_active: true,
                    };
                }
                if (id === 'uuid-inactive') {
                    return {
                        id: 'uuid-inactive',
                        number: 456,
                        location: 'Pasillo B',
                        status: 'Available',
                        member_id: null,
                        is_active: false,
                    };
                }
                return null;
            }

            async deactivate(id: string) {
                return {
                    id,
                    number: 123,
                    location: 'Pasillo A',
                    status: 'Available',
                    member_id: null,
                    is_active: false,
                };
            }

            async update(id: string, data: any) {
                return {
                    id,
                    number: data.number !== undefined ? data.number : 123,
                    location: data.location !== undefined ? data.location : 'Pasillo A',
                    status: data.status !== undefined ? data.status : 'Available',
                    member_id: data.member_id !== undefined ? data.member_id : null,
                    is_active: true,
                };
            }
        }
    };
});

describe('Locker API Integration Tests (Alta de Casillero)', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = buildApp();
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
    });

    describe('POST /api/v1/lockers', () => {
        it('[1] POST /api/v1/lockers con datos válidos → 201 con LockerDTO (status Available, is_active true)', async () => {
            const payload: CreateLockerRequest = {
                number: 15,
                location: 'Pasillo E2E',
            };

            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/lockers',
                payload,
            });

            expect(response.statusCode).toBe(201);
            const body = JSON.parse(response.payload);

            expect(body.data).toBeDefined();
            expect(body.data.id).toBe('uuid-new-locker');
            expect(body.data.number).toBe(15);
            expect(body.data.location).toBe('Pasillo E2E');
            expect(body.data.status).toBe('Available');
            expect(body.data.is_active).toBe(true);
            expect(body.data.member_id).toBeNull();
        });

        it('[2] POST con number duplicado → 409', async () => {
            const payload: CreateLockerRequest = {
                number: 10, // El número 10 lo mockeamos arriba como duplicado
                location: 'Pasillo B',
            };

            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/lockers',
                payload,
            });

            expect(response.statusCode).toBe(409);
            const body = JSON.parse(response.payload);
            expect(body.error).toBe('número de casillero ya registrado');
        });
    });

    describe('DELETE /api/v1/lockers/:id', () => {
        it('[5] DELETE /api/v1/lockers/:id activo → 200 con LockerDTO con is_active false', async () => {
            const response = await app.inject({
                method: 'DELETE',
                url: '/api/v1/lockers/uuid-active',
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.payload);

            expect(body.data).toBeDefined();
            expect(body.data.id).toBe('uuid-active');
            expect(body.data.is_active).toBe(false);
        });

        it('[6] DELETE locker ya inactivo → 409', async () => {
            const response = await app.inject({
                method: 'DELETE',
                url: '/api/v1/lockers/uuid-inactive',
            });

            expect(response.statusCode).toBe(409);
            const body = JSON.parse(response.payload);
            expect(body.error).toBe('el casillero ya fue dado de baja');
        });
    });

    describe('PATCH /api/v1/lockers/:id', () => {
        it('[3] PATCH /api/v1/lockers/:id asignando member_id con status Maintenance → 422', async () => {
            const payload = {
                number: 123,
                location: 'Pasillo A',
                status: 'Maintenance',
                member_id: 'member-999',
            };

            const response = await app.inject({
                method: 'PATCH',
                url: '/api/v1/lockers/uuid-active',
                payload,
            });

            expect(response.statusCode).toBe(422);
            const body = JSON.parse(response.payload);
            expect(body.error).toBe('casillero en mantenimiento no puede tener socio');
        });

        it('[4] PATCH cambiando status y location → 200 con datos actualizados', async () => {
            const payload = {
                number: 123,
                location: 'Nuevo Pasillo B',
                status: 'Occupied',
                member_id: 'member-123',
            };

            const response = await app.inject({
                method: 'PATCH',
                url: '/api/v1/lockers/uuid-active',
                payload,
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.payload);

            expect(body.data).toBeDefined();
            expect(body.data.id).toBe('uuid-active');
            expect(body.data.location).toBe('Nuevo Pasillo B');
            expect(body.data.status).toBe('Occupied');
            expect(body.data.member_id).toBe('member-123');
        });
    });
});
