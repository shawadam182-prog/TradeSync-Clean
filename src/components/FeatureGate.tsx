import React from 'react';
import { Lock, AlertTriangle, CreditCard, Clock } from 'lucide-react';
import {
  useFeatureAccess,
  useSubscription,
  getTierDisplayName,
  getFeatureDisplayName,
  AccessDeniedReason,
} from '../hooks/useFeatureAccess';
import type { GatedFeature, SubscriptionTier } from '../../types';

interface FeatureGateProps {
  feature: GatedFeature;
  children: React.ReactNode;
  /** Custom fallback component when access is denied */
  fallback?: React.ReactNode;
  /** If true, hides the feature entirely instead of showing upgrade prompt */
  hideWhenLocked?: boolean;
  /** Custom message to show when locked */
  lockedMessage?: string;
}

/**
 * Wraps a feature and shows an upgrade prompt if the user doesn't have access.
 * Use this to gate premium features based on subscription tier.
 *
 * @example
 * <FeatureGate feature="bankImport">
 *   <BankImportComponent />
 * </FeatureGate>
 */
export function FeatureGate({
  feature,
  children,
  fallback,
  hideWhenLocked = false,
  lockedMessage,
}: FeatureGateProps) {
  const access = useFeatureAccess(feature);

  if (access.allowed) {
    return <>{children}</>;
  }

  if (hideWhenLocked) {
    return null;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <UpgradePrompt
      feature={feature}
      reason={access.reason}
      requiredTier={access.requiredTier}
      currentTier={access.currentTier}
      trialDaysRemaining={access.trialDaysRemaining}
      customMessage={lockedMessage}
    />
  );
}

interface UpgradePromptProps {
  feature: GatedFeature;
  reason?: AccessDeniedReason;
  requiredTier?: SubscriptionTier;
  currentTier: SubscriptionTier;
  trialDaysRemaining: number | null;
  customMessage?: string;
}

function UpgradePrompt({
  feature,
  reason,
  requiredTier,
  currentTier,
  trialDaysRemaining,
  customMessage,
}: UpgradePromptProps) {
  const featureName = getFeatureDisplayName(feature);

  const getIcon = () => {
    switch (reason) {
      case 'trial_expired':
      case 'subscription_expired':
        return <Clock className="w-8 h-8 text-amber-500" />;
      case 'past_due':
        return <CreditCard className="w-8 h-8 text-red-500" />;
      case 'subscription_cancelled':
        return <AlertTriangle className="w-8 h-8 text-amber-500" />;
      default:
        return <Lock className="w-8 h-8 text-slate-400" />;
    }
  };

  const getMessage = () => {
    if (customMessage) return customMessage;

    switch (reason) {
      case 'tier_required':
        return `${featureName} requires ${getTierDisplayName(requiredTier || 'professional')} plan or higher.`;
      case 'trial_expired':
        return 'Your free trial has ended. Upgrade to continue using this feature.';
      case 'subscription_expired':
        return 'Your subscription has expired. Renew to regain access.';
      case 'subscription_cancelled':
        return 'Your subscription has been cancelled. Resubscribe to regain access.';
      case 'past_due':
        return 'Your payment is past due. Please update your payment method.';
      case 'limit_reached':
        return `You've reached your ${featureName.toLowerCase()} limit on the ${getTierDisplayName(currentTier)} plan.`;
      default:
        return `Upgrade to access ${featureName}.`;
    }
  };

  const getActionText = () => {
    switch (reason) {
      case 'past_due':
        return 'Update Payment';
      case 'subscription_cancelled':
        return 'Resubscribe';
      case 'trial_expired':
      case 'subscription_expired':
        return 'Choose a Plan';
      default:
        return 'Upgrade Now';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
      {getIcon()}
      <h3 className="mt-4 text-lg font-semibold text-slate-800">{featureName}</h3>
      <p className="mt-2 text-sm text-slate-600 text-center max-w-sm">{getMessage()}</p>

      {requiredTier && reason === 'tier_required' && (
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
          <span className="px-2 py-1 bg-slate-200 rounded">{getTierDisplayName(currentTier)}</span>
          <span>→</span>
          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded font-medium">
            {getTierDisplayName(requiredTier)}
          </span>
        </div>
      )}

      <button
        onClick={() => {
          // TODO: Navigate to subscription/upgrade page
          console.log('Navigate to upgrade page');
        }}
        className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
      >
        {getActionText()}
      </button>

      {trialDaysRemaining !== null && trialDaysRemaining > 0 && (
        <p className="mt-3 text-xs text-slate-500">
          {trialDaysRemaining} day{trialDaysRemaining !== 1 ? 's' : ''} left in trial
        </p>
      )}
    </div>
  );
}

/**
 * A simpler inline check component that shows a lock icon and upgrade text.
 * Use this for smaller UI elements like buttons or menu items.
 */
interface FeatureLockBadgeProps {
  feature: GatedFeature;
  children: React.ReactNode;
  /** Show the badge inline with children */
  inline?: boolean;
}

export function FeatureLockBadge({ feature, children, inline = false }: FeatureLockBadgeProps) {
  const access = useFeatureAccess(feature);

  if (access.allowed) {
    return <>{children}</>;
  }

  if (inline) {
    return (
      <span className="inline-flex items-center gap-1 opacity-60">
        {children}
        <Lock className="w-3 h-3" />
      </span>
    );
  }

  return (
    <div className="relative">
      <div className="opacity-50 pointer-events-none">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center bg-white/60 rounded">
        <span className="flex items-center gap-1 text-xs text-slate-600 bg-white px-2 py-1 rounded shadow-sm">
          <Lock className="w-3 h-3" />
          {getTierDisplayName(access.requiredTier || 'professional')}
        </span>
      </div>
    </div>
  );
}

/**
 * Trial banner component to show at the top of the app when user is in trial.
 */
export function TrialBanner() {
  const subscription = useSubscription();

  if (!subscription.isActive || subscription.status !== 'trialing') {
    return null;
  }

  const daysLeft = subscription.trialDaysRemaining;
  if (daysLeft === null || daysLeft > 7) {
    return null; // Only show when 7 days or less remaining
  }

  const urgencyClass = daysLeft <= 3 ? 'bg-amber-500' : 'bg-blue-500';

  return (
    <div className={`${urgencyClass} text-white text-sm py-2 px-4 text-center`}>
      <span className="font-medium">
        {daysLeft === 0
          ? 'Your trial ends today!'
          : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left in your free trial`}
      </span>
      <button
        onClick={() => {
          // TODO: Navigate to upgrade page
          console.log('Navigate to upgrade page');
        }}
        className="ml-3 underline hover:no-underline"
      >
        Upgrade now
      </button>
    </div>
  );
}

/**
 * Hook wrapper that returns a function to check feature access imperatively.
 * Useful when you need to check access in event handlers.
 */
export function useFeatureCheck() {
  const subscription = useSubscription();

  return (feature: GatedFeature): boolean => {
    const { FEATURE_TIER_MAP } = require('../../types');
    const TIER_ORDER: Record<SubscriptionTier, number> = {
      free: 1,
      professional: 2,
      business: 3,
    };

    if (!subscription.isActive) return false;

    const requiredTier = FEATURE_TIER_MAP[feature];
    return TIER_ORDER[subscription.tier] >= TIER_ORDER[requiredTier];
  };
}
