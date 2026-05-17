// ==========================================
// Member
// ==========================================
export type MemberCategory = 'Pleno' | 'Cadete' | 'Honorario';
export type MemberStatus = 'Activo' | 'Moroso' | 'Suspendido';

export interface MemberDTO {
  id: string; // UUID
  dni: string;
  name: string;
  email: string;
  birthdate: string; // ISO Date String (YYYY-MM-DD)
  category: MemberCategory;
  status: MemberStatus;
  created_at: string; // ISO Date String
}

export interface CreateMemberRequest {
  dni: string;
  name: string;
  email: string;
  birthdate: string; // ISO Date String (YYYY-MM-DD)
  category: MemberCategory;
}

export interface UpdateMemberRequest {
  dni?: string;
  name?: string;
  email?: string;
  birthdate?: string; // ISO Date String (YYYY-MM-DD)
  category?: MemberCategory;
  status?: MemberStatus;
}

export type DisciplineDTO = {
  id: string;
  member_id: string;
  reason: string;
  start_date: string;
  end_date: string;
  is_total_suspension: boolean;
  previous_member_status: Exclude<MemberStatus, 'Suspendido'> | null;
};

export type CreateDisciplineRequest = {
  member_id: string;
  reason: string;
  start_date: string;
  end_date: string;
  is_total_suspension: boolean;
};

export type UpdateDisciplineRequest = {
  reason?: string;
  start_date?: string;
  end_date?: string;
  is_total_suspension?: boolean;
};

// ==========================================
// Sport
// ==========================================
export interface SportDTO {
  id: string;
  name: string;
  description: string;
  max_capacity: number;
  additional_price: number;
  requires_medical_certificate: boolean;
  deleted_at: string | null;
}

export interface CreateSportRequest {
  name: string;
  description: string;
  max_capacity: number;
  additional_price: number;
  requires_medical_certificate: boolean;
}

export interface UpdateSportRequest {
  description?: string;
  max_capacity?: number;
  additional_price?: number;
  requires_medical_certificate?: boolean;
}

// ==========================================
// MedicalCertificate
// ==========================================
export interface MedicalCertificateDTO {
  id: string; // UUID
  issue_date: string; // ISO Date String
  expiry_date: string; // ISO Date String
  doctor_license: string;
  is_validated: boolean;
  member_id: string; // UUID
}

export interface CreateMedicalCertificateRequest {
  member_id: string; // UUID
  issue_date: string; // ISO Date String
  expiry_date: string; // ISO Date String
  doctor_license: string;
}

export interface UpdateMedicalCertificateRequest {
  member_id?: never;
  issue_date?: string; // ISO Date String
  expiry_date?: string; // ISO Date String
  doctor_license?: string;
}

// ==========================================
// Payment
// ==========================================
export interface PaymentDTO {
  id: string; // UUID
  member_id: string; // UUID
  amount: number;
  month: number;
  year: number;
  due_date: string; // ISO Date String
  status: 'Pending' | 'Paid' | 'Canceled';
  payment_date: string | null; // ISO Date String
}

export interface CreatePaymentRequest {
  member_id: string; // UUID
  amount: number;
  month: number;
  year: number;
  due_date: string; // ISO Date String
}

export interface UpdatePaymentRequest {
  member_id?: never;
  payment_date?: never;
  amount?: number;
  due_date?: string; // ISO Date String
  status?: 'Paid' | 'Canceled';
}

// ==========================================
// Enrollment
// ==========================================
export interface EnrollmentDTO {
  id: string;
  member_id: string;
  sport_id: string;
  enrollment_date: string;
  is_active: boolean;
  deleted_at: string | null;
}

export interface CreateEnrollmentRequest {
  member_id: string;
  sport_id: string;
}

export interface UpdateEnrollmentRequest {
  is_active?: boolean;
}
