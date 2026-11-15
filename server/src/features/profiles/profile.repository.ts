import { pool } from '../../db/db';
import { Role } from '../../shared/types';
import { CreateProfileDTO, Profile } from './profile.types';

const PROFILE_COLUMNS = `
  id, full_name AS "fullName", username, email, avatar_url AS "avatarUrl", role,
  created_at AS "createdAt"`;

export const createProfileRepository = async (profile: CreateProfileDTO): Promise<Profile> => {
  const result = await pool.query<Profile>(
    `INSERT INTO public.profiles (id, full_name, username, email, role)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${PROFILE_COLUMNS}`,
    [profile.id, profile.fullName, profile.username, profile.email, profile.role],
  );

  return result.rows[0];
};

export const findProfileByIdRepository = async (id: string): Promise<Profile | undefined> => {
  const result = await pool.query<Profile>(
    `SELECT ${PROFILE_COLUMNS} FROM public.profiles WHERE id = $1`,
    [id],
  );

  return result.rows[0];
};

export const findProfileRoleRepository = async (id: string): Promise<Role | undefined> => {
  const result = await pool.query<{ role: Role }>(
    'SELECT role FROM public.profiles WHERE id = $1',
    [id],
  );

  return result.rows[0]?.role;
};

export const usernameExistsRepository = async (username: string): Promise<boolean> => {
  const result = await pool.query('SELECT 1 FROM public.profiles WHERE username = $1', [username]);

  return (result.rowCount ?? 0) > 0;
};
