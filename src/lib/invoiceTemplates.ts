// Invoice Template System
// Simplified to 2 professional templates optimized for one-page PDF output

export type InvoiceTemplate =
  | 'professional'  // Zoho-style professional invoice (default)
  | 'compact';      // Ultra-minimal, guaranteed one-page

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

// Template definitions - Optimized for one-page PDF output
export const INVOICE_TEMPLATES: Record<InvoiceTemplate, TemplateConfig> = {
  // Template 1: Professional - Zoho-style invoice (matches real-world example)
  professional: {
    id: 'professional',
    name: 'Professional',
    description: 'Clean professional invoice',
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
    containerPadding: 'p-3',
    containerBg: 'bg-white',
    headerPadding: 'p-0',
    rowPadding: 'py-1 px-2',
    sectionGap: 'space-y-2',
    fontSize: 'text-[10px]',
    headerFontSize: 'text-sm',
    borderRadius: 'rounded-none',
    tableHeaderStyle: 'bg-slate-800 text-white py-1.5 px-2 text-[10px] font-semibold',
  },

  // Template 2: Compact - Ultra-minimal, guaranteed one-page
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
    headerPadding: 'p-0',
    rowPadding: 'py-0.5',
    sectionGap: 'space-y-0.5',
    fontSize: 'text-[8px]',
    headerFontSize: 'text-[10px]',
    borderRadius: 'rounded-none',
  },
};

// Helper to get template config with fallback
export const getTemplateConfig = (templateId?: InvoiceTemplate | string): TemplateConfig => {
  if (!templateId || !(templateId in INVOICE_TEMPLATES)) {
    return INVOICE_TEMPLATES['professional']; // Default to professional
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
    id: 'professional',
    name: 'Professional',
    desc: 'Clean professional invoice',
    preview: '┌──────┐\n│░░ INV│\n│  £280│\n│══════│\n│#│Desc│\n│1│Item│\n│2│Item│\n│══════│\n└──────┘',
    recommended: true
  },
  {
    id: 'compact',
    name: 'Compact',
    desc: 'Ultra-minimal layout',
    preview: '┌──────────┐\n│Co│IN│Date│\n│Item×3 £X │\n│S+V-C=TOT │\n└──────────┘'
  },
];

// Template descriptions for preview panel
export const TEMPLATE_DESCRIPTIONS: Record<InvoiceTemplate, string> = {
  'professional': 'Clean, professional invoice format based on industry standards like Zoho and QuickBooks. Features a clear table layout with line numbers, proper spacing, and all essential details. Optimized to fit on one page for most jobs.',
  'compact': 'Ultra-compact receipt-style layout with minimal spacing. Guaranteed to fit on one page even for jobs with many line items. Perfect for quick jobs, call-outs, and when you need maximum information density.',
};
