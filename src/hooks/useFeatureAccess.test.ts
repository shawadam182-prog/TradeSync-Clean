import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  useFeatureAccess,
  useSubscription,
  useUsageLimit,
  useCanAdd,
  getTierDisplayName,
  getFeatureDisplayName,
} from './useFeatureAccess';
import type { AppSettings, SubscriptionTier, SubscriptionStatus } from '../../types';
import { createMockSettings, createMockSettingsForTier } from '../test/factories';

// Mock the DataContext
const mockSettings: { current: AppSettings } = {
  current: createMockSettings(),
};

vi.mock('../contexts/DataContext', () => ({
  useData: () => ({
    settings: mockSettings.current,
  }),
}));

// Helper to set mock settings for a test
// Uses createMockSettingsForTier when tier is specified to get correct usage limits
function setMockSettings(settings: Partial<AppSettings>) {
  const tier = settings.subscriptionTier || 'free';
  // Start with tier-specific defaults, then apply overrides
  mockSettings.current = createMockSettingsForTier(tier, settings);
}

// Helper to create date strings relative to now
function daysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function daysAgo(days: number): string {
  return daysFromNow(-days);
}

describe('useFeatureAccess', () => {
  beforeEach(() => {
    mockSettings.current = createMockSettings();
  });

  // ============================================
  // TIER-BASED ACCESS
  // ============================================

  describe('tier-based access', () => {
    describe('free tier', () => {
      beforeEach(() => {
        setMockSettings({
          subscriptionTier: 'free',
          subscriptionStatus: 'active',
        });
      });

      it('can access invoices', () => {
        const { result } = renderHook(() => useFeatureAccess('invoices'));
        expect(result.current.allowed).toBe(true);
        expect(result.current.currentTier).toBe('free');
      });

      it('can access schedule', () => {
        const { result } = renderHook(() => useFeatureAccess('schedule'));
        expect(result.current.allowed).toBe(true);
      });

      it('CANNOT access expenses', () => {
        const { result } = renderHook(() => useFeatureAccess('expenses'));
        expect(result.current.allowed).toBe(false);
        expect(result.current.reason).toBe('tier_required');
        expect(result.current.requiredTier).toBe('professional');
      });

      it('CANNOT access bankImport', () => {
        const { result } = renderHook(() => useFeatureAccess('bankImport'));
        expect(result.current.allowed).toBe(false);
        expect(result.current.reason).toBe('tier_required');
        expect(result.current.requiredTier).toBe('business');
      });

      it('CANNOT access vatReports', () => {
        const { result } = renderHook(() => useFeatureAccess('vatReports'));
        expect(result.current.allowed).toBe(false);
        expect(result.current.reason).toBe('tier_required');
        expect(result.current.requiredTier).toBe('business');
      });

      it('CANNOT access materialsLibrary', () => {
        const { result } = renderHook(() => useFeatureAccess('materialsLibrary'));
        expect(result.current.allowed).toBe(false);
        expect(result.current.reason).toBe('tier_required');
        expect(result.current.requiredTier).toBe('professional');
      });

      it('CANNOT access filingCabinet', () => {
        const { result } = renderHook(() => useFeatureAccess('filingCabinet'));
        expect(result.current.allowed).toBe(false);
        expect(result.current.reason).toBe('tier_required');
        expect(result.current.requiredTier).toBe('business');
      });
    });

    describe('professional tier', () => {
      beforeEach(() => {
        setMockSettings({
          subscriptionTier: 'professional',
          subscriptionStatus: 'active',
        });
      });

      it('can access invoices (from free tier)', () => {
        const { result } = renderHook(() => useFeatureAccess('invoices'));
        expect(result.current.allowed).toBe(true);
      });

      it('can access schedule (from free tier)', () => {
        const { result } = renderHook(() => useFeatureAccess('schedule'));
        expect(result.current.allowed).toBe(true);
      });

      it('can access expenses', () => {
        const { result } = renderHook(() => useFeatureAccess('expenses'));
        expect(result.current.allowed).toBe(true);
        expect(result.current.currentTier).toBe('professional');
      });

      it('can access materialsLibrary', () => {
        const { result } = renderHook(() => useFeatureAccess('materialsLibrary'));
        expect(result.current.allowed).toBe(true);
      });

      it('can access siteDocuments', () => {
        const { result } = renderHook(() => useFeatureAccess('siteDocuments'));
        expect(result.current.allowed).toBe(true);
      });

      it('CANNOT access bankImport', () => {
        const { result } = renderHook(() => useFeatureAccess('bankImport'));
        expect(result.current.allowed).toBe(false);
        expect(result.current.reason).toBe('tier_required');
        expect(result.current.requiredTier).toBe('business');
      });

      it('CANNOT access vatReports', () => {
        const { result } = renderHook(() => useFeatureAccess('vatReports'));
        expect(result.current.allowed).toBe(false);
        expect(result.current.reason).toBe('tier_required');
        expect(result.current.requiredTier).toBe('business');
      });

      it('CANNOT access payables', () => {
        const { result } = renderHook(() => useFeatureAccess('payables'));
        expect(result.current.allowed).toBe(false);
        expect(result.current.reason).toBe('tier_required');
        expect(result.current.requiredTier).toBe('business');
      });

      it('CANNOT access filingCabinet', () => {
        const { result } = renderHook(() => useFeatureAccess('filingCabinet'));
        expect(result.current.allowed).toBe(false);
        expect(result.current.reason).toBe('tier_required');
        expect(result.current.requiredTier).toBe('business');
      });
    });

    describe('business tier', () => {
      beforeEach(() => {
        setMockSettings({
          subscriptionTier: 'business',
          subscriptionStatus: 'active',
        });
      });

      it('can access invoices', () => {
        const { result } = renderHook(() => useFeatureAccess('invoices'));
        expect(result.current.allowed).toBe(true);
      });

      it('can access schedule', () => {
        const { result } = renderHook(() => useFeatureAccess('schedule'));
        expect(result.current.allowed).toBe(true);
      });

      it('can access expenses', () => {
        const { result } = renderHook(() => useFeatureAccess('expenses'));
        expect(result.current.allowed).toBe(true);
      });

      it('can access materialsLibrary', () => {
        const { result } = renderHook(() => useFeatureAccess('materialsLibrary'));
        expect(result.current.allowed).toBe(true);
      });

      it('can access bankImport', () => {
        const { result } = renderHook(() => useFeatureAccess('bankImport'));
        expect(result.current.allowed).toBe(true);
        expect(result.current.currentTier).toBe('business');
      });

      it('can access vatReports', () => {
        const { result } = renderHook(() => useFeatureAccess('vatReports'));
        expect(result.current.allowed).toBe(true);
      });

      it('can access payables', () => {
        const { result } = renderHook(() => useFeatureAccess('payables'));
        expect(result.current.allowed).toBe(true);
      });

      it('can access filingCabinet', () => {
        const { result } = renderHook(() => useFeatureAccess('filingCabinet'));
        expect(result.current.allowed).toBe(true);
      });

      it('can access siteDocuments', () => {
        const { result } = renderHook(() => useFeatureAccess('siteDocuments'));
        expect(result.current.allowed).toBe(true);
      });
    });
  });

  // ============================================
  // STATUS-BASED RESTRICTIONS
  // ============================================

  describe('status-based restrictions', () => {
    describe('trialing status', () => {
      it('allows access with valid trialEnd', () => {
        setMockSettings({
          subscriptionTier: 'professional',
          subscriptionStatus: 'trialing',
          trialEnd: daysFromNow(7), // Trial ends in 7 days
        });

        const { result } = renderHook(() => useFeatureAccess('expenses'));

        expect(result.current.allowed).toBe(true);
        expect(result.current.isTrialing).toBe(true);
        expect(result.current.trialDaysRemaining).toBe(7);
      });

      it('blocks access with expired trialEnd and returns trial_expired reason', () => {
        setMockSettings({
          subscriptionTier: 'professional',
          subscriptionStatus: 'trialing',
          trialEnd: daysAgo(1), // Trial ended yesterday
        });

        const { result } = renderHook(() => useFeatureAccess('expenses'));

        expect(result.current.allowed).toBe(false);
        expect(result.current.reason).toBe('trial_expired');
        expect(result.current.isTrialing).toBe(true);
        expect(result.current.trialDaysRemaining).toBe(0);
      });

      it('blocks access when trial expired even for free tier features', () => {
        setMockSettings({
          subscriptionTier: 'professional',
          subscriptionStatus: 'trialing',
          trialEnd: daysAgo(5), // Trial ended 5 days ago
        });

        const { result } = renderHook(() => useFeatureAccess('invoices'));

        expect(result.current.allowed).toBe(false);
        expect(result.current.reason).toBe('trial_expired');
      });
    });

    describe('active status', () => {
      it('allows access with active status', () => {
        setMockSettings({
          subscriptionTier: 'professional',
          subscriptionStatus: 'active',
          subscriptionPeriodEnd: daysFromNow(30),
        });

        const { result } = renderHook(() => useFeatureAccess('expenses'));

        expect(result.current.allowed).toBe(true);
        expect(result.current.isTrialing).toBe(false);
      });

      it('allows access when subscriptionPeriodEnd is in the future', () => {
        setMockSettings({
          subscriptionTier: 'business',
          subscriptionStatus: 'active',
          subscriptionPeriodEnd: daysFromNow(15),
        });

        const { result } = renderHook(() => useFeatureAccess('bankImport'));

        expect(result.current.allowed).toBe(true);
      });

      it('blocks access when active but subscriptionPeriodEnd has passed', () => {
        setMockSettings({
          subscriptionTier: 'business',
          subscriptionStatus: 'active',
          subscriptionPeriodEnd: daysAgo(1),
        });

        const { result } = renderHook(() => useFeatureAccess('bankImport'));

        expect(result.current.allowed).toBe(false);
        expect(result.current.reason).toBe('subscription_expired');
      });
    });

    describe('past_due status', () => {
      it('blocks access with past_due reason', () => {
        setMockSettings({
          subscriptionTier: 'professional',
          subscriptionStatus: 'past_due',
        });

        const { result } = renderHook(() => useFeatureAccess('expenses'));

        expect(result.current.allowed).toBe(false);
        expect(result.current.reason).toBe('past_due');
      });

      it('blocks even free tier features when past_due', () => {
        setMockSettings({
          subscriptionTier: 'professional',
          subscriptionStatus: 'past_due',
        });

        const { result } = renderHook(() => useFeatureAccess('invoices'));

        expect(result.current.allowed).toBe(false);
        expect(result.current.reason).toBe('past_due');
      });
    });

    describe('cancelled status', () => {
      it('allows access until subscriptionPeriodEnd passes', () => {
        setMockSettings({
          subscriptionTier: 'professional',
          subscriptionStatus: 'cancelled',
          subscriptionPeriodEnd: daysFromNow(10), // Still have 10 days
        });

        const { result } = renderHook(() => useFeatureAccess('expenses'));

        expect(result.current.allowed).toBe(true);
      });

      it('blocks access after subscriptionPeriodEnd passes', () => {
        setMockSettings({
          subscriptionTier: 'professional',
          subscriptionStatus: 'cancelled',
          subscriptionPeriodEnd: daysAgo(1), // Ended yesterday
        });

        const { result } = renderHook(() => useFeatureAccess('expenses'));

        expect(result.current.allowed).toBe(false);
        expect(result.current.reason).toBe('subscription_cancelled');
      });
    });

    describe('expired status', () => {
      it('blocks access with subscription_expired reason', () => {
        setMockSettings({
          subscriptionTier: 'professional',
          subscriptionStatus: 'expired',
        });

        const { result } = renderHook(() => useFeatureAccess('expenses'));

        expect(result.current.allowed).toBe(false);
        expect(result.current.reason).toBe('subscription_expired');
      });

      it('blocks even free tier features when expired', () => {
        setMockSettings({
          subscriptionTier: 'business',
          subscriptionStatus: 'expired',
        });

        const { result } = renderHook(() => useFeatureAccess('invoices'));

        expect(result.current.allowed).toBe(false);
        expect(result.current.reason).toBe('subscription_expired');
      });
    });
  });

  // ============================================
  // TRIAL DAYS CALCULATION
  // ============================================

  describe('trial days calculation', () => {
    it('calculates trialDaysRemaining correctly for 7 days', () => {
      setMockSettings({
        subscriptionTier: 'professional',
        subscriptionStatus: 'trialing',
        trialEnd: daysFromNow(7),
      });

      const { result } = renderHook(() => useFeatureAccess('expenses'));

      expect(result.current.trialDaysRemaining).toBe(7);
    });

    it('calculates trialDaysRemaining correctly for 14 days', () => {
      setMockSettings({
        subscriptionTier: 'professional',
        subscriptionStatus: 'trialing',
        trialEnd: daysFromNow(14),
      });

      const { result } = renderHook(() => useFeatureAccess('expenses'));

      expect(result.current.trialDaysRemaining).toBe(14);
    });

    it('calculates trialDaysRemaining correctly for 1 day', () => {
      setMockSettings({
        subscriptionTier: 'professional',
        subscriptionStatus: 'trialing',
        trialEnd: daysFromNow(1),
      });

      const { result } = renderHook(() => useFeatureAccess('expenses'));

      expect(result.current.trialDaysRemaining).toBe(1);
    });

    it('returns 0 when trial has passed', () => {
      setMockSettings({
        subscriptionTier: 'professional',
        subscriptionStatus: 'trialing',
        trialEnd: daysAgo(3),
      });

      const { result } = renderHook(() => useFeatureAccess('expenses'));

      expect(result.current.trialDaysRemaining).toBe(0);
    });

    it('returns null when no trialEnd is set', () => {
      setMockSettings({
        subscriptionTier: 'professional',
        subscriptionStatus: 'active',
        trialEnd: undefined,
      });

      const { result } = renderHook(() => useFeatureAccess('expenses'));

      expect(result.current.trialDaysRemaining).toBeNull();
    });
  });
});

