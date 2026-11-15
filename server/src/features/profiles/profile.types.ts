import { Role } from '../../shared/types';

export interface Profile {
  id: string;
  fullName: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  role: Role;
  createdAt: string;
}

export interface CreateProfileDTO {
  id: string;
  fullName: string;
  username: string;
  email: string;
  role: Role;
}
