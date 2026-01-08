export interface PasswordResetRequest {
  id: string;
  userId: string;
  email?: string;
  phoneNumber?: string;
  code: string;
  createdAt: Date;
  expiresAt: Date;
  verified: boolean;
  usedAt?: Date;
}

export interface ResetCodeData {
  emailOrPhone: string;
  code: string;
  createdAt: number;
  expiresAt: number;
}