// ============================================
// useSubscription TESTS
// ============================================

describe('useSubscription', () => {
  beforeEach(() => {
    mockSettings.current = createMockSettings();
  });

  describe('isActive calculation', () => {
    it('is true for valid active subscription', () => {
      setMockSettings({
        subscriptionTier: 'professional',
        subscriptionStatus: 'active',
        subscriptionPeriodEnd: daysFromNow(30),
      });

      const { result } = renderHook(() => useSubscription());

      expect(result.current.isActive).toBe(true);
      expect(result.current.tier).toBe('professional');
      expect(result.current.status).toBe('active');
    });

    it('is true for active subscription without period end', () => {
      setMockSettings({
        subscriptionTier: 'business',
        subscriptionStatus: 'active',
        subscriptionPeriodEnd: undefined,
      });

      const { result } = renderHook(() => useSubscription());

      expect(result.current.isActive).toBe(true);
    });

    it('is true for valid trialing subscription', () => {
      setMockSettings({
        subscriptionTier: 'professional',
        subscriptionStatus: 'trialing',
        trialEnd: daysFromNow(7),
      });

      const { result } = renderHook(() => useSubscription());

      expect(result.current.isActive).toBe(true);
      expect(result.current.trialDaysRemaining).toBe(7);
    });

    it('is false for expired trialing subscription', () => {
      setMockSettings({
        subscriptionTier: 'professional',
        subscriptionStatus: 'trialing',
        trialEnd: daysAgo(1),
      });

      const { result } = renderHook(() => useSubscription());

      expect(result.current.isActive).toBe(false);
    });

    it('is false for trialing with no trialEnd set', () => {
      setMockSettings({
        subscriptionTier: 'professional',
        subscriptionStatus: 'trialing',
        trialEnd: undefined,
      });

      const { result } = renderHook(() => useSubscription());

      expect(result.current.isActive).toBe(false);
    });

    it('is false for expired subscription', () => {
      setMockSettings({
        subscriptionTier: 'professional',
        subscriptionStatus: 'expired',
      });

      const { result } = renderHook(() => useSubscription());

      expect(result.current.isActive).toBe(false);
    });

    it('is false for past_due subscription', () => {
      setMockSettings({
        subscriptionTier: 'professional',
        subscriptionStatus: 'past_due',
      });

      const { result } = renderHook(() => useSubscription());

      expect(result.current.isActive).toBe(false);
    });

    it('is true for cancelled with period end in future', () => {
      setMockSettings({
        subscriptionTier: 'professional',
        subscriptionStatus: 'cancelled',
        subscriptionPeriodEnd: daysFromNow(15),
      });

      const { result } = renderHook(() => useSubscription());

      expect(result.current.isActive).toBe(true);
    });

    it('is false for cancelled with period end in past', () => {
      setMockSettings({
        subscriptionTier: 'professional',
        subscriptionStatus: 'cancelled',
        subscriptionPeriodEnd: daysAgo(1),
      });

      const { result } = renderHook(() => useSubscription());

      expect(result.current.isActive).toBe(false);
    });
  });

  describe('usageLimits', () => {
    it('merges with tier defaults for free tier', () => {
      setMockSettings({
        subscriptionTier: 'free',
        subscriptionStatus: 'active',
        usageLimits: undefined,
      });

      const { result } = renderHook(() => useSubscription());

      expect(result.current.usageLimits.customers).toBe(5);
      expect(result.current.usageLimits.jobPacks).toBe(3);
      expect(result.current.usageLimits.quotes).toBe(3);
      expect(result.current.usageLimits.invoices).toBe(3);
      expect(result.current.usageLimits.photosPerMonth).toBe(20);
    });

    it('merges with tier defaults for professional tier', () => {
      setMockSettings({
        subscriptionTier: 'professional',
        subscriptionStatus: 'active',
        usageLimits: undefined,
      });

      const { result } = renderHook(() => useSubscription());

      expect(result.current.usageLimits.customers).toBeNull(); // unlimited
      expect(result.current.usageLimits.jobPacks).toBeNull();
      expect(result.current.usageLimits.photosPerMonth).toBe(100);
    });

    it('merges with tier defaults for business tier', () => {
      setMockSettings({
        subscriptionTier: 'business',
        subscriptionStatus: 'active',
        usageLimits: undefined,
      });

      const { result } = renderHook(() => useSubscription());

      expect(result.current.usageLimits.customers).toBeNull();
      expect(result.current.usageLimits.photosPerMonth).toBeNull();
      expect(result.current.usageLimits.documentsPerMonth).toBeNull();
    });

    it('overrides tier defaults with custom usageLimits', () => {
      setMockSettings({
        subscriptionTier: 'free',
        subscriptionStatus: 'active',
        usageLimits: {
          customers: 10, // Override from 5
          jobPacks: 3,
          quotes: 3,
          invoices: 3,
          photosPerMonth: 50, // Override from 20
          documentsPerMonth: 5,
        },
      });

      const { result } = renderHook(() => useSubscription());

      expect(result.current.usageLimits.customers).toBe(10);
      expect(result.current.usageLimits.photosPerMonth).toBe(50);
    });
  });
});

