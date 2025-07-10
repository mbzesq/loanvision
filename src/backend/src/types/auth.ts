 // Authentication types (migrated from shared)
export type UserRole = 'super_user' | 'admin' | 'manager' | 'user';
export interface User {
    id: number;
    email: string;
    firstName?: string;
    lastName?: string;
    role: UserRole;
    createdAt: Date;
    updatedAt: Date;
  }

export interface AuthResponse {
    token: string;
    user: User;
  }

 export interface RegisterRequest {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }

 export interface LoginRequest {
    email: string;
    password: string;
  }

  export interface JWTPayload {
    id: number;
    email: string;
    role: UserRole;
    tokenId?: string; // For session tracking
  }
