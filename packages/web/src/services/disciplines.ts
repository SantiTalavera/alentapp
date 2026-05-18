import type { CreateDisciplineRequest, DisciplineDTO, UpdateDisciplineRequest } from '@alentapp/shared';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api/v1';

export const disciplinesService = {
  async getByMemberId(memberId: string): Promise<DisciplineDTO[]> {
    const response = await fetch(`${API_URL}/members/${memberId}/disciplines`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error al obtener las disciplinas del socio');
    }

    const result = await response.json();
    return result.data;
  },

  async getById(id: string): Promise<DisciplineDTO> {
    const response = await fetch(`${API_URL}/disciplines/${id}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error al obtener la disciplina');
    }

    const result = await response.json();
    return result.data;
  },

  async create(data: CreateDisciplineRequest): Promise<DisciplineDTO> {
    const response = await fetch(`${API_URL}/disciplines`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error al registrar la disciplina');
    }

    const result = await response.json();
    return result.data;
  },

  async update(id: string, data: UpdateDisciplineRequest): Promise<DisciplineDTO> {
    const response = await fetch(`${API_URL}/disciplines/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error al actualizar la disciplina');
    }

    const result = await response.json();
    return result.data;
  },
};
