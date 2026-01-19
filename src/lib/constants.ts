// Master admin user IDs - only these users can access admin features
export const ADMIN_USER_IDS = [
  '5ebbf6a3-1477-4d3f-a6e8-6795e26b4d1d', // shawadam182@gmail.com
  '83c1804d-f1ba-469e-8f29-4ad0a10d1112', // hsa.electrical@gmail.com (fixed ID)
  '3b71f70c-35b5-4ace-9f30-b95390007043', // test@tradesync.info
] as const;

export const isAdminUser = (userId: string | undefined): boolean => {
  if (!userId) return false;
  return ADMIN_USER_IDS.includes(userId as typeof ADMIN_USER_IDS[number]);
};

// App configuration
export const APP_CONFIG = {
  BASE_URL: import.meta.env.VITE_APP_URL || 'https://tradesync.app',
  TRIAL_DURATION_DAYS: 14,
  REFERRAL_VALIDITY_DAYS: 30,
  DEFAULT_COMMISSION: 10.00,
} as const;

// Free tier limits (same as TIER_LIMITS['free'] but usable without importing types)
export const FREE_TIER_LIMITS = {
  customers: 5,
  jobPacks: 3,
  quotes: 3,
  invoices: 3,
  photosPerMonth: 20,
  documentsPerMonth: 5,
} as const;