// ============================================
// useUsageLimit TESTS
// ============================================

describe('useUsageLimit', () => {
  beforeEach(() => {
    mockSettings.current = createMockSettings();
  });

  describe('free tier limits', () => {
    beforeEach(() => {
      setMockSettings({
        subscriptionTier: 'free',
        subscriptionStatus: 'active',
      });
    });

    it('allows 5 customers (limit is 5)', () => {
      const { result } = renderHook(() => useUsageLimit('customers', 4));

      expect(result.current.allowed).toBe(true);
      expect(result.current.current).toBe(4);
      expect(result.current.limit).toBe(5);
      expect(result.current.remaining).toBe(1);
      expect(result.current.isUnlimited).toBe(false);
    });

    it('blocks 6th customer (limit is 5)', () => {
      const { result } = renderHook(() => useUsageLimit('customers', 5));

      expect(result.current.allowed).toBe(false);
      expect(result.current.current).toBe(5);
      expect(result.current.limit).toBe(5);
      expect(result.current.remaining).toBe(0);
      expect(result.current.isUnlimited).toBe(false);
    });

    it('blocks when already over limit', () => {
      const { result } = renderHook(() => useUsageLimit('customers', 7));

      expect(result.current.allowed).toBe(false);
      expect(result.current.remaining).toBe(0);
    });

    it('calculates remaining correctly for jobPacks', () => {
      const { result } = renderHook(() => useUsageLimit('jobPacks', 1));

      expect(result.current.allowed).toBe(true);
      expect(result.current.limit).toBe(3);
      expect(result.current.remaining).toBe(2);
    });

    it('calculates remaining correctly for quotes', () => {
      const { result } = renderHook(() => useUsageLimit('quotes', 2));

      expect(result.current.allowed).toBe(true);
      expect(result.current.limit).toBe(3);
      expect(result.current.remaining).toBe(1);
    });
  });

  describe('professional tier limits', () => {
    beforeEach(() => {
      setMockSettings({
        subscriptionTier: 'professional',
        subscriptionStatus: 'active',
      });
    });

    it('allows unlimited customers (null limit)', () => {
      const { result } = renderHook(() => useUsageLimit('customers', 100));

      expect(result.current.allowed).toBe(true);
      expect(result.current.current).toBe(100);
      expect(result.current.limit).toBeNull();
      expect(result.current.remaining).toBeNull();
      expect(result.current.isUnlimited).toBe(true);
    });

    it('allows unlimited jobPacks', () => {
      const { result } = renderHook(() => useUsageLimit('jobPacks', 50));

      expect(result.current.allowed).toBe(true);
      expect(result.current.isUnlimited).toBe(true);
    });

    it('has monthly photo limit of 100', () => {
      const { result } = renderHook(() => useUsageLimit('photosPerMonth', 99));

      expect(result.current.allowed).toBe(true);
      expect(result.current.limit).toBe(100);
      expect(result.current.remaining).toBe(1);
      expect(result.current.isUnlimited).toBe(false);
    });

    it('blocks when monthly photo limit reached', () => {
      const { result } = renderHook(() => useUsageLimit('photosPerMonth', 100));

      expect(result.current.allowed).toBe(false);
      expect(result.current.remaining).toBe(0);
    });
  });

  describe('business tier limits', () => {
    beforeEach(() => {
      setMockSettings({
        subscriptionTier: 'business',
        subscriptionStatus: 'active',
      });
    });

    it('allows unlimited customers', () => {
      const { result } = renderHook(() => useUsageLimit('customers', 500));

      expect(result.current.allowed).toBe(true);
      expect(result.current.isUnlimited).toBe(true);
    });

    it('allows unlimited photos per month', () => {
      const { result } = renderHook(() => useUsageLimit('photosPerMonth', 1000));

      expect(result.current.allowed).toBe(true);
      expect(result.current.isUnlimited).toBe(true);
    });

    it('allows unlimited documents per month', () => {
      const { result } = renderHook(() => useUsageLimit('documentsPerMonth', 500));

      expect(result.current.allowed).toBe(true);
      expect(result.current.isUnlimited).toBe(true);
    });
  });

  describe('remaining calculation', () => {
    it('calculates remaining correctly when under limit', () => {
      setMockSettings({
        subscriptionTier: 'free',
        subscriptionStatus: 'active',
      });

      const { result } = renderHook(() => useUsageLimit('customers', 2));

      expect(result.current.remaining).toBe(3); // 5 - 2 = 3
    });

    it('returns 0 remaining when at limit', () => {
      setMockSettings({
        subscriptionTier: 'free',
        subscriptionStatus: 'active',
      });

      const { result } = renderHook(() => useUsageLimit('customers', 5));

      expect(result.current.remaining).toBe(0);
    });

    it('returns 0 remaining when over limit (not negative)', () => {
      setMockSettings({
        subscriptionTier: 'free',
        subscriptionStatus: 'active',
      });

      const { result } = renderHook(() => useUsageLimit('customers', 10));

      expect(result.current.remaining).toBe(0);
    });

    it('returns null remaining for unlimited resources', () => {
      setMockSettings({
        subscriptionTier: 'business',
        subscriptionStatus: 'active',
      });

      const { result } = renderHook(() => useUsageLimit('customers', 100));

      expect(result.current.remaining).toBeNull();
    });
  });
});

