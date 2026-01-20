// Invoice Template System
// 8 distinct templates for professional PDF invoice/quote rendering

export type InvoiceTemplate =
  | 'classic'
  | 'trade-pro'
  | 'minimal'
  | 'detailed'
  | 'compact'
  | 'branded'
  | 'statement'
  | 'modern-card';

export interface TemplateConfig {
  id: InvoiceTemplate;
  name: string;
  description: string;

  // Layout structure
  combineLineItems: boolean;      // Materials + Labour in one table
  showSectionHeaders: boolean;    // Show "MATERIALS" / "LABOUR" headers
  showIcons: boolean;             // Show Package/HardHat icons
  showBackgrounds: boolean;       // Colored backgrounds in body
  showTableBorders: boolean;      // Table structure visible
  showColumnHeaders: boolean;     // Full table headers
  showLineNumbers: boolean;       // #1, #2, etc
  showPerLineVat: boolean;        // VAT column in table
  centeredLayout: boolean;        // Center-aligned layout
  inlineLayout: boolean;          // Everything on single lines

  // Logo
  logoPosition: 'left' | 'center' | 'right' | 'hidden';
  logoSize: 'small' | 'medium' | 'large';

  // Spacing (Tailwind classes)
  containerPadding: string;
  containerBg: string;
  headerPadding: string;
  rowPadding: string;
  sectionGap: string;

  // Typography
  fontSize: string;
  headerFontSize: string;

  // Borders/Rounding
  borderRadius: string;

  // Special styles
  sectionHeaderStyle?: string;
  tableHeaderStyle?: string;
  totalBoxStyle?: string;
  cardStyle?: string;
  dividerStyle?: string;
}

