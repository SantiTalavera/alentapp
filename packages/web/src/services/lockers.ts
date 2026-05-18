import type { CreateLockerRequest, UpdateLockerRequest, LockerDTO } from '@alentapp/shared';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api/v1';

export const lockersService = {
  async create(data: CreateLockerRequest): Promise<LockerDTO> {
    const response = await fetch(`${API_URL}/lockers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error al crear el casillero');
    }

    const result = await response.json();
    return result.data;
  },

  async update(id: string, data: UpdateLockerRequest): Promise<LockerDTO> {
    const response = await fetch(`${API_URL}/lockers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error al actualizar el casillero');
    }

    const result = await response.json();
    return result.data;
  },

  async delete(id: string): Promise<LockerDTO> {
    const response = await fetch(`${API_URL}/lockers/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error al dar de baja el casillero');
    }

    const result = await response.json();
    return result.data;
  },

  async getAll(status?: string): Promise<LockerDTO[]> {
    const url = status ? `${API_URL}/lockers?status=${status}` : `${API_URL}/lockers`;
    const response = await fetch(url);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error al obtener los casilleros');
    }

    const result = await response.json();
    return result.data;
  },

  async getById(id: string): Promise<LockerDTO> {
    const response = await fetch(`${API_URL}/lockers/${id}`);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error al obtener el casillero');
    }

    const result = await response.json();
    return result.data;
  },
};
