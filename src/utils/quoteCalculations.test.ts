import { describe, it, expect } from 'vitest';
import {
  calculateSectionLabour,
  calculateSectionMaterials,
  calculateSectionPrice,
  calculateDiscount,
  calculateVat,
  calculateCis,
  calculatePartPayment,
  calculateQuoteTotals,
} from './quoteCalculations';
import type { Quote, QuoteSection, QuoteDisplayOptions } from '../../types';

// Helper to create a minimal section
function createSection(overrides: Partial<QuoteSection> = {}): QuoteSection {
  return {
    id: '1',
    title: 'Test Section',
    items: [],
    labourHours: 0,
    ...overrides,
  };
}

// Helper to create a minimal quote
function createQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: '1',
    customerId: 'cust-1',
    date: '2024-01-15',
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
    title: 'Test Quote',
    sections: [],
    labourRate: 50,
    markupPercent: 0,
    taxPercent: 20,
    cisPercent: 20,
    status: 'draft',
    notes: '',
    type: 'quotation',
    ...overrides,
  };
}

const defaultDisplayOptions: QuoteDisplayOptions = {
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

describe('calculateSectionLabour', () => {
  const defaultRate = 65;
  const quoteRate = 50;

  it('returns 0 for empty section', () => {
    const section = createSection();
    expect(calculateSectionLabour(section, quoteRate, defaultRate)).toBe(0);
  });

  it('calculates hours-based labour with quote rate', () => {
    const section = createSection({ labourHours: 8 });
    expect(calculateSectionLabour(section, quoteRate, defaultRate)).toBe(400); // 8 * 50
  });

  it('uses section rate override over quote rate', () => {
    const section = createSection({ labourHours: 8, labourRate: 75 });
    expect(calculateSectionLabour(section, quoteRate, defaultRate)).toBe(600); // 8 * 75
  });

  it('uses direct labourCost when provided', () => {
    const section = createSection({ labourHours: 8, labourCost: 250 });
    expect(calculateSectionLabour(section, quoteRate, defaultRate)).toBe(250);
  });

  it('calculates itemized labour with default rate', () => {
    const section = createSection({
      labourItems: [
        { id: '1', description: 'Task 1', hours: 4 },
        { id: '2', description: 'Task 2', hours: 3 },
      ],
    });
    expect(calculateSectionLabour(section, quoteRate, defaultRate)).toBe(350); // (4 + 3) * 50
  });

  it('calculates itemized labour with per-item rate overrides', () => {
    const section = createSection({
      labourItems: [
        { id: '1', description: 'Standard', hours: 4, rate: 50 },
        { id: '2', description: 'Skilled', hours: 2, rate: 80 },
      ],
    });
    expect(calculateSectionLabour(section, quoteRate, defaultRate)).toBe(360); // (4 * 50) + (2 * 80)
  });

  it('itemized labour takes priority over labourCost', () => {
    const section = createSection({
      labourCost: 100,
      labourItems: [{ id: '1', description: 'Task', hours: 5 }],
    });
    expect(calculateSectionLabour(section, quoteRate, defaultRate)).toBe(250); // 5 * 50
  });
});

describe('calculateSectionMaterials', () => {
  it('returns 0 for empty items', () => {
    const section = createSection();
    expect(calculateSectionMaterials(section)).toBe(0);
  });

  it('sums material item totals', () => {
    const section = createSection({
      items: [
        { id: '1', name: 'Timber', description: '', quantity: 10, unit: 'm', unitPrice: 5, totalPrice: 50 },
        { id: '2', name: 'Screws', description: '', quantity: 100, unit: 'pcs', unitPrice: 0.10, totalPrice: 10 },
      ],
    });
    expect(calculateSectionMaterials(section)).toBe(60);
  });

  it('excludes heading items from total', () => {
    const section = createSection({
      items: [
        { id: '1', name: 'Materials', description: '', quantity: 0, unit: '', unitPrice: 0, totalPrice: 0, isHeading: true },
        { id: '2', name: 'Timber', description: '', quantity: 10, unit: 'm', unitPrice: 5, totalPrice: 50 },
        { id: '3', name: 'Fixings', description: '', quantity: 0, unit: '', unitPrice: 0, totalPrice: 0, isHeading: true },
        { id: '4', name: 'Screws', description: '', quantity: 100, unit: 'pcs', unitPrice: 0.10, totalPrice: 10 },
      ],
    });
    expect(calculateSectionMaterials(section)).toBe(60);
  });

  it('handles undefined totalPrice gracefully', () => {
    const section = createSection({
      items: [
        { id: '1', name: 'Item', description: '', quantity: 1, unit: 'ea', unitPrice: 10, totalPrice: undefined as any },
        { id: '2', name: 'Item 2', description: '', quantity: 1, unit: 'ea', unitPrice: 20, totalPrice: 20 },
      ],
    });
    expect(calculateSectionMaterials(section)).toBe(20);
  });
});

describe('calculateSectionPrice', () => {
  it('returns materials + labour when no override', () => {
    const section = createSection();
    expect(calculateSectionPrice(section, 100, 200)).toBe(300);
  });

  it('uses subsectionPrice override when set', () => {
    const section = createSection({ subsectionPrice: 500 });
    expect(calculateSectionPrice(section, 100, 200)).toBe(500);
  });

  it('uses subsectionPrice even when 0', () => {
    const section = createSection({ subsectionPrice: 0 });
    expect(calculateSectionPrice(section, 100, 200)).toBe(0);
  });
});

describe('calculateDiscount', () => {
  it('returns 0 when no discount value', () => {
    expect(calculateDiscount(1000, undefined, undefined)).toBe(0);
    expect(calculateDiscount(1000, 'percentage', 0)).toBe(0);
  });

  it('calculates percentage discount', () => {
    expect(calculateDiscount(1000, 'percentage', 10)).toBe(100);
    expect(calculateDiscount(500, 'percentage', 25)).toBe(125);
  });

  it('applies fixed discount', () => {
    expect(calculateDiscount(1000, 'fixed', 150)).toBe(150);
  });

  it('treats undefined type as fixed', () => {
    expect(calculateDiscount(1000, undefined, 50)).toBe(50);
  });
});

describe('calculateVat', () => {
  it('returns 0 when VAT disabled in settings', () => {
    expect(calculateVat(1000, 20, { enableVat: false, showVat: true })).toBe(0);
  });

  it('returns 0 when VAT hidden in display', () => {
    expect(calculateVat(1000, 20, { enableVat: true, showVat: false })).toBe(0);
  });

  it('calculates VAT at 20%', () => {
    expect(calculateVat(1000, 20, { enableVat: true, showVat: true })).toBe(200);
  });

  it('calculates VAT at reduced rate', () => {
    expect(calculateVat(1000, 5, { enableVat: true, showVat: true })).toBe(50);
  });

  it('handles 0% VAT rate', () => {
    expect(calculateVat(1000, 0, { enableVat: true, showVat: true })).toBe(0);
  });
});

describe('calculateCis', () => {
  it('returns 0 when CIS disabled in settings', () => {
    expect(calculateCis(500, 20, { enableCis: false, showCis: true })).toBe(0);
  });

  it('returns 0 when CIS hidden in display', () => {
    expect(calculateCis(500, 20, { enableCis: true, showCis: false })).toBe(0);
  });

  it('calculates CIS at 20% on labour only', () => {
    expect(calculateCis(500, 20, { enableCis: true, showCis: true })).toBe(100);
  });

  it('calculates CIS at 30% (higher rate)', () => {
    expect(calculateCis(1000, 30, { enableCis: true, showCis: true })).toBe(300);
  });
});

describe('calculatePartPayment', () => {
  it('returns 0 when not enabled', () => {
    expect(calculatePartPayment(1000, false, 'percentage', 50)).toBe(0);
    expect(calculatePartPayment(1000, undefined, 'percentage', 50)).toBe(0);
  });

  it('returns 0 when no value', () => {
    expect(calculatePartPayment(1000, true, 'percentage', 0)).toBe(0);
    expect(calculatePartPayment(1000, true, 'percentage', undefined)).toBe(0);
  });

  it('calculates percentage deposit', () => {
    expect(calculatePartPayment(1000, true, 'percentage', 30)).toBe(300);
  });

  it('applies fixed deposit amount', () => {
    expect(calculatePartPayment(1000, true, 'fixed', 250)).toBe(250);
  });
});

describe('calculateQuoteTotals', () => {
  const defaultOptions = {
    enableVat: true,
    enableCis: false,
    showVat: true,
    showCis: false,
    defaultLabourRate: 65,
  };

  it('calculates simple quote with one section', () => {
    const quote = createQuote({
      sections: [
        createSection({
          items: [
            { id: '1', name: 'Material', description: '', quantity: 1, unit: 'ea', unitPrice: 100, totalPrice: 100 },
          ],
          labourHours: 4,
        }),
      ],
      labourRate: 50,
      markupPercent: 0,
      taxPercent: 20,
    });

    const totals = calculateQuoteTotals(quote, defaultOptions, defaultDisplayOptions);

    expect(totals.materialsTotal).toBe(100);
    expect(totals.labourTotal).toBe(200); // 4 * 50
    expect(totals.sectionsTotal).toBe(300);
    expect(totals.clientSubtotal).toBe(300); // no markup
    expect(totals.afterDiscount).toBe(300);
    expect(totals.taxAmount).toBe(60); // 20% VAT
    expect(totals.cisAmount).toBe(0);
    expect(totals.grandTotal).toBe(360);
  });

  it('applies markup correctly', () => {
    const quote = createQuote({
      sections: [
        createSection({
          items: [
            { id: '1', name: 'Material', description: '', quantity: 1, unit: 'ea', unitPrice: 100, totalPrice: 100 },
          ],
        }),
      ],
      markupPercent: 20,
      taxPercent: 0,
    });

    const totals = calculateQuoteTotals(
      quote,
      { ...defaultOptions, enableVat: false },
      { ...defaultDisplayOptions, showVat: false }
    );

    expect(totals.sectionsTotal).toBe(100);
    expect(totals.clientSubtotal).toBe(120); // 20% markup
    expect(totals.grandTotal).toBe(120);
  });

  it('applies percentage discount before VAT', () => {
    const quote = createQuote({
      sections: [
        createSection({
          items: [
            { id: '1', name: 'Material', description: '', quantity: 1, unit: 'ea', unitPrice: 1000, totalPrice: 1000 },
          ],
        }),
      ],
      discountType: 'percentage',
      discountValue: 10,
      taxPercent: 20,
    });

    const totals = calculateQuoteTotals(quote, defaultOptions, defaultDisplayOptions);

    expect(totals.clientSubtotal).toBe(1000);
    expect(totals.discountAmount).toBe(100);
    expect(totals.afterDiscount).toBe(900);
    expect(totals.taxAmount).toBe(180); // VAT on discounted amount
    expect(totals.grandTotal).toBe(1080);
  });

  it('applies fixed discount', () => {
    const quote = createQuote({
      sections: [
        createSection({
          items: [
            { id: '1', name: 'Material', description: '', quantity: 1, unit: 'ea', unitPrice: 1000, totalPrice: 1000 },
          ],
        }),
      ],
      discountType: 'fixed',
      discountValue: 150,
      taxPercent: 20,
    });

    const totals = calculateQuoteTotals(quote, defaultOptions, defaultDisplayOptions);

    expect(totals.discountAmount).toBe(150);
    expect(totals.afterDiscount).toBe(850);
    expect(totals.taxAmount).toBe(170);
    expect(totals.grandTotal).toBe(1020);
  });

  it('calculates CIS deduction on labour only', () => {
    const quote = createQuote({
      sections: [
        createSection({
          items: [
            { id: '1', name: 'Material', description: '', quantity: 1, unit: 'ea', unitPrice: 500, totalPrice: 500 },
          ],
          labourHours: 10,
        }),
      ],
      labourRate: 50,
      taxPercent: 0,
      cisPercent: 20,
    });

    const totals = calculateQuoteTotals(
      quote,
      { ...defaultOptions, enableVat: false, enableCis: true },
      { ...defaultDisplayOptions, showVat: false, showCis: true }
    );

    expect(totals.materialsTotal).toBe(500);
    expect(totals.labourTotal).toBe(500); // 10 * 50
    expect(totals.cisAmount).toBe(100); // 20% of labour only
    expect(totals.grandTotal).toBe(900); // 1000 - 100 CIS
  });

  it('handles multiple sections', () => {
    const quote = createQuote({
      sections: [
        createSection({
          items: [
            { id: '1', name: 'Material 1', description: '', quantity: 1, unit: 'ea', unitPrice: 200, totalPrice: 200 },
          ],
          labourHours: 4,
        }),
        createSection({
          items: [
            { id: '2', name: 'Material 2', description: '', quantity: 1, unit: 'ea', unitPrice: 300, totalPrice: 300 },
          ],
          labourHours: 6,
        }),
      ],
      labourRate: 50,
      taxPercent: 0,
    });

    const totals = calculateQuoteTotals(
      quote,
      { ...defaultOptions, enableVat: false },
      { ...defaultDisplayOptions, showVat: false }
    );

    expect(totals.materialsTotal).toBe(500);
    expect(totals.labourTotal).toBe(500); // (4 + 6) * 50
    expect(totals.grandTotal).toBe(1000);
  });

  it('respects subsection price overrides', () => {
    const quote = createQuote({
      sections: [
        createSection({
          items: [
            { id: '1', name: 'Material', description: '', quantity: 1, unit: 'ea', unitPrice: 100, totalPrice: 100 },
          ],
          labourHours: 4,
          subsectionPrice: 500, // Override
        }),
      ],
      labourRate: 50,
      taxPercent: 0,
    });

    const totals = calculateQuoteTotals(
      quote,
      { ...defaultOptions, enableVat: false },
      { ...defaultDisplayOptions, showVat: false }
    );

    expect(totals.materialsTotal).toBe(100);
    expect(totals.labourTotal).toBe(200);
    expect(totals.sectionsTotal).toBe(500); // Uses override
    expect(totals.grandTotal).toBe(500);
  });

  it('handles empty quote', () => {
    const quote = createQuote({ sections: [] });
    const totals = calculateQuoteTotals(
      quote,
      { ...defaultOptions, enableVat: false },
      { ...defaultDisplayOptions, showVat: false }
    );

    expect(totals.materialsTotal).toBe(0);
    expect(totals.labourTotal).toBe(0);
    expect(totals.grandTotal).toBe(0);
  });

  it('combines VAT and CIS correctly', () => {
    const quote = createQuote({
      sections: [
        createSection({
          items: [
            { id: '1', name: 'Material', description: '', quantity: 1, unit: 'ea', unitPrice: 500, totalPrice: 500 },
          ],
          labourHours: 10,
        }),
      ],
      labourRate: 50,
      taxPercent: 20,
      cisPercent: 20,
    });

    const totals = calculateQuoteTotals(
      quote,
      { ...defaultOptions, enableCis: true },
      { ...defaultDisplayOptions, showCis: true }
    );

    expect(totals.materialsTotal).toBe(500);
    expect(totals.labourTotal).toBe(500);
    expect(totals.clientSubtotal).toBe(1000);
    expect(totals.taxAmount).toBe(200); // 20% VAT
    expect(totals.cisAmount).toBe(100); // 20% CIS on labour
    expect(totals.grandTotal).toBe(1100); // 1000 + 200 VAT - 100 CIS
  });
});
