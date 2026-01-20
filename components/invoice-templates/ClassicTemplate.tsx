// ClassicTemplate.tsx - Ultra-compact traditional invoice layout with inline styles

import React from 'react';
import { Quote, Customer, AppSettings } from '../../types';
import { getColorScheme } from '../../src/lib/invoiceTemplates';
import type { ColorScheme } from '../../src/lib/invoiceTemplates';

interface TemplateProps {
  quote: Quote;
  customer: Customer;
  settings: AppSettings;
  totals: {
    clientSubtotal: number;
    taxAmount: number;
    cisAmount: number;
    discountAmount: number;
    grandTotal: number;
  };
  reference: string;
}

export const ClassicTemplate: React.FC<TemplateProps> = ({
  quote, customer, settings, totals, reference
}) => {
  const markupMultiplier = 1 + ((quote.markupPercent || 0) / 100);
  const displayOptions = quote.displayOptions || settings.defaultDisplayOptions;

  // Get color scheme based on document type
  const colorSchemeToUse = quote.type === 'invoice' ? settings.invoiceColorScheme : settings.quoteColorScheme;
  const colorScheme = getColorScheme(colorSchemeToUse);
  const isDark = colorScheme.isDark;

  // Convert Tailwind classes to inline styles
  const headerBgColor = isDark ? '#1e293b' :
    colorScheme.id === 'slate' ? '#f1f5f9' :
    colorScheme.id === 'blue' ? '#dbeafe' :
    colorScheme.id === 'teal' ? '#ccfbf1' :
    colorScheme.id === 'emerald' ? '#d1fae5' :
    colorScheme.id === 'purple' ? '#e9d5ff' :
    colorScheme.id === 'rose' ? '#fce7f3' : '#f1f5f9';

  const headerTextColor = isDark ? '#ffffff' :
    colorScheme.id === 'slate' ? '#334155' :
    colorScheme.id === 'blue' ? '#1e40af' :
    colorScheme.id === 'teal' ? '#0f766e' :
    colorScheme.id === 'emerald' ? '#047857' :
    colorScheme.id === 'purple' ? '#7c3aed' :
    colorScheme.id === 'rose' ? '#be123c' : '#334155';

  // Flatten all items
  const getAllItems = () => {
    const items: Array<{ description: string; qty: string; rate: number; amount: number }> = [];

    (quote.sections || []).forEach(section => {
      (section.items || []).filter(i => !i.isHeading).forEach(item => {
        items.push({
          description: [item.name, item.description].filter(Boolean).join(' - '),
          qty: `${item.quantity} ${item.unit}`,
          rate: item.unitPrice * markupMultiplier,
          amount: (item.totalPrice || 0) * markupMultiplier,
        });
      });

      if (section.labourItems?.length) {
        section.labourItems.forEach(labour => {
          const rate = labour.rate || section.labourRate || quote.labourRate || settings.defaultLabourRate;
          items.push({
            description: labour.description || 'Labour',
            qty: `${labour.hours} hrs`,
            rate: rate * markupMultiplier,
            amount: labour.hours * rate * markupMultiplier,
          });
        });
      } else if ((section.labourHours || 0) > 0) {
        const rate = section.labourRate || quote.labourRate || settings.defaultLabourRate;
        items.push({
          description: 'Labour',
          qty: `${section.labourHours} hrs`,
          rate: rate * markupMultiplier,
          amount: (section.labourHours || 0) * rate * markupMultiplier,
        });
      }
    });

    return items;
  };

  const items = getAllItems();

  return (
    <div
      className="bg-white text-slate-900 font-sans"
      style={{
        width: '100%',
        maxWidth: '750px',
        padding: '24px',
        fontSize: '9px',
        boxSizing: 'border-box'
      }}
    >
      {/* COMPACT HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6mm', paddingBottom: '4mm', borderBottom: `2px solid ${isDark ? '#1e293b' : headerBgColor}` }}>
        <div>
          {displayOptions.showLogo && settings.companyLogo && (
            <img src={settings.companyLogo} alt="" style={{ height: '10mm', marginBottom: '2mm' }} />
          )}
          <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{settings.companyName}</div>
          <div style={{ fontSize: '8px', color: '#64748b' }}>{settings.companyAddress?.split('\n').join(' • ')}</div>
          <div style={{ fontSize: '8px', color: '#94a3b8' }}>{[settings.phone, settings.email].filter(Boolean).join(' • ')}</div>
          {settings.vatNumber && (
            <div style={{ fontSize: '7px', color: '#94a3b8' }}>VAT: {settings.vatNumber}</div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '11px', fontWeight: '300', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {quote.type === 'invoice' ? 'Invoice' : 'Quote'}
          </div>
          <div style={{ fontSize: '9px', fontWeight: 'bold' }}>{reference}</div>
          <div style={{ fontSize: '8px', color: '#64748b' }}>{quote.date ? new Date(quote.date).toLocaleDateString('en-GB') : ''}</div>
        </div>
      </div>

      {/* CLIENT + JOB */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6mm', marginBottom: '6mm' }}>
        <div>
          <div style={{ fontSize: '7px', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '1mm' }}>Bill To</div>
          <div style={{ fontSize: '10px', fontWeight: 'bold' }}>{customer?.name}</div>
          {customer?.company && <div style={{ fontSize: '8px', color: '#475569' }}>{customer.company}</div>}
          {customer?.address && <div style={{ fontSize: '8px', color: '#64748b', lineHeight: 1.4 }}>{customer.address}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '7px', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '1mm' }}>Project</div>
          <div style={{ fontSize: '10px', fontWeight: 'bold' }}>{quote.title}</div>
          {quote.dueDate && (
            <div style={{ fontSize: '8px', color: '#d97706', fontWeight: 'bold', marginTop: '2mm' }}>
              Due: {new Date(quote.dueDate).toLocaleDateString('en-GB')}
            </div>
          )}
        </div>
      </div>

      {/* ITEMS TABLE */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '4mm' }}>
        <thead>
          <tr style={{ background: headerBgColor, color: headerTextColor }}>
            <th style={{ padding: '4px 6px', textAlign: 'left', fontSize: '8px', fontWeight: 'bold' }}>Description</th>
            <th style={{ padding: '4px 6px', textAlign: 'center', fontSize: '8px', fontWeight: 'bold', width: '50px' }}>Qty</th>
            <th style={{ padding: '4px 6px', textAlign: 'right', fontSize: '8px', fontWeight: 'bold', width: '60px' }}>Rate</th>
            <th style={{ padding: '4px 6px', textAlign: 'right', fontSize: '8px', fontWeight: 'bold', width: '70px' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '4px 6px', fontSize: '9px' }}>{item.description}</td>
              <td style={{ padding: '4px 6px', textAlign: 'center', color: '#64748b', fontSize: '9px' }}>{item.qty}</td>
              <td style={{ padding: '4px 6px', textAlign: 'right', color: '#64748b', fontSize: '9px' }}>£{item.rate.toFixed(2)}</td>
              <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: '500', fontSize: '9px' }}>£{item.amount.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* TOTALS */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ width: '160px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: '8px', color: '#64748b' }}>
            <span>Subtotal</span>
            <span>£{totals.clientSubtotal.toFixed(2)}</span>
          </div>
          {totals.discountAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: '8px', color: '#64748b' }}>
              <span>Discount</span>
              <span>-£{totals.discountAmount.toFixed(2)}</span>
            </div>
          )}
          {settings.enableVat && displayOptions.showVat && totals.taxAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: '8px', color: '#64748b' }}>
              <span>VAT ({quote.taxPercent}%)</span>
              <span>£{totals.taxAmount.toFixed(2)}</span>
            </div>
          )}
          {settings.enableCis && displayOptions.showCis && totals.cisAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: '8px', color: '#64748b' }}>
              <span>CIS Deduction</span>
              <span>-£{totals.cisAmount.toFixed(2)}</span>
            </div>
          )}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '6px 0',
            borderTop: `2px solid ${isDark ? '#1e293b' : headerBgColor}`,
            marginTop: '3px',
            fontWeight: 'bold',
            fontSize: '11px'
          }}>
            <span>Total</span>
            <span>£{totals.grandTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* BANK DETAILS */}
      {settings.bankAccountName && (
        <div style={{ marginTop: '6mm', paddingTop: '3mm', borderTop: '1px solid #e2e8f0', fontSize: '8px', color: '#64748b' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '1mm' }}>Payment Details</div>
          <div>
            {settings.bankAccountName} | {settings.bankAccountNumber} | {settings.bankSortCode}
            {settings.bankName && ` | ${settings.bankName}`}
          </div>
        </div>
      )}

      {/* NOTES */}
      {displayOptions.showNotes && (quote.notes || settings.defaultInvoiceNotes) && (
        <div style={{ marginTop: '4mm', fontSize: '8px', color: '#64748b', lineHeight: 1.5 }}>
          <div style={{ fontWeight: 'bold', marginBottom: '1mm' }}>Notes</div>
          <div style={{ whiteSpace: 'pre-line' }}>{quote.notes || settings.defaultInvoiceNotes}</div>
        </div>
      )}
    </div>
  );
};
