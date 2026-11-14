import Boom from '@hapi/boom';
import { randomInt } from 'node:crypto';
import { Role } from '../../shared/types';
import {
  createProfileRepository,
  findProfileByIdRepository,
  findProfileRoleRepository,
  usernameExistsRepository,
} from './profile.repository';
import { Profile } from './profile.types';

const MAX_USERNAME_ATTEMPTS = 5;

// "Lina.Sanchez+test@after.app" -> "lina.sanchez"; a numeric suffix is added on collisions
const toBaseUsername = (email: string): string => {
  const local = email.split('@')[0].split('+')[0].toLowerCase();
  const cleaned = local.replace(/[^a-z0-9._-]/g, '');

  return cleaned || 'user';
};

const generateUsername = async (email: string): Promise<string> => {
  const base = toBaseUsername(email);

  for (let attempt = 0; attempt < MAX_USERNAME_ATTEMPTS; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}${randomInt(1000, 10000)}`;

    if (!(await usernameExistsRepository(candidate))) {
      return candidate;
    }
  }

  throw Boom.conflict('Could not generate a unique username');
};

export const createProfileService = async (input: {
  id: string;
  email: string;
  fullName: string;
  role: Role;
}): Promise<Profile> => {
  const username = await generateUsername(input.email);

  return createProfileRepository({ ...input, username });
};

export const getProfileByIdService = async (id: string): Promise<Profile> => {
  const profile = await findProfileByIdRepository(id);

  if (!profile) {
    throw Boom.notFound('Profile not found');
  }

  return profile;
};

// Users without a profile row (created outside our API) are treated as clients
export const getProfileRoleService = async (id: string): Promise<Role> =>
  (await findProfileRoleRepository(id)) ?? 'client';
