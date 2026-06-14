import React, { useState } from "react";
import { Invoice, Client, Operation, Company } from "../types";
import { Search, FileText, CheckCircle2, Clock, AlertTriangle, ExternalLink, Calendar, Printer, FileSpreadsheet } from "lucide-react";
import InvoicePrintModal from "./InvoicePrintModal";
import { useLanguage } from "../lib/LanguageContext";

interface InvoicesProps {
  invoices: Invoice[];
  clients: Client[];
  operations: Operation[];
  currentCompany: Company | null;
  onToggleInvoice: (id: string, currentStatus: "Paid" | "Unpaid") => void;
}

export default function Invoices({ invoices, clients, operations, currentCompany, onToggleInvoice }: InvoicesProps) {
  const { language, t } = useLanguage();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Paid" | "Unpaid" | "Overdue">("All");
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState<Invoice | null>(null);

  const currency = currentCompany?.currency || "ر.س";
  const todayStr = new Date().toISOString().split("T")[0];

  // Resolve client info
  const getClientInfo = (clientId: string) => {
    const cli = clients.find(c => c.id === clientId);
    return cli 
      ? { name: cli.name, company: cli.company, phone: cli.phone || "" } 
      : { name: language === "ar" ? "عميل مجهول" : "Unknown Client", company: "", phone: "" };
  };

  // Resolve operation service
  const getOpService = (opId: string) => {
    const op = operations.find(o => o.id === opId);
    return op ? op.service : (language === "ar" ? "عملية مجهولة" : "Unknown Service");
  };

  // Filtered invoices
  const filteredInvoices = invoices.filter(inv => {
    const client = getClientInfo(inv.client_id);
    const service = getOpService(inv.op_id);
    const matchesSearch = 
      client.name.toLowerCase().includes(search.toLowerCase()) ||
      client.company.toLowerCase().includes(search.toLowerCase()) ||
      service.toLowerCase().includes(search.toLowerCase()) ||
      inv.id.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    // Apply Tab status filters
    if (statusFilter === "All") return true;
    if (statusFilter === "Paid") return inv.status === "Paid";
    if (statusFilter === "Unpaid") return inv.status === "Unpaid" && (!inv.due_date || inv.due_date >= todayStr);
    if (statusFilter === "Overdue") return inv.status === "Unpaid" && inv.due_date && inv.due_date < todayStr;

    return true;
  });

  // Export Filtered data to Excel-friendly CSV with BOM protection
  const handleExportCSV = () => {
    const headers = language === "ar" ? [
      "رقم الفاتورة",
      "اسم العميل/الجهة",
      "الشركة أو الكيان المشغل",
      "رقم تواصل العميل",
      "الخدمة/العملية التشغيلية",
      `إجمالي المبلغ شامل الضريبة (${currency})`,
      "تاريخ الاستحقاق الدفعي",
      "تاريخ السداد والتحصيل الفعلي",
      "حالة الفواتير الضريبية",
      "رمز العملية المالية المرجعي"
    ] : [
      "Invoice ID",
      "Client/Entity Name",
      "Operator Company",
      "Client Phone",
      "Service/Operation Offered",
      `Total Amount inc. VAT (${currency})`,
      "Due Date",
      "Payment Date",
      "Invoice Status",
      "Reference Operation ID"
    ];

    const csvRows = [
      headers.join(","),
      ...filteredInvoices.map(inv => {
        const client = getClientInfo(inv.client_id);
        const service = getOpService(inv.op_id);
        
        const row = [
          `"${inv.id.replace(/"/g, '""')}"`,
          `"${client.name.replace(/"/g, '""')}"`,
          `"${(client.company || "").replace(/"/g, '""')}"`,
          `"${(client.phone || "").replace(/"/g, '""')}"`,
          `"${service.replace(/"/g, '""')}"`,
          inv.amount,
          `"${(inv.due_date || "").replace(/"/g, '""')}"`,
          `"${(inv.payment_date || "").replace(/"/g, '""')}"`,
          `"${inv.status === "Paid" ? (language === "ar" ? "مدفوعة ومحصلة" : "Paid") : (language === "ar" ? "في الانتظار / متأخرة" : "Unpaid / Overdue")}"`,
          `"${inv.op_id.replace(/"/g, '""')}"`
        ];
        return row.join(",");
      })
    ];

    // Unicode BOM prepended to force MS Excel to correctly read Arabic characters as UTF-8
    const csvString = "\uFEFF" + csvRows.join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `invoices_statement_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Log the CSV export action to Audit Logs
    fetch("/api/audit-logs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-company-id": currentCompany?.id || "comp-1"
      },
      body: JSON.stringify({
        action: language === "ar" ? "تصدير الفواتير لملف CSV" : "Exporting invoices to CSV",
        details: language === "ar" 
          ? `تصدير كامل لكشف حساب الفواتير النشط لملف CSV خارجي، تضمن التصدير ${filteredInvoices.length} فاتورة لمطابقة الحسابات في برنامج Excel/برامج المحاسبة.` 
          : `Exported full invoice billing records statement to an external CSV file, packaging ${filteredInvoices.length} records for Excel/External ERP bookkeeping.`
      })
    }).catch(err => console.warn("Could not log CSV export:", err));
  };

  return (
    <div className="space-y-6 text-start">
      
      {/* Search & Tabs Header Card */}
      <div className="bg-cardbk p-6 rounded-2xl shadow-sm border border-borderline space-y-4">
        
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h3 className="text-lg font-bold text-txtmain">{t("inv_title")}</h3>
            <p className="text-xs text-txtmuted mt-0.5">{t("inv_subtitle")}</p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
            {/* CSV Export Button */}
            <button
              onClick={handleExportCSV}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all duration-150 shadow-sm shadow-emerald-950/10 hover:shadow-emerald-600/20 cursor-pointer shrink-0"
              title={language === "ar" ? "تصدير جميع الفواتير المفلترة إلى ملف Excel CSV" : "Export all filtered invoices to clean CSV"}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{language === "ar" ? `تصدير CSV لـ Excel (${filteredInvoices.length})` : `Export CSV (${filteredInvoices.length})`}</span>
            </button>

            {/* Text input search */}
            <div className="relative w-full sm:w-85">
              <span className={`absolute inset-y-0 ${language === "ar" ? "right-0 pr-3" : "left-0 pl-3"} flex items-center pointer-events-none text-txtmuted`}>
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder={language === "ar" ? "ابحث برقم الفاتورة، العميل أو الخدمة..." : "Search by code, client or service..."}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className={`w-full bg-appbk text-txtmain border border-borderline rounded-xl py-2.5 text-xs focus:outline-none focus:border-indigo-500 transition-colors ${language === "ar" ? "pr-9 pl-3.5" : "pl-9 pr-3.5"}`}
              />
            </div>
          </div>
        </div>

        {/* Tab Filters */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-borderline">
          <button
            onClick={() => setStatusFilter("All")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${statusFilter === "All" ? "bg-indigo-600 dark:bg-indigo-500 text-white shadow-sm" : "bg-appbk text-txtmuted hover:bg-borderline/40"}`}
          >
            {language === "ar" ? `كل الفواتير (${invoices.length})` : `All Invoices (${invoices.length})`}
          </button>
          
          <button
            onClick={() => setStatusFilter("Paid")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${statusFilter === "Paid" ? "bg-emerald-600 text-white shadow-sm" : "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"}`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            {language === "ar" ? `المدفوعة (${invoices.filter(i => i.status === "Paid").length})` : `Paid (${invoices.filter(i => i.status === "Paid").length})`}
          </button>

          <button
            onClick={() => setStatusFilter("Unpaid")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${statusFilter === "Unpaid" ? "bg-indigo-600 text-white shadow-sm" : "bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20"}`}
          >
            <span className="w-2 h-2 rounded-full bg-indigo-400" />
            {language === "ar" ? `غير المدفوعة (${invoices.filter(i => i.status === "Unpaid" && (!i.due_date || i.due_date >= todayStr)).length})` : `Unpaid (${invoices.filter(i => i.status === "Unpaid" && (!i.due_date || i.due_date >= todayStr)).length})`}
          </button>

          <button
            onClick={() => setStatusFilter("Overdue")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${statusFilter === "Overdue" ? "bg-rose-600 text-white shadow-sm" : "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"}`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            {language === "ar" ? `المتأخرة (${invoices.filter(i => i.status === "Unpaid" && i.due_date && i.due_date < todayStr).length})` : `Overdue (${invoices.filter(i => i.status === "Unpaid" && i.due_date && i.due_date < todayStr).length})`}
          </button>
        </div>

      </div>

      {/* Directory Bills Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredInvoices.length === 0 ? (
          <div className="bg-cardbk p-12 rounded-2xl shadow-sm border border-borderline text-center col-span-full text-txtmuted">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-25" />
            <p className="text-sm">{language === "ar" ? "لا يوجد فواتير تتبع الفلتر المحدد حالياً." : "No invoice items match selected state filters."}</p>
          </div>
        ) : (
          filteredInvoices.map(inv => {
            const client = getClientInfo(inv.client_id);
            const service = getOpService(inv.op_id);
            const isOverdue = inv.status === "Unpaid" && inv.due_date && inv.due_date < todayStr;

            return (
              <div 
                key={inv.id} 
                className={`bg-cardbk rounded-2xl shadow-sm border p-5 flex flex-col justify-between gap-4 transition-all hover:shadow-md relative overflow-hidden ${
                  inv.status === "Paid" 
                  ? "border-emerald-500/20 hover:border-emerald-500/40" 
                  : isOverdue 
                    ? "border-rose-500/30 bg-rose-500/5 animate-pulse" 
                    : "border-borderline hover:border-indigo-500/30"
                }`}
              >
                
                {/* Diagonal Stripe for Quick identification */}
                <div className={`absolute top-0 inset-x-y w-2 h-full ${language === "ar" ? "right-0" : "left-0"} ${inv.status === "Paid" ? "bg-emerald-500" : isOverdue ? "bg-rose-500" : "bg-indigo-500"}`} />

                {/* Bill Heading */}
                <div className={`${language === "ar" ? "pr-3" : "pl-3"} space-y-2`}>
                  <div className="flex justify-between items-center gap-1.5">
                    <span className="text-[9px] bg-appbk text-txtmuted font-mono px-2 py-0.5 rounded border border-borderline">
                      Ref: {inv.id.substring(0, 10)}...
                    </span>
                    
                    {/* Badge Status */}
                    {inv.status === "Paid" ? (
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-bold px-2 py-0.5 rounded-md flex items-center gap-1 border border-emerald-500/20 shrink-0">
                        <CheckCircle2 className="w-3 h-3" />
                        {language === "ar" ? "مدفوعة" : "Paid"}
                      </span>
                    ) : isOverdue ? (
                      <span className="text-[10px] bg-rose-500/10 text-rose-400 font-black px-2 py-0.5 rounded-md flex items-center gap-1 border border-rose-500/20 shrink-0">
                        <AlertTriangle className="w-3 h-3" />
                        {language === "ar" ? "متأخرة" : "Overdue"}
                      </span>
                    ) : (
                      <span className="text-[10px] bg-indigo-500/10 text-indigo-400 font-bold px-2 py-0.5 rounded-md flex items-center gap-1 border border-indigo-500/20 shrink-0">
                        <Clock className="w-3 h-3" />
                        {language === "ar" ? "بانتظار السداد" : "Unpaid"}
                      </span>
                    )}
                  </div>

                  <h4 className="text-sm font-bold text-txtmain pt-1 truncate">{service}</h4>
                  <p className="text-xs text-txtmuted truncate">{language === "ar" ? "العميل:" : "Client:"} <strong className="text-txtmain">{client.name}</strong> {client.company && `(${client.company})`}</p>
                </div>

                <div className={`${language === "ar" ? "pr-3" : "pl-3"} divide-y divide-borderline`}>
                  {/* Amount Details */}
                  <div className="flex justify-between py-2 items-center text-xs">
                    <span className="text-txtmuted">{language === "ar" ? "قيمة الفاتورة" : "Invoice Value"}</span>
                    <span className="text-txtmain font-extrabold text-sm font-mono">
                      {inv.amount.toLocaleString()} <span className="font-sans font-normal text-[10px] text-txtmuted">{currency}</span>
                    </span>
                  </div>

                  {/* Date details */}
                  <div className="flex justify-between py-2 items-center text-[11px]">
                    <span className="text-txtmuted">{language === "ar" ? "تاريخ الاستحقاق" : "Payment Due Date"}</span>
                    <span className={`font-mono font-medium ${isOverdue ? 'text-rose-400 font-bold' : 'text-txtmain'}`}>
                      {inv.due_date || "—"}
                    </span>
                  </div>

                  {/* Payment date if paid */}
                  {inv.status === "Paid" && inv.payment_date && (
                    <div className="flex justify-between py-2 items-center text-[11px]">
                      <span className="text-txtmuted font-medium">{language === "ar" ? "تاريخ السداد والتحصيل" : "Collected Date"}</span>
                      <span className="font-mono bg-emerald-500/10 text-emerald-400 px-2.5 py-0.5 rounded border border-emerald-500/20 font-bold">
                        {inv.payment_date}
                      </span>
                    </div>
                  )}
                </div>

                {/* Bottom Toggle Control Action */}
                <div className={`pt-3 ${language === "ar" ? "pr-3" : "pl-3"} border-t border-borderline flex flex-wrap items-center justify-between gap-3`}>
                  <span className="text-[9px] text-txtmuted flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-indigo-500" />
                    {language === "ar" ? "استحقاق 7 أيام تلقائي" : "Auto-due in 7 Days"}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setSelectedInvoiceForPrint(inv)}
                      className="font-bold text-[10px] px-2.5 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 duration-150 cursor-pointer flex items-center gap-1 transition-all"
                      title={language === "ar" ? "معاينة وطباعة الفاتورة أو تصديرها كـ PDF" : "Preview, print or save as PDF"}
                    >
                      <Printer className="w-3 h-3" />
                      <span>{language === "ar" ? "PDF / طباعة" : "PDF / Print"}</span>
                    </button>

                    <button
                      onClick={() => onToggleInvoice(inv.id, inv.status)}
                      className={`font-semibold text-[10px] px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                        inv.status === "Paid"
                        ? "bg-rose-500/10 hover:bg-rose-500/20 text-rose-400"
                        : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                      }`}
                    >
                      {inv.status === "Paid" ? (language === "ar" ? "إلغاء التحصيل" : "Uncollect") : (language === "ar" ? "تحصيل" : "Collect")}
                    </button>
                  </div>
                </div>

              </div>
            );
          })
        )}
      </div>

      {/* Overlaid print container for rendering Saudi standard VAT Invoice */}
      {selectedInvoiceForPrint && (
        <InvoicePrintModal
          invoice={selectedInvoiceForPrint}
          client={clients.find(c => c.id === selectedInvoiceForPrint.client_id) || { id: "", company_id: "", name: language === "ar" ? "عميل مجهول" : "Unknown Client", company: "", phone: "" }}
          operation={operations.find(o => o.id === selectedInvoiceForPrint.op_id) || { id: "", company_id: "", client_id: "", service: language === "ar" ? "عملية مجهولة" : "Unknown Service", cost: 0, revenue: 0, profit: 0, date: "" }}
          company={currentCompany}
          onClose={() => setSelectedInvoiceForPrint(null)}
        />
      )}

    </div>
  );
}
