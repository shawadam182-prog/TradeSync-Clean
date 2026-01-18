import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import {
  validateTestEnv,
  createAdminClient,
  signInAsUserA,
  signInAsUserB,
  createCleanupTracker,
  cleanupTestData,
  cleanupAllUserData,
  generateTestCustomer,
  generateTestQuote,
  generateTestJobPack,
  generateTestExpense,
  assertDefined,
  type TestUserSession,
  type CleanupTracker,
} from './testClient';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../lib/database.types';

describe('dataService integration tests', () => {
  let userASession: TestUserSession;
  let userBSession: TestUserSession;
  let adminClient: SupabaseClient<Database>;
  let cleanup: CleanupTracker;

  // Validate environment before running any tests
  beforeAll(() => {
    validateTestEnv();
    adminClient = createAdminClient();
  });

  // Sign in both test users before each test
  beforeEach(async () => {
    userASession = await signInAsUserA();
    userBSession = await signInAsUserB();
    cleanup = createCleanupTracker();
  });

  // Clean up test data and sign out after each test
  afterEach(async () => {
    await cleanupTestData(cleanup, adminClient);
    await userASession.cleanup();
    await userBSession.cleanup();
  });

  // ============================================
  // CUSTOMER CRUD OPERATIONS
  // ============================================

  describe('customers', () => {
    describe('create and retrieve', () => {
      it('creates a customer and verifies it exists in the database', async () => {
        const customerData = generateTestCustomer(userASession.user.id);

        // Create customer
        const { data: created, error: createError } = await userASession.client
          .from('customers')
          .insert(customerData)
          .select()
          .single();

        expect(createError).toBeNull();
        assertDefined(created, 'Customer should be created');
        cleanup.customers.push(created.id);

        // Verify it exists
        const { data: fetched, error: fetchError } = await userASession.client
          .from('customers')
          .select('*')
          .eq('id', created.id)
          .single();

        expect(fetchError).toBeNull();
        assertDefined(fetched, 'Customer should be fetched');
        expect(fetched.name).toBe(customerData.name);
        expect(fetched.email).toBe(customerData.email);
        expect(fetched.phone).toBe(customerData.phone);
        expect(fetched.address).toBe(customerData.address);
        expect(fetched.user_id).toBe(userASession.user.id);
      });

      it('generates UUID id automatically', async () => {
        const customerData = generateTestCustomer(userASession.user.id);

        const { data, error } = await userASession.client
          .from('customers')
          .insert(customerData)
          .select()
          .single();

        expect(error).toBeNull();
        assertDefined(data, 'Customer should be created');
        cleanup.customers.push(data.id);

        // Verify ID is a valid UUID format
        expect(data.id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        );
      });

      it('returns all customers for a user ordered by name', async () => {
        // Create multiple customers
        const customers = [
          { ...generateTestCustomer(userASession.user.id), name: 'Zack Customer' },
          { ...generateTestCustomer(userASession.user.id), name: 'Alice Customer' },
          { ...generateTestCustomer(userASession.user.id), name: 'Mike Customer' },
        ];

        for (const cust of customers) {
          const { data, error } = await userASession.client
            .from('customers')
            .insert(cust)
            .select()
            .single();
          expect(error).toBeNull();
          assertDefined(data);
          cleanup.customers.push(data.id);
        }

        // Fetch all and verify order
        const { data: allCustomers, error } = await userASession.client
          .from('customers')
          .select('*')
          .order('name');

        expect(error).toBeNull();
        assertDefined(allCustomers);
        expect(allCustomers.length).toBeGreaterThanOrEqual(3);

        // Find our test customers and verify they're in alphabetical order
        const testCustomers = allCustomers.filter((c) =>
          ['Zack Customer', 'Alice Customer', 'Mike Customer'].includes(c.name)
        );
        expect(testCustomers.map((c) => c.name)).toEqual([
          'Alice Customer',
          'Mike Customer',
          'Zack Customer',
        ]);
      });
    });

    describe('update', () => {
      it('updates only the specified fields', async () => {
        // Create customer
        const customerData = generateTestCustomer(userASession.user.id);
        const { data: created, error: createError } = await userASession.client
          .from('customers')
          .insert(customerData)
          .select()
          .single();

        expect(createError).toBeNull();
        assertDefined(created);
        cleanup.customers.push(created.id);

        // Update only name
        const { data: updated, error: updateError } = await userASession.client
          .from('customers')
          .update({ name: 'Updated Name' })
          .eq('id', created.id)
          .select()
          .single();

        expect(updateError).toBeNull();
        assertDefined(updated);
        expect(updated.name).toBe('Updated Name');
        expect(updated.email).toBe(customerData.email); // Unchanged
        expect(updated.phone).toBe(customerData.phone); // Unchanged
      });
    });

    describe('delete', () => {
      it('removes customer from database', async () => {
        // Create customer
        const customerData = generateTestCustomer(userASession.user.id);
        const { data: created, error: createError } = await userASession.client
          .from('customers')
          .insert(customerData)
          .select()
          .single();

        expect(createError).toBeNull();
        assertDefined(created);

        // Delete customer
        const { error: deleteError } = await userASession.client
          .from('customers')
          .delete()
          .eq('id', created.id);

        expect(deleteError).toBeNull();

        // Verify it's gone
        const { data: fetched, error: fetchError } = await userASession.client
          .from('customers')
          .select('*')
          .eq('id', created.id)
          .single();

        expect(fetchError).not.toBeNull();
        expect(fetchError?.code).toBe('PGRST116'); // Row not found
      });
    });
  });

  // ============================================
  // ROW LEVEL SECURITY (RLS) TESTS
  // ============================================

  describe('RLS (Row Level Security)', () => {
    it('User A cannot see User B customers', async () => {
      // User B creates a customer
      const customerData = generateTestCustomer(userBSession.user.id);
      const { data: userBCustomer, error: createError } = await userBSession.client
        .from('customers')
        .insert(customerData)
        .select()
        .single();

      expect(createError).toBeNull();
      assertDefined(userBCustomer);
      cleanup.customers.push(userBCustomer.id);

      // User A tries to fetch User B's customer
      const { data: fetchedByA, error: fetchError } = await userASession.client
        .from('customers')
        .select('*')
        .eq('id', userBCustomer.id)
        .single();

      // Should get no rows error because RLS prevents access
      expect(fetchError).not.toBeNull();
      expect(fetchError?.code).toBe('PGRST116'); // Row not found
    });

    it('User A cannot update User B customers', async () => {
      // User B creates a customer
      const customerData = generateTestCustomer(userBSession.user.id);
      const { data: userBCustomer, error: createError } = await userBSession.client
        .from('customers')
        .insert(customerData)
        .select()
        .single();

      expect(createError).toBeNull();
      assertDefined(userBCustomer);
      cleanup.customers.push(userBCustomer.id);

      // User A tries to update User B's customer
      const { data: updateResult, error: updateError } = await userASession.client
        .from('customers')
        .update({ name: 'Hacked Name' })
        .eq('id', userBCustomer.id)
        .select();

      // Update should succeed but affect 0 rows (RLS filters it out)
      expect(updateError).toBeNull();
      expect(updateResult).toEqual([]);

      // Verify original data unchanged
      const { data: verified } = await userBSession.client
        .from('customers')
        .select('*')
        .eq('id', userBCustomer.id)
        .single();

      assertDefined(verified);
      expect(verified.name).toBe(customerData.name);
    });

    it('User A cannot delete User B customers', async () => {
      // User B creates a customer
      const customerData = generateTestCustomer(userBSession.user.id);
      const { data: userBCustomer, error: createError } = await userBSession.client
        .from('customers')
        .insert(customerData)
        .select()
        .single();

      expect(createError).toBeNull();
      assertDefined(userBCustomer);
      cleanup.customers.push(userBCustomer.id);

      // User A tries to delete User B's customer
      await userASession.client.from('customers').delete().eq('id', userBCustomer.id);

      // Verify customer still exists for User B
      const { data: stillExists, error } = await userBSession.client
        .from('customers')
        .select('*')
        .eq('id', userBCustomer.id)
        .single();

      expect(error).toBeNull();
      assertDefined(stillExists);
      expect(stillExists.id).toBe(userBCustomer.id);
    });

    it('User A only sees their own customers in getAll', async () => {
      // Both users create customers
      const customerA = generateTestCustomer(userASession.user.id);
      const customerB = generateTestCustomer(userBSession.user.id);

      const { data: createdA } = await userASession.client
        .from('customers')
        .insert(customerA)
        .select()
        .single();
      const { data: createdB } = await userBSession.client
        .from('customers')
        .insert(customerB)
        .select()
        .single();

      assertDefined(createdA);
      assertDefined(createdB);
      cleanup.customers.push(createdA.id, createdB.id);

      // User A fetches all customers
      const { data: userACustomers, error } = await userASession.client
        .from('customers')
        .select('*');

      expect(error).toBeNull();
      assertDefined(userACustomers);

      // User A should only see their own customers
      const userAIds = userACustomers.map((c) => c.user_id);
      expect(userAIds.every((id) => id === userASession.user.id)).toBe(true);
      expect(userAIds).not.toContain(userBSession.user.id);
    });
  });

  // ============================================
  // CASCADE DELETE TESTS
  // ============================================

  describe('cascade delete', () => {
    it('deleting customer removes related quotes', async () => {
      // Create customer
      const customerData = generateTestCustomer(userASession.user.id);
      const { data: customer, error: custError } = await userASession.client
        .from('customers')
        .insert(customerData)
        .select()
        .single();

      expect(custError).toBeNull();
      assertDefined(customer);

      // Create quote for customer
      const quoteData = generateTestQuote(userASession.user.id, customer.id);
      const { data: quote, error: quoteError } = await userASession.client
        .from('quotes')
        .insert(quoteData)
        .select()
        .single();

      expect(quoteError).toBeNull();
      assertDefined(quote);

      // Verify quote exists
      const { data: quoteExists } = await userASession.client
        .from('quotes')
        .select('*')
        .eq('id', quote.id)
        .single();
      assertDefined(quoteExists);

      // Delete customer (should cascade to quotes)
      const { error: deleteError } = await userASession.client
        .from('customers')
        .delete()
        .eq('id', customer.id);

      expect(deleteError).toBeNull();

      // Verify quote is also deleted
      const { data: quoteAfterDelete, error: quoteCheckError } = await userASession.client
        .from('quotes')
        .select('*')
        .eq('id', quote.id)
        .single();

      expect(quoteCheckError).not.toBeNull();
      expect(quoteCheckError?.code).toBe('PGRST116'); // Row not found
    });

    it('deleting customer removes related job packs', async () => {
      // Create customer
      const customerData = generateTestCustomer(userASession.user.id);
      const { data: customer, error: custError } = await userASession.client
        .from('customers')
        .insert(customerData)
        .select()
        .single();

      expect(custError).toBeNull();
      assertDefined(customer);

      // Create job pack for customer
      const jobPackData = generateTestJobPack(userASession.user.id, customer.id);
      const { data: jobPack, error: jobError } = await userASession.client
        .from('job_packs')
        .insert(jobPackData)
        .select()
        .single();

      expect(jobError).toBeNull();
      assertDefined(jobPack);

      // Delete customer (should cascade)
      const { error: deleteError } = await userASession.client
        .from('customers')
        .delete()
        .eq('id', customer.id);

      expect(deleteError).toBeNull();

      // Verify job pack is also deleted
      const { error: jobCheckError } = await userASession.client
        .from('job_packs')
        .select('*')
        .eq('id', jobPack.id)
        .single();

      expect(jobCheckError?.code).toBe('PGRST116');
    });

    it('deleting job pack removes related site notes, photos, and documents', async () => {
      // Create customer and job pack
      const customerData = generateTestCustomer(userASession.user.id);
      const { data: customer } = await userASession.client
        .from('customers')
        .insert(customerData)
        .select()
        .single();
      assertDefined(customer);
      cleanup.customers.push(customer.id);

      const jobPackData = generateTestJobPack(userASession.user.id, customer.id);
      const { data: jobPack } = await userASession.client
        .from('job_packs')
        .insert(jobPackData)
        .select()
        .single();
      assertDefined(jobPack);

      // Create a site note
      const { data: note } = await userASession.client
        .from('site_notes')
        .insert({
          job_pack_id: jobPack.id,
          text: 'Test note for cascade delete test',
        })
        .select()
        .single();
      assertDefined(note);

      // Delete job pack
      const { error: deleteError } = await userASession.client
        .from('job_packs')
        .delete()
        .eq('id', jobPack.id);

      expect(deleteError).toBeNull();

      // Verify site note is also deleted
      const { error: noteCheckError } = await userASession.client
        .from('site_notes')
        .select('*')
        .eq('id', note.id)
        .single();

      expect(noteCheckError?.code).toBe('PGRST116');
    });
  });

  // ============================================
  // DATA TRANSFORMATION TESTS
  // ============================================

  describe('data transformation', () => {
    it('database stores snake_case columns correctly', async () => {
      // Create customer with user_id
      const customerData = generateTestCustomer(userASession.user.id);
      const { data: created, error } = await userASession.client
        .from('customers')
        .insert(customerData)
        .select()
        .single();

      expect(error).toBeNull();
      assertDefined(created);
      cleanup.customers.push(created.id);

      // Verify snake_case columns exist
      expect(created).toHaveProperty('user_id');
      expect(created).toHaveProperty('created_at');
      expect(created).toHaveProperty('updated_at');
      expect(created.user_id).toBe(userASession.user.id);
    });

    it('quote sections are stored as JSON and retrieved correctly', async () => {
      // Create customer
      const customerData = generateTestCustomer(userASession.user.id);
      const { data: customer } = await userASession.client
        .from('customers')
        .insert(customerData)
        .select()
        .single();
      assertDefined(customer);
      cleanup.customers.push(customer.id);

      // Create quote with sections
      const sections = [
        {
          id: 'sec-1',
          title: 'Materials',
          items: [
            { id: 'i1', name: 'Timber', quantity: 10, unit: 'm', unitPrice: 5, totalPrice: 50 },
          ],
          labourHours: 4,
        },
        {
          id: 'sec-2',
          title: 'Labour',
          items: [],
          labourHours: 8,
        },
      ];

      const quoteData = {
        ...generateTestQuote(userASession.user.id, customer.id),
        sections: JSON.stringify(sections),
      };

      const { data: quote, error } = await userASession.client
        .from('quotes')
        .insert(quoteData)
        .select()
        .single();

      expect(error).toBeNull();
      assertDefined(quote);
      cleanup.quotes.push(quote.id);

      // Retrieve and verify sections
      const { data: fetched } = await userASession.client
        .from('quotes')
        .select('*')
        .eq('id', quote.id)
        .single();

      assertDefined(fetched);
      const parsedSections = JSON.parse(fetched.sections as string);
      expect(parsedSections).toHaveLength(2);
      expect(parsedSections[0].title).toBe('Materials');
      expect(parsedSections[0].items[0].name).toBe('Timber');
      expect(parsedSections[1].labourHours).toBe(8);
    });

    it('timestamps are auto-generated on insert', async () => {
      const customerData = generateTestCustomer(userASession.user.id);
      const { data: created, error } = await userASession.client
        .from('customers')
        .insert(customerData)
        .select()
        .single();

      expect(error).toBeNull();
      assertDefined(created);
      cleanup.customers.push(created.id);

      // Verify timestamps exist and are recent
      expect(created.created_at).toBeDefined();
      expect(created.updated_at).toBeDefined();

      const createdAt = new Date(created.created_at!);
      const now = new Date();
      const diffMs = now.getTime() - createdAt.getTime();

      // Should be within last 10 seconds
      expect(diffMs).toBeLessThan(10000);
    });

    it('updated_at changes on update', async () => {
      const customerData = generateTestCustomer(userASession.user.id);
      const { data: created } = await userASession.client
        .from('customers')
        .insert(customerData)
        .select()
        .single();

      assertDefined(created);
      cleanup.customers.push(created.id);

      const originalUpdatedAt = created.updated_at;

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Update the customer
      const { data: updated } = await userASession.client
        .from('customers')
        .update({ name: 'Updated for timestamp test' })
        .eq('id', created.id)
        .select()
        .single();

      assertDefined(updated);

      // updated_at should be different (more recent)
      expect(updated.updated_at).not.toBe(originalUpdatedAt);
      expect(new Date(updated.updated_at!).getTime()).toBeGreaterThan(
        new Date(originalUpdatedAt!).getTime()
      );
    });
  });

  // ============================================
  // RELATIONSHIP TESTS
  // ============================================

  describe('relationships', () => {
    it('can fetch quotes with customer data joined', async () => {
      // Create customer
      const customerData = generateTestCustomer(userASession.user.id);
      const { data: customer } = await userASession.client
        .from('customers')
        .insert(customerData)
        .select()
        .single();
      assertDefined(customer);
      cleanup.customers.push(customer.id);

      // Create quote
      const quoteData = generateTestQuote(userASession.user.id, customer.id);
      const { data: quote } = await userASession.client
        .from('quotes')
        .insert(quoteData)
        .select()
        .single();
      assertDefined(quote);
      cleanup.quotes.push(quote.id);

      // Fetch quote with customer join
      const { data: quoteWithCustomer, error } = await userASession.client
        .from('quotes')
        .select(
          `
          *,
          customer:customers(id, name, email)
        `
        )
        .eq('id', quote.id)
        .single();

      expect(error).toBeNull();
      assertDefined(quoteWithCustomer);
      expect(quoteWithCustomer.customer).toBeDefined();
      expect(quoteWithCustomer.customer!.id).toBe(customer.id);
      expect(quoteWithCustomer.customer!.name).toBe(customerData.name);
    });

    it('can fetch job packs with related counts', async () => {
      // Create customer and job pack
      const customerData = generateTestCustomer(userASession.user.id);
      const { data: customer } = await userASession.client
        .from('customers')
        .insert(customerData)
        .select()
        .single();
      assertDefined(customer);
      cleanup.customers.push(customer.id);

      const jobPackData = generateTestJobPack(userASession.user.id, customer.id);
      const { data: jobPack } = await userASession.client
        .from('job_packs')
        .insert(jobPackData)
        .select()
        .single();
      assertDefined(jobPack);
      cleanup.jobPacks.push(jobPack.id);

      // Add some notes
      await userASession.client.from('site_notes').insert([
        { job_pack_id: jobPack.id, text: 'Note 1' },
        { job_pack_id: jobPack.id, text: 'Note 2' },
      ]);

      // Fetch with nested selects
      const { data: jobPackWithData, error } = await userASession.client
        .from('job_packs')
        .select(
          `
          *,
          customer:customers(id, name),
          site_notes(*),
          site_photos(*),
          site_documents(*)
        `
        )
        .eq('id', jobPack.id)
        .single();

      expect(error).toBeNull();
      assertDefined(jobPackWithData);
      expect(jobPackWithData.customer!.id).toBe(customer.id);
      expect(jobPackWithData.site_notes).toHaveLength(2);
      expect(jobPackWithData.site_photos).toHaveLength(0);
    });
  });
});
