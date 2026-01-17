import type { Quote, QuoteSection, QuoteDisplayOptions, AppSettings } from '../../types';

export interface QuoteTotals {
  materialsTotal: number;
  labourTotal: number;
  sectionsTotal: number;
  clientSubtotal: number;
  discountAmount: number;
  afterDiscount: number;
  taxAmount: number;
  cisAmount: number;
  grandTotal: number;
}

export interface CalculationOptions {
  enableVat: boolean;
  enableCis: boolean;
  showVat: boolean;
  showCis: boolean;
  defaultLabourRate: number;
}

/**
 * Calculate labour cost for a single section.
 * Supports itemized labour (labourItems array), direct cost (labourCost),
 * or hours-based calculation (labourHours * rate).
 */
export function calculateSectionLabour(
  section: QuoteSection,
  quoteLabourRate: number,
  defaultLabourRate: number
): number {
  const effectiveRate = section.labourRate ?? quoteLabourRate ?? defaultLabourRate;

  // Itemized labour takes priority
  if (section.labourItems && section.labourItems.length > 0) {
    return section.labourItems.reduce((sum, item) => {
      const rate = item.rate ?? effectiveRate;
      return sum + (item.hours * rate);
    }, 0);
  }

  // Direct labour cost override
  if (section.labourCost !== undefined) {
    return section.labourCost;
  }

  // Hours-based calculation
  return (section.labourHours || 0) * effectiveRate;
}

/**
 * Calculate materials total for a section.
 * Excludes heading items from the total.
 */
export function calculateSectionMaterials(section: QuoteSection): number {
  return (section.items || [])
    .filter(item => !item.isHeading)
    .reduce((sum, item) => sum + (item.totalPrice || 0), 0);
}

/**
 * Calculate the effective price for a section.
 * Uses subsectionPrice override if set, otherwise materials + labour.
 */
export function calculateSectionPrice(
  section: QuoteSection,
  materialsTotal: number,
  labourTotal: number
): number {
  if (section.subsectionPrice !== undefined) {
    return section.subsectionPrice;
  }
  return materialsTotal + labourTotal;
}

/**
 * Calculate discount amount based on type and value.
 */
export function calculateDiscount(
  subtotal: number,
  discountType: 'percentage' | 'fixed' | undefined,
  discountValue: number | undefined
): number {
  if (!discountValue) {
    return 0;
  }

  if (discountType === 'percentage') {
    return subtotal * (discountValue / 100);
  }

  // Fixed discount
  return discountValue;
}

/**
 * Calculate VAT amount.
 */
export function calculateVat(
  afterDiscount: number,
  taxPercent: number,
  options: { enableVat: boolean; showVat: boolean }
): number {
  if (!options.enableVat || !options.showVat) {
    return 0;
  }
  return afterDiscount * ((taxPercent || 0) / 100);
}

/**
 * Calculate CIS deduction.
 * CIS is calculated on labour only, not materials.
 */
export function calculateCis(
  labourTotal: number,
  cisPercent: number,
  options: { enableCis: boolean; showCis: boolean }
): number {
  if (!options.enableCis || !options.showCis) {
    return 0;
  }
  return labourTotal * ((cisPercent || 0) / 100);
}

/**
 * Calculate part payment amount.
 */
export function calculatePartPayment(
  grandTotal: number,
  enabled: boolean | undefined,
  type: 'percentage' | 'fixed' | undefined,
  value: number | undefined
): number {
  if (!enabled || !value) {
    return 0;
  }

  if (type === 'percentage') {
    return grandTotal * (value / 100);
  }

  return value;
}

/**
 * Calculate all quote totals.
 * This is the main calculation function that combines all the individual calculations.
 */
export function calculateQuoteTotals(
  quote: Quote,
  options: CalculationOptions,
  displayOptions: QuoteDisplayOptions
): QuoteTotals {
  const sections = quote.sections || [];
  const markupMultiplier = 1 + ((quote.markupPercent || 0) / 100);

  let materialsTotal = 0;
  let labourTotal = 0;
  let sectionsTotal = 0;

  sections.forEach(section => {
    const sectionMaterials = calculateSectionMaterials(section);
    const sectionLabour = calculateSectionLabour(
      section,
      quote.labourRate,
      options.defaultLabourRate
    );
    const sectionPrice = calculateSectionPrice(section, sectionMaterials, sectionLabour);

    materialsTotal += sectionMaterials;
    labourTotal += sectionLabour;
    sectionsTotal += sectionPrice;
  });

  const clientSubtotal = sectionsTotal * markupMultiplier;

  const discountAmount = calculateDiscount(
    clientSubtotal,
    quote.discountType,
    quote.discountValue
  );

  const afterDiscount = clientSubtotal - discountAmount;

  const taxAmount = calculateVat(afterDiscount, quote.taxPercent, {
    enableVat: options.enableVat,
    showVat: displayOptions.showVat,
  });

  const cisAmount = calculateCis(labourTotal, quote.cisPercent, {
    enableCis: options.enableCis,
    showCis: displayOptions.showCis,
  });

  const grandTotal = (afterDiscount + taxAmount) - cisAmount;

  return {
    materialsTotal,
    labourTotal,
    sectionsTotal,
    clientSubtotal,
    discountAmount,
    afterDiscount,
    taxAmount,
    cisAmount,
    grandTotal,
  };
}
