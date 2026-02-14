import type { User } from '@supabase/supabase-js';

export type UserRole = 'admin' | 'client' | null;

export function normalizeRole(value: unknown): UserRole {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === 'admin' || normalized === 'administrator') {
    return 'admin';
  }

  if (normalized === 'client' || normalized === 'cliente') {
    return 'client';
  }

  return null;
}

export function resolveRoleFromMetadata(user: User | null): UserRole {
  if (!user) {
    return null;
  }

  const userMetadataRole = normalizeRole(user.user_metadata?.role);
  if (userMetadataRole) {
    return userMetadataRole;
  }

  return normalizeRole(user.app_metadata?.role);
}

export function toClientSlug(clientName: string): string {
  return clientName
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
