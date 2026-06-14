import React, { useState, useMemo } from "react";
import { Operation, Client } from "../types";
import { 
  PlusCircle, Search, DollarSign, HelpCircle, Activity, Briefcase, Trash2, 
  Calendar, SlidersHorizontal, X, Filter, FileSpreadsheet 
} from "lucide-react";
import { useLanguage } from "../lib/LanguageContext";

interface OperationsProps {
  operations: Operation[];
  clients: Client[];
  companyCurrency?: string;
  onCreateOperation: (data: { service: string; client_id: string; cost: number; revenue: number; status?: "Pending" | "In Progress" | "Completed" }) => Promise<void>;
  onDeleteOperation?: (id: string) => Promise<void>;
  onUpdateOperationStatus?: (id: string, status: "Pending" | "In Progress" | "Completed") => Promise<void>;
  onBulkImportOperations?: (operations: Array<{ service: string; client_name?: string; client_company?: string; cost?: number; revenue?: number; status?: string; date?: string }>) => Promise<void>;
}

export default function Operations({ 
  operations, 
  clients, 
  companyCurrency = "ر.س", 
  onCreateOperation, 
  onDeleteOperation, 
  onUpdateOperationStatus,
  onBulkImportOperations
}: OperationsProps) {
  const { language, t } = useLanguage();
  const [service, setService] = useState("");
  const [clientId, setClientId] = useState("");
  const [cost, setCost] = useState<number | "">("");
  const [revenue, setRevenue] = useState<number | "">("");
  const [status, setStatus] = useState<"Pending" | "In Progress" | "Completed">("In Progress");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // CSV Import States for Operations
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [importError, setImportError] = useState("");
  const [importSuccess, setImportSuccess] = useState("");
  const [parsedOps, setParsedOps] = useState<Array<{ service: string; client_name: string; client_company: string; cost: number; revenue: number; status: string; date: string }>>([]);

  // standard RFC 4180 CSV parser
  const parseCSV = (text: string): string[][] => {
    const lines: string[][] = [];
    let row: string[] = [""];
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          row[row.length - 1] += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push("");
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        lines.push(row);
        row = [""];
      } else {
        row[row.length - 1] += char;
      }
    }
    if (row.length > 1 || row[0] !== "") {
      lines.push(row);
    }
    return lines;
  };

  const downloadTemplate = () => {
    const headers = language === "ar" 
      ? "الخدمة,العميل,الشركة (اختياري),التكلفة,الإيراد,الحالة (Pending/In Progress/Completed),التاريخ (YYYY-MM-DD)" 
      : "Service,Client Name,Client Company,Cost,Revenue,Status,Date";
    const sampleRow = language === "ar" 
      ? "تطوير موقع الكتروني,عبدالله الشمري,مؤسسة الأفق,12000,25000,Completed,2026-06-12" 
      : "Website Development,Abdullah Shammari,Horizon Corp,12000,25000,Completed,2026-06-12";
    const csvContent = "\uFEFF" + headers + "\n" + sampleRow;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", language === "ar" ? "نموذج_استيراد_العمليات.csv" : "operations_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    setImportError("");
    setImportSuccess("");
    setParsedOps([]);

    if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
      setImportError(language === "ar" ? "الرجاء اختيار ملف بصيغة CSV فقط" : "Please select a valid CSV file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) {
          throw new Error("Empty file");
        }
        const rows = parseCSV(text);
        if (rows.length < 2) {
          setImportError(language === "ar" ? "الملف فارغ أو لا يحتوي على صفوف بيانات" : "File is empty or lacks rows");
          return;
        }

        const headers = rows[0].map(h => h.trim().toLowerCase());
        
        let serviceIdx = headers.findIndex(h => h.includes("service") || h.includes("خدمة") || h.includes("عملية") || h.includes("الخدمة") || h.includes("العملية"));
        let clientIdx = headers.findIndex(h => h.includes("client") || h.includes("العميل") || h.includes("عميل") || h.includes("اسم العميل"));
        let companyIdx = headers.findIndex(h => h.includes("company") || h.includes("الشركة") || h.includes("منشأة") || h.includes("المؤسسة"));
        let costIdx = headers.findIndex(h => h.includes("cost") || h.includes("تكلفة") || h.includes("التكلفة"));
        let revenueIdx = headers.findIndex(h => h.includes("rev") || h.includes("إيراد") || h.includes("الإيراد") || h.includes("سعر") || h.includes("مبلغ") || h.includes("القيمة"));
        let statusIdx = headers.findIndex(h => h.includes("status") || h.includes("حالة") || h.includes("الحالة"));
        let dateIdx = headers.findIndex(h => h.includes("date") || h.includes("التاريخ") || h.includes("تاريخ"));

        if (serviceIdx === -1) {
          serviceIdx = 0;
        }

        const opsToImport: Array<{ service: string; client_name: string; client_company: string; cost: number; revenue: number; status: string; date: string }> = [];

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (row.length === 1 && row[0] === "") continue;
          
          const rawService = row[serviceIdx] ? row[serviceIdx].trim() : "";
          if (!rawService) continue;

          const rawClient = clientIdx !== -1 && row[clientIdx] ? row[clientIdx].trim() : "";
          const rawCompany = companyIdx !== -1 && row[companyIdx] ? row[companyIdx].trim() : "";
          const rawCost = costIdx !== -1 && row[costIdx] ? Number(row[costIdx].trim()) || 0 : 0;
          const rawRev = revenueIdx !== -1 && row[revenueIdx] ? Number(row[revenueIdx].trim()) || 0 : 0;
          
          let rawStatus = statusIdx !== -1 && row[statusIdx] ? row[statusIdx].trim() : "In Progress";
          // Normalise status
          if (rawStatus.toLowerCase().includes("pend") || rawStatus.includes("قيد") || rawStatus.includes("معلق")) {
            rawStatus = "Pending";
          } else if (rawStatus.toLowerCase().includes("prog") || rawStatus.includes("تنفيذ") || rawStatus.includes("عمل")) {
            rawStatus = "In Progress";
          } else if (rawStatus.toLowerCase().includes("comp") || rawStatus.includes("مكتمل") || rawStatus.includes("تم")) {
            rawStatus = "Completed";
          } else {
            rawStatus = "In Progress";
          }

          let rawDate = dateIdx !== -1 && row[dateIdx] ? row[dateIdx].trim() : "";
          if (!rawDate || !/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
            rawDate = new Date().toISOString().split("T")[0];
          }

          opsToImport.push({
            service: rawService,
            client_name: rawClient,
            client_company: rawCompany,
            cost: rawCost,
            revenue: rawRev,
            status: rawStatus,
            date: rawDate
          });
        }

        if (opsToImport.length === 0) {
          setImportError(language === "ar" ? "تعذر العثور على عمليات صالحة في ملف CSV. تأكد من صحة ترويسة الأعمدة." : "No valid operations found in CSV.");
        } else {
          setParsedOps(opsToImport);
        }
      } catch (err: any) {
        console.error(err);
        setImportError(language === "ar" ? "حدث خطأ أثناء قراءة وتحليل ملف CSV" : "Error occurred while parsing CSV file");
      }
    };
    reader.readAsText(file, "UTF-8");
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const confirmImport = async () => {
    if (parsedOps.length === 0) return;
    setImporting(true);
    setImportError("");
    setImportSuccess("");

    try {
      if (onBulkImportOperations) {
        await onBulkImportOperations(parsedOps);
        setImportSuccess(language === "ar" ? `تم استيراد ${parsedOps.length} عملية بنجاح!` : `Successfully imported ${parsedOps.length} operations!`);
        setParsedOps([]);
        setTimeout(() => {
          setShowImportPanel(false);
          setImportSuccess("");
        }, 2000);
      } else {
        throw new Error("Bulk operations import is not configured.");
      }
    } catch (err: any) {
      setImportError(err.message || (language === "ar" ? "فشل استيراد العمليات" : "Failed to import operations"));
    } finally {
      setImporting(false);
    }
  };

  // Advanced Filtering States
  const [filterClientId, setFilterClientId] = useState("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [filterMinVal, setFilterMinVal] = useState<number | "">("");
  const [filterMaxVal, setFilterMaxVal] = useState<number | "">("");
  const [showFilters, setShowFilters] = useState(false);

  const calculatedProfit = (Number(revenue) || 0) - (Number(cost) || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!service.trim()) {
      setError(language === "ar" ? "الرجاء إدخال اسم الخدمة أو العملية" : "Please fill in the service or operation name");
      return;
    }

    setLoading(true);
    try {
      await onCreateOperation({
        service,
        client_id: clientId,
        cost: Number(cost) || 0,
        revenue: Number(revenue) || 0,
        status
      });
      // Reset form
      setService("");
      setClientId("");
      setCost("");
      setRevenue("");
      setStatus("In Progress");
    } catch (err: any) {
      setError(err?.message || (language === "ar" ? "حدث خطأ أثناء حفظ العملية." : "An error occurred while saving the operation."));
    } finally {
      setLoading(false);
    }
  };

  // Resolve client name
  const getClientName = (id: string) => {
    const cli = clients.find(c => c.id === id);
    if (!cli) return language === "ar" ? "بلا عميل محدد" : "No client specified";
    return cli.company ? `${cli.name} (${cli.company})` : cli.name;
  };

  // Filtered operations using advanced parameters (service name, date, value, client name)
  const filteredOps = useMemo(() => {
    return operations.filter(op => {
      // 1. Text Search: matches service name or client name or client company
      const serviceMatch = op.service.toLowerCase().includes(search.toLowerCase());
      
      const client = clients.find(c => c.id === op.client_id);
      const clientNameMatch = client ? client.name.toLowerCase().includes(search.toLowerCase()) : false;
      const clientCompanyMatch = client && client.company ? client.company.toLowerCase().includes(search.toLowerCase()) : false;
      
      if (search && !serviceMatch && !clientNameMatch && !clientCompanyMatch) {
        return false;
      }

      // 2. Client dropdown filter
      if (filterClientId && op.client_id !== filterClientId) {
        return false;
      }

      // 3. Date range filter
      if (filterStartDate && op.date < filterStartDate) {
        return false;
      }
      if (filterEndDate && op.date > filterEndDate) {
        return false;
      }

      // 4. Value filter (revenue)
      if (filterMinVal !== "" && op.revenue < Number(filterMinVal)) {
        return false;
      }
      if (filterMaxVal !== "" && op.revenue > Number(filterMaxVal)) {
        return false;
      }

      return true;
    });
  }, [operations, clients, search, filterClientId, filterStartDate, filterEndDate, filterMinVal, filterMaxVal]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-start">
      
      {/* Creation form on the edit side */}
      <div className="lg:col-span-4 space-y-6">
        <div className="bg-cardbk p-6 rounded-2xl shadow-sm border border-borderline">
          <div className="flex items-center gap-2 border-b border-borderline pb-4 mb-4">
            <PlusCircle className="w-5 h-5 text-indigo-500" />
            <h3 className="text-lg font-bold text-txtmain">{t("ops_record_title")}</h3>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-rose-500/10 text-rose-500 text-xs rounded-xl font-medium border border-rose-500/20">
                {error}
              </div>
            )}

            {/* Service input */}
            <div>
              <label className="block text-txtmain text-xs font-semibold mb-1.5">{t("ops_service_label")}</label>
              <input
                type="text"
                placeholder={t("ops_service_placeholder")}
                value={service}
                onChange={e => setService(e.target.value)}
                className="w-full bg-appbk border border-borderline rounded-xl px-3.5 py-2.5 text-sm text-txtmain placeholder-txtmuted/50 focus:outline-none focus:border-indigo-500 transition-colors"
                required
              />
            </div>

            {/* Client selector */}
            <div>
              <label className="block text-txtmain text-xs font-semibold mb-1.5">{t("ops_client_label")}</label>
              {clients.length === 0 ? (
                <div className="text-[11px] text-amber-500 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
                  {language === "ar" 
                    ? "لا يوجد عملاء متاحين حالياً. الرجاء إضافة عميل من قسم \"العملاء\" أولاً لربطه بالعملية." 
                    : "No clients configured. Please create a client record first to link it."}
                </div>
              ) : (
                <select
                  value={clientId}
                  onChange={e => setClientId(e.target.value)}
                  className="w-full bg-appbk text-txtmain border border-borderline rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                >
                  <option value="">{language === "ar" ? "-- اختر عميل من القائمة --" : "-- Select linked client --"}</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id} className="bg-cardbk text-txtmain">
                      {c.name} {c.company ? `(${c.company})` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Costs & revenue side by side */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-txtmain text-xs font-semibold mb-1.5">{t("ops_cost_lbl")} ({companyCurrency})</label>
                <input
                  type="number"
                  placeholder="0"
                  min="0"
                  value={cost}
                  onChange={e => setCost(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full bg-appbk border border-borderline rounded-xl px-3 py-2.5 text-sm text-txtmain placeholder-txtmuted/50 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-txtmain text-xs font-semibold mb-1.5">{t("ops_revenue_lbl")} ({companyCurrency})</label>
                <input
                  type="number"
                  placeholder="0"
                  min="0"
                  value={revenue}
                  onChange={e => setRevenue(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full bg-appbk border border-borderline rounded-xl px-3 py-2.5 text-sm text-txtmain placeholder-txtmuted/50 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            {/* Status Selector */}
            <div>
              <label className="block text-txtmain text-xs font-semibold mb-1.5">{language === "ar" ? "حالة العملية" : "Operation Status"}</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as any)}
                className="w-full bg-appbk text-txtmain border border-borderline rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                id="operation-status-create"
              >
                <option value="In Progress" className="bg-cardbk text-txtmain">{language === "ar" ? "قيد التنفيذ (In Progress)" : "In Progress"}</option>
                <option value="Completed" className="bg-cardbk text-txtmain">{language === "ar" ? "مكتملة (Completed)" : "Completed"}</option>
                <option value="Pending" className="bg-cardbk text-txtmain">{language === "ar" ? "معلقة (Pending)" : "Pending"}</option>
              </select>
            </div>

            {/* Dynamic visual preview of the calculated profit */}
            <div className={`p-4 rounded-xl border flex justify-between items-center ${calculatedProfit > 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : calculatedProfit < 0 ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-appbk border-borderline text-txtmain'}`}>
              <div>
                <p className="text-[10px] font-semibold opacity-75">{t("ops_profit_preview")}</p>
                <p className="text-sm font-extrabold mt-0.5">{language === "ar" ? "الربح = الإيراد - التكلفة" : "Profit = Inflow - Outflow"}</p>
              </div>
              <div className="text-start font-mono">
                <span className="text-lg font-black pr-1">{calculatedProfit.toLocaleString()}</span>
                <span className="text-xs">{companyCurrency}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white font-bold py-3 px-4 rounded-xl text-xs transition-all duration-150 disabled:opacity-50 cursor-pointer"
            >
              {loading 
                ? (language === "ar" ? "جاري الحفظ والجدولة..." : "Saving records...") 
                : (language === "ar" ? "حفظ وحساب الأرباح تلقائياً" : "Save & Calculate Earnings")}
            </button>

            <p className="text-[10px] text-txtmuted text-center leading-relaxed">
              ⚠️ {language === "ar" 
                ? "عند تسجيل العملية، سيقوم النظام بتوليد فاتورة غير مدفوعة تلقائية مستحقة الدفع بعد 7 أيام تماشياً مع معايير الفوترة الذكية." 
                : "Upon logging operations, a clean unpaid invoice due in 7 days is auto-issued under active accounts."}
            </p>
          </form>
        </div>
      </div>

      {/* Operations Directory Table */}
      <div className="lg:col-span-8 space-y-4">
        <div className="bg-cardbk p-6 rounded-2xl shadow-sm border border-borderline">
          
          {/* Header search with Advanced Filters */}
          <div className="space-y-4 mb-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-lg font-bold text-txtmain">{t("ops_history")}</h3>
                <p className="text-xs text-txtmuted mt-0.5">{t("ops_history_desc")}</p>
              </div>
              
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-grow sm:w-64">
                  <span className={`absolute inset-y-0 ${language === "ar" ? "right-0 pr-3" : "left-0 pl-3"} flex items-center pointer-events-none text-txtmuted`}>
                    <Search className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    placeholder={language === "ar" ? "ابحث بالخدمة، العميل..." : "Search action, client..."}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className={`w-full bg-appbk text-txtmain border border-borderline rounded-xl py-2 text-xs focus:outline-none focus:border-indigo-500 transition-colors ${language === "ar" ? "pr-9 pl-3" : "pl-9 pr-3"}`}
                  />
                </div>
                
                <button
                  type="button"
                  onClick={() => {
                    setShowImportPanel(!showImportPanel);
                    setShowFilters(false);
                  }}
                  className={`p-2 rounded-xl border border-borderline flex items-center gap-1.5 text-xs font-bold transition-all ${
                    showImportPanel || parsedOps.length > 0
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                      : "bg-appbk text-txtmuted hover:text-txtmain"
                  } cursor-pointer`}
                  title={language === "ar" ? "استيراد عمليات من ملف CSV" : "Import operations from CSV file"}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span className="hidden md:inline">
                    {language === "ar" ? "استيراد CSV" : "Import CSV"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowFilters(!showFilters);
                    setShowImportPanel(false);
                  }}
                  className={`p-2 rounded-xl border border-borderline flex items-center gap-1.5 text-xs font-bold transition-all ${showFilters || filterClientId || filterStartDate || filterEndDate || filterMinVal !== "" || filterMaxVal !== "" ? 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' : 'bg-appbk text-txtmuted hover:text-txtmain'} cursor-pointer`}
                  title={language === "ar" ? "خيارات التصفية المتقدمة" : "Advanced Filters"}
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  <span className="hidden md:inline">{language === "ar" ? "تصفية مخصصة" : "Advanced"}</span>
                </button>

                {(search || filterClientId || filterStartDate || filterEndDate || filterMinVal !== "" || filterMaxVal !== "") && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setFilterClientId("");
                      setFilterStartDate("");
                      setFilterEndDate("");
                      setFilterMinVal("");
                      setFilterMaxVal("");
                    }}
                    className="p-2 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500 hover:text-white transition-all text-xs cursor-pointer"
                    title={language === "ar" ? "إعادة تعيين الكل" : "Reset All"}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Collapsible Bulk Import Panel */}
            {showImportPanel && (
              <div className="p-6 bg-appbk/80 rounded-2xl border border-borderline space-y-4 animate-in fade-in slide-in-from-top-2 duration-200 text-start">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-borderline pb-3">
                  <div>
                    <h4 className="text-sm font-bold text-txtmain flex items-center gap-1.5 font-sans">
                      <FileSpreadsheet className="w-4.5 h-4.5 text-indigo-500" />
                      {language === "ar" ? "أداة استيراد العمليات والصفقات الذكية (CSV)" : "Smart Operations CSV Import Utility"}
                    </h4>
                    <p className="text-[11px] text-txtmuted mt-0.5 font-sans">
                      {language === "ar"
                        ? "استورد العمليات والصفقات المنفذة دفعة واحدة. النظام سيربط أو ينشئ حسابات العملاء تلقائياً وينشئ الفواتير ويحدث التقارير."
                        : "Import historical sales or service operations. The system dynamically resolves or creates clients, issues custom invoices, and refreshes metrics."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={downloadTemplate}
                    className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 px-3 py-1.5 rounded-lg border border-indigo-500/20 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    {language === "ar" ? "تحميل النموذج القياسي" : "Download Sample CSV"}
                  </button>
                </div>

                {importError && (
                  <div className="p-3 bg-rose-500/10 text-rose-500 text-xs rounded-xl border border-rose-500/20 text-start font-semibold">
                    ⚠️ {importError}
                  </div>
                )}

                {importSuccess && (
                  <div className="p-3 bg-emerald-500/10 text-emerald-500 text-xs rounded-xl border border-emerald-500/20 text-start font-semibold font-sans">
                    ✅ {importSuccess}
                  </div>
                )}

                {parsedOps.length === 0 ? (
                  /* Drag and Drop Zone */
                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                      dragActive
                        ? "border-indigo-500 bg-indigo-500/5 scale-[0.99]"
                        : "border-borderline hover:border-txtmuted/40"
                    }`}
                  >
                    <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 text-txtmuted/40 animate-pulse" />
                    <p className="text-xs font-bold text-txtmain">
                      {language === "ar"
                        ? "اسحب ملف الـ CSV لبيانات العمليات وأفلته هنا، أو"
                        : "Drag and drop your operations CSV file here, or"}
                    </p>
                    <label className="inline-block mt-3 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white text-xs font-bold rounded-xl cursor-pointer transition-all shadow-sm">
                      <span>{language === "ar" ? "تصفح الملفات" : "Browse Files"}</span>
                      <input
                        type="file"
                        accept=".csv"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                    <p className="text-[10px] text-txtmuted mt-2.5">
                      {language === "ar"
                        ? "يدعم الصيغ النصية بترميز UTF-8 فقط"
                        : "Only CSV files with UTF-8 encoding are supported."}
                    </p>
                  </div>
                ) : (
                  /* Data Preview Area */
                  <div className="space-y-3">
                    <div className="flex justify-between items-center bg-appbk p-3 rounded-xl border border-borderline text-xs font-medium">
                      <span className="text-txtmuted font-sans">
                        {language === "ar"
                          ? `تم تحليل ${parsedOps.length} عملية جاهزة للاستيراد:`
                          : `${parsedOps.length} operation records parsed & ready to load:`}
                      </span>
                      <button
                        onClick={() => setParsedOps([])}
                        className="text-rose-500 hover:text-rose-700 font-bold transition-colors cursor-pointer"
                      >
                        {language === "ar" ? "إلغاء وإعادة المحاولة" : "Clear & Retry"}
                      </button>
                    </div>

                    {/* Scrollable grid preview */}
                    <div className="max-h-48 overflow-y-auto border border-borderline rounded-xl divide-y divide-borderline bg-cardbk">
                      {parsedOps.map((op, i) => (
                        <div key={i} className="p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs text-start hover:bg-appbk/40">
                          <div>
                            <div className="font-bold text-txtmain flex items-center gap-1.5">
                              <span>{op.service}</span>
                              <span className={`px-2 py-0.5 rounded-[6px] text-[9px] font-bold ${
                                op.status === "Completed" ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" :
                                op.status === "In Progress" ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" :
                                "bg-zinc-500/10 text-zinc-500 border border-zinc-500/20"
                              }`}>
                                {op.status}
                              </span>
                            </div>
                            <div className="text-[10px] text-txtmuted mt-0.5 flex items-center gap-2">
                              <span>👤 {op.client_name || (language === "ar" ? "عميل عام" : "General Client")}</span>
                              {op.client_company && <span className="bg-appbk px-1.5 py-0.2 rounded border border-borderline">{op.client_company}</span>}
                              <span>📅 {op.date}</span>
                            </div>
                          </div>
                          
                          <div className="text-right flex items-center gap-3">
                            <div className="text-[10px]">
                              <span className="text-txtmuted">{language === "ar" ? "التكلفة: " : "Cost: "}</span>
                              <span className="font-mono font-semibold text-rose-500">{op.cost} {companyCurrency}</span>
                            </div>
                            <div className="text-[10px]">
                              <span className="text-txtmuted">{language === "ar" ? "الإيراد: " : "Revenue: "}</span>
                              <span className="font-mono font-bold text-emerald-500">{op.revenue} {companyCurrency}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setParsedOps([])}
                        className="px-4 py-2 text-xs font-bold text-txtmuted hover:text-txtmain bg-appbk border border-borderline rounded-xl cursor-pointer"
                      >
                        {language === "ar" ? "تراجع" : "Cancel"}
                      </button>
                      <button
                        type="button"
                        onClick={confirmImport}
                        disabled={importing}
                        className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white text-xs font-bold px-5 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {importing ? (
                          <span>{language === "ar" ? "جاري الحفظ..." : "Saving..."}</span>
                        ) : (
                          <span>{language === "ar" ? "تأكيد واستيراد العمليات" : "Confirm Import"}</span>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Advanced Filters Panel */}
            {showFilters && (
              <div className="p-4 bg-appbk/60 rounded-xl border border-borderline/80 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Filter by Client */}
                  <div>
                    <label className="block text-[10px] text-txtmuted font-semibold mb-1">{language === "ar" ? "تصفية حسب العميل" : "Filter by Client"}</label>
                    <select
                      value={filterClientId}
                      onChange={e => setFilterClientId(e.target.value)}
                      className="w-full bg-cardbk text-txtmain border border-borderline rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-indigo-500 transition-colors"
                    >
                      <option value="">{language === "ar" ? "كل العملاء" : "All Clients"}</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Filter by Date Range */}
                  <div className="sm:col-span-2 grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-txtmuted font-semibold mb-1">{language === "ar" ? "من تاريخ" : "From Date"}</label>
                      <input
                        type="date"
                        value={filterStartDate}
                        onChange={e => setFilterStartDate(e.target.value)}
                        className="w-full bg-cardbk text-txtmain border border-borderline rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-txtmuted font-semibold mb-1">{language === "ar" ? "إلى تاريخ" : "To Date"}</label>
                      <input
                        type="date"
                        value={filterEndDate}
                        onChange={e => setFilterEndDate(e.target.value)}
                        className="w-full bg-cardbk text-txtmain border border-borderline rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-1">
                  {/* Minimum Contract value */}
                  <div>
                    <label className="block text-[10px] text-txtmuted font-semibold mb-1">{language === "ar" ? "قيمة الإيراد الأدنى" : "Min Inflow/Revenue"}</label>
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        placeholder="0"
                        value={filterMinVal}
                        onChange={e => setFilterMinVal(e.target.value === "" ? "" : Number(e.target.value))}
                        className={`w-full bg-cardbk text-txtmain border border-borderline rounded-xl py-1.5 text-xs focus:outline-none focus:border-indigo-500 transition-colors ${language === "ar" ? "pl-14 pr-2.5" : "pr-14 pl-2.5"}`}
                      />
                      <span className={`absolute ${language === "ar" ? "left-2.5" : "right-2.5"} text-[9px] text-txtmuted font-mono`}>{companyCurrency}</span>
                    </div>
                  </div>

                  {/* Maximum Contract value */}
                  <div>
                    <label className="block text-[10px] text-txtmuted font-semibold mb-1">{language === "ar" ? "قيمة الإيراد الأقصى" : "Max Inflow/Revenue"}</label>
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        placeholder="1,000,000"
                        value={filterMaxVal}
                        onChange={e => setFilterMaxVal(e.target.value === "" ? "" : Number(e.target.value))}
                        className={`w-full bg-cardbk text-txtmain border border-borderline rounded-xl py-1.5 text-xs focus:outline-none focus:border-indigo-500 transition-colors ${language === "ar" ? "pl-14 pr-2.5" : "pr-14 pl-2.5"}`}
                      />
                      <span className={`absolute ${language === "ar" ? "left-2.5" : "right-2.5"} text-[9px] text-txtmuted font-mono`}>{companyCurrency}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Table container */}
          <div className="overflow-x-auto">
            {filteredOps.length === 0 ? (
              <div className="text-center py-12 text-txtmuted">
                <Activity className="w-12 h-12 mx-auto mb-3 opacity-25" />
                <p className="text-sm">{language === "ar" ? "لا يوجد أي عمليات مسجّلة توافق البحث." : "No operations match seeking filters."}</p>
              </div>
            ) : (
              <table className="w-full text-start border-collapse text-xs">
                <thead>
                  <tr className="border-b border-borderline text-txtmuted pb-3">
                    <th className="font-bold py-3 px-2 text-start">{language === "ar" ? "الخدمة / العملية" : "Service / Action"}</th>
                    <th className="font-bold py-3 px-2 text-start">{language === "ar" ? "العميل" : "Client"}</th>
                    <th className="font-bold py-3 px-2 text-start">{language === "ar" ? "التكلفة" : "Production Cost"}</th>
                    <th className="font-bold py-3 px-2 text-start">{language === "ar" ? "الإيراد" : "Inflow Revenue"}</th>
                    <th className="font-bold py-3 px-2 text-start">{language === "ar" ? "صافي الربح" : "Net Margin"}</th>
                    <th className="font-bold py-3 px-2 text-center">{language === "ar" ? "الحالة" : "Status"}</th>
                    <th className="font-bold py-3 px-2 text-center">{language === "ar" ? "التاريخ" : "Logging Date"}</th>
                    {onDeleteOperation && <th className="font-bold py-3 px-2 text-center">{language === "ar" ? "الإجراء" : "Action"}</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-borderline">
                  {filteredOps.map(op => (
                    <tr key={op.id} className="hover:bg-appbk/50 transition-colors">
                      <td className="py-3.5 px-2 font-bold text-txtmain flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                        {op.service}
                      </td>
                      <td className="py-3.5 px-2 text-txtmuted">{getClientName(op.client_id)}</td>
                      <td className="py-3.5 px-2 text-start text-rose-500 font-mono font-medium">{op.cost.toLocaleString()} {companyCurrency}</td>
                      <td className="py-3.5 px-2 text-start text-emerald-500 font-mono font-medium">{op.revenue.toLocaleString()} {companyCurrency}</td>
                      <td className="py-3.5 px-2 text-start">
                        <span className={`inline-block font-mono font-bold px-2 py-0.5 rounded ${op.profit >= 0 ? "text-emerald-400 bg-emerald-500/10" : "text-rose-400 bg-rose-500/10"}`}>
                          {op.profit >= 0 ? "+" : ""}{op.profit.toLocaleString()} {companyCurrency}
                        </span>
                      </td>
                      <td className="py-3.5 px-2 text-center">
                        {onUpdateOperationStatus ? (
                          <div className="relative inline-block text-start">
                            <select
                              value={op.status || "Completed"}
                              onChange={(e) => onUpdateOperationStatus(op.id, e.target.value as any)}
                              className={`text-[10px] font-bold px-3 py-1 rounded-full outline-none border transition-colors cursor-pointer text-center appearance-none ${
                                (op.status || "Completed") === "Completed"
                                  ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/25"
                                  : (op.status || "Completed") === "In Progress"
                                  ? "bg-blue-500/15 text-blue-400 border-blue-500/20 hover:bg-blue-500/25"
                                  : "bg-amber-500/15 text-amber-500 border-amber-500/20 hover:bg-amber-500/25"
                              }`}
                            >
                              <option value="Completed" className="bg-cardbk text-emerald-500 font-bold">{language === "ar" ? "مكتملة" : "Completed"}</option>
                              <option value="In Progress" className="bg-cardbk text-blue-400 font-bold">{language === "ar" ? "قيد التنفيذ" : "In Progress"}</option>
                              <option value="Pending" className="bg-cardbk text-amber-500 font-bold">{language === "ar" ? "معلقة" : "Pending"}</option>
                            </select>
                          </div>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                              (op.status || "Completed") === "Completed"
                                ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/20"
                                : (op.status || "Completed") === "In Progress"
                                ? "bg-blue-500/15 text-blue-400 border-blue-500/20"
                                : "bg-amber-500/15 text-amber-500 border-amber-500/20"
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              (op.status || "Completed") === "Completed"
                                ? "bg-emerald-500"
                                : (op.status || "Completed") === "In Progress"
                                ? "bg-blue-400"
                                : "bg-amber-500"
                            }`}></span>
                            <span>
                              {(op.status || "Completed") === "Completed"
                                ? (language === "ar" ? "مكتملة" : "Completed")
                                : (op.status || "Completed") === "In Progress"
                                ? (language === "ar" ? "قيد التنفيذ" : "In Progress")
                                : (language === "ar" ? "معلقة" : "Pending")}
                            </span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-2 text-center text-txtmuted font-mono">{op.date}</td>
                      {onDeleteOperation && (
                        <td className="py-3.5 px-2 text-center">
                          <button
                            onClick={() => {
                              if (window.confirm(language === "ar" ? "هل أنت متأكد من رغبتك في حذف هذه العملية بشكل نهائي؟ سيؤدي ذلك أيضاً إلى إلغاء وتدمير الفاتورة الضريبية التلقائية التابعة لها." : "Are you sure you want to permanently delete this operation? This will also cancel and remove the automated tax invoice linked to it.")) {
                                onDeleteOperation(op.id);
                              }
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500 hover:text-white transition-all text-[10.5px] font-black cursor-pointer"
                            title={language === "ar" ? "حذف وإلغاء الفواتير" : "Cancel operations & invoices"}
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>{language === "ar" ? "حذف" : "Delete"}</span>
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

        </div>
      </div>

    </div>
  );
}
