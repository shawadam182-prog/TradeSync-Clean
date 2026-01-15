
import React, { useState, useRef } from 'react';
import { Quote, Customer, AppSettings, QuoteDisplayOptions, QuoteSection } from '../types';
import {
  ArrowLeft, Edit3, Hammer, User, FileText, Info,
  Landmark, Package, HardHat, FileDown, Loader2, Navigation, PoundSterling,
  Settings2, Eye, EyeOff, ChevronDown, ChevronUp, LayoutGrid, List,
  Image as ImageIcon, AlignLeft, ReceiptText, ShieldCheck, ListChecks, FileDigit,
  Box, Circle, Share2, Copy, MessageCircle, MapPin
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

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

  const calculateTotals = () => {
    try {
      const sections = activeQuote.sections || [];
      const markupMultiplier = 1 + ((activeQuote.markupPercent || 0) / 100);
      
      let materialsTotal = 0;
      let labourHoursTotal = 0;

      sections.forEach(s => {
        materialsTotal += (s.items || []).reduce((sum, item) => sum + (item?.totalPrice || 0), 0);
        labourHoursTotal += s.labourHours || 0;
      });

      const labourTotal = labourHoursTotal * (activeQuote.labourRate || settings.defaultLabourRate || 0);
      const internalSubtotal = materialsTotal + labourTotal;
      const clientSubtotal = internalSubtotal * markupMultiplier;
      
      const taxAmount = (settings.enableVat && displayOptions.showVat) ? clientSubtotal * ((activeQuote.taxPercent || 0) / 100) : 0;
      const cisAmount = (settings.enableCis && displayOptions.showCis) ? labourTotal * ((activeQuote.cisPercent || 0) / 100) : 0;
      
      const grandTotal = (clientSubtotal + taxAmount) - cisAmount;

      return { materialsTotal, labourTotal, clientSubtotal, taxAmount, cisAmount, grandTotal };
    } catch (e) {
      return { materialsTotal: 0, labourTotal: 0, clientSubtotal: 0, taxAmount: 0, cisAmount: 0, grandTotal: 0 };
    }
  };

  const totals = calculateTotals();

  const handleDownloadPDF = async () => {
    if (!documentRef.current) return;

    setIsDownloading(true);
    try {
      const prefix = activeQuote.type === 'invoice' ? (settings.invoicePrefix || 'INV-') : (settings.quotePrefix || 'EST-');
      const numStr = (activeQuote.referenceNumber || 1).toString().padStart(4, '0');
      const cleanTitle = (activeQuote.title || 'estimate').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const filename = `${prefix}${numStr}_${cleanTitle}.pdf`;

      // Capture the document as canvas
      const canvas = await html2canvas(documentRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 0;

      // Handle multi-page if content is tall
      const pageHeight = pdfHeight;
      const scaledHeight = (imgHeight * pdfWidth) / imgWidth;
      let heightLeft = scaledHeight;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, scaledHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - scaledHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, scaledHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(filename);
    } catch (err) {
      console.error('PDF generation failed:', err);
      window.print();
    } finally {
      setIsDownloading(false);
    }
  };

  const handleWhatsAppShare = () => {
    const prefix = activeQuote.type === 'invoice' ? (settings.invoicePrefix || 'INV-') : (settings.quotePrefix || 'EST-');
    const numStr = (activeQuote.referenceNumber || 1).toString().padStart(4, '0');
    const docType = activeQuote.type === 'invoice' ? 'Invoice' : 'Quote';

    const message = `Hi ${customer?.name || 'there'},

Here's your ${docType} (${prefix}${numStr}) for "${activeQuote.title}":

💰 Total: £${totals.grandTotal.toFixed(2)}
📅 Date: ${activeQuote?.date ? new Date(activeQuote.date).toLocaleDateString() : 'N/A'}

${activeQuote.type === 'invoice' ? 'Payment due within 14 days.' : 'Let me know if you have any questions!'}

- ${settings?.companyName || 'TradeMate'}`;

    const phoneNumber = customer?.phone?.replace(/\D/g, '') || '';
    const url = phoneNumber
      ? `https://wa.me/${phoneNumber.startsWith('44') ? phoneNumber : '44' + phoneNumber.replace(/^0/, '')}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    window.open(url, '_blank');
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
      <div className="flex flex-col gap-4 print:hidden">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="flex items-center gap-1.5 text-slate-400 hover:text-slate-800 transition-colors py-2">
            <ArrowLeft size={16} />
            <span className="font-black text-[10px] uppercase tracking-widest">Back</span>
          </button>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowCustomiser(!showCustomiser)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold transition-all text-[10px] uppercase tracking-widest shadow-sm border ${
                showCustomiser ? 'bg-purple-600 text-white border-purple-700' : 'bg-white text-purple-600 border-purple-100 hover:border-purple-300'
              }`}
            >
              <Settings2 size={14} />
              Layout {showCustomiser ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
            </button>
            <button onClick={onEdit} className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-bold hover:bg-slate-50 transition-all text-[10px] uppercase tracking-widest shadow-sm"><Edit3 size={14} /> Edit</button>
            {onDuplicate && (
              <button onClick={onDuplicate} className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-bold hover:bg-slate-50 transition-all text-[10px] uppercase tracking-widest shadow-sm">
                <Copy size={14} /> Copy
              </button>
            )}
            {activeQuote.type !== 'invoice' && onConvertToInvoice && activeQuote.status === 'accepted' && (
              <button onClick={onConvertToInvoice} className="flex items-center gap-2 bg-emerald-500 text-white px-3 py-1.5 rounded-lg font-black hover:bg-emerald-600 transition-all text-[10px] uppercase tracking-widest shadow-md shadow-emerald-200">
                <ReceiptText size={14} /> Convert to Invoice
              </button>
            )}
            <button onClick={handleWhatsAppShare} className="flex items-center gap-2 bg-green-500 text-white px-3 py-1.5 rounded-lg font-black hover:bg-green-600 transition-all text-[10px] uppercase tracking-widest shadow-md shadow-green-200">
              <MessageCircle size={14} /> WhatsApp
            </button>
            {customer?.address && (
              <button onClick={handleOpenMaps} className="flex items-center gap-2 bg-blue-500 text-white px-3 py-1.5 rounded-lg font-black hover:bg-blue-600 transition-all text-[10px] uppercase tracking-widest shadow-md shadow-blue-200">
                <MapPin size={14} /> Maps
              </button>
            )}
            <button onClick={handleDownloadPDF} disabled={isDownloading} className="flex items-center gap-2 bg-amber-500 text-white px-4 py-1.5 rounded-lg font-black hover:bg-amber-600 transition-all text-[10px] uppercase tracking-widest shadow-md shadow-amber-200 disabled:opacity-50">
              {isDownloading ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
              {isDownloading ? 'Working...' : 'PDF'}
            </button>
          </div>
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

      <div ref={documentRef} className="bg-white rounded-[32px] shadow-2xl border border-slate-200 overflow-hidden print:border-none print:shadow-none">
        {/* Modern Hero Header */}
        <div className="bg-slate-900 text-white p-6 relative overflow-hidden">
          <div className="relative z-10 flex justify-between items-start">
             <div>
                <p className="text-slate-400 text-xs font-medium mb-1 uppercase tracking-wider">{activeQuote.type || 'estimate'}</p>
                <h1 className="text-2xl font-bold text-white mb-2">{activeQuote?.title || 'Proposed Works'}</h1>
                <div className="flex items-center gap-3 text-sm text-slate-300">
                   <span>{customer?.name}</span>
                   <span>•</span>
                   <span>{activeQuote?.date ? new Date(activeQuote.date).toLocaleDateString() : ''}</span>
                </div>
             </div>
             <div className="text-right">
                <div className="bg-white/10 px-3 py-1 rounded-lg text-xs font-mono text-amber-400">{reference}</div>
             </div>
          </div>
        </div>

        {(activeQuote.sections || []).map((section, idx) => {
          const markupMultiplier = 1 + ((activeQuote.markupPercent || 0) / 100);
          const rawMaterialsTotal = (section.items || []).reduce((s, i) => s + (i.totalPrice || 0), 0);
          const rawLabourTotal = (section.labourHours || 0) * (activeQuote.labourRate || settings.defaultLabourRate || 0);
          
          return (
            <div key={section.id} className={`p-4 md:p-8 ${idx % 2 === 1 ? 'bg-slate-50/30' : 'bg-white'} border-b border-slate-100 last:border-b-0 space-y-8`}>
              <div className="flex items-center gap-3">
                 <div className="h-8 w-8 bg-slate-900 text-amber-500 rounded-lg flex items-center justify-center font-black text-xs">{idx + 1}</div>
                 <h4 className="text-lg font-black text-slate-900 uppercase tracking-widest">{section.title}</h4>
              </div>

              {/* Materials Block */}
              {displayOptions.showMaterials && (rawMaterialsTotal > 0 || (section.items || []).length > 0) && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                    <Package size={14} className="text-amber-500" />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Project Materials</span>
                  </div>

                  {displayOptions.showMaterialItems && (section.items || []).length > 0 && (
                    <div className="w-full">
                      {/* Desktop Table */}
                      <table className="hidden md:table w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <th className="py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">Item Description</th>
                            {displayOptions.showMaterialQty && <th className="py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center w-20">Qty</th>}
                            {displayOptions.showMaterialUnitPrice && <th className="py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right w-24">Unit (£)</th>}
                            {displayOptions.showMaterialLineTotals && <th className="py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right w-24">Total</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {(section.items || []).map(item => (
                            <tr key={item.id}>
                              <td className="py-3 pr-4"><p className="text-sm font-bold text-slate-900">{item.name}</p>{item.description && <p className="text-[10px] text-slate-500 italic leading-tight">{item.description}</p>}</td>
                              {displayOptions.showMaterialQty && <td className="py-3 text-center"><span className="text-xs font-black text-slate-700">{item.quantity} {item.unit}</span></td>}
                              {displayOptions.showMaterialUnitPrice && <td className="py-3 text-right text-xs font-black text-slate-700">£{(item.unitPrice * markupMultiplier).toFixed(2)}</td>}
                              {displayOptions.showMaterialLineTotals && <td className="py-3 text-right text-sm font-black text-slate-900">£{(item.totalPrice * markupMultiplier).toFixed(2)}</td>}
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* Mobile List View - Ultra Clean */}
                      <div className="md:hidden">
                        {(section.items || []).map(item => (
                          <div key={item.id} className="py-3 border-b border-slate-50 last:border-0 flex justify-between items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                {displayOptions.showMaterialQty && <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 rounded">{item.quantity}{item.unit}</span>}
                                <span className="font-medium text-slate-900 text-sm truncate">{item.name}</span>
                              </div>
                              {item.description && <p className="text-xs text-slate-400 truncate">{item.description}</p>}
                            </div>
                            <div className="text-right whitespace-nowrap">
                              {displayOptions.showMaterialLineTotals && <p className="text-sm font-bold text-slate-900">£{(item.totalPrice * markupMultiplier).toFixed(2)}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {displayOptions.showMaterialSectionTotal && (
                    <div className="flex justify-between items-center py-3.5 bg-slate-50 px-6 rounded-2xl border border-slate-100/50">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Section Materials Total</span>
                      <span className="font-black text-slate-900">£{(rawMaterialsTotal * markupMultiplier).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Labour Block */}
              {displayOptions.showLabour && (section.labourHours || 0) > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                    <HardHat size={14} className="text-blue-500" />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Labour & Site Support</span>
                  </div>

                  {displayOptions.showLabourItems && (
                    <div className="p-5 bg-blue-50/40 rounded-2xl border border-blue-100/30 flex justify-between items-center">
                      <div className="flex-1">
                        <p className="text-sm font-bold text-slate-900 uppercase tracking-tight">Technical Personnel & Site Resource</p>
                        {(displayOptions.showLabourQty || displayOptions.showLabourUnitPrice) && (
                          <p className="text-[10px] font-black text-slate-500 italic mt-1">
                            {displayOptions.showLabourQty ? `${section.labourHours} Hours Scheduled` : ''}
                            {displayOptions.showLabourQty && displayOptions.showLabourUnitPrice ? ' @ ' : ''}
                            {displayOptions.showLabourUnitPrice ? `£${((activeQuote.labourRate || settings.defaultLabourRate) * markupMultiplier).toFixed(2)} / Hour` : ''}
                          </p>
                        )}
                      </div>
                      {displayOptions.showLabourSectionTotal && (
                        <div className="text-right">
                          <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-0.5">Subtotal</p>
                          <p className="text-lg font-black text-blue-600">£{(rawLabourTotal * markupMultiplier).toFixed(2)}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {!displayOptions.showLabourItems && displayOptions.showLabourSectionTotal && (
                    <div className="flex justify-between items-center py-3.5 bg-blue-50/50 px-6 rounded-2xl border border-blue-100/50">
                      <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Section Labour Total</span>
                      <span className="font-black text-blue-600">£{(rawLabourTotal * markupMultiplier).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}
              
              <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                <div className="flex items-center gap-2 opacity-30">
                  <Circle size={8} fill="currentColor" className="text-slate-400" />
                  <span className="text-[8px] font-black uppercase tracking-widest">Work Stream {idx + 1}</span>
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Combined Section Total: <span className="text-slate-900 ml-2">£{((rawMaterialsTotal + rawLabourTotal) * markupMultiplier).toFixed(2)}</span></p>
              </div>
            </div>
          );
        })}

        <div className="bg-slate-50 p-6 md:p-10 border-t border-slate-100">
          <div className="flex flex-col gap-6">
            <div className="space-y-2">
              {displayOptions.showTotalsBreakdown && (
                <>
                  <div className="flex justify-between text-sm text-slate-500"><span>Subtotal</span><span>£{totals.clientSubtotal.toFixed(2)}</span></div>
                  {settings.enableVat && displayOptions.showVat && (
                    <div className="flex justify-between text-sm text-slate-500"><span>VAT ({activeQuote.taxPercent}%)</span><span>£{totals.taxAmount.toFixed(2)}</span></div>
                  )}
                </>
              )}
              <div className="flex justify-between items-center pt-4 border-t border-slate-200">
                <span className="font-bold text-slate-900">Total Due</span>
                <span className="text-2xl font-bold text-slate-900">£{totals.grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {displayOptions.showNotes && activeQuote?.notes && (
                <div className="text-xs text-slate-400 leading-relaxed bg-white p-4 rounded-xl border border-slate-100">
                  <p className="font-bold mb-1">Notes</p>
                  {activeQuote.notes}
                </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex justify-center pt-4 print:hidden">
        <div className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm flex items-center gap-2.5 ${statusColors[activeQuote.status || 'draft']}`}>Status: {activeQuote.status || 'draft'}</div>
      </div>
    </div>
  );
};
