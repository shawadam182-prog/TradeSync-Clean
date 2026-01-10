import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type Tables = Database['public']['Tables'];

// ============================================
// CUSTOMERS
// ============================================

export const customersService = {
  async getAll() {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('name');
    if (error) throw error;
    return data;
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async create(customer: Tables['customers']['Insert']) {
    const { data, error } = await supabase
      .from('customers')
      .insert(customer)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Tables['customers']['Update']) {
    const { data, error } = await supabase
      .from('customers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};

// ============================================
// JOB PACKS
// ============================================

export const jobPacksService = {
  async getAll() {
    const { data, error } = await supabase
      .from('job_packs')
      .select(`
        *,
        customer:customers(id, name),
        site_notes(*),
        site_photos(*),
        site_documents(*),
        project_materials(*)
      `)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('job_packs')
      .select(`
        *,
        customer:customers(id, name),
        site_notes(*),
        site_photos(*),
        site_documents(*),
        project_materials(*)
      `)
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async create(jobPack: Tables['job_packs']['Insert']) {
    const { data, error } = await supabase
      .from('job_packs')
      .insert(jobPack)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Tables['job_packs']['Update']) {
    const { data, error } = await supabase
      .from('job_packs')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('job_packs')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};

// ============================================
// SITE NOTES
// ============================================

export const siteNotesService = {
  async create(note: Tables['site_notes']['Insert']) {
    const { data, error } = await supabase
      .from('site_notes')
      .insert(note)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Tables['site_notes']['Update']) {
    const { data, error } = await supabase
      .from('site_notes')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('site_notes')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};

// ============================================
// SITE PHOTOS
// ============================================

export const sitePhotosService = {
  async upload(jobPackId: string, file: File, caption?: string, tags?: string[], isDrawing = false) {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Not authenticated');

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${jobPackId}/${Date.now()}.${fileExt}`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('photos')
      .upload(fileName, file);
    if (uploadError) throw uploadError;

    // Create database record
    const { data, error } = await supabase
      .from('site_photos')
      .insert({
        job_pack_id: jobPackId,
        storage_path: fileName,
        caption,
        tags: tags || [],
        is_drawing: isDrawing,
      })
      .select()
      .single();
    if (error) throw error;

    return data;
  },

  async getUrl(storagePath: string) {
    const { data } = await supabase.storage
      .from('photos')
      .createSignedUrl(storagePath, 3600); // 1 hour expiry
    return data?.signedUrl;
  },

  async delete(id: string, storagePath: string) {
    // Delete from storage
    await supabase.storage.from('photos').remove([storagePath]);

    // Delete database record
    const { error } = await supabase
      .from('site_photos')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async update(id: string, updates: Tables['site_photos']['Update']) {
    const { data, error } = await supabase
      .from('site_photos')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};

// ============================================
// SITE DOCUMENTS
// ============================================

export const siteDocumentsService = {
  async upload(jobPackId: string, file: File, summary?: string) {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Not authenticated');

    const fileName = `${user.id}/${jobPackId}/${Date.now()}-${file.name}`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, file);
    if (uploadError) throw uploadError;

    // Create database record
    const { data, error } = await supabase
      .from('site_documents')
      .insert({
        job_pack_id: jobPackId,
        name: file.name,
        storage_path: fileName,
        file_type: file.type,
        summary,
      })
      .select()
      .single();
    if (error) throw error;

    return data;
  },

  async getUrl(storagePath: string) {
    const { data } = await supabase.storage
      .from('documents')
      .createSignedUrl(storagePath, 3600);
    return data?.signedUrl;
  },

  async delete(id: string, storagePath: string) {
    await supabase.storage.from('documents').remove([storagePath]);

    const { error } = await supabase
      .from('site_documents')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};

// ============================================
// PROJECT MATERIALS
// ============================================

export const projectMaterialsService = {
  async create(material: Tables['project_materials']['Insert']) {
    const { data, error } = await supabase
      .from('project_materials')
      .insert(material)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Tables['project_materials']['Update']) {
    const { data, error } = await supabase
      .from('project_materials')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('project_materials')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};

// ============================================
// QUOTES
// ============================================

export const quotesService = {
  async getAll() {
    const { data, error } = await supabase
      .from('quotes')
      .select(`
        *,
        customer:customers(id, name)
      `)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('quotes')
      .select(`
        *,
        customer:customers(*)
      `)
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async getByJobPack(jobPackId: string) {
    const { data, error } = await supabase
      .from('quotes')
      .select(`
        *,
        customer:customers(id, name)
      `)
      .eq('job_pack_id', jobPackId)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async create(quote: Tables['quotes']['Insert']) {
    const { data, error } = await supabase
      .from('quotes')
      .insert(quote)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Tables['quotes']['Update']) {
    const { data, error } = await supabase
      .from('quotes')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('quotes')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async getNextReferenceNumber(type: 'estimate' | 'quotation' | 'invoice') {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .rpc('get_next_reference_number', {
        p_user_id: user.id,
        p_type: type,
      });
    if (error) throw error;
    return data as number;
  },
};

// ============================================
// SCHEDULE ENTRIES
// ============================================

export const scheduleService = {
  async getAll() {
    const { data, error } = await supabase
      .from('schedule_entries')
      .select(`
        *,
        job_pack:job_packs(id, title),
        customer:customers(id, name)
      `)
      .order('start_time');
    if (error) throw error;
    return data;
  },

  async getByDateRange(startDate: string, endDate: string) {
    const { data, error } = await supabase
      .from('schedule_entries')
      .select(`
        *,
        job_pack:job_packs(id, title),
        customer:customers(id, name)
      `)
      .gte('start_time', startDate)
      .lte('end_time', endDate)
      .order('start_time');
    if (error) throw error;
    return data;
  },

  async create(entry: Tables['schedule_entries']['Insert']) {
    const { data, error } = await supabase
      .from('schedule_entries')
      .insert(entry)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Tables['schedule_entries']['Update']) {
    const { data, error } = await supabase
      .from('schedule_entries')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('schedule_entries')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};

// ============================================
// USER SETTINGS
// ============================================

export const userSettingsService = {
  async get() {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // If no settings exist, create defaults
    if (error?.code === 'PGRST116') {
      return this.create({
        user_id: user.id,
      });
    }
    if (error) throw error;
    return data;
  },

  async create(settings: Tables['user_settings']['Insert']) {
    const { data, error } = await supabase
      .from('user_settings')
      .insert(settings)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(updates: Tables['user_settings']['Update']) {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('user_settings')
      .update(updates)
      .eq('user_id', user.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async uploadLogo(file: File) {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Not authenticated');

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/logo.${fileExt}`;

    // Delete old logo if exists
    await supabase.storage.from('logos').remove([fileName]);

    // Upload new logo
    const { error: uploadError } = await supabase.storage
      .from('logos')
      .upload(fileName, file, { upsert: true });
    if (uploadError) throw uploadError;

    // Update settings with logo path
    await this.update({ company_logo_path: fileName });

    return fileName;
  },

  async getLogoUrl(storagePath: string) {
    const { data } = await supabase.storage
      .from('logos')
      .createSignedUrl(storagePath, 86400); // 24 hour expiry
    return data?.signedUrl;
  },
};


// ============================================
// EXPENSES
// ============================================

export const expensesService = {
  async getAll() {
    const { data, error } = await supabase
      .from('expenses')
      .select()
      .order('expense_date', { ascending: false });
    if (error) throw error;
    return data;
  },

  async create(expense) {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('expenses')
      .insert({ ...expense, user_id: user.id })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('expenses')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async uploadReceipt(expenseId, file) {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Not authenticated');

    const fileExt = file.name.split('.').pop();
    const fileName = user.id + '/' + expenseId + '/' + Date.now() + '.' + fileExt;

    const { error: uploadError } = await supabase.storage
      .from('receipts')
      .upload(fileName, file);
    if (uploadError) throw uploadError;

    await this.update(expenseId, { receipt_storage_path: fileName });

    return fileName;
  },

  async getReceiptUrl(storagePath) {
    const { data } = await supabase.storage
      .from('receipts')
      .createSignedUrl(storagePath, 3600);
    return data?.signedUrl;
  },
};

// ============================================
// BANK TRANSACTIONS
// ============================================

export const bankTransactionsService = {
  async getAll() {
    const { data, error } = await supabase
      .from('bank_transactions')
      .select()
      .order('transaction_date', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getUnreconciled() {
    const { data, error } = await supabase
      .from('bank_transactions')
      .select('*')
      .eq('is_reconciled', false)
      .order('transaction_date', { ascending: false });
    if (error) throw error;
    return data;
  },

  async importBatch(transactions: any[]) {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Not authenticated');

    const withUserId = transactions.map(t => ({ ...t, user_id: user.id }));

    const { data, error } = await supabase
      .from('bank_transactions')
      .insert(withUserId)
      .select();
    if (error) throw error;
    return data;
  },

  async reconcileWithExpense(transactionId: string, expenseId: string) {
    const { error: txError } = await supabase
      .from('bank_transactions')
      .update({ is_reconciled: true, reconciled_expense_id: expenseId })
      .eq('id', transactionId);
    if (txError) throw txError;

    const { error: expError } = await supabase
      .from('expenses')
      .update({ is_reconciled: true, reconciled_transaction_id: transactionId })
      .eq('id', expenseId);
    if (expError) throw expError;
  },

  async reconcileWithInvoice(transactionId: string, invoiceId: string) {
    const { error } = await supabase
      .from('bank_transactions')
      .update({ is_reconciled: true, reconciled_invoice_id: invoiceId })
      .eq('id', transactionId);
    if (error) throw error;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('bank_transactions')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};

// ============================================
// RECONCILIATION (Multi-receipt support)
// ============================================

export interface ReconciliationLink {
  id: string;
  bank_transaction_id: string;
  expense_id?: string;
  invoice_id?: string;
  amount_matched: number;
  created_at: string;
}

export const reconciliationService = {
  async getLinksForTransaction(transactionId: string) {
    const { data, error } = await supabase
      .from('reconciliation_links')
      .select(`
        *,
        expense:expenses(*),
        invoice:quotes(*)
      `)
      .eq('bank_transaction_id', transactionId);
    if (error) throw error;
    return data;
  },

  async reconcileMulti(transactionId: string, expenseIds: string[], invoiceIds: string[] = []) {
    const { error } = await supabase.rpc('reconcile_transaction_multi', {
      p_transaction_id: transactionId,
      p_expense_ids: expenseIds,
      p_invoice_ids: invoiceIds,
    });
    if (error) throw error;
  },

  async unreconcile(transactionId: string) {
    const { error } = await supabase.rpc('unreconcile_transaction', {
      p_transaction_id: transactionId,
    });
    if (error) throw error;
  },

  async getSummary() {
    const { data, error } = await supabase
      .from('reconciliation_summary')
      .select('*')
      .order('transaction_date', { ascending: false });
    if (error) throw error;
    return data;
  },

  // Quick single-item reconciliation (backwards compatible)
  async reconcileSingle(transactionId: string, expenseId?: string, invoiceId?: string) {
    const expenseIds = expenseId ? [expenseId] : [];
    const invoiceIds = invoiceId ? [invoiceId] : [];
    return this.reconcileMulti(transactionId, expenseIds, invoiceIds);
  },
};

// ============================================
// PAYABLES (Bills to pay)
// ============================================

export interface Payable {
  id: string;
  user_id: string;
  vendor_name: string;
  vendor_id?: string;
  invoice_number?: string;
  description?: string;
  amount: number;
  vat_amount: number;
  invoice_date: string;
  due_date?: string;
  paid_date?: string;
  status: 'unpaid' | 'partial' | 'paid' | 'overdue' | 'disputed';
  amount_paid: number;
  category: string;
  job_pack_id?: string;
  document_path?: string;
  notes?: string;
  is_reconciled: boolean;
  created_at: string;
  updated_at: string;
}

export const payablesService = {
  async getAll() {
    const { data, error } = await supabase
      .from('payables')
      .select('*')
      .order('due_date', { ascending: true });
    if (error) throw error;
    return data;
  },

  async getByStatus(status: string) {
    const { data, error } = await supabase
      .from('payables')
      .select('*')
      .eq('status', status)
      .order('due_date', { ascending: true });
    if (error) throw error;
    return data;
  },

  async getOverdue() {
    const { data, error } = await supabase
      .from('payables')
      .select('*')
      .in('status', ['unpaid', 'partial', 'overdue'])
      .lt('due_date', new Date().toISOString().split('T')[0])
      .order('due_date', { ascending: true });
    if (error) throw error;
    return data;
  },

  async getDueThisWeek() {
    const today = new Date();
    const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const { data, error } = await supabase
      .from('payables')
      .select('*')
      .in('status', ['unpaid', 'partial'])
      .gte('due_date', today.toISOString().split('T')[0])
      .lte('due_date', weekFromNow.toISOString().split('T')[0])
      .order('due_date', { ascending: true });
    if (error) throw error;
    return data;
  },

  async getSummary() {
    const { data, error } = await supabase
      .from('payables_summary')
      .select('*')
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async create(payable: Omit<Payable, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'status' | 'amount_paid' | 'is_reconciled'>) {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('payables')
      .insert({ ...payable, user_id: user.id })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Partial<Payable>) {
    const { data, error } = await supabase
      .from('payables')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async markPaid(id: string, paidDate?: string, transactionId?: string) {
    const { error } = await supabase.rpc('mark_payable_paid', {
      p_payable_id: id,
      p_paid_date: paidDate || new Date().toISOString().split('T')[0],
      p_transaction_id: transactionId || null,
    });
    if (error) throw error;
  },

  async recordPartialPayment(id: string, amount: number) {
    const { data: current, error: fetchError } = await supabase
      .from('payables')
      .select('amount_paid')
      .eq('id', id)
      .single();
    if (fetchError) throw fetchError;

    const { data, error } = await supabase
      .from('payables')
      .update({ amount_paid: (current?.amount_paid || 0) + amount })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('payables')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};

// ============================================
// FILING CABINET
// ============================================

export type DocumentCategory = 'receipt' | 'invoice' | 'contract' | 'certificate' | 'insurance' | 'warranty' | 'tax' | 'bank' | 'general';

export interface FiledDocument {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  file_type?: string;
  file_size?: number;
  storage_path: string;
  category: DocumentCategory;
  tags?: string[];
  document_date?: string;
  expiry_date?: string;
  vendor_name?: string;
  job_pack_id?: string;
  expense_id?: string;
  payable_id?: string;
  extracted_text?: string;
  tax_year?: string;
  created_at: string;
  updated_at: string;
}

export const filingService = {
  async getAll(category?: DocumentCategory) {
    let query = supabase
      .from('filed_documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async getByTaxYear(taxYear: string) {
    const { data, error } = await supabase
      .from('filed_documents')
      .select('*')
      .eq('tax_year', taxYear)
      .order('document_date', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getExpiring(days: number = 30) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    const { data, error } = await supabase
      .from('filed_documents')
      .select('*')
      .not('expiry_date', 'is', null)
      .gte('expiry_date', new Date().toISOString().split('T')[0])
      .lte('expiry_date', futureDate.toISOString().split('T')[0])
      .order('expiry_date', { ascending: true });
    if (error) throw error;
    return data;
  },

  async search(query: string, category?: DocumentCategory, taxYear?: string) {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase.rpc('search_filed_documents', {
      p_user_id: user.id,
      p_query: query,
      p_category: category || null,
      p_tax_year: taxYear || null,
    });
    if (error) throw error;
    return data;
  },

  async upload(file: File, metadata: {
    name: string;
    description?: string;
    category: DocumentCategory;
    tags?: string[];
    document_date?: string;
    expiry_date?: string;
    vendor_name?: string;
    job_pack_id?: string;
    tax_year?: string;
  }) {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Not authenticated');

    // Upload file to storage
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'file';
    const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('filed-documents')
      .upload(fileName, file);
    if (uploadError) throw uploadError;

    // Create document record
    const { data, error } = await supabase
      .from('filed_documents')
      .insert({
        user_id: user.id,
        name: metadata.name,
        description: metadata.description,
        file_type: fileExt,
        file_size: file.size,
        storage_path: fileName,
        category: metadata.category,
        tags: metadata.tags,
        document_date: metadata.document_date,
        expiry_date: metadata.expiry_date,
        vendor_name: metadata.vendor_name,
        job_pack_id: metadata.job_pack_id,
        tax_year: metadata.tax_year,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Partial<FiledDocument>) {
    const { data, error } = await supabase
      .from('filed_documents')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    // Get storage path first
    const { data: doc, error: fetchError } = await supabase
      .from('filed_documents')
      .select('storage_path')
      .eq('id', id)
      .single();
    if (fetchError) throw fetchError;

    // Delete from storage
    if (doc?.storage_path) {
      await supabase.storage.from('filed-documents').remove([doc.storage_path]);
    }

    // Delete record
    const { error } = await supabase
      .from('filed_documents')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async getDownloadUrl(storagePath: string) {
    const { data, error } = await supabase.storage
      .from('filed-documents')
      .createSignedUrl(storagePath, 3600); // 1 hour expiry
    if (error) throw error;
    return data.signedUrl;
  },

  async getSummary() {
    const { data, error } = await supabase
      .from('filing_summary')
      .select('*');
    if (error) throw error;
    return data;
  },
};


// ============================================
// EXPENSE CATEGORIES
// ============================================

export const expenseCategoriesService = {
  async getAll() {
    const { data, error } = await supabase
      .from('expense_categories')
      .select('*')
      .order('display_order');
    if (error) throw error;
    return data;
  },

  async create(category: { name: string; icon?: string; color?: string }) {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Not authenticated');

    // Get max display_order
    const { data: existing } = await supabase
      .from('expense_categories')
      .select('display_order')
      .eq('user_id', user.id)
      .order('display_order', { ascending: false })
      .limit(1);

    const maxOrder = existing?.[0]?.display_order || 0;

    const { data, error } = await supabase
      .from('expense_categories')
      .insert({
        user_id: user.id,
        name: category.name,
        icon: category.icon || 'tag',
        color: category.color || '#f59e0b',
        display_order: maxOrder + 1,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: { name?: string; icon?: string; color?: string; display_order?: number }) {
    const { data, error } = await supabase
      .from('expense_categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('expense_categories')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async reorder(categories: { id: string; display_order: number }[]) {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Not authenticated');

    for (const cat of categories) {
      await supabase
        .from('expense_categories')
        .update({ display_order: cat.display_order })
        .eq('id', cat.id)
        .eq('user_id', user.id);
    }
  },
};

// ============================================
// VENDOR KEYWORDS (Auto-categorization)
// ============================================

export const vendorKeywordsService = {
  async getAll() {
    const { data, error } = await supabase
      .from('vendor_keywords')
      .select()
      .order('match_count', { ascending: false });
    if (error) throw error;
    return data;
  },

  async findCategoryByVendor(vendorName: string) {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return null;

    const normalizedVendor = vendorName.toLowerCase().trim();

    const { data, error } = await supabase
      .from('vendor_keywords')
      .select()
      .eq('user_id', user.id);

    if (error || !data) return null;

    for (const keyword of data) {
      if (normalizedVendor.includes(keyword.keyword.toLowerCase())) {
        return keyword.category;
      }
    }

    return null;
  },

  async learnKeyword(vendorName: string, categoryId: string) {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Not authenticated');

    const keyword = vendorName.toLowerCase().trim().split(/s+/)[0];
    if (!keyword || keyword.length < 3) return;

    const { data: existing } = await supabase
      .from('vendor_keywords')
      .select('id, match_count')
      .eq('user_id', user.id)
      .eq('keyword', keyword)
      .single();

    if (existing) {
      await supabase
        .from('vendor_keywords')
        .update({
          category_id: categoryId,
          match_count: existing.match_count + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('vendor_keywords')
        .insert({
          user_id: user.id,
          keyword,
          category_id: categoryId,
          match_count: 1,
        });
    }
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('vendor_keywords')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async deleteByKeyword(keyword: string) {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('vendor_keywords')
      .delete()
      .eq('user_id', user.id)
      .eq('keyword', keyword.toLowerCase());
    if (error) throw error;
  },
};

// ============================================
// VENDORS (Auto-fill and history tracking)
// ============================================

export const vendorsService = {
  async getAll() {
    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .order('expense_count', { ascending: false });
    if (error) throw error;
    return data;
  },

  async search(query: string) {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return [];

    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .eq('user_id', user.id)
      .ilike('name', `%${query}%`)
      .order('expense_count', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Vendor search failed:', error);
      return [];
    }
    return data || [];
  },

  async getByName(name: string) {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return null;

    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .eq('user_id', user.id)
      .ilike('name', name)
      .single();

    if (error) return null;
    return data;
  },

  async getTopVendors(limit = 5) {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return [];

    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .eq('user_id', user.id)
      .order('total_spent', { ascending: false })
      .limit(limit);

    if (error) return [];
    return data || [];
  },

  async update(id: string, updates: { notes?: string; default_category?: string; default_payment_method?: string }) {
    const { data, error } = await supabase
      .from('vendors')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('vendors')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};
