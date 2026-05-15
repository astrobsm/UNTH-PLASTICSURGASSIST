/**
 * ApprovalButton
 * --------------
 * Reusable supervisory-approval button with built-in geo + time stamping.
 *
 * Captures GPS via geolocationService, writes a clinical audit row via
 * clinicalAuditService.logClinicalAction, and (optionally) calls back into
 * the parent so the host module can persist its own approved_by / approved_at.
 *
 * Role-gated: renders nothing if the current user does not hold one of the
 * `requiredRoles`. Single click → confirm → capture geo → log → onApproved.
 */

import { useState } from 'react';
import { CheckCircle2, Loader2, ShieldCheck, MapPin, AlertTriangle } from 'lucide-react';
import { logClinicalAction, type ClinicalAction } from '../services/clinicalAuditService';
import { captureLocation, type GeoLocationResult } from '../services/geolocationService';
import { useAuthStore } from '../store/authStore';

type Role =
  | 'admin'
  | 'consultant'
  | 'senior_registrar'
  | 'junior_registrar'
  | 'house_officer';

export interface ApprovalButtonProps {
  /** Roles permitted to approve this action. */
  requiredRoles: Role[];
  /** Audit action vocabulary entry. */
  action: ClinicalAction | string;
  /** What is being approved (e.g. 'treatment_plan', 'prescription'). */
  resourceType: string;
  /** ID of the resource being approved. */
  resourceId: string | number;
  /** Human-readable identifier (patient name + hosp number). */
  resourceIdentifier?: string;
  /** Extra context to record. */
  details?: Record<string, unknown>;
  /** Button label. Defaults to "Approve". */
  label?: string;
  /** Callback fired AFTER the audit row is written. Receives the captured geo. */
  onApproved?: (geo: GeoLocationResult | null) => void | Promise<void>;
  /** If true, shows a confirm dialog before approving. Default true. */
  confirm?: boolean;
  /** If true, hides the button entirely when role is not permitted. Default true. */
  hideWhenUnauthorised?: boolean;
  /** Visual size. */
  size?: 'sm' | 'md' | 'lg';
  /** Optional disabled override. */
  disabled?: boolean;
  /** Already approved? Renders a passive badge instead of a button. */
  alreadyApproved?: boolean;
  /** Name of the prior approver, shown when alreadyApproved. */
  approvedBy?: string;
  /** ISO timestamp of the prior approval. */
  approvedAt?: string;
}

export function ApprovalButton({
  requiredRoles,
  action,
  resourceType,
  resourceId,
  resourceIdentifier,
  details,
  label = 'Approve',
  onApproved,
  confirm = true,
  hideWhenUnauthorised = true,
  size = 'md',
  disabled = false,
  alreadyApproved = false,
  approvedBy,
  approvedAt,
}: ApprovalButtonProps) {
  const user = useAuthStore((s) => s.user);
  const [busy, setBusy] = useState(false);
  const [lastGeo, setLastGeo] = useState<GeoLocationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const userRole = (user?.role as Role | undefined) || undefined;
  const authorised = !!userRole && requiredRoles.includes(userRole);

  // Already-approved badge
  if (alreadyApproved) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
        <ShieldCheck className="w-3.5 h-3.5" />
        Approved{approvedBy ? ` by ${approvedBy}` : ''}
        {approvedAt ? ` · ${new Date(approvedAt).toLocaleString()}` : ''}
      </span>
    );
  }

  if (!authorised) {
    if (hideWhenUnauthorised) return null;
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-100 border border-gray-200 text-gray-500 text-xs">
        <ShieldCheck className="w-3.5 h-3.5" />
        Approval requires: {requiredRoles.map(formatRole).join(' / ')}
      </span>
    );
  }

  const sizeCls =
    size === 'sm'
      ? 'px-2.5 py-1 text-xs'
      : size === 'lg'
      ? 'px-4 py-2.5 text-base'
      : 'px-3 py-1.5 text-sm';

  const handleClick = async () => {
    if (busy || disabled) return;
    if (confirm) {
      const ok = window.confirm(
        `Confirm approval as ${formatRole(userRole!)}?\n\n` +
          `Action: ${prettyAction(action)}\n` +
          (resourceIdentifier ? `Patient/Item: ${resourceIdentifier}\n` : '') +
          `\nYour identity, GPS location and the exact time will be recorded ` +
          `as a permanent clinical audit entry.`,
      );
      if (!ok) return;
    }

    setBusy(true);
    setError(null);
    let geo: GeoLocationResult | null = null;
    try {
      try {
        geo = await captureLocation({ skipReverseGeocode: false });
        setLastGeo(geo);
      } catch (geoErr) {
        // Geo failure is non-fatal — audit row still written
        console.warn('Geo capture failed during approval:', geoErr);
      }

      await logClinicalAction({
        action,
        resourceType,
        resourceId,
        resourceIdentifier,
        details: { ...(details || {}), approver_role: userRole },
        geo,
      });

      if (onApproved) await onApproved(geo);
    } catch (e: any) {
      console.error('Approval failed:', e);
      setError(e?.message || 'Approval failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy || disabled}
        className={`inline-flex items-center gap-1.5 rounded-md font-medium transition
          ${sizeCls}
          ${
            busy || disabled
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
          }`}
        title={`Approve as ${formatRole(userRole!)} — geo + time will be recorded`}
      >
        {busy ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Recording…
          </>
        ) : (
          <>
            <CheckCircle2 className="w-4 h-4" />
            {label}
          </>
        )}
      </button>

      {lastGeo && (
        <span className="inline-flex items-center gap-1 text-[11px] text-gray-600">
          <MapPin className="w-3 h-3" />
          {lastGeo.geofenceName || `${lastGeo.latitude.toFixed(5)}, ${lastGeo.longitude.toFixed(5)}`}
          {lastGeo.isInsideGeofence === false && (
            <span className="text-amber-600 inline-flex items-center gap-0.5">
              <AlertTriangle className="w-3 h-3" />
              outside hospital
            </span>
          )}
        </span>
      )}

      {error && <span className="text-[11px] text-red-600">{error}</span>}
    </div>
  );
}

function formatRole(r: Role | string) {
  return r
    .replace('_', ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function prettyAction(a: string) {
  return a.replace(/_/g, ' ').toLowerCase();
}

export default ApprovalButton;