// ============================================
// useCanAdd TESTS
// ============================================

describe('useCanAdd', () => {
  beforeEach(() => {
    mockSettings.current = createMockSettings();
  });

  it('returns true when under limit', () => {
    setMockSettings({
      subscriptionTier: 'free',
      subscriptionStatus: 'active',
    });

    const { result } = renderHook(() => useCanAdd('customers', 3));

    expect(result.current).toBe(true);
  });

  it('returns true when at limit minus 1', () => {
    setMockSettings({
      subscriptionTier: 'free',
      subscriptionStatus: 'active',
    });

    const { result } = renderHook(() => useCanAdd('customers', 4));

    expect(result.current).toBe(true);
  });

  it('returns false when at limit', () => {
    setMockSettings({
      subscriptionTier: 'free',
      subscriptionStatus: 'active',
    });

    const { result } = renderHook(() => useCanAdd('customers', 5));

    expect(result.current).toBe(false);
  });

  it('returns true for unlimited resources', () => {
    setMockSettings({
      subscriptionTier: 'professional',
      subscriptionStatus: 'active',
    });

    const { result } = renderHook(() => useCanAdd('customers', 1000));

    expect(result.current).toBe(true);
  });
});

// ============================================
// HELPER FUNCTIONS TESTS
// ============================================

