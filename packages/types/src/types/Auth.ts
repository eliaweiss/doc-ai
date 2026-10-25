/**
 * Domain types for Authentication - Drizzle-independent
 * User accounts and authentication-related types
 */

export interface User {
  id: string;
  name: string | null;
  email: string;
  emailVerified: Date | null;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
  otpValue: string | null;
  otpExpiresAt: Date | null;
  isAdmin: boolean;
  roles: string[];
  optInEmail: boolean;
  cognitoSub: string | null;
}

// Deprecated: These types are no longer used after Cognito migration
// @deprecated Use Cognito for authentication instead
export interface NewUser {
  name?: string;
  email: string;
  password: string;
  confirmPassword: string;
}

// @deprecated Use Cognito for authentication instead
export interface LoginUser {
  email: string;
  password: string;
}
