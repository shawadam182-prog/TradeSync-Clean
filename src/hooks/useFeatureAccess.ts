import { useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import type {
  GatedFeature,
  SubscriptionTier,
  SubscriptionStatus,
  UsageLimits,
  SubscriptionInfo,
} from '../../types';
import { FEATURE_TIER_MAP, TIER_LIMITS } from '../../types';

// Tier hierarchy for comparison
const TIER_ORDER: Record<SubscriptionTier, number> = {
  free: 1,
  professional: 2,
  business: 3,
};

export type AccessDeniedReason =
  | 'tier_required'
  | 'trial_expired'
  | 'subscription_expired'
  | 'subscription_cancelled'
  | 'limit_reached'
  | 'past_due';

export interface FeatureAccessResult {
  allowed: boolean;
  reason?: AccessDeniedReason;
  requiredTier?: SubscriptionTier;
  currentTier: SubscriptionTier;
  isTrialing: boolean;
  trialDaysRemaining: number | null;
}

export interface UsageLimitResult {
  allowed: boolean;
  current: number;
  limit: number | null;
  remaining: number | null;
  isUnlimited: boolean;
}

/**
 * Hook to check if the current user has access to a specific feature
 * based on their subscription tier and status.
 */
export function useFeatureAccess(feature: GatedFeature): FeatureAccessResult {
  const { settings } = useData();

  return useMemo(() => {
    const currentTier: SubscriptionTier = settings.subscriptionTier || 'free';
    const status: SubscriptionStatus = settings.subscriptionStatus || 'trialing';
    const trialEnd = settings.trialEnd ? new Date(settings.trialEnd) : null;
    const now = new Date();

    // Calculate trial days remaining
    const trialDaysRemaining = trialEnd
      ? Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : null;

    const isTrialing = status === 'trialing';

    // Base result
    const baseResult = {
      currentTier,
      isTrialing,
      trialDaysRemaining,
    };

    // Check subscription status first
    if (status === 'expired') {
      return {
        ...baseResult,
        allowed: false,
        reason: 'subscription_expired' as AccessDeniedReason,
      };
    }

    if (status === 'cancelled') {
      // Allow access until subscription_end date if set
      const subscriptionEnd = settings.subscriptionEnd ? new Date(settings.subscriptionEnd) : null;
      if (subscriptionEnd && subscriptionEnd < now) {
        return {
          ...baseResult,
          allowed: false,
          reason: 'subscription_cancelled' as AccessDeniedReason,
        };
      }
    }

    if (status === 'past_due') {
      return {
        ...baseResult,
        allowed: false,
        reason: 'past_due' as AccessDeniedReason,
      };
    }

    // Check if trial has expired
    if (isTrialing && trialEnd && trialEnd < now) {
      return {
        ...baseResult,
        allowed: false,
        reason: 'trial_expired' as AccessDeniedReason,
        trialDaysRemaining: 0,
      };
    }

    // Check tier requirement
    const requiredTier = FEATURE_TIER_MAP[feature];
    const hasRequiredTier = TIER_ORDER[currentTier] >= TIER_ORDER[requiredTier];

    if (!hasRequiredTier) {
      return {
        ...baseResult,
        allowed: false,
        reason: 'tier_required' as AccessDeniedReason,
        requiredTier,
      };
    }

    // Feature is accessible
    return {
      ...baseResult,
      allowed: true,
    };
  }, [settings, feature]);
}

/**
 * Hook to get the current user's subscription information
 */
export function useSubscription(): SubscriptionInfo {
  const { settings } = useData();

  return useMemo(() => {
    const tier: SubscriptionTier = settings.subscriptionTier || 'free';
    const status: SubscriptionStatus = settings.subscriptionStatus || 'trialing';
    const trialEnd = settings.trialEnd ? new Date(settings.trialEnd) : null;
    const now = new Date();

    const trialDaysRemaining = trialEnd
      ? Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : null;

    const isActive =
      status === 'active' ||
      (status === 'trialing' && trialEnd !== null && trialEnd > now);

    // Get usage limits from settings or fall back to tier defaults
    const usageLimits: UsageLimits = settings.usageLimits || TIER_LIMITS[tier];

    return {
      tier,
      status,
      trialStart: settings.trialStart || null,
      trialEnd: settings.trialEnd || null,
      subscriptionStart: settings.subscriptionStart || null,
      subscriptionEnd: settings.subscriptionEnd || null,
      isActive,
      trialDaysRemaining,
      usageLimits,
    };
  }, [settings]);
}

/**
 * Hook to check usage against limits for a specific resource.
 * Pass the current count of the resource (e.g., number of customers).
 */
export function useUsageLimit(
  resource: keyof UsageLimits,
  currentCount: number
): UsageLimitResult {
  const { settings } = useData();

  return useMemo(() => {
    const tier: SubscriptionTier = settings.subscriptionTier || 'free';
    const limits = settings.usageLimits || TIER_LIMITS[tier];
    const limit = limits[resource];

    // null means unlimited
    if (limit === null) {
      return {
        allowed: true,
        current: currentCount,
        limit: null,
        remaining: null,
        isUnlimited: true,
      };
    }

    const remaining = Math.max(0, limit - currentCount);
    const allowed = currentCount < limit;

    return {
      allowed,
      current: currentCount,
      limit,
      remaining,
      isUnlimited: false,
    };
  }, [settings, resource, currentCount]);
}

/**
 * Helper to check if user can perform an action that would increase usage.
 * Returns true if adding one more item would still be within limits.
 */
export function useCanAdd(resource: keyof UsageLimits, currentCount: number): boolean {
  const result = useUsageLimit(resource, currentCount);
  return result.isUnlimited || (result.remaining !== null && result.remaining > 0);
}

/**
 * Get tier display name
 */
export function getTierDisplayName(tier: SubscriptionTier): string {
  switch (tier) {
    case 'free':
      return 'Free';
    case 'professional':
      return 'Professional';
    case 'business':
      return 'Business';
    default:
      return tier;
  }
}

/**
 * Get feature display name
 */
export function getFeatureDisplayName(feature: GatedFeature): string {
  const names: Record<GatedFeature, string> = {
    invoices: 'Invoices',
    expenses: 'Expense Tracking',
    schedule: 'Schedule',
    siteDocuments: 'Site Documents',
    materialsLibrary: 'Materials Library',
    bankImport: 'Bank Import',
    vatReports: 'VAT Reports',
    payables: 'Payables',
    filingCabinet: 'Filing Cabinet',
    unlimitedCustomers: 'Unlimited Customers',
    unlimitedJobPacks: 'Unlimited Job Packs',
    unlimitedPhotos: 'Unlimited Photos',
  };
  return names[feature] || feature;
}