describe('helper functions', () => {
  describe('getTierDisplayName', () => {
    it('returns "Free" for free tier', () => {
      expect(getTierDisplayName('free')).toBe('Free');
    });

    it('returns "Professional" for professional tier', () => {
      expect(getTierDisplayName('professional')).toBe('Professional');
    });

    it('returns "Business" for business tier', () => {
      expect(getTierDisplayName('business')).toBe('Business');
    });
  });

  describe('getFeatureDisplayName', () => {
    it('returns correct display names for features', () => {
      expect(getFeatureDisplayName('invoices')).toBe('Invoices');
      expect(getFeatureDisplayName('expenses')).toBe('Expense Tracking');
      expect(getFeatureDisplayName('schedule')).toBe('Schedule');
      expect(getFeatureDisplayName('siteDocuments')).toBe('Site Documents');
      expect(getFeatureDisplayName('materialsLibrary')).toBe('Materials Library');
      expect(getFeatureDisplayName('bankImport')).toBe('Bank Import');
      expect(getFeatureDisplayName('vatReports')).toBe('VAT Reports');
      expect(getFeatureDisplayName('payables')).toBe('Payables');
      expect(getFeatureDisplayName('filingCabinet')).toBe('Filing Cabinet');
      expect(getFeatureDisplayName('unlimitedCustomers')).toBe('Unlimited Customers');
      expect(getFeatureDisplayName('unlimitedJobPacks')).toBe('Unlimited Job Packs');
      expect(getFeatureDisplayName('unlimitedPhotos')).toBe('Unlimited Photos');
    });
  });
});
