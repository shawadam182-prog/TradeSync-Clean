import type {
  Customer,
  Quote,
  QuoteSection,
  QuoteDisplayOptions,
  MaterialItem,
  LabourItem,
  JobPack,
  SiteNote,
  SitePhoto,
  SiteDocument,
  Expense,
  AppSettings,
  SubscriptionTier,
  SubscriptionStatus,
  UsageLimits,
  TIER_LIMITS,
} from '../../types';

// Counter for generating unique IDs
let idCounter = 0;

function generateId(prefix = 'test'): string {
  return `${prefix}-${++idCounter}`;
}

// Reset ID counter between test runs
export function resetIdCounter(): void {
  idCounter = 0;
}

// ============================================
// CUSTOMER FACTORY
// ============================================

export function createMockCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: generateId('cust'),
    name: 'John Smith',
    email: 'john.smith@example.com',
    phone: '07700 900123',
    address: '123 Test Street, London, SW1A 1AA',
    company: undefined,
    ...overrides,
  };
}

// ============================================
// QUOTE FACTORIES
// ============================================

export function createMockMaterialItem(overrides: Partial<MaterialItem> = {}): MaterialItem {
  return {
    id: generateId('mat'),
    name: 'Test Material',
    description: '',
    quantity: 1,
    unit: 'ea',
    unitPrice: 10,
    totalPrice: 10,
    isAIProposed: false,
    isHeading: false,
    ...overrides,
  };
}

export function createMockLabourItem(overrides: Partial<LabourItem> = {}): LabourItem {
  return {
    id: generateId('lab'),
    description: 'Test Labour',
    hours: 1,
    rate: undefined,
    ...overrides,
  };
}

export function createMockQuoteSection(overrides: Partial<QuoteSection> = {}): QuoteSection {
  return {
    id: generateId('sec'),
    title: 'Test Section',
    items: [],
    labourHours: 0,
    labourRate: undefined,
    labourCost: undefined,
    labourItems: undefined,
    subsectionPrice: undefined,
    ...overrides,
  };
}

export const defaultDisplayOptions: QuoteDisplayOptions = {
  showMaterials: true,
  showMaterialItems: true,
  showMaterialQty: true,
  showMaterialUnitPrice: true,
  showMaterialLineTotals: true,
  showMaterialSectionTotal: true,
  showLabour: true,
  showLabourItems: true,
  showLabourQty: true,
  showLabourUnitPrice: true,
  showLabourLineTotals: true,
  showLabourSectionTotal: true,
  showVat: true,
  showCis: true,
  showNotes: true,
  showLogo: true,
  showTotalsBreakdown: true,
};

export function createMockDisplayOptions(
  overrides: Partial<QuoteDisplayOptions> = {}
): QuoteDisplayOptions {
  return { ...defaultDisplayOptions, ...overrides };
}

export function createMockQuote(overrides: Partial<Quote> = {}): Quote {
  const now = new Date().toISOString();
  const dateStr = now.split('T')[0];

  return {
    id: generateId('quote'),
    customerId: generateId('cust'),
    projectId: undefined,
    date: dateStr,
    createdAt: now,
    updatedAt: now,
    title: 'Test Quote',
    jobAddress: undefined,
    sections: [],
    labourRate: 50,
    markupPercent: 0,
    taxPercent: 20,
    cisPercent: 20,
    status: 'draft',
    notes: '',
    type: 'quotation',
    displayOptions: defaultDisplayOptions,
    referenceNumber: undefined,
    discountType: undefined,
    discountValue: undefined,
    discountDescription: undefined,
    dueDate: undefined,
    paymentDate: undefined,
    paymentMethod: undefined,
    amountPaid: undefined,
    parentQuoteId: undefined,
    partPaymentEnabled: undefined,
    partPaymentType: undefined,
    partPaymentValue: undefined,
    partPaymentLabel: undefined,
    ...overrides,
  };
}

// Create a quote with sections and items pre-populated
export function createMockQuoteWithData(overrides: Partial<Quote> = {}): Quote {
  return createMockQuote({
    sections: [
      createMockQuoteSection({
        title: 'Materials & Labour',
        items: [
          createMockMaterialItem({ name: 'Timber', quantity: 10, unitPrice: 5, totalPrice: 50 }),
          createMockMaterialItem({ name: 'Screws', quantity: 100, unitPrice: 0.1, totalPrice: 10 }),
        ],
        labourHours: 8,
      }),
    ],
    ...overrides,
  });
}

