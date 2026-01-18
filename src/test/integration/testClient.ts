import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from '../../lib/database.types';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load test environment variables
const envTestPath = path.resolve(process.cwd(), '.env.test');
if (fs.existsSync(envTestPath)) {
  dotenv.config({ path: envTestPath });
} else {
  console.warn('Warning: .env.test file not found. Integration tests may fail.');
  console.warn('Copy .env.test.example to .env.test and fill in your test credentials.');
}

// Validate required environment variables
const requiredEnvVars = [
  'SUPABASE_TEST_URL',
  'SUPABASE_TEST_ANON_KEY',
  'SUPABASE_TEST_SERVICE_ROLE_KEY',
  'TEST_USER_A_EMAIL',
  'TEST_USER_A_PASSWORD',
  'TEST_USER_B_EMAIL',
  'TEST_USER_B_PASSWORD',
];

export function validateTestEnv(): void {
  const missing = requiredEnvVars.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required test environment variables: ${missing.join(', ')}\n` +
        'Please copy .env.test.example to .env.test and fill in your test credentials.'
    );
  }
}

// Test environment configuration
export const testConfig = {
  supabaseUrl: process.env.SUPABASE_TEST_URL || '',
  supabaseAnonKey: process.env.SUPABASE_TEST_ANON_KEY || '',
  supabaseServiceRoleKey: process.env.SUPABASE_TEST_SERVICE_ROLE_KEY || '',
  userA: {
    email: process.env.TEST_USER_A_EMAIL || '',
    password: process.env.TEST_USER_A_PASSWORD || '',
  },
  userB: {
    email: process.env.TEST_USER_B_EMAIL || '',
    password: process.env.TEST_USER_B_PASSWORD || '',
  },
};

// Create Supabase client with anon key (for user-authenticated requests)
export function createTestClient(): SupabaseClient<Database> {
  return createClient<Database>(testConfig.supabaseUrl, testConfig.supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// Create Supabase admin client with service role key (bypasses RLS)
export function createAdminClient(): SupabaseClient<Database> {
  return createClient<Database>(testConfig.supabaseUrl, testConfig.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// Test user session management
export interface TestUserSession {
  client: SupabaseClient<Database>;
  user: User;
  cleanup: () => Promise<void>;
}

// Sign in as a test user and return the authenticated client
export async function signInAsTestUser(
  email: string,
  password: string
): Promise<TestUserSession> {
  const client = createTestClient();

  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(`Failed to sign in as test user ${email}: ${error.message}`);
  }

  if (!data.user) {
    throw new Error(`No user returned after sign in for ${email}`);
  }

  return {
    client,
    user: data.user,
    cleanup: async () => {
      await client.auth.signOut();
    },
  };
}

// Sign in as User A
export async function signInAsUserA(): Promise<TestUserSession> {
  return signInAsTestUser(testConfig.userA.email, testConfig.userA.password);
}

// Sign in as User B
export async function signInAsUserB(): Promise<TestUserSession> {
  return signInAsTestUser(testConfig.userB.email, testConfig.userB.password);
}

// Data cleanup utilities
export interface CleanupTracker {
  customers: string[];
  quotes: string[];
  jobPacks: string[];
  expenses: string[];
  scheduleEntries: string[];
}

export function createCleanupTracker(): CleanupTracker {
  return {
    customers: [],
    quotes: [],
    jobPacks: [],
    expenses: [],
    scheduleEntries: [],
  };
}

// Clean up all tracked test data using admin client (bypasses RLS)
export async function cleanupTestData(
  tracker: CleanupTracker,
  adminClient?: SupabaseClient<Database>
): Promise<void> {
  const client = adminClient || createAdminClient();

  // Delete in reverse dependency order
  // 1. Schedule entries (no dependencies)
  if (tracker.scheduleEntries.length > 0) {
    await client.from('schedule_entries').delete().in('id', tracker.scheduleEntries);
  }

  // 2. Expenses (no dependencies)
  if (tracker.expenses.length > 0) {
    await client.from('expenses').delete().in('id', tracker.expenses);
  }

  // 3. Quotes (depends on customers)
  if (tracker.quotes.length > 0) {
    await client.from('quotes').delete().in('id', tracker.quotes);
  }

  // 4. Job packs (depends on customers, has cascade for notes/photos/documents)
  if (tracker.jobPacks.length > 0) {
    await client.from('job_packs').delete().in('id', tracker.jobPacks);
  }

  // 5. Customers (last, as quotes and job packs depend on them)
  if (tracker.customers.length > 0) {
    await client.from('customers').delete().in('id', tracker.customers);
  }
}

// Clean up ALL data for a specific user (nuclear option for test isolation)
export async function cleanupAllUserData(userId: string): Promise<void> {
  const client = createAdminClient();

  // Delete in dependency order
  await client.from('schedule_entries').delete().eq('user_id', userId);
  await client.from('expenses').delete().eq('user_id', userId);
  await client.from('quotes').delete().eq('user_id', userId);
  await client.from('job_packs').delete().eq('user_id', userId);
  await client.from('customers').delete().eq('user_id', userId);
}

// Test data generators with unique identifiers
let testIdCounter = 0;

export function generateTestId(prefix = 'test'): string {
  return `${prefix}-${Date.now()}-${++testIdCounter}`;
}

export function generateTestCustomer(userId: string) {
  const id = generateTestId('cust');
  return {
    user_id: userId,
    name: `Test Customer ${id}`,
    email: `${id}@test.example.com`,
    phone: '07700 900000',
    address: '123 Test Street, London, SW1A 1AA',
  };
}

export function generateTestQuote(userId: string, customerId: string) {
  const id = generateTestId('quote');
  return {
    user_id: userId,
    customer_id: customerId,
    title: `Test Quote ${id}`,
    date: new Date().toISOString().split('T')[0],
    sections: JSON.stringify([
      {
        id: 'sec-1',
        title: 'Test Section',
        items: [
          {
            id: 'item-1',
            name: 'Test Material',
            description: '',
            quantity: 1,
            unit: 'ea',
            unitPrice: 100,
            totalPrice: 100,
          },
        ],
        labourHours: 2,
      },
    ]),
    labour_rate: 50,
    markup_percent: 0,
    tax_percent: 20,
    cis_percent: 0,
    status: 'draft',
    type: 'quotation',
    notes: '',
  };
}

export function generateTestJobPack(userId: string, customerId: string) {
  const id = generateTestId('job');
  return {
    user_id: userId,
    customer_id: customerId,
    title: `Test Job Pack ${id}`,
    status: 'active' as const,
  };
}

export function generateTestExpense(userId: string, jobPackId?: string) {
  const id = generateTestId('exp');
  return {
    user_id: userId,
    job_pack_id: jobPackId || null,
    vendor: `Test Vendor ${id}`,
    description: 'Test expense for integration testing',
    amount: 100,
    vat_amount: 20,
    category: 'materials',
    expense_date: new Date().toISOString().split('T')[0],
    payment_method: 'card',
    is_reconciled: false,
  };
}

// Assertion helpers
export function assertDefined<T>(value: T | null | undefined, message?: string): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message || 'Expected value to be defined');
  }
}
