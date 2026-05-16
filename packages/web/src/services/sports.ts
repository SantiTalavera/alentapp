import type { CreateSportRequest, SportDTO, UpdateSportRequest } from '@alentapp/shared';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api/v1';

export const sportsService = {
  async getAll(): Promise<SportDTO[]> {
    const response = await fetch(`${API_URL}/sports`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error al obtener los deportes');
    }
    const result = await response.json();
    return result.data;
  },

  async getById(id: string): Promise<SportDTO> {
    const response = await fetch(`${API_URL}/sports/${id}`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error al obtener el deporte');
    }
    const result = await response.json();
    return result.data;
  },

  async create(data: CreateSportRequest): Promise<SportDTO> {
    const response = await fetch(`${API_URL}/sports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error al crear el deporte');
    }

    const result = await response.json();
    return result.data;
  },

  async update(id: string, data: UpdateSportRequest): Promise<SportDTO> {
    const response = await fetch(`${API_URL}/sports/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error al actualizar el deporte');
    }

    const result = await response.json();
    return result.data;
  },

  async delete(id: string): Promise<SportDTO> {
    const response = await fetch(`${API_URL}/sports/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error al dar de baja el deporte');
    }

    const result = await response.json();
    return result.data;
  },
};
