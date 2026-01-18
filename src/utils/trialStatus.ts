import type { AppSettings, SubscriptionStatus } from '../../types';

export interface TrialStatus {
  isTrialing: boolean;
  isExpired: boolean;
  daysRemaining: number | null;
  trialEnd: Date | null;
  status: SubscriptionStatus;
}

export type TrialUrgency = 'none' | 'info' | 'warning' | 'urgent' | 'expired';

/**
 * Calculate trial status from app settings
 */
export function getTrialStatus(settings: Pick<AppSettings, 'subscriptionStatus' | 'trialEnd'>): TrialStatus {
  const status = settings.subscriptionStatus || 'trialing';
  const trialEnd = settings.trialEnd ? new Date(settings.trialEnd) : null;
  const now = new Date();

  const isTrialing = status === 'trialing';

  // Check if trial is expired (either explicitly expired or trialing past trial_end)
  const isExpired =
    status === 'expired' ||
    (isTrialing && trialEnd !== null && trialEnd < now);

  // Calculate days remaining
  let daysRemaining: number | null = null;
  if (trialEnd && !isExpired) {
    const msRemaining = trialEnd.getTime() - now.getTime();
    daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
  } else if (isExpired) {
    daysRemaining = 0;
  }

  return {
    isTrialing,
    isExpired,
    daysRemaining,
    trialEnd,
    status,
  };
}

/**
 * Determine urgency level based on trial status
 * - none: Not trialing or more than 7 days remaining
 * - info: 4-7 days remaining (blue)
 * - warning: 1-3 days remaining (amber)
 * - urgent: Less than 24 hours / final day (red)
 * - expired: Trial has ended (red)
 */
export function getTrialUrgency(trialStatus: TrialStatus): TrialUrgency {
  if (!trialStatus.isTrialing && !trialStatus.isExpired) {
    return 'none';
  }

  if (trialStatus.isExpired) {
    return 'expired';
  }

  const days = trialStatus.daysRemaining;

  if (days === null || days > 7) {
    return 'none';
  }

  if (days === 0) {
    return 'urgent';
  }

  if (days <= 3) {
    return 'warning';
  }

  return 'info';
}

/**
 * Get a human-readable trial message
 */
export function formatTrialMessage(trialStatus: TrialStatus): string {
  if (trialStatus.isExpired) {
    return 'Your free trial has ended. Choose a plan to continue using all features.';
  }

  if (!trialStatus.isTrialing) {
    return '';
  }

  const days = trialStatus.daysRemaining;

  if (days === null) {
    return 'You are on a free trial.';
  }

  if (days === 0) {
    return 'Your trial ends today!';
  }

  if (days === 1) {
    return 'Your trial ends tomorrow!';
  }

  return `${days} days left in your free trial`;
}

/**
 * Get urgency-based CSS class for styling
 */
export function getUrgencyColorClass(urgency: TrialUrgency): string {
  switch (urgency) {
    case 'expired':
    case 'urgent':
      return 'bg-red-500';
    case 'warning':
      return 'bg-amber-500';
    case 'info':
      return 'bg-blue-500';
    case 'none':
    default:
      return '';
  }
}

/**
 * Get urgency-based text color class
 */
export function getUrgencyTextClass(urgency: TrialUrgency): string {
  switch (urgency) {
    case 'expired':
    case 'urgent':
      return 'text-red-600';
    case 'warning':
      return 'text-amber-600';
    case 'info':
      return 'text-blue-600';
    case 'none':
    default:
      return 'text-slate-600';
  }
}
