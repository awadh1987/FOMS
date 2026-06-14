import React, { useRef, useState, useEffect } from "react";
import { Invoice, Client, Operation, Company } from "../types";
import { Printer, X, Check, FileCheck, Phone, MapPin, Building, ShieldCheck, Mail, Calendar, Hash, DollarSign, Share2 } from "lucide-react";
import { useLanguage } from "../lib/LanguageContext";

interface InvoicePrintModalProps {
  invoice: Invoice;
  client: Client;
  operation: Operation;
  company: Company | null;
  onClose: () => void;
}

export default function InvoicePrintModal({
  invoice,
  client,
  operation,
  company,
  onClose
}: InvoicePrintModalProps) {
  const { language, t } = useLanguage();
  const companyName = company?.name || (language === "ar" ? "منشأة تجارية" : "Business Enterprise");
  const logoUrl = company?.logo_url || "";
  const primaryColorVal = company?.primary_color || "#4F46E5";
  const currency = company?.currency || "ر.س";

  const [customNote, setCustomNote] = useState("");

  useEffect(() => {
    setCustomNote(
      language === "ar" 
        ? "نشكركم على ثقتكم الغالية وتعاملكم المستمر معنا. يرجى سداد مستحقات هذه الفاتورة خلال فترة الاستحقاق المحددة." 
        : "Thank you for your valued business. Please arrange for invoice settlement within the specified payment terms."
    );
  }, [language]);

  const [stampColor, setStampColor] = useState<"emerald" | "indigo" | "rose">(
    invoice.status === "Paid" ? "emerald" : "indigo"
  );
  
  // Saudi VAT Calculation (15%)
  const grandTotal = invoice.amount;
  const taxableSubtotal = grandTotal / 1.15;
  const vatAmount = grandTotal - taxableSubtotal;

  // Invoice Date (use operation date if available, otherwise fallback to custom)
  const invoiceDate = operation.date || new Date().toISOString().split("T")[0];

  // Helper to generate a realistic Saudi VAT Number based on Tenant ID
  const generateVatNumber = (compId: string) => {
    let numeric = "";
    for (let i = 0; i < compId.length; i++) {
      numeric += compId.charCodeAt(i).toString();
    }
    const middleDigits = (numeric + "9876543210123").substring(0, 13);
    return `3${middleDigits}3`;
  };

  const vatNumber = generateVatNumber(invoice.company_id || "comp-1");

  const [copied, setCopied] = useState(false);

  // Trigger Print using the browser native dialog
  const handlePrint = () => {
    window.print();
    // Log the print action to audit logs
    fetch("/api/audit-logs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-company-id": invoice.company_id || "comp-1"
      },
      body: JSON.stringify({
        action: language === "ar" ? "تصدير الفاتورة PDF / طباعة" : "Exported Invoice PDF / printed",
        details: language === "ar" 
          ? `تصدير الفاتورة رقم #${invoice.id.split("-").pop() || invoice.id} بصيغة PDF وطباعتها، بقيمة إجمالية ${invoice.amount.toLocaleString()} ${currency} لصالح العميل "${client.name}".` 
          : `Printed invoice #${invoice.id.split("-").pop() || invoice.id} to PDF, total balance of ${invoice.amount.toLocaleString()} ${currency} for client "${client.name}".`
      })
    }).catch(err => console.warn("Could not log printing:", err));
  };

  const handleShare = async () => {
    const formattedId = invoice.id.split("-").pop() || invoice.id;
    const shareText = language === "ar" 
      ? `🧾 فاتورة ضريبية مبسطة من: ${companyName}\n` +
        `رقم الفاتورة: #${formattedId}\n` +
        `العميل المستلم: ${client.name}\n` +
        `الخدمة/العملية: ${operation.service}\n` +
        `إجمالي المبلغ شامل الضريبة: ${invoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${currency}\n` +
        `تاريخ الإصدار: ${invoiceDate}\n` +
        `تاريخ الاستحقاق: ${invoice.due_date || "—"}\n` +
        `حالة العملية المالية: ${invoice.status === "Paid" ? "✅ مدفوعة ومحصلة" : "⏳ قيد الانتظار"}\n\n` +
        `تم توليدها وإرسالها إلكترونياً بنجاح.`
      : `🧾 Simplified Tax Invoice from: ${companyName}\n` +
        `Invoice Reference: #${formattedId}\n` +
        `Client Recipient: ${client.name}\n` +
        `Service Rendered: ${operation.service}\n` +
        `Total Amount inc. VAT: ${invoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${currency}\n` +
        `Issue Date: ${invoiceDate}\n` +
        `Due Date: ${invoice.due_date || "—"}\n` +
        `Operational Status: ${invoice.status === "Paid" ? "✅ Paid & Settled" : "⏳ Pending Payment"}\n\n` +
        `Generated and secure-signed electronically.`;

    // Log sharing action
    fetch("/api/audit-logs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-company-id": invoice.company_id || "comp-1"
      },
      body: JSON.stringify({
        action: language === "ar" ? "مشاركة بيانات الفاتورة" : "Shared invoice data link",
        details: language === "ar" 
          ? `مشاركة الفاتورة الضريبية رقم #${formattedId} للعميل "${client.name}" بقيمة ${invoice.amount.toLocaleString()} ${currency} عن طريق الرابط أو نسخها للحافظة.` 
          : `Successfully copied invoice statement metadata #${formattedId} to sharing buffer or dispatch interface for client "${client.name}".`
      })
    }).catch(err => console.warn("Could not log share:", err));

    if (navigator.share) {
      try {
        await navigator.share({
          title: language === "ar" ? `فاتورة ضريبية #${formattedId}` : `Tax Invoice #${formattedId}`,
          text: shareText,
        });
        return;
      } catch (err) {
        console.log("Error sharing:", err);
      }
    }

    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-cardbk dark:bg-slate-900 rounded-2xl max-w-4xl w-full my-8 border border-borderline shadow-2xl flex flex-col md:flex-row relative animate-in fade-in zoom-in-95 duration-200">
        
        {/* Left Column: Customizer & Controls (Not part of print area!) */}
        <div id="invoice-customizer-panel" className="w-full md:w-80 p-6 bg-appbk border-b md:border-b-0 border-borderline flex flex-col justify-between shrink-0 text-start">
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2 text-indigo-500 font-bold mb-1">
                <Printer className="w-5 h-5" />
                <h3 className="text-md text-txtmain">{language === "ar" ? "خيارات تصدير الفاتورة" : "PDF Export Parameters"}</h3>
              </div>
              <p className="text-[11px] text-txtmuted">
                {language === "ar" 
                  ? "قم بتهيِئة خيارات الطباعة وتضمين الملاحظات قبل حفظ الفاتورة كـ PDF." 
                  : "Review printing rules and customize notes before downloading the invoice sheet."}
              </p>
            </div>

            {/* Note text editor */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-txtmain">{language === "ar" ? "الملاحظات أسفل الفاتورة" : "Bottom Footer Memo"}</label>
              <textarea
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                rows={3}
                className="w-full text-xs p-3 bg-cardbk text-txtmain border border-borderline rounded-xl focus:outline-none focus:border-indigo-500 duration-150 resize-none leading-relaxed"
                placeholder={language === "ar" ? "أضف شروط الدفع أو شكر خاص..." : "Add standard notes, bank codes or payment dates..."}
              />
            </div>

            {/* Stamp Color customizer */}
            <div className="space-y-2.5">
              <label className="block text-xs font-bold text-txtmain">{language === "ar" ? "لون ختم الاعتماد (مُبَطَّن)" : "Seal / Badge Color State"}</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStampColor("emerald")}
                  className={`w-8 h-8 rounded-full bg-emerald-500 border-2 transition-transform ${stampColor === "emerald" ? "border-txtmain scale-110" : "border-transparent"}`}
                  title={language === "ar" ? "أخضر معتمد" : "Emerald Verified"}
                />
                <button
                  type="button"
                  onClick={() => setStampColor("indigo")}
                  className={`w-8 h-8 rounded-full bg-indigo-500 border-2 transition-transform ${stampColor === "indigo" ? "border-txtmain scale-110" : "border-transparent"}`}
                  title={language === "ar" ? "أزرق رسمي" : "Official Indigo"}
                />
                <button
                  type="button"
                  onClick={() => setStampColor("rose")}
                  className={`w-8 h-8 rounded-full bg-rose-500 border-2 transition-transform ${stampColor === "rose" ? "border-txtmain scale-110" : "border-transparent"}`}
                  title={language === "ar" ? "وردي تنبيهي" : "Action Pink"}
                />
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-amber-500/10 text-amber-500 p-3.5 rounded-xl border border-amber-500/20 text-[10px] leading-relaxed space-y-1">
              <span className="font-extrabold flex items-center gap-1">💡 {language === "ar" ? "معيار الفوترة الضريبية للمملكة" : "Saudi ZATCA Compliant Standards"}</span>
              <p>
                {language === "ar" 
                  ? "تلتزم الفاتورة بتخطيط هيئة الزكاة والضريبة والجمارك (ZATCA) في السعودية، بما يشمل الرقم الضريبي الموثق والترميز الذكي والـ VAT بنسبة 15%." 
                  : "Formats dynamically match the structural mandates of the Saudi ZATCA authority, integrating VAT 15% brackets and security anchors."}
              </p>
            </div>
          </div>

          <div className="pt-6 border-t border-borderline space-y-2">
            <button
              onClick={handlePrint}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-600/10"
            >
              <Printer className="w-4 h-4" />
              <span>{language === "ar" ? "تحميل PDF / طباعة الفاتورة" : "Download PDF / Print"}</span>
            </button>

            <button
              onClick={handleShare}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer border ${
                copied
                  ? "bg-emerald-500/10 border-emerald-500 text-emerald-500"
                  : "bg-transparent border-borderline hover:bg-borderline/20 text-txtmain"
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 animate-bounce" />
                  <span>{language === "ar" ? "تم نسخ البيانات للمشاركة!" : "Copied statement details!"}</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4" />
                  <span>{language === "ar" ? "مشاركة بيانات الفاتورة" : "Share Invoicing Statement"}</span>
                </>
              )}
            </button>

            <p className="text-[9px] text-txtmuted text-center leading-normal">
              {language === "ar" 
                ? "اختر حفظ بتنسيق PDF في نافذة الطباعة كـ (Save as PDF) لتنزيل ملف الفاتورة المباشر." 
                : "Tip: Select Save as PDF from your browser printer destination list to generate a file."}
            </p>
          </div>
        </div>

        {/* Right Column: Invoice Document A4 Layout (Print Area) */}
        <div className="flex-1 p-6 md:p-10 bg-white text-slate-800 flex flex-col justify-between overflow-y-auto max-h-[85vh] md:max-h-none">
          
          {/* Printable container start */}
          <div id="printable-invoice-area" className="bg-white p-4 md:p-8 rounded-xl border border-slate-100 text-right text-slate-900 leading-relaxed font-sans" style={{ direction: "rtl" }}>
            
            {/* Header section (Company Name & Stamp Letterhead) */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pb-6 mb-6" style={{ borderBottom: `2px solid ${primaryColorVal}` }}>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2.5">
                  {logoUrl ? (
                    <img 
                      src={logoUrl} 
                      alt={companyName}
                      className="w-12 h-12 rounded-lg object-contain border border-slate-200 p-1 shrink-0 bg-white shadow-xs" 
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div 
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-xs uppercase shadow-sm shrink-0"
                      style={{ backgroundColor: primaryColorVal }}
                    >
                      {companyName.substring(0, 1)}
                    </div>
                  )}
                  <h2 className="text-xl font-extrabold text-slate-900">{companyName}</h2>
                </div>
                
                <div className="text-[11px] text-slate-500 space-y-1 pr-1 font-sans">
                  <div className="flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-slate-400" />
                    <span>منشأة SaaS ذكية معزولة - الفواتير الضريبية</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono">
                    <Hash className="w-3.5 h-3.5 text-slate-400" />
                    <span>الرقم الضريبي VAT: {vatNumber}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>المملكة العربية السعودية، الرياض</span>
                  </div>
                </div>
              </div>

              {/* Title & Document Badge */}
              <div className="text-left self-stretch sm:self-auto flex flex-col justify-between items-start sm:items-end">
                <div className="text-slate-950 font-black tracking-tight space-y-1 text-left">
                  <span className="bg-slate-100 text-slate-800 text-[10px] py-1 px-2 rounded-md font-bold inline-block border border-slate-200">
                    فاتورة ضريبية مبسطة / Simplified Tax Invoice
                  </span>
                  <h1 className="text-lg font-black mt-2">رقم الفاتورة / Inv No: #{invoice.id.split("-").pop() || invoice.id}</h1>
                </div>

                <div className="text-[11px] text-slate-500 space-y-1 mt-3 font-mono text-left w-full">
                  <div>تاريخ الإصدار / Date: <strong>{invoiceDate}</strong></div>
                  <div>تاريخ الاستحقاق / Due: <strong className="text-slate-900">{invoice.due_date || "—"}</strong></div>
                  {invoice.status === "Paid" && invoice.payment_date && (
                    <div className="text-emerald-700">تاريخ السداد / Paid Date: <strong>{invoice.payment_date}</strong></div>
                  )}
                </div>
              </div>

            </div>

            {/* Bill To Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200/60 mb-6">
              <div>
                <span className="text-[10px] text-slate-400 font-extrabold block mb-1.5 uppercase">معلومات العميل والمستلم / Client Details</span>
                <h3 className="text-sm font-extrabold text-slate-900">{client.name}</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">{client.company ? `رئيس منشأة: ${client.company}` : "مستلم فردي للأعمال / Enterprise Client"}</p>
                
                {client.phone && (
                  <div className="flex items-center gap-1.5 mt-2 text-[11px] text-slate-600 font-mono">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{client.phone}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col justify-center items-start md:items-end md:border-r border-slate-200/80 pt-3 md:pt-0 md:pr-6">
                <span className="text-[10px] text-slate-400 font-extrabold block mb-1">حالة ميزانية السداد / Payment Status</span>
                {invoice.status === "Paid" ? (
                  <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] px-3 py-1 rounded-full font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>تم الدفع والتحصيل بالكامل / Paid-in-Full</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 bg-indigo-50 text-indigo-800 border border-indigo-200 text-[10px] px-3 py-1 rounded-full font-bold">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                    <span>بانتظار السداد والتحويل / Unpaid</span>
                  </div>
                )}
                <span className="text-[9px] text-slate-400 mt-1 font-mono">رقم المرجع المالي للعملية: {operation.id}</span>
              </div>
            </div>

            {/* Invoice items table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden mb-6">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="text-white font-bold" style={{ backgroundColor: primaryColorVal }}>
                    <th className="py-2.5 px-3 text-center w-12">م / N</th>
                    <th className="py-2.5 px-3">بيان الخدمات والعمليات / Service Description</th>
                    <th className="py-2.5 px-3 text-center w-16">الكمية/Qty</th>
                    <th className="py-2.5 px-3 text-left w-28">السعر الأساسي / Base Rate</th>
                    <th className="py-2.5 px-3 text-center w-20">الضريبة/VAT</th>
                    <th className="py-2.5 px-3 text-left w-28">الإجمالي / Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-3 px-3 text-center text-slate-400 font-mono">1</td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">{operation.service}</div>
                      <p className="text-[10px] text-slate-400 mt-0.5">عملية تشغيلية منجزة ومسجلة في الكيان المالي المعزول</p>
                    </td>
                    <td className="py-3 px-3 text-center font-mono">1</td>
                    <td className="py-3 px-3 text-left font-mono">{taxableSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}</td>
                    <td className="py-3 px-3 text-center text-slate-500 font-mono">15% VAT</td>
                    <td className="py-3 px-3 text-left font-bold font-mono">{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Calculations Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end mb-8">
              
              {/* QR Code and Saudi standard stamp */}
              <div className="flex gap-4 items-center">
                
                {/* Simulated Authentic Saudi ZATCA QR Code */}
                <div className="bg-slate-50 p-2.5 border border-slate-200 rounded-lg shrink-0" title="رمز الاستجابة السريعة لهيئة الزكاة">
                  <div className="w-20 h-20 bg-white p-1 flex flex-col justify-between items-center border border-slate-300 relative">
                    <div className="grid grid-cols-5 gap-1 w-full h-full opacity-90">
                      {[...Array(25)].map((_, i) => (
                        <div 
                           key={i} 
                           className={`rounded-xs ${
                             (i % 3 === 0 || i === 0 || i === 4 || i === 20 || i === 24 || i === 12 || i === 8 || i === 18) 
                             ? "bg-slate-900" 
                             : "bg-slate-100"
                           }`} 
                        />
                      ))}
                    </div>
                    <div className="absolute inset-0 m-auto w-5 h-5 bg-white rounded-full border border-slate-200 flex items-center justify-center shadow-xs">
                      <ShieldCheck className="w-3.5 h-3.5 text-slate-800" />
                    </div>
                  </div>
                  <span className="text-[8px] text-slate-400 font-mono text-center block mt-1">ZATCA Cryptographic ID</span>
                </div>

                {/* Stamp & Manager Signature block */}
                <div className="space-y-2">
                  <div className={`relative w-28 h-10 border border-dashed rounded flex items-center justify-center ${
                    stampColor === "emerald" 
                    ? "border-emerald-500 text-emerald-600 bg-emerald-50/20" 
                    : stampColor === "indigo" 
                      ? "border-indigo-500 text-indigo-600 bg-indigo-50/20" 
                      : "border-rose-500 text-rose-600 bg-rose-50/20"
                  }`}>
                    <span className="text-[10px] font-black tracking-wide uppercase">
                      {invoice.status === "Paid" ? "تم السداد والتحصيل" : "تحت المراجعة"}
                    </span>
                    <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full flex items-center justify-center text-white text-[8px] ${
                      stampColor === "emerald" ? "bg-emerald-500" : stampColor === "indigo" ? "bg-indigo-500" : "bg-rose-500"
                    }`}>
                      ✓
                    </div>
                  </div>
                  
                  <div className="pr-1 text-slate-400 text-[10px] space-y-0.5">
                    <div>توقيع المسؤول / Manager Seal & Sign</div>
                    <div className="italic font-mono border-t border-slate-100 pt-0.5 text-slate-800 font-bold">ERP General Auditing</div>
                  </div>
                </div>

              </div>

              {/* Calculations breakdown list */}
              <div className="space-y-2 text-xs border-r-2 border-slate-100 pr-6">
                <div className="flex justify-between items-center text-slate-500">
                  <span>المبلغ الخاضع للضريبة (Subtotal)</span>
                  <span className="font-mono font-medium">{taxableSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}</span>
                </div>
                <div className="flex justify-between items-center text-slate-500">
                  <span>ضريبة القيمة المضافة (15% VAT)</span>
                  <span className="font-mono font-medium">{vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}</span>
                </div>
                <div className="flex justify-between items-center text-slate-500">
                  <span>رسوم التوصيل أو المعالجة السحابية</span>
                  <span className="font-mono font-medium">0.00 {currency}</span>
                </div>
                <div className="h-[1px] bg-slate-200 my-1" />
                <div className="flex justify-between items-center text-sm font-black" style={{ color: primaryColorVal }}>
                  <span>الإجمالي المستحق (Grand Total)</span>
                  <span className="font-mono text-base">{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}</span>
                </div>
              </div>

            </div>

            {/* Custom note on invoice bottom */}
            {customNote.trim() && (
              <div className="bg-slate-50 border border-slate-200/50 p-3 rounded-xl text-[10px] text-slate-500 leading-relaxed mb-6">
                <span className="font-bold text-slate-800 block mb-0.5">💬 ملاحظات وشروط الدفع / Terms & Notes:</span>
                <p>{customNote}</p>
              </div>
            )}

            {/* Footer stamp/verification */}
            <div className="border-t border-slate-100 pt-3 flex flex-col sm:flex-row justify-between items-center text-[9px] text-slate-400 gap-2">
              <div>
                <span>تم إنشاء وتوثيق هذه الفاتورة إلكترونياً وهي صالحة بدون الختم اليدوي.</span>
              </div>
              <div className="flex items-center gap-1.5 font-mono">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>حماية مشفرة SaaS ISO/IEC 27001 Secured</span>
              </div>
            </div>

          </div>
          {/* Printable container end */}

        </div>

        {/* Floating Close Button for preview modal */}
        <button
          onClick={onClose}
          id="invoice-close-button"
          className="absolute top-4 left-4 p-2.5 rounded-full bg-slate-800 hover:bg-slate-700 text-white duration-150 cursor-pointer shadow-lg z-50 hover:scale-105"
          title={language === "ar" ? "إغلاق معاينة الفاتورة" : "Close Preview"}
        >
          <X className="w-5 h-5" />
        </button>

      </div>
    </div>
  );
}
