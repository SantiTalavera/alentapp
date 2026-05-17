import type { CreateEnrollmentRequest, EnrollmentDTO } from '@alentapp/shared';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api/v1';

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

export const enrollmentsService = { create };