// Create an invoice (quote with type='invoice')
export function createMockInvoice(overrides: Partial<Quote> = {}): Quote {
  const now = new Date().toISOString();
  const dateStr = now.split('T')[0];
  const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  return createMockQuote({
    type: 'invoice',
    status: 'sent',
    dueDate,
    referenceNumber: 1001,
    ...overrides,
  });
}

// ============================================
// JOBPACK FACTORIES
// ============================================

export function createMockSiteNote(overrides: Partial<SiteNote> = {}): SiteNote {
  return {
    id: generateId('note'),
    text: 'Test note content',
    timestamp: new Date().toISOString(),
    isVoice: false,
    ...overrides,
  };
}

export function createMockSitePhoto(overrides: Partial<SitePhoto> = {}): SitePhoto {
  return {
    id: generateId('photo'),
    url: 'https://storage.example.com/photos/test.jpg',
    caption: 'Test photo',
    timestamp: new Date().toISOString(),
    tags: [],
    ...overrides,
  };
}

export function createMockSiteDocument(overrides: Partial<SiteDocument> = {}): SiteDocument {
  return {
    id: generateId('doc'),
    name: 'Test Document.pdf',
    url: 'https://storage.example.com/documents/test.pdf',
    type: 'application/pdf',
    summary: undefined,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockJobPack(overrides: Partial<JobPack> = {}): JobPack {
  const now = new Date().toISOString();

  return {
    id: generateId('job'),
    title: 'Test Job Pack',
    customerId: generateId('cust'),
    status: 'active',
    createdAt: now,
    updatedAt: now,
    notes: [],
    notepad: undefined,
    photos: [],
    drawings: undefined,
    documents: [],
    materials: undefined,
    ...overrides,
  };
}

// Create a job pack with some content pre-populated
export function createMockJobPackWithData(overrides: Partial<JobPack> = {}): JobPack {
  return createMockJobPack({
    notes: [
      createMockSiteNote({ text: 'Initial site visit completed' }),
      createMockSiteNote({ text: 'Customer approved design', isVoice: true }),
    ],
    photos: [
      createMockSitePhoto({ caption: 'Front entrance', tags: ['exterior'] }),
      createMockSitePhoto({ caption: 'Kitchen area', tags: ['interior', 'kitchen'] }),
    ],
    documents: [
      createMockSiteDocument({ name: 'Building Plans.pdf' }),
    ],
    ...overrides,
  });
}

// ============================================
// EXPENSE FACTORY
// ============================================

export function createMockExpense(overrides: Partial<Expense> = {}): Expense {
  const now = new Date().toISOString();
  const dateStr = now.split('T')[0];

  return {
    id: generateId('exp'),
    jobPackId: null,
    vendor: 'Test Supplier Ltd',
    description: 'Test expense',
    amount: 100,
    vatAmount: 20,
    category: 'materials',
    receiptStoragePath: null,
    receiptExtractedText: null,
    expenseDate: dateStr,
    isReconciled: false,
    reconciledTransactionId: null,
    paymentMethod: 'card',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// Create expenses for different categories
export function createMockMaterialsExpense(overrides: Partial<Expense> = {}): Expense {
  return createMockExpense({
    vendor: 'Builders Merchant',
    description: 'Timber and fixings',
    category: 'materials',
    amount: 250,
    vatAmount: 50,
    ...overrides,
  });
}

export function createMockFuelExpense(overrides: Partial<Expense> = {}): Expense {
  return createMockExpense({
    vendor: 'Shell',
    description: 'Diesel for van',
    category: 'fuel',
    amount: 80,
    vatAmount: 13.33,
    paymentMethod: 'card',
    ...overrides,
  });
}

export function createMockToolsExpense(overrides: Partial<Expense> = {}): Expense {
  return createMockExpense({
    vendor: 'Screwfix',
    description: 'Power drill',
    category: 'tools',
    amount: 150,
    vatAmount: 25,
    ...overrides,
  });
}

// ============================================
// SETTINGS FACTORY
// ============================================

export function createMockUsageLimits(overrides: Partial<UsageLimits> = {}): UsageLimits {
  return {
    customers: 5,
    jobPacks: 3,
    quotes: 3,
    invoices: 3,
    photosPerMonth: 20,
    documentsPerMonth: 5,
    ...overrides,
  };
}

export function createMockSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    defaultLabourRate: 50,
    defaultTaxRate: 20,
    defaultCisRate: 20,
    companyName: 'Test Trade Co',
    companyLogo: undefined,
    companyLogoPath: undefined,
    footerLogos: undefined,
    companyAddress: '123 Workshop Lane, London, SW1A 1AA',
    phone: '07700 900456',
    email: 'info@testtrade.co.uk',
    vatNumber: undefined,
    isVatRegistered: false,
    enableVat: true,
    enableCis: false,
    quotePrefix: 'Q-',
    invoicePrefix: 'INV-',
    defaultQuoteNotes: 'Thank you for your business.',
    defaultInvoiceNotes: 'Payment due within 30 days.',
    costBoxColor: 'slate',
    showBreakdown: true,
    defaultDisplayOptions: defaultDisplayOptions,
    documentTemplate: 'classic',
    taxYearStartMonth: 4,
    taxYearStartDay: 6,
    // Subscription fields - default to free tier
    subscriptionTier: 'free',
    subscriptionStatus: 'active',
    trialStart: undefined,
    trialEnd: undefined,
    subscriptionStart: undefined,
    subscriptionEnd: undefined,
    subscriptionPeriodEnd: undefined,
    stripeCustomerId: undefined,
    stripeSubscriptionId: undefined,
    referralCode: undefined,
    usageLimits: createMockUsageLimits(),
    ...overrides,
  };
}

// Create settings for specific subscription tiers
export function createMockSettingsForTier(
  tier: SubscriptionTier,
  overrides: Partial<AppSettings> = {}
): AppSettings {
  const now = new Date();
  const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const tierLimits: Record<SubscriptionTier, UsageLimits> = {
    free: {
      customers: 5,
      jobPacks: 3,
      quotes: 3,
      invoices: 3,
      photosPerMonth: 20,
      documentsPerMonth: 5,
    },
    professional: {
      customers: null,
      jobPacks: null,
      quotes: null,
      invoices: null,
      photosPerMonth: 100,
      documentsPerMonth: 50,
    },
    business: {
      customers: null,
      jobPacks: null,
      quotes: null,
      invoices: null,
      photosPerMonth: null,
      documentsPerMonth: null,
    },
  };

  return createMockSettings({
    subscriptionTier: tier,
    subscriptionStatus: 'active',
    subscriptionStart: now.toISOString(),
    subscriptionPeriodEnd: periodEnd.toISOString(),
    stripeCustomerId: tier !== 'free' ? 'cus_test123' : undefined,
    stripeSubscriptionId: tier !== 'free' ? 'sub_test123' : undefined,
    usageLimits: tierLimits[tier],
    ...overrides,
  });
}

// Create settings for a trialing user
// Default: business tier (full access during trial) with 14 days remaining
export function createMockSettingsTrialing(
  tier: SubscriptionTier = 'business',
  daysRemaining: number = 14,
  overrides: Partial<AppSettings> = {}
): AppSettings {
  const now = new Date();
  const trialStart = new Date(now.getTime() - (14 - daysRemaining) * 24 * 60 * 60 * 1000);
  const trialEnd = new Date(now.getTime() + daysRemaining * 24 * 60 * 60 * 1000);

  return createMockSettingsForTier(tier, {
    subscriptionStatus: 'trialing',
    trialStart: trialStart.toISOString(),
    trialEnd: trialEnd.toISOString(),
    ...overrides,
  });
}

// Create settings for an expired/past_due subscription
export function createMockSettingsExpired(
  previousTier: SubscriptionTier = 'professional',
  overrides: Partial<AppSettings> = {}
): AppSettings {
  const now = new Date();
  const expiredDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  return createMockSettings({
    subscriptionTier: previousTier,
    subscriptionStatus: 'expired',
    subscriptionEnd: expiredDate.toISOString(),
    subscriptionPeriodEnd: expiredDate.toISOString(),
    stripeCustomerId: 'cus_test123',
    stripeSubscriptionId: 'sub_test123',
    usageLimits: createMockUsageLimits(), // Falls back to free limits
    ...overrides,
  });
}
