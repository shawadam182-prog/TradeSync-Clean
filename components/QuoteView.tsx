
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

  // Helper: Calculate labour for a section (supports itemized labour)
  const calculateSectionLabour = (section: QuoteSection) => {
    const defaultRate = section.labourRate || activeQuote.labourRate || settings.defaultLabourRate;
    if (section.labourItems && section.labourItems.length > 0) {
      return section.labourItems.reduce((sum, item) => {
        const rate = item.rate || defaultRate;
        return sum + (item.hours * rate);
      }, 0);
    }
    // Fallback to labourCost or hours-based calculation
    if (section.labourCost !== undefined) return section.labourCost;
    return (section.labourHours || 0) * defaultRate;
  };

  const calculateTotals = () => {
    try {
      const sections = activeQuote.sections || [];
      const markupMultiplier = 1 + ((activeQuote.markupPercent || 0) / 100);

      let materialsTotal = 0;
      let labourTotal = 0;
      let sectionsTotal = 0;

      sections.forEach(s => {
        // Filter out heading items from materials total
        const sectionMaterials = (s.items || []).filter(i => !i.isHeading).reduce((sum, item) => sum + (item?.totalPrice || 0), 0);
        // Use labourItems if present, otherwise fall back
        const sectionLabour = calculateSectionLabour(s);
        // Use subsectionPrice override if set, otherwise calculate from materials + labour
        const sectionPrice = s.subsectionPrice !== undefined ? s.subsectionPrice : (sectionMaterials + sectionLabour);

        materialsTotal += sectionMaterials;
        labourTotal += sectionLabour;
        sectionsTotal += sectionPrice;
      });

      const clientSubtotal = sectionsTotal * markupMultiplier;

      // Calculate discount
      let discountAmount = 0;
      if (activeQuote.discountValue) {
        if (activeQuote.discountType === 'percentage') {
          discountAmount = clientSubtotal * (activeQuote.discountValue / 100);
        } else {
          discountAmount = activeQuote.discountValue;
        }
      }

      const afterDiscount = clientSubtotal - discountAmount;
      const taxAmount = (settings.enableVat && displayOptions.showVat) ? afterDiscount * ((activeQuote.taxPercent || 0) / 100) : 0;
      const cisAmount = (settings.enableCis && displayOptions.showCis) ? labourTotal * ((activeQuote.cisPercent || 0) / 100) : 0;

      const grandTotal = (afterDiscount + taxAmount) - cisAmount;

      return { materialsTotal, labourTotal, clientSubtotal, discountAmount, taxAmount, cisAmount, grandTotal };
    } catch (e) {
      return { materialsTotal: 0, labourTotal: 0, clientSubtotal: 0, discountAmount: 0, taxAmount: 0, cisAmount: 0, grandTotal: 0 };
    }
  };

  const totals = calculateTotals();

  const handleRecordPayment = (payment: {
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

    const message = `Hi ${customer?.name || 'there'},

${activeQuote.type === 'invoice' ? '📄' : '📝'} Your ${docType} is ready!

*Reference:* ${prefix}${numStr}
*Project:* ${activeQuote.title}
*Date:* ${activeQuote?.date ? new Date(activeQuote.date).toLocaleDateString('en-GB') : 'N/A'}
${breakdown}
${totalsBreakdown}

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

      // Use lower scale on mobile to prevent memory issues
      const isMobile = window.innerWidth < 768;
      const scale = isMobile ? 1.5 : 2;

      // Generate PDF
      const canvas = await html2canvas(documentRef.current, {
        scale,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: documentRef.current.scrollWidth,
        windowHeight: documentRef.current.scrollHeight,
      });

      // Use PNG for better compatibility
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

      // Handle multi-page
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

      // Build email content
      const subject = `${docType.charAt(0).toUpperCase() + docType.slice(1)} - ${activeQuote.title} (${prefix}${numStr})`;
      const body = `Dear ${customerName},

Please find attached ${docType} as discussed.

Thanks,
${settings?.companyName || ''}${settings?.phone ? `\n${settings.phone}` : ''}${settings?.email ? `\n${settings.email}` : ''}`;

      // Save PDF to downloads (this works reliably)
      pdf.save(filename);

      // Open email with body pre-filled, user attaches PDF from downloads
      const mailtoLink = `mailto:${customer?.email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

      // Small delay to let PDF download complete
      setTimeout(() => {
        window.location.href = mailtoLink;
      }, 300);
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

  const CustomiseToggle = ({ label, optionKey, activeColor }: { label: string, optionKey: keyof QuoteDisplayOptions, activeColor: string }) => (
    <button
      onClick={() => toggleOption(optionKey)}
      className={`flex items-center justify-between w-full px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${
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
      <div className="sticky top-0 z-40 bg-white border-b border-slate-100 p-4 flex items-center justify-between shadow-sm -mx-4 md:mx-0 print:hidden mb-4">
        <div className="flex items-center gap-3">
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

      <div className="flex flex-col gap-4 print:hidden">
        {/* Secondary Actions Row */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
            <button
              onClick={() => setShowCustomiser(!showCustomiser)}
              className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-100 text-slate-600 text-xs font-bold shadow-sm"
            >
              <Settings2 size={14} /> Layout
            </button>
            {onDuplicate && (
              <button onClick={onDuplicate} className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-100 text-slate-600 text-xs font-bold shadow-sm">
                <Copy size={14} /> Duplicate
              </button>
            )}
            {activeQuote.type !== 'invoice' && onConvertToInvoice && ['draft', 'sent', 'accepted'].includes(activeQuote.status) && (
              <button onClick={onConvertToInvoice} className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-bold shadow-sm border border-emerald-100">
                <ReceiptText size={14} /> To Invoice
              </button>
            )}
            {activeQuote.type === 'invoice' && activeQuote.status !== 'paid' && (
              <button
                onClick={() => setShowPaymentRecorder(true)}
                className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-500/30 hover:bg-emerald-600 transition-colors"
              >
                <Banknote size={14} /> Record Payment
              </button>
            )}
            {customer?.address && (
              <button onClick={handleOpenMaps} className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 text-blue-600 text-xs font-bold shadow-sm border border-blue-100">
                <MapPin size={14} /> Map
              </button>
            )}
        </div>

        {showCustomiser && (
          <div className="bg-white p-5 rounded-[28px] border border-slate-200 shadow-2xl animate-in slide-in-from-top-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="space-y-2 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
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

              <div className="space-y-2 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
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

              <div className="space-y-2 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
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

      <div ref={documentRef} className="bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden print:border-none print:shadow-none print:rounded-none">
        {/* Company Header */}
        <div className="p-4 flex justify-between items-start">
          {/* Logo & Company Info */}
          <div className="flex items-start gap-3">
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
              <div className="flex gap-3 mt-1 text-[11px] text-slate-400">
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
        <div className="bg-slate-900 text-white px-4 py-2">
          <h1 className="text-sm font-bold">{activeQuote?.title || 'Proposed Works'}</h1>
        </div>

        {/* Client and Job Address Section */}
        <div className="px-4 py-3 bg-slate-50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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

        {(activeQuote.sections || []).map((section, idx) => {
          const markupMultiplier = 1 + ((activeQuote.markupPercent || 0) / 100);
          // Filter out heading items from materials total
          const rawMaterialsTotal = (section.items || []).filter(i => !i.isHeading).reduce((s, i) => s + (i.totalPrice || 0), 0);
          // Use labourItems if present, otherwise fall back
          const rawLabourTotal = calculateSectionLabour(section);
          // Use subsectionPrice override if set
          const sectionTotal = section.subsectionPrice !== undefined ? section.subsectionPrice : (rawMaterialsTotal + rawLabourTotal);
          // Get total labour hours
          const totalLabourHours = section.labourItems && section.labourItems.length > 0
            ? section.labourItems.reduce((sum, item) => sum + item.hours, 0)
            : section.labourHours || 0;

          return (
            <div key={section.id} className={`px-4 py-3 ${idx % 2 === 1 ? 'bg-slate-50/30' : 'bg-white'} space-y-3`}>
              <div className="flex items-center gap-2">
                 <div className="h-6 w-6 bg-slate-900 text-amber-500 rounded flex items-center justify-center font-bold text-[10px]">{idx + 1}</div>
                 <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">{section.title}</h4>
              </div>

              {/* Materials Block */}
              {displayOptions.showMaterials && (rawMaterialsTotal > 0 || (section.items || []).length > 0) && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 border-b border-slate-100 pb-1">
                    <Package size={12} className="text-amber-500" />
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Materials</span>
                  </div>

                  {displayOptions.showMaterialItems && (section.items || []).length > 0 && (
                    <div className="w-full">
                      {/* Desktop Table */}
                      <table className="hidden md:table w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <th className="py-1 text-[8px] font-bold text-slate-400 uppercase tracking-wider">Item</th>
                            {displayOptions.showMaterialQty && <th className="py-1 text-[8px] font-bold text-slate-400 uppercase tracking-wider text-center w-16">Qty</th>}
                            {displayOptions.showMaterialUnitPrice && <th className="py-1 text-[8px] font-bold text-slate-400 uppercase tracking-wider text-right w-20">Unit</th>}
                            {displayOptions.showMaterialLineTotals && <th className="py-1 text-[8px] font-bold text-slate-400 uppercase tracking-wider text-right w-20">Total</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {(section.items || []).map(item => (
                            item.isHeading ? (
                              // Heading row
                              <tr key={item.id} className="bg-slate-50">
                                <td colSpan={4} className="py-1 px-2">
                                  <div className="flex items-center gap-1">
                                    <Type size={10} className="text-slate-400" />
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{item.name || 'Section'}</span>
                                  </div>
                                </td>
                              </tr>
                            ) : (
                              <tr key={item.id}>
                                <td className="py-1.5 pr-2"><p className="text-[11px] font-medium text-slate-900">{item.name}</p>{item.description && <p className="text-[9px] text-slate-400 italic leading-tight">{item.description}</p>}</td>
                                {displayOptions.showMaterialQty && <td className="py-1.5 text-center"><span className="text-[10px] font-medium text-slate-600">{item.quantity} {item.unit}</span></td>}
                                {displayOptions.showMaterialUnitPrice && <td className="py-1.5 text-right text-[10px] font-medium text-slate-600">£{(item.unitPrice * markupMultiplier).toFixed(2)}</td>}
                                {displayOptions.showMaterialLineTotals && <td className="py-1.5 text-right text-[11px] font-bold text-slate-900">£{(item.totalPrice * markupMultiplier).toFixed(2)}</td>}
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
                            <div key={item.id} className="py-1.5 border-b border-slate-50 last:border-0 flex justify-between items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  {displayOptions.showMaterialQty && <span className="text-[9px] font-medium text-slate-500 bg-slate-100 px-1 rounded">{item.quantity}{item.unit}</span>}
                                  <span className="font-medium text-slate-900 text-[11px] truncate">{item.name}</span>
                                </div>
                                {item.description && <p className="text-[9px] text-slate-400 truncate">{item.description}</p>}
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
                    <div className="flex justify-between items-center py-2 bg-slate-50 px-4 rounded-lg border border-slate-100/50">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Materials Total</span>
                      <span className="font-bold text-[11px] text-slate-900">£{(rawMaterialsTotal * markupMultiplier).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Labour Block - Now with itemized support */}
              {displayOptions.showLabour && rawLabourTotal > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 border-b border-slate-100 pb-1">
                    <HardHat size={12} className="text-blue-500" />
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Labour & Site Support</span>
                  </div>

                  {displayOptions.showLabourItems && (
                    <div className="space-y-1.5">
                      {/* Itemized Labour List */}
                      {section.labourItems && section.labourItems.length > 0 ? (
                        <>
                          {section.labourItems.map((labourItem) => {
                            const rate = labourItem.rate || section.labourRate || activeQuote.labourRate || settings.defaultLabourRate;
                            const itemTotal = labourItem.hours * rate;
                            return (
                              <div key={labourItem.id} className="py-2 px-3 bg-blue-50/40 rounded-lg border border-blue-100/30 flex justify-between items-center">
                                <div className="flex-1">
                                  <p className="text-[11px] font-medium text-slate-900">{labourItem.description || 'Labour'}</p>
                                  {(displayOptions.showLabourQty || displayOptions.showLabourUnitPrice) && (
                                    <p className="text-[9px] font-medium text-slate-500 flex items-center gap-1">
                                      <Clock size={9} />
                                      {displayOptions.showLabourQty ? `${labourItem.hours} hrs` : ''}
                                      {displayOptions.showLabourQty && displayOptions.showLabourUnitPrice ? ' @ ' : ''}
                                      {displayOptions.showLabourUnitPrice ? `£${(rate * markupMultiplier).toFixed(2)}/hr` : ''}
                                    </p>
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
                        <div className="py-2 px-3 bg-blue-50/40 rounded-lg border border-blue-100/30 flex justify-between items-center">
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
                    <div className="flex justify-between items-center py-2 bg-blue-50/50 px-4 rounded-lg border border-blue-100/50">
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
        })}

        <div className="bg-slate-50 px-4 py-4">
          <div className="flex flex-col gap-3">
            <div className="space-y-1">
              {displayOptions.showTotalsBreakdown && (
                <>
                  <div className="flex justify-between text-[11px] text-slate-500"><span>Subtotal</span><span>£{totals.clientSubtotal.toFixed(2)}</span></div>
                  {/* Discount */}
                  {totals.discountAmount > 0 && (
                    <div className="flex justify-between text-[11px] text-emerald-600">
                      <span className="flex items-center gap-1">
                        <Tag size={10} />
                        Discount
                        {activeQuote.discountDescription && <span className="text-slate-400 ml-1">({activeQuote.discountDescription})</span>}
                        {activeQuote.discountType === 'percentage' && <span className="text-slate-400 ml-1">({activeQuote.discountValue}%)</span>}
                      </span>
                      <span>-£{totals.discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  {settings.enableVat && displayOptions.showVat && (
                    <div className="flex justify-between text-[11px] text-slate-500"><span>VAT ({activeQuote.taxPercent}%)</span><span>£{totals.taxAmount.toFixed(2)}</span></div>
                  )}
                  {settings.enableCis && displayOptions.showCis && totals.cisAmount > 0 && (
                    <div className="flex justify-between text-[11px] text-red-500"><span>CIS Deduction ({activeQuote.cisPercent}%)</span><span>-£{totals.cisAmount.toFixed(2)}</span></div>
                  )}
                </>
              )}
              <div className="h-px bg-slate-200 my-2"></div>
              <div className="flex justify-between items-center">
                <span className="font-bold text-sm text-slate-900">Total Due</span>
                <span className="text-xl font-bold text-slate-900">£{totals.grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {displayOptions.showNotes && activeQuote?.notes && (
                <div className="text-[10px] text-slate-500 leading-relaxed bg-white p-3 rounded-lg border border-slate-100">
                  <p className="font-bold text-slate-600 mb-0.5">Notes</p>
                  {activeQuote.notes}
                </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex justify-center pt-4 print:hidden">
        <div className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm flex items-center gap-2.5 ${statusColors[activeQuote.status || 'draft']}`}>Status: {activeQuote.status || 'draft'}</div>
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
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[85vh] overflow-hidden animate-in slide-in-from-bottom-4">
            {/* Header */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
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
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
                <Check size={18} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-emerald-800">
                  PDF saved to your downloads. Now send it via email:
                </p>
              </div>

              {/* Email preview */}
              <div className="space-y-3">
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
                  <div className="bg-slate-50 rounded-xl p-3 mt-1 border border-slate-100">
                    <p className="text-sm text-slate-600 whitespace-pre-line">{emailHelper.body}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-5 pt-0 space-y-3">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(emailHelper.body);
                  setEmailHelper({ ...emailHelper, copied: true });
                  setTimeout(() => setEmailHelper(prev => prev ? { ...prev, copied: false } : null), 2000);
                }}
                className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
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
                className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/30"
              >
                <Mail size={18} />
                Open Email App
              </button>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mt-2">
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
