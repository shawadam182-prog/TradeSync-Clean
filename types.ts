
export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  company?: string;
}

export interface MaterialItem {
  id: string;
  name: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  isAIProposed?: boolean;
}

export interface QuoteSection {
  id: string;
  title: string;
  items: MaterialItem[];
  labourHours: number;
  labourRate?: number; // Optional override per section
}

export interface QuoteDisplayOptions {
  // Materials Presentation
  showMaterials: boolean;
  showMaterialItems: boolean; // Detail vs Summary
  showMaterialQty: boolean;
  showMaterialUnitPrice: boolean;
  showMaterialLineTotals: boolean;
  showMaterialSectionTotal: boolean;

  // Labour Presentation
  showLabour: boolean;
  showLabourItems: boolean; // Detail vs Summary
  showLabourQty: boolean;
  showLabourUnitPrice: boolean;
  showLabourLineTotals: boolean;
  showLabourSectionTotal: boolean;

  // General & Tax
  showVat: boolean;
  showCis: boolean;
  showNotes: boolean;
  showLogo: boolean;
  showTotalsBreakdown: boolean;
}

export interface Quote {
  id: string;
  customerId: string;
  projectId?: string; 
  date: string;
  updatedAt: string;
  title: string; // The overall document title
  sections: QuoteSection[];
  labourRate: number; // Default document rate
  markupPercent: number;
  taxPercent: number;
  cisPercent: number;
  status: 'draft' | 'sent' | 'accepted' | 'declined' | 'invoiced' | 'paid';
  notes: string;
  type: 'estimate' | 'quotation' | 'invoice';
  displayOptions?: QuoteDisplayOptions;
  referenceNumber?: number;
}

export interface ScheduleEntry {
  id: string;
  title: string;
  start: string; 
  end: string;   
  description?: string;
  projectId?: string;
  customerId?: string;
  location?: string;
}

export interface SiteNote {
  id: string;
  text: string;
  timestamp: string;
  isVoice?: boolean;
}

export interface SitePhoto {
  id: string;
  url: string; 
  caption: string;
  timestamp: string;
  tags: string[];
}

export interface SiteDocument {
  id: string;
  name: string;
  url: string;
  type: string;
  summary?: string;
  timestamp: string;
}

export interface ProjectMaterial {
  id: string;
  name: string;
  unit: string;
  quotedQty: number;
  orderedQty: number;
  deliveredQty: number;
  usedQty: number;
  status: 'pending' | 'ordered' | 'delivered' | 'partially_delivered';
}

export interface JobPack {
  id: string;
  title: string;
  customerId: string;
  status: 'active' | 'completed' | 'archived';
  createdAt: string;
  updatedAt: string;
  notes: SiteNote[];
  notepad?: string;
  photos: SitePhoto[];
  drawings?: SitePhoto[];
  documents: SiteDocument[];
  materials?: ProjectMaterial[];
}

export interface AppSettings {
  defaultLabourRate: number;
  defaultTaxRate: number;
  defaultCisRate: number;
  companyName: string;
  companyLogo?: string;
  footerLogos?: string[]; 
  companyAddress: string;
  vatNumber?: string;
  isVatRegistered: boolean;
  enableVat: boolean;
  enableCis: boolean;
  quotePrefix: string;
  invoicePrefix: string;
  defaultQuoteNotes: string;
  defaultInvoiceNotes: string;
  costBoxColor: 'slate' | 'amber' | 'blue';
  showBreakdown: boolean;
  defaultDisplayOptions: QuoteDisplayOptions;
}

export interface Expense {
  id: string;
  jobPackId?: string;
  vendor: string;
  description?: string;
  amount: number;
  vatAmount: number;
  category: 'materials' | 'tools' | 'fuel' | 'subcontractor' | 'office' | 'insurance' | 'other';
  receiptStoragePath?: string;
  receiptExtractedText?: string;
  expenseDate: string;
  isReconciled: boolean;
  reconciledTransactionId?: string;
  paymentMethod: 'card' | 'cash' | 'bank_transfer' | 'cheque';
  createdAt: string;
  updatedAt: string;
}

export interface BankTransaction {
  id: string;
  transactionDate: string;
  description: string;
  amount: number;
  balance?: number;
  reference?: string;
  transactionType?: string;
  isReconciled: boolean;
  reconciledExpenseId?: string;
  reconciledInvoiceId?: string;
  importBatchId?: string;
  bankName?: string;
  accountLastFour?: string;
  createdAt: string;
}

// ============================================
// DATABASE SCHEMA TYPES (snake_case)
// Used by components that work with raw DB data
// ============================================

export interface DBExpense {
  id: string;
  user_id: string;
  job_pack_id?: string;
  vendor: string;
  description?: string;
  amount: number;
  vat_amount: number;
  category: string;
  receipt_storage_path?: string;
  receipt_extracted_text?: string;
  expense_date: string;
  is_reconciled: boolean;
  reconciled_transaction_id?: string;
  payment_method: string;
  created_at: string;
  updated_at: string;
  job_pack?: { id: string; title: string } | null;
}

export interface DBBankTransaction {
  id: string;
  user_id: string;
  transaction_date: string;
  description: string;
  amount: number;
  balance?: number;
  reference?: string;
  transaction_type?: string;
  is_reconciled: boolean;
  reconciled_expense_id?: string;
  reconciled_invoice_id?: string;
  import_batch_id?: string;
  bank_name?: string;
  account_last_four?: string;
  created_at: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  display_order: number;
  is_default: boolean;
}

export interface Vendor {
  id: string;
  name: string;
  default_category?: string | null;
  default_payment_method?: string | null;
  total_spent?: number;
  expense_count?: number;
  last_expense_date?: string | null;
}

export interface Payable {
  id: string;
  user_id: string;
  vendor_name: string;
  invoice_number?: string;
  description?: string;
  amount: number;
  vat_amount: number;
  amount_paid: number;
  status: 'unpaid' | 'partial' | 'paid' | 'overdue' | 'disputed';
  invoice_date?: string;
  due_date?: string;
  paid_date?: string;
  category?: string;
  notes?: string;
  attachment_path?: string;
  created_at: string;
  updated_at: string;
}

export type DocumentCategory = 'receipt' | 'invoice' | 'contract' | 'certificate' | 'insurance' | 'warranty' | 'tax' | 'bank' | 'general';

export interface FiledDocument {
  id: string;
  user_id: string;
  name: string;
  storage_path: string;
  file_type?: string;
  file_size?: number;
  category: DocumentCategory;
  description?: string;
  document_date?: string;
  expiry_date?: string;
  vendor_name?: string;
  tax_year?: string;
  created_at: string;
  updated_at: string;
}

export interface QuarterSummary {
  quarter: string;
  label: string;
  inputVat: number;
  outputVat: number;
  netVat: number;
  expenseCount: number;
  invoiceCount: number;
}
