// Invoice Template System
// Simplified to 2 professional templates optimized for one-page PDF output

export type InvoiceTemplate =
  | 'professional'  // Zoho-style professional invoice (default)
  | 'classic';      // Traditional compact layout

export type ColorScheme = 'default' | 'slate' | 'blue' | 'teal' | 'emerald' | 'purple' | 'rose';

export interface ColorSchemeConfig {
  id: ColorScheme;
  name: string;
  headerBg: string;        // Background for headers
  headerText: string;      // Text color for headers
  accentBg: string;        // Accent background
  accentText: string;      // Accent text color
  isDark?: boolean;        // Whether this is a dark color scheme
}

export const COLOR_SCHEMES: Record<ColorScheme, ColorSchemeConfig> = {
  default: {
    id: 'default',
    name: 'No Color (Dark)',
    headerBg: 'bg-slate-800',
    headerText: 'text-white',
    accentBg: 'bg-slate-100',
    accentText: 'text-slate-600',
    isDark: true,
  },
  slate: {
    id: 'slate',
    name: 'Classic Slate',
    headerBg: 'bg-slate-100',
    headerText: 'text-slate-700',
    accentBg: 'bg-slate-50',
    accentText: 'text-slate-600',
  },
  blue: {
    id: 'blue',
    name: 'Ocean Blue',
    headerBg: 'bg-blue-100',
    headerText: 'text-blue-700',
    accentBg: 'bg-blue-50',
    accentText: 'text-blue-600',
  },
  teal: {
    id: 'teal',
    name: 'Fresh Teal',
    headerBg: 'bg-teal-100',
    headerText: 'text-teal-700',
    accentBg: 'bg-teal-50',
    accentText: 'text-teal-600',
  },
  emerald: {
    id: 'emerald',
    name: 'Spring Emerald',
    headerBg: 'bg-emerald-100',
    headerText: 'text-emerald-700',
    accentBg: 'bg-emerald-50',
    accentText: 'text-emerald-600',
  },
  purple: {
    id: 'purple',
    name: 'Royal Purple',
    headerBg: 'bg-purple-100',
    headerText: 'text-purple-700',
    accentBg: 'bg-purple-50',
    accentText: 'text-purple-600',
  },
  rose: {
    id: 'rose',
    name: 'Soft Rose',
    headerBg: 'bg-rose-100',
    headerText: 'text-rose-700',
    accentBg: 'bg-rose-50',
    accentText: 'text-rose-600',
  },
};

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

  // Color scheme support
  supportsColorScheme?: boolean;  // Whether this template uses color schemes
  defaultColorScheme?: ColorScheme;
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
    supportsColorScheme: true,     // Now supports color schemes
    defaultColorScheme: 'default',  // Defaults to dark (no color)
  },

  // Template 2: Classic - Traditional compact layout
  classic: {
    id: 'classic',
    name: 'Classic',
    description: 'Traditional compact layout',
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
    containerPadding: 'p-2.5',
    containerBg: 'bg-white',
    headerPadding: 'p-0',
    rowPadding: 'py-1 px-1.5',
    sectionGap: 'space-y-1.5',
    fontSize: 'text-[9px]',
    headerFontSize: 'text-[11px]',
    borderRadius: 'rounded-none',
    supportsColorScheme: true,
    defaultColorScheme: 'default',
  },
};

// Helper to get template config with fallback
export const getTemplateConfig = (templateId?: InvoiceTemplate | string): TemplateConfig => {
  if (!templateId || !(templateId in INVOICE_TEMPLATES)) {
    return INVOICE_TEMPLATES['professional']; // Default to professional
  }
  return INVOICE_TEMPLATES[templateId as InvoiceTemplate];
};

// Helper to get color scheme config
export const getColorScheme = (colorSchemeId?: ColorScheme | string): ColorSchemeConfig => {
  if (!colorSchemeId || !(colorSchemeId in COLOR_SCHEMES)) {
    return COLOR_SCHEMES['default']; // Default to dark (no color)
  }
  return COLOR_SCHEMES[colorSchemeId as ColorScheme];
};

// Helper to build table header style with color scheme
export const getTableHeaderStyle = (
  template: TemplateConfig,
  colorScheme?: ColorScheme | string
): string => {
  // All templates now support color schemes
  const scheme = getColorScheme(colorScheme || template.defaultColorScheme);
  return `${scheme.headerBg} ${scheme.headerText} py-1.5 px-2 text-[10px] font-semibold`;
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
    desc: 'Zoho-style invoice',
    preview: '┌──────┐\n│░░ INV│\n│  £280│\n│══════│\n│#│Desc│\n│1│Item│\n│2│Item│\n│══════│\n└──────┘',
    recommended: true
  },
  {
    id: 'classic',
    name: 'Classic',
    desc: 'Traditional layout',
    preview: '┌─────────┐\n│ INVOICE │\n│─────────│\n│Desc│Amt│\n│Item│£10│\n│─────────│\n│Total £X │\n└─────────┘'
  },
];

// Template descriptions for preview panel
export const TEMPLATE_DESCRIPTIONS: Record<InvoiceTemplate, string> = {
  'professional': 'Clean, professional invoice format based on industry standards like Zoho and QuickBooks. Features a clear table layout with line numbers, proper spacing, and all essential details. Optimized to fit on one page for most jobs.',
  'classic': 'Traditional compact invoice format with straightforward layout. Clean and simple design that works well for standard jobs. Features all essential information in a traditional business format with customizable color schemes.',
};
