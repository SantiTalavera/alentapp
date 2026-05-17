import type {
  CreateEnrollmentRequest,
  EnrollmentDTO,
  UpdateEnrollmentRequest,
} from '@alentapp/shared';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api/v1';

export type EnrollmentListFilters = {
  memberId?: string;
  sportId?: string;
  isActive?: boolean;
};

export async function create(
  data: CreateEnrollmentRequest,
): Promise<EnrollmentDTO> {
  const response = await fetch(`${API_URL}/enrollments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Error al registrar la inscripción');
  }

  const result = await response.json();
  return result.data;
}

export async function update(
  id: string,
  data: UpdateEnrollmentRequest,
): Promise<EnrollmentDTO> {
  const response = await fetch(
    `${API_URL}/enrollments/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    },
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      (errorData as { error?: string }).error ||
        'Error al actualizar la inscripción',
    );
  }

  const result = await response.json();
  return result.data;
}

export async function getAll(
  filters?: EnrollmentListFilters,
): Promise<EnrollmentDTO[]> {
  const params = new URLSearchParams();
  if (filters?.memberId) {
    params.set('memberId', filters.memberId);
  }
  if (filters?.sportId) {
    params.set('sportId', filters.sportId);
  }
  if (filters?.isActive !== undefined) {
    params.set('isActive', filters.isActive ? 'true' : 'false');
  }
  const query = params.toString();
  const url = query ? `${API_URL}/enrollments?${query}` : `${API_URL}/enrollments`;

  const response = await fetch(url);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      (errorData as { error?: string }).error ||
        'Error al cargar las inscripciones',
    );
  }

  const result = await response.json();
  return result.data as EnrollmentDTO[];
}

export async function getById(id: string): Promise<EnrollmentDTO> {
  const response = await fetch(
    `${API_URL}/enrollments/${encodeURIComponent(id)}`,
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      (errorData as { error?: string }).error ||
        'Error al obtener la inscripción',
    );
  }

  const result = await response.json();
  return result.data as EnrollmentDTO;
}

export const enrollmentsService = {
  create,
  update,
  getAll,
  getById,
};
