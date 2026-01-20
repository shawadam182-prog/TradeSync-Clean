
import React, { useState, useRef } from 'react';
import { Quote, Customer, AppSettings, QuoteDisplayOptions, QuoteSection, LabourItem } from '../types';
import {
  ArrowLeft, Edit3, Hammer, User, FileText, Info,
  Landmark, Package, HardHat, FileDown, Loader2, Navigation, PoundSterling,
  Settings2, Eye, EyeOff, ChevronDown, ChevronUp, LayoutGrid, List,
  Image as ImageIcon, AlignLeft, ReceiptText, ShieldCheck, ListChecks, FileDigit,
  Box, Circle, Share2, Copy, MessageCircle, MapPin, Mail, Banknote, Check, X, Clock, Tag, Type
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { PaymentRecorder } from './PaymentRecorder';
import { hapticSuccess } from '../src/hooks/useHaptic';
import { filingService } from '../src/services/dataService';
import {
  calculateSectionLabour,
  calculateQuoteTotals,
  calculatePartPayment,
} from '../src/utils/quoteCalculations';
import { getTemplateConfig, getTableHeaderStyle, getColorScheme } from '../src/lib/invoiceTemplates';
import { ClassicTemplate } from './invoice-templates';

interface QuoteViewProps {
  quote: Quote;
  customer: Customer;
  settings: AppSettings;
  onEdit: () => void;
  onBack: () => void;
  onUpdateStatus: (status: Quote['status']) => void;
  onUpdateQuote: (quote: Quote) => void;
  onConvertToInvoice?: () => void;
  onDuplicate?: () => void;
}

export const QuoteView: React.FC<QuoteViewProps> = ({
  quote, customer, settings, onEdit, onBack, onUpdateStatus, onUpdateQuote,
  onConvertToInvoice, onDuplicate
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [showCustomiser, setShowCustomiser] = useState(false);
  const [showPaymentRecorder, setShowPaymentRecorder] = useState(false);
  const [emailHelper, setEmailHelper] = useState<{
    show: boolean;
    subject: string;
    body: string;
    email: string;
    filename: string;
    copied: boolean;
  } | null>(null);
  const documentRef = useRef<HTMLDivElement>(null);

  const getProcessedQuote = (): Quote => {
    if (!quote) return quote;
    if ((quote as any).items) {
      return {
        ...quote,
        sections: [{
          id: 'legacy',
          title: 'Work Specification',
          items: (quote as any).items || [],
          labourHours: (quote as any).labourHours || 0
        }]
      } as Quote;
    }
    return quote;
  };

  const activeQuote = getProcessedQuote();

  if (!activeQuote) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-slate-400">
        <FileText size={48} className="mb-4 text-slate-200" />
        <p className="font-black text-sm uppercase tracking-widest italic">Document unavailable</p>
        <button onClick={onBack} className="mt-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest hover:text-slate-900"><ArrowLeft size={14} /> Go Back</button>
      </div>
    );
  }

  const displayOptions = activeQuote.displayOptions || settings.defaultDisplayOptions;

  const toggleOption = (optionKey: keyof QuoteDisplayOptions) => {
    const updatedOptions = { ...displayOptions, [optionKey]: !displayOptions[optionKey] };
    onUpdateQuote({ ...activeQuote, displayOptions: updatedOptions });
  };

  // Use extracted calculation functions for testability
  const getSectionLabour = (section: QuoteSection) => {
    return calculateSectionLabour(section, activeQuote.labourRate, settings.defaultLabourRate);
  };

  const totals = calculateQuoteTotals(
    activeQuote,
    {
      enableVat: settings.enableVat,
      enableCis: settings.enableCis,
      showVat: displayOptions.showVat,
      showCis: displayOptions.showCis,
      defaultLabourRate: settings.defaultLabourRate,
    },
    displayOptions
  );

  const partPaymentAmount = calculatePartPayment(
    totals.grandTotal,
    activeQuote.partPaymentEnabled,
    activeQuote.partPaymentType,
    activeQuote.partPaymentValue
  );

  // Helper to flatten all items (materials + labour) into a single table
  const getAllLineItems = () => {
    const items: Array<{
      lineNum: number;
      name: string;
      description: string;
      subtext?: string;
      qty: string;
      rate?: number;
      amount: number;
      isHeading?: boolean;
    }> = [];

    const markupMultiplier = 1 + ((activeQuote.markupPercent || 0) / 100);
    let lineNum = 1;

    (activeQuote.sections || []).forEach(section => {
      // Add materials
      (section.items || []).forEach(item => {
        if (item.isHeading) {
          items.push({
            lineNum: 0,
            name: item.name || 'Section',
            description: item.name || 'Section',
            qty: '',
            amount: 0,
            isHeading: true
          });
        } else {
          const unitPrice = (item.unitPrice || 0) * markupMultiplier;
          items.push({
            lineNum: lineNum++,
            name: item.name || '',
            description: [item.name, item.description].filter(Boolean).join(' '),
            subtext: item.description || undefined,
            qty: `${item.quantity}`,
            rate: unitPrice,
            amount: (item.totalPrice || 0) * markupMultiplier,
          });
        }
      });

      // Add labour items
      if (section.labourItems && section.labourItems.length > 0) {
        section.labourItems.forEach(labour => {
          const rate = (labour.rate || section.labourRate || activeQuote.labourRate || settings.defaultLabourRate) * markupMultiplier;
          items.push({
            lineNum: lineNum++,
            name: labour.description || 'Labour',
            description: labour.description || 'Labour',
            qty: `${labour.hours}`,
            rate: rate,
            amount: labour.hours * rate,
          });
        });
      } else if ((section.labourHours || 0) > 0) {
        const rate = (section.labourRate || activeQuote.labourRate || settings.defaultLabourRate) * markupMultiplier;
        items.push({
          lineNum: lineNum++,
          name: 'Labour',
          description: 'Labour',
          qty: `${section.labourHours}`,
          rate: rate,
          amount: (section.labourHours || 0) * rate,
        });
      }
    });

    return items;
  };

  // Generate PDF as a Blob for filing
  const generatePDFBlob = async (): Promise<{ blob: Blob; filename: string } | null> => {
    if (!documentRef.current) return null;

    try {
      const prefix = activeQuote.type === 'invoice' ? (settings.invoicePrefix || 'INV-') : (settings.quotePrefix || 'EST-');
      const numStr = (activeQuote.referenceNumber || 1).toString().padStart(4, '0');
      const cleanTitle = (activeQuote.title || 'invoice').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const filename = `${prefix}${numStr}_${cleanTitle}.pdf`;

      const isMobile = window.innerWidth < 768;
      const scale = isMobile ? 1.5 : 2;

      const canvas = await html2canvas(documentRef.current, {
        scale,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: documentRef.current.scrollWidth,
        windowHeight: documentRef.current.scrollHeight,
      });

      let imgData: string;
      try {
        imgData = canvas.toDataURL('image/png');
      } catch {
        imgData = canvas.toDataURL('image/jpeg', 0.8);
      }

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const scaledHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = scaledHeight;
      let position = 0;
      let pageNum = 0;

      while (heightLeft > 0) {
        if (pageNum > 0) {
          pdf.addPage();
        }
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, scaledHeight);
        heightLeft -= pdfHeight;
        position -= pdfHeight;
        pageNum++;
      }

      const blob = pdf.output('blob');
      return { blob, filename };
    } catch (err) {
      console.error('PDF generation for filing failed:', err);
      return null;
    }
  };

  // File paid invoice to Filing Cabinet
  const filePaidInvoice = async () => {
    const pdfResult = await generatePDFBlob();
    if (!pdfResult) return;

    const { blob, filename } = pdfResult;
    const file = new File([blob], filename, { type: 'application/pdf' });

    // Get tax year from payment date
    const paymentDate = activeQuote.paymentDate || new Date().toISOString().split('T')[0];
    const paymentYear = new Date(paymentDate).getFullYear();
    const paymentMonth = new Date(paymentDate).getMonth();
    // UK tax year runs April to April
    const taxYear = paymentMonth < 3 ? `${paymentYear - 1}/${paymentYear}` : `${paymentYear}/${paymentYear + 1}`;

    const prefix = settings.invoicePrefix || 'INV-';
    const numStr = (activeQuote.referenceNumber || 1).toString().padStart(4, '0');
    const reference = `${prefix}${numStr}`;

    try {
      await filingService.upload(file, {
        name: `${reference} - ${activeQuote.title} (PAID)`,
        description: `Paid invoice for ${customer?.name || 'Customer'}. Amount: £${totals.grandTotal.toFixed(2)}`,
        category: 'invoice',
        document_date: paymentDate,
        vendor_name: customer?.name,
        tax_year: taxYear,
        tags: ['paid', 'invoice', reference],
      });
      console.log('Invoice filed to Filing Cabinet successfully');
    } catch (err) {
      console.error('Failed to file invoice:', err);
      // Don't throw - filing is a nice-to-have, don't block the payment recording
    }
  };

  const handleRecordPayment = async (payment: {
    amount: number;
    method: 'cash' | 'card' | 'bank_transfer' | 'cheque';
    date: string;
    markAsPaid: boolean;
  }) => {
    const newAmountPaid = (activeQuote.amountPaid || 0) + payment.amount;
    const updatedQuote: Quote = {
      ...activeQuote,
      amountPaid: newAmountPaid,
      paymentMethod: payment.method,
      paymentDate: payment.date,
      status: payment.markAsPaid ? 'paid' : activeQuote.status,
    };
    onUpdateQuote(updatedQuote);
    setShowPaymentRecorder(false);
    hapticSuccess();

    // Auto-file to Filing Cabinet when marked as paid
    if (payment.markAsPaid) {
      // Small delay to ensure the UI updates with the new status first
      setTimeout(() => {
        filePaidInvoice();
      }, 500);
    }
  };

  const handleDownloadPDF = async () => {
    if (!documentRef.current) return;

    setIsDownloading(true);
    try {
      const prefix = activeQuote.type === 'invoice' ? (settings.invoicePrefix || 'INV-') : (settings.quotePrefix || 'EST-');
      const numStr = (activeQuote.referenceNumber || 1).toString().padStart(4, '0');
      const cleanTitle = (activeQuote.title || 'estimate').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const filename = `${prefix}${numStr}_${cleanTitle}.pdf`;

      // Use lower scale on mobile to prevent memory issues
      const isMobile = window.innerWidth < 768;
      const scale = isMobile ? 1.5 : 2;

      // Capture the document as canvas
      const canvas = await html2canvas(documentRef.current, {
        scale,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: documentRef.current.scrollWidth,
        windowHeight: documentRef.current.scrollHeight,
      });

      // Use PNG for better compatibility, with fallback to JPEG
      let imgData: string;
      try {
        imgData = canvas.toDataURL('image/png');
      } catch {
        // Fallback to JPEG if PNG fails (memory constraints)
        imgData = canvas.toDataURL('image/jpeg', 0.8);
      }

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const scaledHeight = (canvas.height * pdfWidth) / canvas.width;

      // Handle multi-page if content is tall
      let heightLeft = scaledHeight;
      let position = 0;
      let pageNum = 0;

      while (heightLeft > 0) {
        if (pageNum > 0) {
          pdf.addPage();
        }
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, scaledHeight);
        heightLeft -= pdfHeight;
        position -= pdfHeight;
        pageNum++;
      }

      pdf.save(filename);
    } catch (err) {
      console.error('PDF generation failed:', err);
      alert('PDF generation failed. Please try again or use screenshot instead.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleWhatsAppShare = () => {
    const prefix = activeQuote.type === 'invoice' ? (settings.invoicePrefix || 'INV-') : (settings.quotePrefix || 'EST-');
    const numStr = (activeQuote.referenceNumber || 1).toString().padStart(4, '0');
    const docType = activeQuote.type === 'invoice' ? 'Invoice' : 'Quote';

    // Build detailed breakdown
    let breakdown = '';
    if (activeQuote.sections && activeQuote.sections.length > 0) {
      breakdown += '\n📋 *Work Breakdown:*\n';
      activeQuote.sections.forEach((section, idx) => {
        const markupMultiplier = 1 + ((activeQuote.markupPercent || 0) / 100);
        const rawMaterialsTotal = (section.items || []).reduce((s, i) => s + (i.totalPrice || 0), 0);
        const rawLabourTotal = (section.labourHours || 0) * (activeQuote.labourRate || settings.defaultLabourRate || 0);
        const sectionTotal = (rawMaterialsTotal + rawLabourTotal) * markupMultiplier;

        breakdown += `\n${idx + 1}. ${section.title}`;
        if (section.items && section.items.length > 0) {
          breakdown += `\n   • Materials: £${(rawMaterialsTotal * markupMultiplier).toFixed(2)}`;
        }
        if (section.labourHours && section.labourHours > 0) {
          breakdown += `\n   • Labour (${section.labourHours}hrs): £${(rawLabourTotal * markupMultiplier).toFixed(2)}`;
        }
        breakdown += `\n   *Section Total: £${sectionTotal.toFixed(2)}*`;
      });
    }

    // Build totals section
    let totalsBreakdown = '\n\n💰 *Financial Summary:*';
    totalsBreakdown += `\nSubtotal: £${totals.clientSubtotal.toFixed(2)}`;
    if (settings.enableVat && displayOptions.showVat && totals.taxAmount > 0) {
      totalsBreakdown += `\nVAT (${activeQuote.taxPercent}%): £${totals.taxAmount.toFixed(2)}`;
    }
    if (settings.enableCis && displayOptions.showCis && totals.cisAmount > 0) {
      totalsBreakdown += `\nCIS Deduction: -£${totals.cisAmount.toFixed(2)}`;
    }
    totalsBreakdown += `\n\n*TOTAL DUE: £${totals.grandTotal.toFixed(2)}*`;

    // Add part payment info if enabled
    let partPaymentInfo = '';
    if (activeQuote.type === 'invoice' && activeQuote.partPaymentEnabled && activeQuote.partPaymentValue) {
      const partAmount = activeQuote.partPaymentType === 'percentage'
        ? totals.grandTotal * (activeQuote.partPaymentValue / 100)
        : activeQuote.partPaymentValue;

      partPaymentInfo = `\n\n💳 *${activeQuote.partPaymentLabel || 'Amount Due Now'}:* £${partAmount.toFixed(2)}`;
      if (activeQuote.partPaymentType === 'percentage') {
        partPaymentInfo += ` (${activeQuote.partPaymentValue}%)`;
      }
      partPaymentInfo += `\n*Balance Remaining:* £${(totals.grandTotal - partAmount).toFixed(2)}`;
    }

    const message = `Hi ${customer?.name || 'there'},

${activeQuote.type === 'invoice' ? '📄' : '📝'} Your ${docType} is ready!

*Reference:* ${prefix}${numStr}
*Project:* ${activeQuote.title}
*Date:* ${activeQuote?.date ? new Date(activeQuote.date).toLocaleDateString('en-GB') : 'N/A'}
${breakdown}
${totalsBreakdown}${partPaymentInfo}

${activeQuote.type === 'invoice'
  ? '⏰ *Payment Terms:* Due within 14 days\n\nPlease arrange payment at your earliest convenience.'
  : '✅ Please review and let me know if you have any questions or need any adjustments.\n\nI\'m happy to discuss the details.'}

${activeQuote.notes ? `\n📌 *Additional Notes:*\n${activeQuote.notes}\n` : ''}
---
${settings?.companyName || 'TradeSync'}
${settings?.phone ? `📞 ${settings.phone}` : ''}
${settings?.email ? `📧 ${settings.email}` : ''}`;

    const phoneNumber = customer?.phone?.replace(/\D/g, '') || '';
    const url = phoneNumber
      ? `https://wa.me/${phoneNumber.startsWith('44') ? phoneNumber : '44' + phoneNumber.replace(/^0/, '')}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    window.open(url, '_blank');
  };

  const handleEmailShare = async () => {
    if (!documentRef.current) return;

    setIsDownloading(true);
    try {
      const prefix = activeQuote.type === 'invoice' ? (settings.invoicePrefix || 'INV-') : (settings.quotePrefix || 'EST-');
      const numStr = (activeQuote.referenceNumber || 1).toString().padStart(4, '0');
      const cleanTitle = (activeQuote.title || 'estimate').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const filename = `${prefix}${numStr}_${cleanTitle}.pdf`;
      const docType = activeQuote.type === 'invoice' ? 'invoice' : 'quote';
      const customerName = customer?.name || 'there';
      const customerEmail = customer?.email || '';

      // MOBILE: Use very low scale to prevent memory corruption
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      const scale = isMobile ? 1 : 2;

      // Generate canvas from the document
      const canvas = await html2canvas(documentRef.current, {
        scale,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: documentRef.current.scrollWidth,
        windowHeight: documentRef.current.scrollHeight,
      });

      // Use JPEG on mobile for smaller file size and better compatibility
      const imgData = isMobile
        ? canvas.toDataURL('image/jpeg', 0.85)
        : canvas.toDataURL('image/png');

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const scaledHeight = (canvas.height * pdfWidth) / canvas.width;

      // Handle multi-page
      let heightLeft = scaledHeight;
      let position = 0;
      let pageNum = 0;

      while (heightLeft > 0) {
        if (pageNum > 0) {
          pdf.addPage();
        }
        pdf.addImage(imgData, isMobile ? 'JPEG' : 'PNG', 0, position, pdfWidth, scaledHeight);
        heightLeft -= pdfHeight;
        position -= pdfHeight;
        pageNum++;
      }

      // Build email content
      let partPaymentLine = '';
      if (activeQuote.type === 'invoice' && activeQuote.partPaymentEnabled && activeQuote.partPaymentValue) {
        const partAmount = activeQuote.partPaymentType === 'percentage'
          ? totals.grandTotal * (activeQuote.partPaymentValue / 100)
          : activeQuote.partPaymentValue;
        partPaymentLine = `\n\n${activeQuote.partPaymentLabel || 'Amount Due Now'}: £${partAmount.toFixed(2)}`;
      }

      const subject = `${docType.charAt(0).toUpperCase() + docType.slice(1)} - ${activeQuote.title} (${prefix}${numStr})`;
      const body = `Dear ${customerName},

Please find attached ${docType} as discussed.${partPaymentLine}

Thanks,
${settings?.companyName || ''}${settings?.phone ? `\n${settings.phone}` : ''}${settings?.email ? `\n${settings.email}` : ''}`;

      // MOBILE: Use Web Share API to attach PDF directly to email
      if (isMobile && navigator.share && navigator.canShare) {
        try {
          // Use blob output directly - more reliable than arraybuffer on mobile
          const pdfBlob = pdf.output('blob');

          // Validate the blob has content
          if (!pdfBlob || pdfBlob.size < 1000) {
            console.warn('PDF blob too small, falling back to download');
            throw new Error('PDF generation produced invalid output');
          }

          const pdfFile = new File([pdfBlob], filename, {
            type: 'application/pdf',
            lastModified: Date.now()
          });

          const shareData = {
            files: [pdfFile],
            title: subject,
            text: `To: ${customerEmail}\n\n${body}`,
          };

          if (navigator.canShare(shareData)) {
            await navigator.share(shareData);
            return; // Success - email app opened with PDF attached
          }
        } catch (shareErr) {
          if ((shareErr as Error).name === 'AbortError') {
            return; // User cancelled
          }
          console.log('Web Share failed:', shareErr);
          // Fall through to download approach
        }
      }

      // DESKTOP/FALLBACK: Download PDF and open mailto
      pdf.save(filename);
      const mailtoLink = `mailto:${customerEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      await new Promise(resolve => setTimeout(resolve, 300));
      window.location.href = mailtoLink;
    } catch (err) {
      console.error('Email share failed:', err);
      alert('Could not prepare email. Please try downloading the PDF instead.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleOpenMaps = () => {
    if (customer?.address) {
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(customer.address)}`;
      window.open(url, '_blank');
    }
  };

  const statusColors = {
    draft: 'bg-slate-100 text-slate-600',
    sent: 'bg-blue-100 text-blue-600',
    accepted: 'bg-green-100 text-green-600',
    declined: 'bg-red-100 text-red-600',
    invoiced: 'bg-emerald-100 text-emerald-600',
    paid: 'bg-emerald-500 text-white'
  };

  const costBoxThemes = {
    slate: 'bg-slate-900 text-white',
    amber: 'bg-amber-500 text-slate-950',
    blue: 'bg-blue-600 text-white'
  };

  const currentThemeClass = costBoxThemes[settings.costBoxColor || 'slate'];

  // Get template configuration from the template system
  const templateConfig = getTemplateConfig(settings.documentTemplate);

  // Get the table header style with color scheme support (use invoice color for invoices, quote color for quotes)
  const colorSchemeToUse = activeQuote.type === 'invoice' ? settings.invoiceColorScheme : settings.quoteColorScheme;
  const tableHeaderStyle = getTableHeaderStyle(templateConfig, colorSchemeToUse);
  const colorScheme = getColorScheme(colorSchemeToUse || templateConfig.defaultColorScheme);

  // Create templateStyle for backwards compatibility with existing rendering
  const activeTemplate = settings.documentTemplate || 'professional';
  const templateStyle = {
    container: templateConfig.borderRadius,
    header: templateConfig.headerPadding,
    titleBar: `border-y border-slate-200 ${templateConfig.showBackgrounds ? 'bg-slate-50' : 'bg-white'} px-2 py-1`,
    clientSection: `px-2 py-1 ${templateConfig.showBackgrounds ? 'bg-slate-50' : ''}`,
    sectionPadding: templateConfig.containerPadding,
    sectionSpacing: templateConfig.sectionGap,
    sectionTitle: `${templateConfig.fontSize} font-bold text-slate-900 uppercase tracking-wide`,
    materialHeader: templateConfig.sectionHeaderStyle || 'flex items-center gap-1.5 border-b border-slate-100 pb-1',
    tableText: templateConfig.fontSize,
    footerRounding: templateConfig.borderRadius === 'rounded-none' ? '' : 'rounded-b-xl',
    borderStyle: 'border-slate-200'
  };

  const CustomiseToggle = ({ label, optionKey, activeColor }: { label: string, optionKey: keyof QuoteDisplayOptions, activeColor: string }) => (
    <button
      onClick={() => toggleOption(optionKey)}
      className={`flex items-center justify-between w-full px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${
        displayOptions[optionKey]
        ? `${activeColor} border-transparent shadow-sm`
        : 'bg-white text-slate-300 border-slate-100 italic opacity-60'
      }`}
    >
      <span className="truncate mr-2">{label}</span>
      {displayOptions[optionKey] ? <Eye size={10} /> : <EyeOff size={10} />}
    </button>
  );

  const prefix = activeQuote.type === 'invoice' ? (settings.invoicePrefix || 'INV-') : (settings.quotePrefix || 'EST-');
  const numStr = (activeQuote.referenceNumber || 1).toString().padStart(4, '0');
  const reference = `${prefix}${numStr}`;

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-24">
      {/* Unified Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-slate-100 p-2 flex items-center justify-between shadow-sm -mx-4 md:mx-0 print:hidden mb-4">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="p-2 -ml-2 text-slate-400 hover:text-slate-700">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-bold text-slate-900">{activeQuote.type === 'invoice' ? 'Invoice' : 'Quote'} Details</h1>
        </div>
        <div className="flex gap-2">
           <button onClick={onEdit} className="p-2 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100"><Edit3 size={18} /></button>
           <button onClick={handleEmailShare} disabled={isDownloading} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100" title="Email with PDF">
             {isDownloading ? <Loader2 size={18} className="animate-spin"/> : <Mail size={18} />}
           </button>
           <button onClick={handleWhatsAppShare} className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100" title="Share via WhatsApp"><MessageCircle size={18} /></button>
           <button onClick={handleDownloadPDF} disabled={isDownloading} className="p-2 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100" title="Download PDF">
             {isDownloading ? <Loader2 size={18} className="animate-spin"/> : <FileDown size={18} />}
           </button>
        </div>
      </div>

      <div className="flex flex-col gap-2 print:hidden">
        {/* Status Action Buttons for Quotes */}
        {activeQuote.type !== 'invoice' && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
            {activeQuote.status === 'draft' && (
              <button
                onClick={() => {
                  onUpdateStatus('sent');
                  hapticSuccess();
                }}
                className="flex-shrink-0 flex items-center gap-2 px-2 py-1 rounded-xl bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-500/30 hover:bg-blue-600 transition-colors"
              >
                <Share2 size={14} /> Mark as Sent
              </button>
            )}
            {activeQuote.status === 'sent' && (
              <>
                <button
                  onClick={() => {
                    onUpdateStatus('accepted');
                    hapticSuccess();
                  }}
                  className="flex-shrink-0 flex items-center gap-2 px-2 py-1 rounded-xl bg-green-500 text-white text-xs font-bold shadow-lg shadow-green-500/30 hover:bg-green-600 transition-colors"
                >
                  <Check size={14} /> Customer Accepted
                </button>
                <button
                  onClick={() => {
                    onUpdateStatus('declined');
                    hapticSuccess();
                  }}
                  className="flex-shrink-0 flex items-center gap-2 px-2 py-1 rounded-xl bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-500/30 hover:bg-red-600 transition-colors"
                >
                  <X size={14} /> Customer Declined
                </button>
              </>
            )}
            {activeQuote.status === 'accepted' && !activeQuote.status.includes('invoiced') && (
              <div className="flex items-center gap-2 px-2 py-1 rounded-xl bg-green-100 text-green-700 text-xs font-bold">
                <Check size={14} /> Accepted - Ready to Invoice
              </div>
            )}
            {activeQuote.status === 'declined' && (
              <div className="flex items-center gap-2 px-2 py-1 rounded-xl bg-red-100 text-red-700 text-xs font-bold">
                <X size={14} /> Quote Declined
              </div>
            )}
          </div>
        )}

        {/* Secondary Actions Row */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
            <button
              onClick={() => setShowCustomiser(!showCustomiser)}
              className="flex-shrink-0 flex items-center gap-2 px-2 py-1 rounded-lg bg-white border border-slate-100 text-slate-600 text-xs font-bold shadow-sm"
            >
              <Settings2 size={14} /> Layout
            </button>
            {onDuplicate && (
              <button onClick={onDuplicate} className="flex-shrink-0 flex items-center gap-2 px-2 py-1 rounded-lg bg-white border border-slate-100 text-slate-600 text-xs font-bold shadow-sm">
                <Copy size={14} /> Duplicate
              </button>
            )}
            {activeQuote.type !== 'invoice' && onConvertToInvoice && ['draft', 'sent', 'accepted'].includes(activeQuote.status) && (
              <button onClick={onConvertToInvoice} className="flex-shrink-0 flex items-center gap-2 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-bold shadow-sm border border-emerald-100">
                <ReceiptText size={14} /> To Invoice
              </button>
            )}
            {activeQuote.type === 'invoice' && activeQuote.status !== 'paid' && (
              <button
                onClick={() => setShowPaymentRecorder(true)}
                className="flex-shrink-0 flex items-center gap-2 px-2 py-1 rounded-lg bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-500/30 hover:bg-emerald-600 transition-colors"
              >
                <Banknote size={14} /> Record Payment
              </button>
            )}
            {customer?.address && (
              <button onClick={handleOpenMaps} className="flex-shrink-0 flex items-center gap-2 px-2 py-1 rounded-lg bg-blue-50 text-blue-600 text-xs font-bold shadow-sm border border-blue-100">
                <MapPin size={14} /> Map
              </button>
            )}
        </div>

        {showCustomiser && (
          <div className="bg-white p-5 rounded-[28px] border border-slate-200 shadow-2xl animate-in slide-in-from-top-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="space-y-1 bg-slate-50/50 p-2 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100"><Package size={12} className="text-amber-500" /><span className="text-[9px] font-black uppercase tracking-widest text-slate-700">Materials</span></div>
                <CustomiseToggle label="Show Section" optionKey="showMaterials" activeColor="bg-amber-500 text-white" />
                <div className={`space-y-1 pl-2 border-l border-slate-100 transition-all ${displayOptions.showMaterials ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                  <CustomiseToggle label="Detailed List" optionKey="showMaterialItems" activeColor="bg-slate-900 text-amber-500" />
                  <div className={`space-y-1 transition-all ${displayOptions.showMaterialItems ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                    <CustomiseToggle label="Show Quantities" optionKey="showMaterialQty" activeColor="bg-slate-800 text-white" />
                    <CustomiseToggle label="Show Unit Prices" optionKey="showMaterialUnitPrice" activeColor="bg-slate-800 text-white" />
                    <CustomiseToggle label="Show Line Totals" optionKey="showMaterialLineTotals" activeColor="bg-slate-800 text-white" />
                  </div>
                  <CustomiseToggle label="Section Total" optionKey="showMaterialSectionTotal" activeColor="bg-slate-800 text-white" />
                </div>
              </div>

              <div className="space-y-1 bg-slate-50/50 p-2 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100"><HardHat size={12} className="text-blue-500" /><span className="text-[9px] font-black uppercase tracking-widest text-slate-700">Labour</span></div>
                <CustomiseToggle label="Show Section" optionKey="showLabour" activeColor="bg-blue-600 text-white" />
                <div className={`space-y-1 pl-2 border-l border-slate-100 transition-all ${displayOptions.showLabour ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                  <CustomiseToggle label="Detailed Info" optionKey="showLabourItems" activeColor="bg-slate-900 text-blue-500" />
                  <div className={`space-y-1 transition-all ${displayOptions.showLabourItems ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                    <CustomiseToggle label="Show Hours" optionKey="showLabourQty" activeColor="bg-slate-800 text-white" />
                    <CustomiseToggle label="Show Hourly Rate" optionKey="showLabourUnitPrice" activeColor="bg-slate-800 text-white" />
                    <CustomiseToggle label="Show Subtotals" optionKey="showLabourLineTotals" activeColor="bg-slate-800 text-white" />
                  </div>
                  <CustomiseToggle label="Section Total" optionKey="showLabourSectionTotal" activeColor="bg-slate-800 text-white" />
                </div>
              </div>

              <div className="space-y-1 bg-slate-50/50 p-2 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100"><Landmark size={12} className="text-emerald-500" /><span className="text-[9px] font-black uppercase tracking-widest text-slate-700">Tax & Branding</span></div>
                <CustomiseToggle label="VAT Breakdown" optionKey="showVat" activeColor="bg-emerald-600 text-white" />
                <CustomiseToggle label="CIS Deductions" optionKey="showCis" activeColor="bg-emerald-600 text-white" />
                <CustomiseToggle label="Totals Summary" optionKey="showTotalsBreakdown" activeColor="bg-slate-900 text-white" />
                <CustomiseToggle label="Business Logo" optionKey="showLogo" activeColor="bg-slate-900 text-white" />
                <CustomiseToggle label="Terms/Notes" optionKey="showNotes" activeColor="bg-slate-900 text-white" />
              </div>
            </div>
          </div>
        )}
      </div>

      <div ref={documentRef} className={`bg-white ${templateStyle.container} shadow-xl border ${templateStyle.borderStyle} overflow-hidden print:border-none print:shadow-none print:rounded-none max-w-[750px] mx-auto`} style={{ width: '750px' }}>
        {/* Use ClassicTemplate component for classic template */}
        {activeTemplate === 'classic' ? (
          <ClassicTemplate
            quote={activeQuote}
            customer={customer}
            settings={settings}
            totals={totals}
            reference={reference}
          />
        ) : (
          <>
        {/* Company Header - Statement template has special Zoho-style layout */}
        {activeTemplate === 'professional' ? (
          /* PROFESSIONAL TEMPLATE HEADER - Matches Zoho screenshot */
          <div className={templateConfig.containerPadding}>
            <div className={`flex justify-between items-start ${templateConfig.sectionGap.replace('space-y-', 'mb-')}`}>
              {/* Left: Logo + Company */}
              <div className="flex-1">
                {displayOptions.showLogo && settings.companyLogo && (
                  <img
                    src={settings.companyLogo}
                    alt={settings.companyName || 'Logo'}
                    className={`${templateConfig.logoSize === 'large' ? 'h-20' : 'h-16'} w-auto object-contain mb-2`}
                    style={{ maxWidth: templateConfig.logoSize === 'large' ? '160px' : '120px' }}
                  />
                )}
                <h2 className={`${templateConfig.headerFontSize} font-bold text-slate-900`}>{settings.companyName}</h2>
                {settings.companyAddress && (
                  <p className={`${templateConfig.fontSize} text-slate-600 leading-snug whitespace-pre-line mt-0.5`}>{settings.companyAddress}</p>
                )}
                {settings.phone && <p className={`${templateConfig.fontSize} text-slate-600 mt-0.5`}>{settings.phone}</p>}
                {settings.email && <p className={`${templateConfig.fontSize} text-slate-600`}>{settings.email}</p>}
                {settings.vatNumber && <p className={`${templateConfig.fontSize} text-slate-600`}>{settings.vatNumber}</p>}
              </div>

              {/* Right: INVOICE header + Balance */}
              <div className="text-right">
                <h1 className={`${activeTemplate === 'spacious' ? 'text-3xl' : 'text-2xl'} font-bold text-slate-900 mb-1`}>
                  {activeQuote.type === 'invoice' ? 'INVOICE' : 'QUOTE'}
                </h1>
                <p className={`${templateConfig.fontSize} text-slate-600 font-semibold`}>{activeQuote.type === 'invoice' ? 'Invoice' : 'Quote'}# {reference}</p>
                <div className="mt-2">
                  <div className={`${templateConfig.fontSize} text-slate-600 font-semibold`}>Balance Due</div>
                  <div className={`${activeTemplate === 'spacious' ? 'text-2xl' : 'text-xl'} font-bold text-slate-900`}>£{totals.grandTotal.toFixed(2)}</div>
                </div>
              </div>
            </div>

            {/* Bill To + Dates Row */}
            <div className={`grid grid-cols-2 gap-4 ${templateConfig.sectionGap.replace('space-y-', 'mb-')}`}>
              <div>
                <div className={`${templateConfig.fontSize} font-bold text-slate-900 mb-1`}>Bill To</div>
                <p className={`${templateConfig.headerFontSize} font-bold text-slate-900`}>{customer?.name}</p>
                {customer?.company && <p className={`${templateConfig.fontSize} text-slate-600`}>{customer.company}</p>}
                {customer?.address && <p className={`${templateConfig.fontSize} text-slate-600 leading-snug`}>{customer.address}</p>}
              </div>
              <div className="space-y-0.5">
                <div className={`flex justify-between ${templateConfig.fontSize}`}>
                  <span className="text-slate-600">Invoice Date :</span>
                  <span className="text-slate-900 font-medium">{activeQuote?.date ? new Date(activeQuote.date).toLocaleDateString('en-GB') : ''}</span>
                </div>
                <div className={`flex justify-between ${templateConfig.fontSize}`}>
                  <span className="text-slate-600">Terms :</span>
                  <span className="text-slate-900 font-medium">Due on Receipt</span>
                </div>
                {activeQuote.dueDate && (
                  <div className={`flex justify-between ${templateConfig.fontSize}`}>
                    <span className="text-slate-600">Due Date :</span>
                    <span className="text-slate-900 font-medium">{new Date(activeQuote.dueDate).toLocaleDateString('en-GB')}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* STANDARD HEADER - All other templates */
          <>
            <div className={`${templateStyle.header} flex justify-between items-start`}>
              {/* Logo & Company Info */}
              <div className="flex items-start gap-2">
                {displayOptions.showLogo && settings.companyLogo && (
                  <img
                    src={settings.companyLogo}
                    alt={settings.companyName || 'Company Logo'}
                    className="h-12 w-auto object-contain"
                    style={{ maxWidth: '120px' }}
                  />
                )}
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{settings.companyName}</h2>
                  {settings.companyAddress && (
                    <p className="text-[11px] text-slate-500 leading-tight whitespace-pre-line">{settings.companyAddress}</p>
                  )}
                  <div className="flex gap-2 mt-1 text-[11px] text-slate-400">
                    {settings.phone && <span>{settings.phone}</span>}
                    {settings.email && <span>{settings.email}</span>}
                  </div>
                  {settings.vatNumber && (
                    <p className="text-[10px] text-slate-400">VAT: {settings.vatNumber}</p>
                  )}
                </div>
              </div>

              {/* Document Type Badge */}
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {activeQuote.type === 'invoice' ? 'Invoice' : activeQuote.type === 'quotation' ? 'Quotation' : 'Estimate'}
                </span>
                <p className="text-base font-mono font-bold text-slate-900">{reference}</p>
                <p className="text-[11px] text-slate-500">{activeQuote?.date ? new Date(activeQuote.date).toLocaleDateString('en-GB') : ''}</p>
                {activeQuote.type === 'invoice' && activeQuote.dueDate && (
                  <p className="text-[11px] text-amber-600 font-bold">
                    Due: {new Date(activeQuote.dueDate).toLocaleDateString('en-GB')}
                  </p>
                )}
              </div>
            </div>

            {/* Project Title Bar */}
            <div className={templateStyle.titleBar}>
              <h1 className={templateStyle.sectionTitle}>{activeQuote?.title || 'Proposed Works'}</h1>
            </div>

            {/* Client and Job Address Section */}
            <div className={templateStyle.clientSection}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {/* To: Client Address */}
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-0.5">
                    <User size={9} /> To
                  </p>
                  <p className="text-sm font-bold text-slate-900">{customer?.name}</p>
                  {customer?.company && <p className="text-[11px] text-slate-600">{customer.company}</p>}
                  {customer?.address && (
                    <p className="text-[11px] text-slate-500 leading-snug">{customer.address}</p>
                  )}
                </div>

                {/* For: Job Address (only show if different from client) */}
                {activeQuote.jobAddress && activeQuote.jobAddress !== customer?.address && (
                  <div>
                    <p className="text-[9px] font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1 mb-0.5">
                      <MapPin size={9} /> Job Site
                    </p>
                    <p className="text-[11px] text-slate-500 leading-snug">{activeQuote.jobAddress}</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* COMBINED LINE ITEMS TABLE - For templates that combine materials + labour */}
        {templateConfig.combineLineItems ? (
          <div className="px-4 pb-2">
            <table className={`w-full ${templateStyle.tableText}`} style={{ borderCollapse: 'collapse' }}>
              {templateConfig.showColumnHeaders && (
                <thead>
                  <tr className={tableHeaderStyle}>
                    {templateConfig.showLineNumbers && (
                      <th className={`${templateConfig.rowPadding} text-left w-10 font-semibold`}>#</th>
                    )}
                    <th className={`${templateConfig.rowPadding} text-left font-semibold`}>Item & Description</th>
                    <th className={`${templateConfig.rowPadding} text-center w-16 font-semibold`}>Qty</th>
                    {activeTemplate === 'professional' && (
                      <th className={`${templateConfig.rowPadding} text-right w-24 font-semibold`}>Rate</th>
                    )}
                    <th className={`${templateConfig.rowPadding} text-right w-24 font-semibold`}>Amount</th>
                  </tr>
                </thead>
              )}
              <tbody>
                {getAllLineItems().map((item, idx) => (
                  item.isHeading ? (
                    <tr key={`heading-${idx}`} className="bg-slate-50">
                      <td colSpan={activeTemplate === 'professional' ? 5 : (templateConfig.showLineNumbers ? 4 : 3)} className="py-1 px-2">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{item.description}</span>
                      </td>
                    </tr>
                  ) : (
                    <tr key={`item-${idx}`} className={templateConfig.showTableBorders ? 'border-b border-slate-100' : ''}>
                      {templateConfig.showLineNumbers && (
                        <td className={`${templateConfig.rowPadding} text-slate-600`}>{item.lineNum}</td>
                      )}
                      <td className={templateConfig.rowPadding}>
                        <div className="text-slate-900 font-medium">{item.name}</div>
                        {item.subtext && <div className="text-[9px] text-slate-500 mt-0.5">{item.subtext}</div>}
                      </td>
                      <td className={`${templateConfig.rowPadding} text-slate-900 text-center font-medium`}>{item.qty}</td>
                      {activeTemplate === 'professional' && (
                        <td className={`${templateConfig.rowPadding} text-slate-900 text-right`}>{item.rate ? `${item.rate.toFixed(2)}` : '-'}</td>
                      )}
                      <td className={`${templateConfig.rowPadding} text-slate-900 text-right font-medium`}>
                        {item.amount.toFixed(2)}
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* SEPARATE SECTIONS - For templates that split materials/labour */
          (activeQuote.sections || []).map((section, idx) => {
          const markupMultiplier = 1 + ((activeQuote.markupPercent || 0) / 100);
          // Filter out heading items from materials total
          const rawMaterialsTotal = (section.items || []).filter(i => !i.isHeading).reduce((s, i) => s + (i.totalPrice || 0), 0);
          // Use labourItems if present, otherwise fall back
          const rawLabourTotal = getSectionLabour(section);
          // Use subsectionPrice override if set
          const sectionTotal = section.subsectionPrice !== undefined ? section.subsectionPrice : (rawMaterialsTotal + rawLabourTotal);
          // Get total labour hours
          const totalLabourHours = section.labourItems && section.labourItems.length > 0
            ? section.labourItems.reduce((sum, item) => sum + item.hours, 0)
            : section.labourHours || 0;

          return (
            <div key={section.id} className={`${templateStyle.sectionPadding} ${idx % 2 === 1 ? 'bg-slate-50/30' : 'bg-white'} ${templateStyle.sectionSpacing}`}>
              <div className="flex items-center gap-2.5">
                 <span className={`${templateStyle.tableText} font-bold text-slate-400`}>{idx + 1}.</span>
                 <h4 className={templateStyle.sectionTitle}>{section.title}</h4>
              </div>

              {/* Materials Block */}
              {displayOptions.showMaterials && (rawMaterialsTotal > 0 || (section.items || []).length > 0) && (
                <div className="space-y-1">
                  {templateConfig.showSectionHeaders && (
                    <div className={templateStyle.materialHeader}>
                      {templateConfig.showIcons && <Package size={12} className="text-amber-500" />}
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Materials</span>
                    </div>
                  )}

                  {displayOptions.showMaterialItems && (section.items || []).length > 0 && (
                    <div className="w-full">
                      {/* Desktop Table */}
                      <table className={`hidden md:table w-full text-left ${activeTemplate === 'minimal' ? 'border border-slate-300' : ''}`} style={{ borderCollapse: 'collapse' }}>
                        <thead>
                          <tr className={activeTemplate === 'minimal' ? 'border-b-2 border-slate-300 bg-slate-50' : 'border-b border-slate-100'}>
                            <th className={`${activeTemplate === 'minimal' ? 'py-1 px-2' : 'py-1 px-2'} text-[9px] font-bold ${activeTemplate === 'minimal' ? 'text-slate-700' : 'text-slate-400'} uppercase tracking-wider ${activeTemplate === 'minimal' ? 'border-r border-slate-300' : ''}`} style={{ lineHeight: '1.6' }}>Item & Description</th>
                            {displayOptions.showMaterialQty && <th className={`${activeTemplate === 'minimal' ? 'py-1 px-2' : 'py-1 px-2'} text-[9px] font-bold ${activeTemplate === 'minimal' ? 'text-slate-700' : 'text-slate-400'} uppercase tracking-wider text-center w-20 ${activeTemplate === 'minimal' ? 'border-r border-slate-300' : ''}`} style={{ lineHeight: '1.6' }}>Qty</th>}
                            {displayOptions.showMaterialUnitPrice && <th className={`${activeTemplate === 'minimal' ? 'py-1 px-2' : 'py-1 px-2'} text-[9px] font-bold ${activeTemplate === 'minimal' ? 'text-slate-700' : 'text-slate-400'} uppercase tracking-wider text-right w-24 ${activeTemplate === 'minimal' ? 'border-r border-slate-300' : ''}`} style={{ lineHeight: '1.6' }}>Rate</th>}
                            {displayOptions.showMaterialLineTotals && <th className={`${activeTemplate === 'minimal' ? 'py-1 px-2' : 'py-1 px-2'} text-[9px] font-bold ${activeTemplate === 'minimal' ? 'text-slate-700' : 'text-slate-400'} uppercase tracking-wider text-right w-24`} style={{ lineHeight: '1.6' }}>Amount</th>}
                          </tr>
                        </thead>
                        <tbody className={activeTemplate === 'minimal' ? '' : 'divide-y divide-slate-50'}>
                          {(section.items || []).map(item => (
                            item.isHeading ? (
                              // Heading row
                              <tr key={item.id} className={`bg-slate-50 ${activeTemplate === 'minimal' ? 'border-b border-slate-300' : ''}`}>
                                <td colSpan={4} className={`${activeTemplate === 'minimal' ? 'py-1 px-2' : 'py-1 px-2'} ${activeTemplate === 'minimal' ? 'border-r border-slate-300' : ''}`}>
                                  <div className="flex items-center gap-1">
                                    <Type size={10} className="text-slate-400" />
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{item.name || 'Section'}</span>
                                  </div>
                                </td>
                              </tr>
                            ) : (
                              <tr key={item.id} className={activeTemplate === 'minimal' ? 'border-b border-slate-300' : ''}>
                                <td className={`${activeTemplate === 'minimal' ? 'py-1 px-2' : 'py-1 px-2'} ${activeTemplate === 'minimal' ? 'border-r border-slate-300' : ''}`} style={{ lineHeight: '1.5' }}><p className={`${activeTemplate === 'minimal' ? 'text-[10px]' : 'text-[11px]'} font-medium text-slate-900`} style={{ lineHeight: '1.5' }}>{[item.name, item.description].filter(Boolean).join(' ')}</p></td>
                                {displayOptions.showMaterialQty && <td className={`${activeTemplate === 'minimal' ? 'py-1 px-2' : 'py-1 px-2'} text-center ${activeTemplate === 'minimal' ? 'border-r border-slate-300' : ''}`} style={{ lineHeight: '1.5' }}><span className="text-[10px] font-medium text-slate-700" style={{ lineHeight: '1.5' }}>{item.quantity} {item.unit}</span></td>}
                                {displayOptions.showMaterialUnitPrice && <td className={`${activeTemplate === 'minimal' ? 'py-1 px-2' : 'py-1 px-2'} text-right text-[10px] font-medium ${activeTemplate === 'minimal' ? 'text-slate-700 border-r border-slate-300' : 'text-slate-600'}`} style={{ lineHeight: '1.5' }}>£{(item.unitPrice * markupMultiplier).toFixed(2)}</td>}
                                {displayOptions.showMaterialLineTotals && <td className={`${activeTemplate === 'minimal' ? 'py-1 px-2' : 'py-1 px-2'} text-right text-[10px] font-bold ${activeTemplate === 'minimal' ? 'text-slate-900' : 'text-slate-900'}`} style={{ lineHeight: '1.5' }}>£{(item.totalPrice * markupMultiplier).toFixed(2)}</td>}
                              </tr>
                            )
                          ))}
                        </tbody>
                      </table>

                      {/* Mobile List View - Ultra Clean */}
                      <div className="md:hidden">
                        {(section.items || []).map(item => (
                          item.isHeading ? (
                            // Heading row for mobile
                            <div key={item.id} className="py-1 px-2 bg-slate-50 rounded my-0.5 flex items-center gap-1">
                              <Type size={10} className="text-slate-400" />
                              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{item.name || 'Section'}</span>
                            </div>
                          ) : (
                            <div key={item.id} className="py-1 border-b border-slate-50 last:border-0 flex justify-between items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  {displayOptions.showMaterialQty && <span className="text-[9px] font-medium text-slate-500 bg-slate-100 px-1 rounded">{item.quantity}{item.unit}</span>}
                                  <span className="font-medium text-slate-900 text-[11px]">{[item.name, item.description].filter(Boolean).join(' ')}</span>
                                </div>
                              </div>
                              <div className="text-right whitespace-nowrap">
                                {displayOptions.showMaterialLineTotals && <p className="text-[11px] font-bold text-slate-900">£{(item.totalPrice * markupMultiplier).toFixed(2)}</p>}
                              </div>
                            </div>
                          )
                        ))}
                      </div>
                    </div>
                  )}

                  {displayOptions.showMaterialSectionTotal && (
                    <div className={`flex justify-between items-center py-1 ${templateConfig.showBackgrounds ? 'bg-slate-50 px-2 rounded-lg border border-slate-100/50' : 'border-t border-slate-100 px-1'}`}>
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Materials Total</span>
                      <span className="font-bold text-[11px] text-slate-900">£{(rawMaterialsTotal * markupMultiplier).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Labour Block - Now with itemized support */}
              {displayOptions.showLabour && rawLabourTotal > 0 && (
                <div className="space-y-1">
                  {templateConfig.showSectionHeaders && (
                    <div className="flex items-center gap-1.5 border-b border-slate-100 pb-1">
                      {templateConfig.showIcons && <HardHat size={12} className="text-blue-500" />}
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Labour & Site Support</span>
                    </div>
                  )}

                  {displayOptions.showLabourItems && (
                    <div className="space-y-1.5">
                      {/* Itemized Labour List */}
                      {section.labourItems && section.labourItems.length > 0 ? (
                        <>
                          {section.labourItems.map((labourItem) => {
                            const rate = labourItem.rate || section.labourRate || activeQuote.labourRate || settings.defaultLabourRate;
                            const itemTotal = labourItem.hours * rate;
                            return (
                              <div key={labourItem.id} className={`py-1 px-2 ${templateConfig.showBackgrounds ? 'bg-blue-50/40 rounded-lg border border-blue-100/30' : 'border-b border-slate-100'} flex justify-between items-center`}>
                                <div className="flex-1">
                                  <p className="text-[11px] font-medium text-slate-900">{labourItem.description || 'Labour'}</p>
                                  {(displayOptions.showLabourQty || displayOptions.showLabourUnitPrice) && (
                                    <span className="text-[9px] font-medium text-slate-500">
                                      {displayOptions.showLabourQty ? `${labourItem.hours} hrs` : ''}
                                      {displayOptions.showLabourQty && displayOptions.showLabourUnitPrice ? ' @ ' : ''}
                                      {displayOptions.showLabourUnitPrice ? `£${(rate * markupMultiplier).toFixed(2)}/hr` : ''}
                                    </span>
                                  )}
                                </div>
                                {displayOptions.showLabourLineTotals && (
                                  <p className="text-[11px] font-bold text-blue-600">£{(itemTotal * markupMultiplier).toFixed(2)}</p>
                                )}
                              </div>
                            );
                          })}
                        </>
                      ) : (
                        // Fallback to old-style single labour block
                        <div className={`py-1 px-2 ${templateConfig.showBackgrounds ? 'bg-blue-50/40 rounded-lg border border-blue-100/30' : 'border-b border-slate-100'} flex justify-between items-center`}>
                          <div className="flex-1">
                            <p className="text-[11px] font-medium text-slate-900">Technical Personnel & Site Resource</p>
                            {totalLabourHours > 0 && (displayOptions.showLabourQty || displayOptions.showLabourUnitPrice) && (
                              <p className="text-[9px] font-medium text-slate-500">
                                {displayOptions.showLabourQty ? `${totalLabourHours} hrs` : ''}
                                {displayOptions.showLabourQty && displayOptions.showLabourUnitPrice ? ' @ ' : ''}
                                {displayOptions.showLabourUnitPrice ? `£${((activeQuote.labourRate || settings.defaultLabourRate) * markupMultiplier).toFixed(2)}/hr` : ''}
                              </p>
                            )}
                          </div>
                          {displayOptions.showLabourSectionTotal && (
                            <p className="text-[11px] font-bold text-blue-600">£{(rawLabourTotal * markupMultiplier).toFixed(2)}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {displayOptions.showLabourSectionTotal && (
                    <div className={`flex justify-between items-center py-1 ${templateConfig.showBackgrounds ? 'bg-blue-50/50 px-2 rounded-lg border border-blue-100/50' : 'border-t border-slate-100 px-1'}`}>
                      <span className="text-[9px] font-bold text-blue-500 uppercase tracking-wider">
                        Labour Total {totalLabourHours > 0 && `(${totalLabourHours} hrs)`}
                      </span>
                      <span className="font-bold text-[11px] text-blue-600">£{(rawLabourTotal * markupMultiplier).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                <span className="text-[8px] font-medium text-slate-400 uppercase tracking-wider">Section {idx + 1}</span>
                <p className="text-[10px] font-bold text-slate-600">Section Total: <span className="text-slate-900 ml-1">£{(sectionTotal * markupMultiplier).toFixed(2)}</span></p>
              </div>
            </div>
          );
        })
        )}

        {/* TOTALS SECTION - Statement template has special compact right-aligned layout */}
        {activeTemplate === 'professional' || activeTemplate === 'spacious' ? (
          /* PROFESSIONAL TEMPLATE TOTALS - Zoho-style right-aligned */
          <div className={`${templateConfig.containerPadding} py-1`}>
            <div className="flex justify-end">
              <div className={activeTemplate === 'spacious' ? 'w-56' : 'w-48'}>
                <div className={`flex justify-between py-1 border-b border-slate-100 ${templateConfig.fontSize}`}>
                  <span className="text-slate-500">Sub Total</span>
                  <span className="text-slate-900">£{totals.clientSubtotal.toFixed(2)}</span>
                </div>
                {totals.discountAmount > 0 && (
                  <div className={`flex justify-between py-1 border-b border-slate-100 ${templateConfig.fontSize}`}>
                    <span className="text-slate-500">Discount</span>
                    <span className="text-slate-900">-£{totals.discountAmount.toFixed(2)}</span>
                  </div>
                )}
                {settings.enableVat && displayOptions.showVat && totals.taxAmount > 0 && (
                  <div className={`flex justify-between py-1 border-b border-slate-100 ${templateConfig.fontSize}`}>
                    <span className="text-slate-500">VAT ({activeQuote.taxPercent}%)</span>
                    <span className="text-slate-900">£{totals.taxAmount.toFixed(2)}</span>
                  </div>
                )}
                {settings.enableCis && displayOptions.showCis && totals.cisAmount > 0 && (
                  <div className={`flex justify-between py-1 border-b border-slate-100 ${templateConfig.fontSize}`}>
                    <span className="text-slate-500">CIS Deduction</span>
                    <span className="text-slate-900">-£{totals.cisAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className={`flex justify-between py-1 font-bold bg-slate-100 px-2 -mx-2 mt-1 rounded ${templateConfig.headerFontSize}`}>
                  <span>Balance Due</span>
                  <span>£{totals.grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Part Payment - compact version */}
            {activeQuote.type === 'invoice' && activeQuote.partPaymentEnabled && activeQuote.partPaymentValue && (
              <div className="flex justify-end mt-2">
                <div className={`bg-teal-50 border border-teal-200 p-2 rounded-lg ${activeTemplate === 'spacious' ? 'w-56' : 'w-48'}`}>
                  <div className={`flex justify-between ${templateConfig.fontSize}`}>
                    <span className="text-teal-700">{activeQuote.partPaymentLabel || 'Due Now'}</span>
                    <span className="font-bold text-teal-700">£{partPaymentAmount.toFixed(2)}</span>
                  </div>
                  <div className={`flex justify-between text-[9px] mt-1`}>
                    <span className="text-slate-500">Remaining</span>
                    <span className="text-slate-700">£{(totals.grandTotal - partPaymentAmount).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* STANDARD TOTALS - All other templates */
          <div className={`${activeTemplate === 'minimal' ? 'bg-white border-t-2 border-slate-300 text-slate-900' : currentThemeClass} px-2 py-1 ${templateStyle.footerRounding} ${activeTemplate === 'minimal' ? '' : 'shadow-sm'}`}>
            <div className="flex flex-col gap-2">
              <div className="space-y-1">
                {displayOptions.showTotalsBreakdown && (
                  <>
                    <div className={`flex justify-between text-[10px] ${activeTemplate === 'minimal' ? 'text-slate-700 font-medium' : 'opacity-70'}`}><span>Sub Total</span><span className={activeTemplate === 'minimal' ? '' : 'opacity-90'}>£{totals.clientSubtotal.toFixed(2)}</span></div>
                    {totals.discountAmount > 0 && (
                      <div className={`flex justify-between text-[10px] ${activeTemplate === 'minimal' ? 'text-slate-700 font-medium' : ''}`}>
                        <span className={`flex items-center gap-1 ${activeTemplate === 'minimal' ? '' : 'opacity-70'}`}>
                          <Tag size={9} />
                          Discount
                          {activeQuote.discountDescription && <span className={activeTemplate === 'minimal' ? 'text-slate-500 ml-1' : 'opacity-50 ml-1'}>({activeQuote.discountDescription})</span>}
                          {activeQuote.discountType === 'percentage' && <span className={activeTemplate === 'minimal' ? 'text-slate-500 ml-1' : 'opacity-50 ml-1'}>({activeQuote.discountValue}%)</span>}
                        </span>
                        <span className="font-semibold">-£{totals.discountAmount.toFixed(2)}</span>
                      </div>
                    )}
                    {settings.enableVat && displayOptions.showVat && (
                      <div className={`flex justify-between text-[10px] ${activeTemplate === 'minimal' ? 'text-slate-700 font-medium' : 'opacity-70'}`}><span>VAT ({activeQuote.taxPercent}%)</span><span className={activeTemplate === 'minimal' ? '' : 'opacity-90'}>£{totals.taxAmount.toFixed(2)}</span></div>
                    )}
                    {settings.enableCis && displayOptions.showCis && totals.cisAmount > 0 && (
                      <div className={`flex justify-between text-[10px] ${activeTemplate === 'minimal' ? 'text-slate-700 font-medium' : 'opacity-70'}`}><span>CIS Deduction ({activeQuote.cisPercent}%)</span><span className={activeTemplate === 'minimal' ? '' : 'opacity-90'}>-£{totals.cisAmount.toFixed(2)}</span></div>
                    )}
                  </>
                )}
                <div className={`h-px ${activeTemplate === 'minimal' ? 'bg-slate-300' : 'bg-current opacity-20'} my-1`}></div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    {activeTemplate !== 'minimal' && <div className="w-1 h-1 rounded-full bg-current opacity-60"></div>}
                    <span className={`font-bold ${activeTemplate === 'minimal' ? 'text-sm' : 'text-[10px] opacity-80'} uppercase tracking-wider`}>{activeQuote.type === 'invoice' ? 'Balance Due' : 'Total Due'}</span>
                  </div>
                  <span className={`${activeTemplate === 'minimal' ? 'text-2xl' : 'text-xl'} font-black`}>£{totals.grandTotal.toFixed(2)}</span>
                </div>

                {/* Part Payment Highlight Box */}
                {activeQuote.type === 'invoice' && activeQuote.partPaymentEnabled && activeQuote.partPaymentValue && (
                  <div className="bg-white border border-teal-200 p-2 rounded-xl mt-2 shadow-sm">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
                          {activeQuote.partPaymentLabel || 'Amount Due Now'}
                        </p>
                        <p className="text-lg font-black text-teal-600">
                          £{partPaymentAmount.toFixed(2)}
                        </p>
                        {activeQuote.partPaymentType === 'percentage' && (
                          <p className="text-[9px] font-bold text-slate-400">
                            ({activeQuote.partPaymentValue}% of £{totals.grandTotal.toFixed(2)})
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Balance</p>
                        <p className="text-base font-black text-slate-700">
                          £{(totals.grandTotal - partPaymentAmount).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Bank Details Section - Only for invoices */}
              {activeQuote.type === 'invoice' && (
                settings.bankAccountName || settings.bankAccountNumber || settings.bankSortCode || settings.bankName
              ) && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-2">
                    <div className="flex items-center gap-2 mb-2">
                      <Landmark size={14} className="text-emerald-600" />
                      <h4 className="text-[10px] font-black text-emerald-900 uppercase tracking-widest">Payment Details</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      {settings.bankAccountName && (
                        <div>
                          <p className="text-[8px] font-bold text-emerald-700 uppercase">Account Name</p>
                          <p className="text-[10px] font-bold text-slate-900">{settings.bankAccountName}</p>
                        </div>
                      )}
                      {settings.bankName && (
                        <div>
                          <p className="text-[8px] font-bold text-emerald-700 uppercase">Bank</p>
                          <p className="text-[10px] font-bold text-slate-900">{settings.bankName}</p>
                        </div>
                      )}
                      {settings.bankAccountNumber && (
                        <div>
                          <p className="text-[8px] font-bold text-emerald-700 uppercase">Account Number</p>
                          <p className="text-[10px] font-bold text-slate-900">{settings.bankAccountNumber}</p>
                        </div>
                      )}
                      {settings.bankSortCode && (
                        <div>
                          <p className="text-[8px] font-bold text-emerald-700 uppercase">Sort Code</p>
                          <p className="text-[10px] font-bold text-slate-900">{settings.bankSortCode}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {displayOptions.showNotes && activeQuote?.notes && (
                  <div className="text-[8px] leading-snug opacity-60 mt-2">
                    {activeQuote.notes}
                  </div>
              )}
            </div>
          </div>
        )}

        {/* Notes section for Professional Template */}
        {(activeTemplate === 'professional' || activeTemplate === 'spacious') && (displayOptions.showNotes || (settings.bankAccountName || settings.bankAccountNumber || settings.bankSortCode || settings.bankName)) && (
          <div className={`${templateConfig.containerPadding} py-3 border-t border-slate-200`}>
            <div className={`${templateConfig.fontSize} font-bold text-slate-900 mb-2`}>Notes</div>
            {(settings.bankAccountName || settings.bankAccountNumber || settings.bankSortCode || settings.bankName) && activeQuote.type === 'invoice' && (
              <div className="mb-2">
                <div className={`${templateConfig.fontSize} text-slate-900`}>Payment Details:</div>
                <div className={`${templateConfig.fontSize} text-slate-600 space-y-0.5 mt-1`}>
                  {settings.bankAccountName && <div>Mr {settings.bankAccountName}</div>}
                  {settings.bankAccountNumber && <div>{settings.bankAccountNumber}</div>}
                  {settings.bankSortCode && <div>{settings.bankSortCode}</div>}
                  {settings.bankName && <div>{settings.bankName}</div>}
                </div>
              </div>
            )}
            {displayOptions.showNotes && activeQuote?.notes && (
              <div className={`${templateConfig.fontSize} text-slate-600 leading-relaxed`}>
                {activeQuote.notes}
              </div>
            )}
          </div>
        )}
          </>
        )}
      </div>
      <div className="flex justify-center pt-4 print:hidden">
        <div className={`px-6 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm flex items-center gap-2.5 ${statusColors[activeQuote.status || 'draft']}`}>Status: {activeQuote.status || 'draft'}</div>
      </div>

      {/* Payment Recorder Modal */}
      {showPaymentRecorder && activeQuote.type === 'invoice' && (
        <PaymentRecorder
          invoice={activeQuote}
          invoiceTotal={totals.grandTotal}
          onRecordPayment={handleRecordPayment}
          onClose={() => setShowPaymentRecorder(false)}
        />
      )}

      {/* Email Helper Modal */}
      {emailHelper?.show && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-2">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[85vh] overflow-hidden animate-in slide-in-from-bottom-4">
            {/* Header */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
                  <Mail size={20} />
                </div>
                <div>
                  <h3 className="font-bold">PDF Downloaded</h3>
                  <p className="text-xs text-slate-400">{emailHelper.filename}</p>
                </div>
              </div>
              <button
                onClick={() => setEmailHelper(null)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2 flex items-start gap-2">
                <Check size={18} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-emerald-800">
                  PDF saved to your downloads. Now send it via email:
                </p>
              </div>

              {/* Email preview */}
              <div className="space-y-1.5">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">To</label>
                  <p className="text-sm font-medium text-slate-700">{emailHelper.email || '(add recipient)'}</p>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Subject</label>
                  <p className="text-sm font-medium text-slate-700">{emailHelper.subject}</p>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Message</label>
                  <div className="bg-slate-50 rounded-xl p-2 mt-1 border border-slate-100">
                    <p className="text-sm text-slate-600 whitespace-pre-line">{emailHelper.body}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-5 pt-0 space-y-1.5">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(emailHelper.body);
                  setEmailHelper({ ...emailHelper, copied: true });
                  setTimeout(() => setEmailHelper(prev => prev ? { ...prev, copied: false } : null), 2000);
                }}
                className={`w-full py-1 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                  emailHelper.copied
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {emailHelper.copied ? <Check size={18} /> : <Copy size={18} />}
                {emailHelper.copied ? 'Copied!' : 'Copy Message'}
              </button>

              <button
                onClick={() => {
                  const mailtoLink = `mailto:${emailHelper.email}?subject=${encodeURIComponent(emailHelper.subject)}&body=${encodeURIComponent(emailHelper.body)}`;
                  window.location.href = mailtoLink;
                }}
                className="w-full py-1.5 bg-blue-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/30"
              >
                <Mail size={18} />
                Open Email App
              </button>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-2 mt-2">
                <p className="text-xs text-amber-800 text-center">
                  In your email app, tap the <strong>paperclip icon</strong> to attach the PDF from your Downloads folder
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
