export type Role = 'client' | 'admin';

// The authenticated caller, attached to req.user by authMiddleware
export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}
