// Local auth types - migrated from removed shared workspace

export type UserRole = 'super_user' | 'admin' | 'manager' | 'user';

export interface Organization {
  id: number;
  name: string;
  slug: string;
  type: 'servicer' | 'investor' | 'law_firm' | 'asset_manager' | 'other';
  email_domain?: string;
  description?: string;
  website?: string;
  phone?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: number;
  email: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  organizationId?: number;
  organization?: Organization;
  created_at: string;
  updated_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role?: UserRole;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  token?: string;
  message?: string;
  error?: string;
}

export interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, role?: UserRole) => Promise<boolean>;
  logout: () => void;
  loading: boolean;
}