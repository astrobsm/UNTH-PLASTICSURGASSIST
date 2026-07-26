import { apiClient } from './apiClient';

/**
 * Staff role registry (client side).
 *
 * The role LIST is data, not code: an admin can add a role the unit employs,
 * relabel one, or retire it. Each role maps to at most one ROSTERING GRADE
 * (`rosters_as`), which is what keeps call duty and patient assignment working —
 * a new "Medical Officer" that rosters as a registrar joins the registrar pool
 * automatically.
 */

/** The four fixed rostering grades. Roles map onto these; these never change. */
export const GRADES = ['consultant', 'senior_registrar', 'registrar', 'house_officer'] as const;
export type Grade = typeof GRADES[number];

export const GRADE_LABELS: Record<Grade, string> = {
  consultant: 'Consultant',
  senior_registrar: 'Senior Registrar',
  registrar: 'Registrar',
  house_officer: 'House Officer',
};

export interface StaffRole {
  id: number;
  role_key: string;
  label: string;
  rosters_as: Grade | null;
  is_builtin: boolean;
  is_active: boolean;
  sort_order: number;
  description?: string | null;
  user_count: number;
  active_user_count: number;
}

/** Used when the registry can't be reached, so role pickers are never empty. */
const FALLBACK_ROLES: StaffRole[] = [
  { id: -1, role_key: 'house_officer', label: 'House Officer', rosters_as: 'house_officer', is_builtin: true, is_active: true, sort_order: 40, user_count: 0, active_user_count: 0 },
  { id: -2, role_key: 'junior_registrar', label: 'Registrar', rosters_as: 'registrar', is_builtin: true, is_active: true, sort_order: 30, user_count: 0, active_user_count: 0 },
  { id: -3, role_key: 'senior_registrar', label: 'Senior Registrar', rosters_as: 'senior_registrar', is_builtin: true, is_active: true, sort_order: 20, user_count: 0, active_user_count: 0 },
  { id: -4, role_key: 'consultant', label: 'Consultant', rosters_as: 'consultant', is_builtin: true, is_active: true, sort_order: 10, user_count: 0, active_user_count: 0 },
  { id: -5, role_key: 'admin', label: 'Administrator', rosters_as: null, is_builtin: true, is_active: true, sort_order: 50, user_count: 0, active_user_count: 0 },
];

class RolesService {
  private cache: StaffRole[] | null = null;
  private cacheAt = 0;
  private static TTL = 60_000;

  /** All roles, newest state from the server (short-lived memo). */
  async list(force = false): Promise<StaffRole[]> {
    if (!force && this.cache && Date.now() - this.cacheAt < RolesService.TTL) return this.cache;
    try {
      const data: any = await apiClient.get('/roles', { freshRead: true } as any);
      const roles = (data?.roles || []) as StaffRole[];
      if (roles.length) {
        this.cache = roles;
        this.cacheAt = Date.now();
        return roles;
      }
      return this.cache || FALLBACK_ROLES;
    } catch (err) {
      console.warn('rolesService.list failed, using fallback role list:', err);
      return this.cache || FALLBACK_ROLES;
    }
  }

  /** Roles an admin can put a person into (active only). */
  async assignable(): Promise<StaffRole[]> {
    return (await this.list()).filter(r => r.is_active);
  }

  /** Display label for a role key, falling back to a readable form of the key. */
  labelFor(roleKey: string, roles: StaffRole[]): string {
    const found = roles.find(r => r.role_key === roleKey);
    if (found) return found.label;
    return (roleKey || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  async create(input: { key: string; label: string; rosters_as?: Grade | null; description?: string }): Promise<StaffRole[]> {
    const data: any = await apiClient.post('/roles', input);
    this.bust(data);
    return (data?.roles || []) as StaffRole[];
  }

  async update(input: {
    key: string; label?: string; rosters_as?: Grade | null;
    is_active?: boolean; sort_order?: number; description?: string;
  }): Promise<StaffRole[]> {
    const data: any = await apiClient.put('/roles', input);
    this.bust(data);
    return (data?.roles || []) as StaffRole[];
  }

  /** Delete a custom role. `reassignTo` moves any holders to that role first. */
  async remove(roleKey: string, reassignTo?: string): Promise<StaffRole[]> {
    const qs = new URLSearchParams({ key: roleKey });
    if (reassignTo) qs.set('reassign_to', reassignTo);
    const data: any = await apiClient.delete(`/roles?${qs.toString()}`);
    this.bust(data);
    return (data?.roles || []) as StaffRole[];
  }

  private bust(data: any) {
    this.cache = (data?.roles as StaffRole[]) || null;
    this.cacheAt = this.cache ? Date.now() : 0;
  }
}

export const rolesService = new RolesService();