// Template definitions
export const INVOICE_TEMPLATES: Record<InvoiceTemplate, TemplateConfig> = {
  // Template 1: Classic - Traditional Business (Most Compact)
  classic: {
    id: 'classic',
    name: 'Classic',
    description: 'Single table, most compact',
    combineLineItems: true,
    showSectionHeaders: false,
    showIcons: false,
    showBackgrounds: false,
    showTableBorders: true,
    showColumnHeaders: true,
    showLineNumbers: false,
    showPerLineVat: false,
    centeredLayout: false,
    inlineLayout: false,
    logoPosition: 'left',
    logoSize: 'small',
    containerPadding: 'p-2',
    containerBg: 'bg-white',
    headerPadding: 'p-2',
    rowPadding: 'py-0.5 px-1',
    sectionGap: 'space-y-1',
    fontSize: 'text-[9px]',
    headerFontSize: 'text-xs',
    borderRadius: 'rounded-none',
    tableHeaderStyle: 'border-b border-slate-200 text-left text-[9px] uppercase text-slate-500 py-1',
  },

  // Template 2: Trade Pro - Materials/Labour Split
  'trade-pro': {
    id: 'trade-pro',
    name: 'Trade Pro',
    description: 'Clear materials/labour breakdown',
    combineLineItems: false,
    showSectionHeaders: true,
    showIcons: false,
    showBackgrounds: false,
    showTableBorders: false,
    showColumnHeaders: false,
    showLineNumbers: false,
    showPerLineVat: false,
    centeredLayout: false,
    inlineLayout: false,
    logoPosition: 'left',
    logoSize: 'small',
    containerPadding: 'p-2',
    containerBg: 'bg-white',
    headerPadding: 'p-2',
    rowPadding: 'py-0.5 px-0',
    sectionGap: 'space-y-1',
    fontSize: 'text-[10px]',
    headerFontSize: 'text-sm',
    borderRadius: 'rounded-lg',
    sectionHeaderStyle: 'text-[8px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-0.5 mb-1',
  },

  // Template 3: Minimal - Modern/Clean
  minimal: {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean, typography-focused',
    combineLineItems: true,
    showSectionHeaders: false,
    showIcons: false,
    showBackgrounds: false,
    showTableBorders: false,
    showColumnHeaders: false,
    showLineNumbers: false,
    showPerLineVat: false,
    centeredLayout: false,
    inlineLayout: false,
    logoPosition: 'hidden',
    logoSize: 'small',
    containerPadding: 'p-2',
    containerBg: 'bg-white',
    headerPadding: 'p-2',
    rowPadding: 'py-0.5',
    sectionGap: 'space-y-1',
    fontSize: 'text-[11px]',
    headerFontSize: 'text-base',
    borderRadius: 'rounded-none',
    dividerStyle: 'border-b border-slate-200 my-4',
  },

  // Template 4: Detailed - Full Breakdown
  detailed: {
    id: 'detailed',
    name: 'Detailed',
    description: 'Full breakdown with columns',
    combineLineItems: false,
    showSectionHeaders: true,
    showIcons: false,
    showBackgrounds: true,
    showTableBorders: true,
    showColumnHeaders: true,
    showLineNumbers: false,
    showPerLineVat: true,
    centeredLayout: false,
    inlineLayout: false,
    logoPosition: 'left',
    logoSize: 'medium',
    containerPadding: 'p-2',
    containerBg: 'bg-white',
    headerPadding: 'p-2',
    rowPadding: 'py-0.5 px-1',
    sectionGap: 'space-y-1',
    fontSize: 'text-[9px]',
    headerFontSize: 'text-sm',
    borderRadius: 'rounded-lg',
    sectionHeaderStyle: 'bg-slate-100 border border-slate-200 px-2 py-0.5 font-bold text-[8px] uppercase tracking-wider',
    tableHeaderStyle: 'bg-slate-50 border border-slate-100 text-[8px]',
  },

  // Template 5: Compact - One-Page Guarantee
  compact: {
    id: 'compact',
    name: 'Compact',
    description: 'Ultra-compact, one-page guarantee',
    combineLineItems: true,
    showSectionHeaders: false,
    showIcons: false,
    showBackgrounds: false,
    showTableBorders: false,
    showColumnHeaders: false,
    showLineNumbers: false,
    showPerLineVat: false,
    centeredLayout: false,
    inlineLayout: true,
    logoPosition: 'hidden',
    logoSize: 'small',
    containerPadding: 'p-2',
    containerBg: 'bg-white',
    headerPadding: 'p-2',
    rowPadding: 'py-0.5',
    sectionGap: 'space-y-0.5',
    fontSize: 'text-[9px]',
    headerFontSize: 'text-xs',
    borderRadius: 'rounded-none',
  },

  // Template 6: Branded - Logo-Focused
  branded: {
    id: 'branded',
    name: 'Branded',
    description: 'Large logo, brand-focused',
    combineLineItems: true,
    showSectionHeaders: false,
    showIcons: false,
    showBackgrounds: false,
    showTableBorders: false,
    showColumnHeaders: false,
    showLineNumbers: false,
    showPerLineVat: false,
    centeredLayout: true,
    inlineLayout: false,
    logoPosition: 'center',
    logoSize: 'large',
    containerPadding: 'p-2',
    containerBg: 'bg-white',
    headerPadding: 'p-2',
    rowPadding: 'py-0.5',
    sectionGap: 'space-y-1',
    fontSize: 'text-[10px]',
    headerFontSize: 'text-base',
    borderRadius: 'rounded-xl',
    totalBoxStyle: 'bg-slate-900 text-white p-3 rounded-xl text-center',
  },

  // Template 7: Statement - Zoho/QuickBooks Style
  statement: {
    id: 'statement',
    name: 'Statement',
    description: 'Zoho/QuickBooks style',
    combineLineItems: true,
    showSectionHeaders: false,
    showIcons: false,
    showBackgrounds: false,
    showTableBorders: true,
    showColumnHeaders: true,
    showLineNumbers: true,
    showPerLineVat: false,
    centeredLayout: false,
    inlineLayout: false,
    logoPosition: 'left',
    logoSize: 'small',
    containerPadding: 'p-2',
    containerBg: 'bg-white',
    headerPadding: 'p-2',
    rowPadding: 'py-0.5 px-1',
    sectionGap: 'space-y-1',
    fontSize: 'text-[9px]',
    headerFontSize: 'text-xs',
    borderRadius: 'rounded-lg',
    tableHeaderStyle: 'bg-slate-800 text-white py-1.5 px-2 text-[9px]',
  },

  // Template 8: Modern Card - Current Style Optimised
  'modern-card': {
    id: 'modern-card',
    name: 'Modern Card',
    description: 'Card-based app style',
    combineLineItems: false,
    showSectionHeaders: true,
    showIcons: true,
    showBackgrounds: true,
    showTableBorders: false,
    showColumnHeaders: false,
    showLineNumbers: false,
    showPerLineVat: false,
    centeredLayout: false,
    inlineLayout: false,
    logoPosition: 'left',
    logoSize: 'small',
    containerPadding: 'p-2',
    containerBg: 'bg-slate-50',
    headerPadding: 'p-2',
    rowPadding: 'py-0.5',
    sectionGap: 'space-y-1',
    fontSize: 'text-[10px]',
    headerFontSize: 'text-sm',
    borderRadius: 'rounded-xl',
    cardStyle: 'bg-white rounded-lg shadow-sm p-2',
  },
};

// Helper to get template config with fallback
export const getTemplateConfig = (templateId?: InvoiceTemplate | string): TemplateConfig => {
  if (!templateId || !(templateId in INVOICE_TEMPLATES)) {
    return INVOICE_TEMPLATES['trade-pro']; // Default to trade-pro
  }
  return INVOICE_TEMPLATES[templateId as InvoiceTemplate];
};

// Template metadata for settings UI
export interface TemplateMetadata {
  id: InvoiceTemplate;
  name: string;
  desc: string;
  preview: string;
  recommended?: boolean;
}

export const TEMPLATE_METADATA: TemplateMetadata[] = [
  {
    id: 'classic',
    name: 'Classic',
    desc: 'Single table, most compact',
    preview: '┌──────┐\n│░░░░░░│\n│══════│\n│──────│\n│──────│\n│══════│\n└──────┘'
  },
  {
    id: 'trade-pro',
    name: 'Trade Pro',
    desc: 'Materials/Labour split',
    preview: '┌──────┐\n│░░░░░░│\n├──────┤\n│MAT   │\n│──────│\n│LAB   │\n│══════│\n└──────┘',
    recommended: true
  },
  {
    id: 'minimal',
    name: 'Minimal',
    desc: 'Clean, modern',
    preview: '┌──────┐\n│      │\n│──────│\n│ Item │\n│ Item │\n│──────│\n│Total │\n└──────┘'
  },
  {
    id: 'detailed',
    name: 'Detailed',
    desc: 'Full breakdown',
    preview: '┌──────┐\n│░░▓▓░░│\n├──────┤\n│Q│D│R│T│\n│─┼─┼─┼─│\n│Q│D│R│T│\n│══════│\n└──────┘'
  },
  {
    id: 'compact',
    name: 'Compact',
    desc: 'One-page guarantee',
    preview: '┌────────────┐\n│Co│INV│Date│\n│Item×3 £X   │\n│S+V-C=TOTAL │\n└────────────┘'
  },
  {
    id: 'branded',
    name: 'Branded',
    desc: 'Large logo focus',
    preview: '┌──────┐\n│      │\n│[LOGO]│\n│      │\n│──────│\n│▓▓▓▓▓▓│\n└──────┘'
  },
  {
    id: 'statement',
    name: 'Statement',
    desc: 'Zoho-style familiar',
    preview: '┌──────┐\n│░░  IN│\n│░░VOIC│\n│══════│\n│#│Desc│\n│─┼────│\n│══════│\n└──────┘'
  },
  {
    id: 'modern-card',
    name: 'Modern Card',
    desc: 'App-style cards',
    preview: '┌──────┐\n│┌────┐│\n││Card││\n│└────┘│\n│┌────┐│\n││Card││\n│└────┘│\n└──────┘'
  },
];

// Template descriptions for preview panel
export const TEMPLATE_DESCRIPTIONS: Record<InvoiceTemplate, string> = {
  'classic': 'Traditional single-table layout. All items (materials and labour) in one table. Most compact option - ideal for professional B2B invoices.',
  'trade-pro': 'Separates materials and labour into distinct sections. Clear breakdown that tradespeople and customers both appreciate. Recommended for most trades.',
  'minimal': 'Typography-focused with intentional white space. No tables or boxes - just clean text. Modern and elegant.',
  'detailed': 'Full breakdown with column headers, unit prices, and per-line VAT. Best for large jobs with multiple sections.',
  'compact': 'Ultra-compact receipt-style layout. Guaranteed to fit on one page. Perfect for quick jobs and call-outs.',
  'branded': 'Large centered logo with prominent branding. Less detail, more visual impact. Great for customer-facing documents.',
  'statement': 'Familiar Zoho/QuickBooks style. Generic business invoice that customers instantly recognise.',
  'modern-card': 'Card-based layout with subtle shadows. App-style feel with materials and labour in separate cards.',
};
