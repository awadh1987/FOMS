import React, { useState, useMemo } from "react";
import { Client, Operation, Invoice } from "../types";
import { 
  PlusCircle, Search, Users, Phone, Building, UserPlus,
  BarChart3, Award, Clock, DollarSign, ArrowUpRight, 
  CheckCircle2, AlertCircle, ChevronRight, FileSpreadsheet, TrendingUp, Sparkles, Building2,
  SlidersHorizontal, X, Calendar, Filter
} from "lucide-react";
import { useLanguage } from "../lib/LanguageContext";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area
} from "recharts";

interface ClientsProps {
  clients: Client[];
  operations: Operation[];
  invoices: Invoice[];
  companyCurrency: string;
  onCreateClient: (data: { name: string; company: string; phone: string }) => Promise<void>;
  onBulkImportClients?: (clients: Array<{ name: string; company: string; phone: string }>) => Promise<void>;
}

export default function Clients({ 
  clients, 
  operations = [], 
  invoices = [], 
  companyCurrency = "ر.س", 
  onCreateClient,
  onBulkImportClients
}: ClientsProps) {
  const { language, t } = useLanguage();
  const [activeSubTab, setActiveSubTab] = useState<"manage" | "analytics">("manage");
  
  // Create client form state
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // CSV Import States
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [importError, setImportError] = useState("");
  const [importSuccess, setImportSuccess] = useState("");
  const [parsedClients, setParsedClients] = useState<Array<{ name: string; company: string; phone: string }>>([]);

  // Standard RFC 4180 CSV Parser
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
    const headers = language === "ar" ? "الاسم,الشركة,الهاتف" : "Name,Company,Phone";
    const sampleRow = language === "ar" ? "محمد العتيبي,مؤسسة الرموز التقنية,+966509998877" : "Mohammed Otaibi,Tech Symbols Corp,+966509998877";
    const csvContent = "\uFEFF" + headers + "\n" + sampleRow;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", language === "ar" ? "نموذج_استيراد_العملاء.csv" : "clients_import_template.csv");
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
    setParsedClients([]);

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
        
        let nameIdx = headers.findIndex(h => h.includes("name") || h.includes("الاسم") || h.includes("اسم"));
        let companyIdx = headers.findIndex(h => h.includes("company") || h.includes("الشركة") || h.includes("منشأة") || h.includes("منشأه") || h.includes("شركة"));
        let phoneIdx = headers.findIndex(h => h.includes("phone") || h.includes("الهاتف") || h.includes("رقم") || h.includes("جوال") || h.includes("تواصل"));

        if (nameIdx === -1) {
          nameIdx = 0;
        }

        const clientsToImport: Array<{ name: string; company: string; phone: string }> = [];

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (row.length === 1 && row[0] === "") continue;
          
          const rawName = row[nameIdx] ? row[nameIdx].trim() : "";
          if (!rawName) continue;

          const rawCompany = companyIdx !== -1 && row[companyIdx] ? row[companyIdx].trim() : "";
          const rawPhone = phoneIdx !== -1 && row[phoneIdx] ? row[phoneIdx].trim() : "";

          clientsToImport.push({
            name: rawName,
            company: rawCompany,
            phone: rawPhone
          });
        }

        if (clientsToImport.length === 0) {
          setImportError(language === "ar" ? "تعذر العثور على عملاء صالحين في ملف CSV. تأكد من صحة ترويسة الأعمدة." : "No valid clients found in CSV.");
        } else {
          setParsedClients(clientsToImport);
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
    if (parsedClients.length === 0) return;
    setImporting(true);
    setImportError("");
    setImportSuccess("");

    try {
      if (onBulkImportClients) {
        await onBulkImportClients(parsedClients);
        setImportSuccess(language === "ar" ? `تم استيراد ${parsedClients.length} عميل بنجاح!` : `Successfully imported ${parsedClients.length} clients!`);
        setParsedClients([]);
        setTimeout(() => {
          setShowImportPanel(false);
          setImportSuccess("");
        }, 2000);
      } else {
        throw new Error("Bulk import is not configured.");
      }
    } catch (err: any) {
      setImportError(err.message || (language === "ar" ? "فشل استيراد العملاء" : "Failed to import clients"));
    } finally {
      setImporting(false);
    }
  };

  // Advanced filtration states for Clients list
  const [filterMinClientLtv, setFilterMinClientLtv] = useState<number | "">("");
  const [filterMinClientProfit, setFilterMinClientProfit] = useState<number | "">("");
  const [filterClientStartDate, setFilterClientStartDate] = useState("");
  const [filterClientEndDate, setFilterClientEndDate] = useState("");
  const [showClientFilters, setShowClientFilters] = useState(false);

  // Select client timeline state
  const [selectedTimelineClientId, setSelectedTimelineClientId] = useState<string>("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError(language === "ar" ? "الرجاء إدخال اسم العميل" : "Please input client name");
      return;
    }

    setLoading(true);
    try {
      await onCreateClient({ name, company, phone });
      setName("");
      setCompany("");
      setPhone("");
    } catch (err: any) {
      setError(err?.message || (language === "ar" ? "حدث خطأ أثناء حفظ العميل" : "An error occurred while saving the client."));
    } finally {
      setLoading(false);
    }
  };

  // Filter clients using advanced parameters (name/company/phone, cumulative spent, deal date bounds)
  const filteredClients = useMemo(() => {
    return clients.filter(c => {
      // 1. Text Search matching name, company, or phone
      const textMatch = 
        c.name.toLowerCase().includes(search.toLowerCase()) || 
        c.company.toLowerCase().includes(search.toLowerCase()) ||
        c.phone.includes(search);

      if (!textMatch) return false;

      // Filter based on transactions/operations
      const clientOps = operations.filter(o => o.client_id === c.id);

      // 2. Date Range Filter: does the client have operations in this date range?
      if (filterClientStartDate || filterClientEndDate) {
        const hasMatchingDeals = clientOps.some(o => {
          if (filterClientStartDate && o.date < filterClientStartDate) return false;
          if (filterClientEndDate && o.date > filterClientEndDate) return false;
          return true;
        });
        if (!hasMatchingDeals) return false;
      }

      // 3. Min Revenue value (LTV sum)
      if (filterMinClientLtv !== "") {
        const totalRev = clientOps.reduce((sum, o) => sum + (Number(o.revenue) || 0), 0);
        if (totalRev < Number(filterMinClientLtv)) return false;
      }

      // 4. Min Pure profit
      if (filterMinClientProfit !== "") {
        const totalProfit = clientOps.reduce((sum, o) => sum + ((Number(o.revenue) || 0) - (Number(o.cost) || 0)), 0);
        if (totalProfit < Number(filterMinClientProfit)) return false;
      }

      return true;
    });
  }, [clients, operations, search, filterClientStartDate, filterClientEndDate, filterMinClientLtv, filterMinClientProfit]);

  // Compile detailed financial intelligence for each customer
  const clientStats = useMemo(() => {
    const computed = clients.map(client => {
      const clientOps = operations.filter(o => o.client_id === client.id);
      const clientInvoices = invoices.filter(i => i.client_id === client.id);

      const totalRevenue = clientOps.reduce((sum, o) => sum + (Number(o.revenue) || 0), 0);
      const totalCost = clientOps.reduce((sum, o) => sum + (Number(o.cost) || 0), 0);
      const pureProfit = clientOps.reduce((sum, o) => sum + ((Number(o.revenue) || 0) - (Number(o.cost) || 0)), 0);

      const totalInvoiced = clientInvoices.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
      const paidInvoiced = clientInvoices.filter(i => i.status === "Paid").reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
      const unpaidInvoiced = clientInvoices.filter(i => i.status === "Unpaid").reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

      const reliabilityIndex = totalInvoiced > 0 ? Math.round((paidInvoiced / totalInvoiced) * 100) : 100;
      const profitMargin = totalRevenue > 0 ? Math.round((pureProfit / totalRevenue) * 100) : 0;

      return {
        client,
        opsCount: clientOps.length,
        invoicesCount: clientInvoices.length,
        totalRevenue,
        totalCost,
        pureProfit,
        totalInvoiced,
        paidInvoiced,
        unpaidInvoiced,
        reliabilityIndex,
        profitMargin
      };
    });

    // Sort by profit generated chronologically
    return computed;
  }, [clients, operations, invoices]);

  // Top clients by pure generated profit
  const topProfitableClients = useMemo(() => {
    return [...clientStats].sort((a, b) => b.pureProfit - a.pureProfit);
  }, [clientStats]);

  // Set the default client for the timeline drilldown once stats load
  React.useEffect(() => {
    if (topProfitableClients.length > 0 && !selectedTimelineClientId) {
      setSelectedTimelineClientId(topProfitableClients[0].client.id);
    }
  }, [topProfitableClients, selectedTimelineClientId]);

  // Compile selected client's transaction history timeline
  const selectedClientTimeline = useMemo(() => {
    if (!selectedTimelineClientId) return [];
    
    const clientOps = operations.filter(o => o.client_id === selectedTimelineClientId);
    const clientInvoices = invoices.filter(i => i.client_id === selectedTimelineClientId);

    const timelineItems: Array<{
      type: "operation" | "invoice";
      id: string;
      date: string;
      title: string;
      detail: string;
      amount: number;
      extra?: string;
      status?: string;
    }> = [];

    clientOps.forEach(o => {
      timelineItems.push({
        type: "operation",
        id: o.id,
        date: o.date,
        title: language === "ar" ? `عملية تشغيلية: ${o.service}` : `Operation: ${o.service}`,
        detail: language === "ar" 
          ? `قيمة العقد: ${(o.revenue).toLocaleString()} ${companyCurrency} | التكلفة الأساسية: ${(o.cost).toLocaleString()} ${companyCurrency}`
          : `Revenue: ${(o.revenue).toLocaleString()} ${companyCurrency} | Core Cost: ${(o.cost).toLocaleString()} ${companyCurrency}`,
        amount: o.revenue,
        extra: language === "ar" 
          ? `هامش صافي ربح التعاقد: ${(o.revenue - o.cost).toLocaleString()} ${companyCurrency}` 
          : `Contract Profit Margin: ${(o.revenue - o.cost).toLocaleString()} ${companyCurrency}`
      });
    });

    clientInvoices.forEach(i => {
      timelineItems.push({
        type: "invoice",
        id: i.id,
        date: i.due_date || i.payment_date || "",
        title: language === "ar" ? `إصدار فاتورة رقم ${i.id.substring(0, 6).toUpperCase()}` : `Invoice Bill #${i.id.substring(0, 6).toUpperCase()}`,
        detail: language === "ar" 
          ? `حالة السداد: ${i.status === "Paid" ? "مكتمل السداد" : "ذمم دائنة معلقة"}` 
          : `Settlement: ${i.status === "Paid" ? "Fully Settled" : "Accrued Receivables"}`,
        amount: i.amount,
        status: i.status
      });
    });

    // Sort chronologically descending
    return timelineItems.sort((a, b) => b.date.localeCompare(a.date));
  }, [selectedTimelineClientId, operations, invoices, language, companyCurrency]);

  const selectedTimelineClientData = useMemo(() => {
    return clientStats.find(s => s.client.id === selectedTimelineClientId);
  }, [clientStats, selectedTimelineClientId]);

  // Compile LTV Cumulative spent over time for area chart
  const selectedClientCumulativeSpent = useMemo(() => {
    if (!selectedTimelineClientId) return [];
    
    // Get operations linked to this client, sort chronologically ascending
    const clientOps = [...operations]
      .filter(o => o.client_id === selectedTimelineClientId)
      .sort((a, b) => a.date.localeCompare(b.date));

    let runningTotal = 0;
    return clientOps.map(o => {
      runningTotal += Number(o.revenue) || 0;
      return {
        date: o.date,
        [language === "ar" ? "قيمة الصفقة" : "Contract Value"]: Number(o.revenue) || 0,
        [language === "ar" ? "القيمة المتراكمة (LTV)" : "Cumulative LTV"]: runningTotal
      };
    });
  }, [selectedTimelineClientId, operations, language]);

  // Overall average customer collection security index
  const averageReliabilityIndex = useMemo(() => {
    if (clientStats.length === 0) return 100;
    const total = clientStats.reduce((sum, s) => sum + s.reliabilityIndex, 0);
    return Math.round(total / clientStats.length);
  }, [clientStats]);

  // Bar chart top spending vs profit data
  const topClientsChartData = useMemo(() => {
    return topProfitableClients.slice(0, 7).map(s => ({
      name: s.client.name.length > 12 ? `${s.client.name.substring(0, 10)}...` : s.client.name,
      [language === "ar" ? "إجمالي الإنفاق (العميل)" : "Client Total Spent"]: s.totalRevenue,
      [language === "ar" ? "صافي أرباح المنشأة" : "Net Profit Earned"]: s.pureProfit
    }));
  }, [topProfitableClients, language]);

  return (
    <div className="space-y-6 text-start">
      
      {/* Sub-tabs header */}
      <div className="flex border-b border-borderline gap-2 select-none overflow-x-auto">
        <button
          onClick={() => setActiveSubTab("manage")}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 font-bold text-xs transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === "manage"
              ? "border-indigo-600 text-indigo-600 dark:border-indigo-500 dark:text-indigo-400"
              : "border-transparent text-txtmuted hover:text-txtmain"
          }`}
          id="clients_subtab_manage"
        >
          <Users className="w-4 h-4" />
          <span>{language === "ar" ? "قائمة وإدارة العملاء" : "Clients Directory"}</span>
        </button>
        <button
          onClick={() => setActiveSubTab("analytics")}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 font-bold text-xs transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === "analytics"
              ? "border-indigo-600 text-indigo-600 dark:border-indigo-500 dark:text-indigo-400"
              : "border-transparent text-txtmuted hover:text-txtmain"
          }`}
          id="clients_subtab_analytics"
        >
          <BarChart3 className="w-4 h-4" />
          <span>{language === "ar" ? "تحليلات الإنفاق والربحية" : "Client Spending & Profitability"}</span>
          <span className="text-[9px] bg-indigo-500/10 text-indigo-500 px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider">
            {language === "ar" ? "جديد" : "New"}
          </span>
        </button>
      </div>

      {activeSubTab === "manage" ? (
        /* Original Clients Directory Layout Grid */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="clients_manage_grid">
          
          {/* Create Client Form */}
          <div className="lg:col-span-4" id="clients_add_form_panel">
            <div className="bg-cardbk p-6 rounded-2xl shadow-sm border border-borderline">
              <div className="flex items-center gap-2 border-b border-borderline pb-4 mb-4">
                <UserPlus className="w-5 h-5 text-indigo-500" />
                <h3 className="text-lg font-bold text-txtmain">{t("clients_add_title")}</h3>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="p-3 bg-rose-500/10 text-rose-500 text-xs rounded-xl border border-rose-500/20">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-txtmain text-xs font-semibold mb-1.5">{t("clients_name_lbl")}</label>
                  <input
                    type="text"
                    placeholder={t("clients_name_placeholder")}
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full bg-appbk border border-borderline text-txtmain placeholder-txtmuted/50 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-txtmain text-xs font-semibold mb-1.5">{t("clients_company_lbl")}</label>
                  <div className="relative">
                    <span className={`absolute inset-y-0 ${language === "ar" ? "right-0 pr-3" : "left-0 pl-3"} flex items-center pb-0.5 text-txtmuted`}>
                      <Building className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      placeholder={t("clients_company_placeholder")}
                      value={company}
                      onChange={e => setCompany(e.target.value)}
                      className={`w-full bg-appbk border border-borderline text-txtmain placeholder-txtmuted/50 rounded-xl py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors ${language === "ar" ? "pr-9 pl-3.5" : "pl-9 pr-3.5"}`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-txtmain text-xs font-semibold mb-1.5">{t("clients_phone_lbl")}</label>
                  <div className="relative">
                    <span className={`absolute inset-y-0 ${language === "ar" ? "right-0 pr-3" : "left-0 pl-3"} flex items-center pb-0.5 text-txtmuted`}>
                      <Phone className="w-4 h-4" />
                    </span>
                    <input
                      type="tel"
                      placeholder={t("clients_phone_placeholder")}
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      className={`w-full bg-appbk border border-borderline text-txtmain placeholder-txtmuted/50 rounded-xl py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors ${language === "ar" ? "pr-9 pl-3.5" : "pl-9 pr-3.5"}`}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white font-bold py-3 px-4 rounded-xl text-xs transition-all duration-150 disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (language === "ar" ? "جاري الإضافة..." : "Adding...") : t("clients_save_btn")}
                </button>
              </form>
            </div>
          </div>

          {/* Clients List/Table */}
          <div className="lg:col-span-8" id="clients_table_panel">
            <div className="bg-cardbk p-6 rounded-2xl shadow-sm border border-borderline">
              
              {/* Header search with Advanced Filters */}
              <div className="space-y-4 mb-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-txtmain">{t("clients_list_title")}</h3>
                    <p className="text-xs text-txtmuted mt-0.5">{t("clients_list_subtitle")}</p>
                  </div>
                  
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-grow sm:w-64">
                      <span className={`absolute inset-y-0 ${language === "ar" ? "right-0 pr-3" : "left-0 pl-3"} flex items-center pointer-events-none text-txtmuted`}>
                        <Search className="w-4 h-4" />
                      </span>
                      <input
                        type="text"
                        placeholder={language === "ar" ? "البحث بالاسم، المنشأة، الهاتف..." : "Search client, company..."}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className={`w-full bg-appbk text-txtmain border border-borderline rounded-xl py-2 text-xs focus:outline-none focus:border-indigo-500 transition-colors ${language === "ar" ? "pr-9 pl-3" : "pl-9 pr-3"}`}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setShowImportPanel(!showImportPanel);
                        setShowClientFilters(false);
                      }}
                      className={`p-2 rounded-xl border border-borderline flex items-center gap-1.5 text-xs font-bold transition-all ${
                        showImportPanel || parsedClients.length > 0
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                          : "bg-appbk text-txtmuted hover:text-txtmain"
                      } cursor-pointer`}
                      title={language === "ar" ? "استيراد عملاء من ملف CSV" : "Import clients from CSV file"}
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      <span className="hidden md:inline">
                        {language === "ar" ? "استيراد CSV" : "Import CSV"}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowClientFilters(!showClientFilters);
                        setShowImportPanel(false);
                      }}
                      className={`p-2 rounded-xl border border-borderline flex items-center gap-1.5 text-xs font-bold transition-all ${showClientFilters || filterMinClientLtv !== "" || filterMinClientProfit !== "" || filterClientStartDate || filterClientEndDate ? 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' : 'bg-appbk text-txtmuted hover:text-txtmain'} cursor-pointer`}
                      title={language === "ar" ? "خيارات التصفية المتقدمة للعملاء" : "Advanced Client Filters"}
                    >
                      <SlidersHorizontal className="w-4 h-4" />
                      <span className="hidden md:inline">{language === "ar" ? "تصفية مخصصة" : "Advanced"}</span>
                    </button>

                    {(search || filterMinClientLtv !== "" || filterMinClientProfit !== "" || filterClientStartDate || filterClientEndDate) && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearch("");
                          setFilterMinClientLtv("");
                          setFilterMinClientProfit("");
                          setFilterClientStartDate("");
                          setFilterClientEndDate("");
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
                        <h4 className="text-sm font-bold text-txtmain flex items-center gap-1.5">
                          <FileSpreadsheet className="w-4.5 h-4.5 text-indigo-500" />
                          {language === "ar" ? "أداة استيراد العملاء القياسية (CSV)" : "Smart Clients CSV Import Utility"}
                        </h4>
                        <p className="text-[11px] text-txtmuted mt-0.5">
                          {language === "ar"
                            ? "استورد مئات العملاء دفعة واحدة بدلاً من تعبئتهم يدوياً. النظام سيتعرف تلقائياً على العناوين ويربطها تلقائياً."
                            : "Import hundreds of customer accounts instantly. The system will auto-map details based on headers."}
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
                      <div className="p-3 bg-emerald-500/10 text-emerald-500 text-xs rounded-xl border border-emerald-500/20 text-start font-semibold">
                        ✅ {importSuccess}
                      </div>
                    )}

                    {parsedClients.length === 0 ? (
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
                            ? "اسحب ملف الـ CSV وأفلته هنا، أو"
                            : "Drag and drop your CSV file here, or"}
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
                          <span className="text-txtmuted">
                            {language === "ar"
                              ? `تم تحليل ${parsedClients.length} سجل جاهز للاستيراد:`
                              : `${parsedClients.length} client records parsed & ready to load:`}
                          </span>
                          <button
                            onClick={() => setParsedClients([])}
                            className="text-rose-500 hover:text-rose-700 font-bold transition-colors cursor-pointer"
                          >
                            {language === "ar" ? "إلغاء وإعادة المحاولة" : "Clear & Retry"}
                          </button>
                        </div>

                        {/* Scrollable grid preview */}
                        <div className="max-h-40 overflow-y-auto border border-borderline rounded-xl divide-y divide-borderline bg-cardbk">
                          {parsedClients.map((c, i) => (
                            <div key={i} className="p-2.5 flex justify-between items-center text-xs text-start hover:bg-appbk/40">
                              <span className="font-bold text-txtmain">{c.name}</span>
                              <div className="text-right flex items-center gap-2">
                                {c.company && (
                                  <span className="bg-appbk hover:bg-appbk/80 px-2 py-0.5 rounded text-[10px] font-medium border border-borderline">
                                    {c.company}
                                  </span>
                                )}
                                {c.phone && <span className="font-mono text-txtmuted text-[10px]">{c.phone}</span>}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => setParsedClients([])}
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
                              <span>{language === "ar" ? "تأكيد واستيراد البيانات" : "Confirm Import"}</span>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Collapsible Client Filters Panel */}
                {showClientFilters && (
                  <div className="p-4 bg-appbk/60 rounded-xl border border-borderline/80 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200 text-start">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Filter by deal Date range */}
                      <div>
                        <label className="block text-[10px] text-txtmuted font-semibold mb-1">{language === "ar" ? "تاريخ الصفقة أو العملية (من)" : "Operations Deal Date (from)"}</label>
                        <input
                          type="date"
                          value={filterClientStartDate}
                          onChange={e => setFilterClientStartDate(e.target.value)}
                          className="w-full bg-cardbk text-txtmain border border-borderline rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-txtmuted font-semibold mb-1">{language === "ar" ? "تاريخ الصفقة أو العملية (إلى)" : "Operations Deal Date (to)"}</label>
                        <input
                          type="date"
                          value={filterClientEndDate}
                          onChange={e => setFilterClientEndDate(e.target.value)}
                          className="w-full bg-cardbk text-txtmain border border-borderline rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Filter by Min cumulative spent */}
                      <div>
                        <label className="block text-[10px] text-txtmuted font-semibold mb-1">{language === "ar" ? "إجمالي الإنفاق الأدنى (LTV)" : "Min Cumulative Spending (LTV)"}</label>
                        <div className="relative flex items-center">
                          <input
                            type="number"
                            placeholder="0"
                            value={filterMinClientLtv}
                            onChange={e => setFilterMinClientLtv(e.target.value === "" ? "" : Number(e.target.value))}
                            className={`w-full bg-cardbk text-txtmain border border-borderline rounded-xl py-1.5 text-xs focus:outline-none focus:border-indigo-500 transition-colors ${language === "ar" ? "pl-14 pr-2.5" : "pr-14 pl-2.5"}`}
                          />
                          <span className={`absolute ${language === "ar" ? "left-2.5" : "right-2.5"} text-[9px] text-txtmuted font-mono`}>{companyCurrency}</span>
                        </div>
                      </div>

                      {/* Filter by Min generated pure profit */}
                      <div>
                        <label className="block text-[10px] text-txtmuted font-semibold mb-1">{language === "ar" ? "صافي أرباح المنشأة المدفوعة الأدنى" : "Min Contribution Net Profit"}</label>
                        <div className="relative flex items-center">
                          <input
                            type="number"
                            placeholder="0"
                            value={filterMinClientProfit}
                            onChange={e => setFilterMinClientProfit(e.target.value === "" ? "" : Number(e.target.value))}
                            className={`w-full bg-cardbk text-txtmain border border-borderline rounded-xl py-1.5 text-xs focus:outline-none focus:border-indigo-500 transition-colors ${language === "ar" ? "pl-14 pr-2.5" : "pr-14 pl-2.5"}`}
                          />
                          <span className={`absolute ${language === "ar" ? "left-2.5" : "right-2.5"} text-[9px] text-txtmuted font-mono`}>{companyCurrency}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="overflow-x-auto">
                {filteredClients.length === 0 ? (
                  <div className="text-center py-12 text-txtmuted">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-25" />
                    <p className="text-sm">{language === "ar" ? "لا يوجد عملاء مضافون يتطابقون مع عملية البحث." : "No client profiles match search query."}</p>
                  </div>
                ) : (
                  <table className="w-full text-start border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-borderline text-txtmuted pb-3 font-semibold">
                        <th className="font-bold py-3 px-2 text-start">{language === "ar" ? "الاسم بالكامل" : "Full Name"}</th>
                        <th className="font-bold py-3 px-2 text-start">{language === "ar" ? "المنشأة / الشركة" : "Enterprise / Business"}</th>
                        <th className="font-bold py-3 px-2 text-start">{language === "ar" ? "رقم التواصل" : "Contact Phone"}</th>
                        <th className="font-bold py-3 px-2 text-center">{language === "ar" ? "الرمز المعرّف (ID)" : "Unique Identifier (ID)"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-borderline">
                      {filteredClients.map(c => (
                        <tr key={c.id} className="hover:bg-appbk/50 transition-colors">
                          <td className="py-3.5 px-2 font-bold text-txtmain flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-[10px]">
                              {c.name.substring(0, 1).toUpperCase()}
                            </div>
                            {c.name}
                          </td>
                          <td className="py-3.5 px-2 text-txtmuted">
                            {c.company ? (
                              <span className="bg-appbk text-txtmain px-2.5 py-1 rounded-md font-medium border border-borderline">
                                {c.company}
                              </span>
                            ) : (
                              <span className="text-txtmuted italic">{language === "ar" ? "غير محدد" : "Unspecified"}</span>
                            )}
                          </td>
                          <td className="py-3.5 px-2 text-txtmuted font-mono">{c.phone || "—"}</td>
                          <td className="py-3.5 px-2 text-center">
                            <span className="font-mono text-txtmuted bg-appbk px-2 py-0.5 rounded text-[10px] border border-borderline">
                              {c.id.substring(0, 8)}...
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

            </div>
          </div>

        </div>
      ) : (
        /* Advanced Financial Analytics & Lifetime Value Tab Layout */
        <div className="space-y-6 animate-in fade-in duration-300" id="clients_analytics_workspace">
          
          {/* Key Metric Snapshot Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6" id="client_analytics_kpi_cards">
            
            {/* Top Revenue Client */}
            <div className="bg-cardbk p-5 rounded-2xl border border-borderline shadow-xs flex items-center gap-4 text-start">
              <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-500 border border-indigo-500/20 shrink-0">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-txtmuted font-bold uppercase tracking-wider">
                  {language === "ar" ? "العميل الأعلى تعاقداً وإنفاقاً" : "Highest Spending Client"}
                </p>
                <h4 className="text-sm font-black text-txtmain truncate mt-1">
                  {topProfitableClients[0]?.client.name || "—"}
                </h4>
                <p className="text-xs font-mono font-bold text-indigo-500 mt-0.5">
                  {(topProfitableClients[0]?.totalRevenue || 0).toLocaleString()} {companyCurrency}
                </p>
              </div>
            </div>

            {/* Top Profit Contribution */}
            <div className="bg-cardbk p-5 rounded-2xl border border-borderline shadow-xs flex items-center gap-4 text-start">
              <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500 border border-emerald-500/20 shrink-0">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-txtmuted font-bold uppercase tracking-wider">
                  {language === "ar" ? "العميل الأكثر ربحية خالصة" : "Most Profitable Client"}
                </p>
                <h4 className="text-sm font-black text-emerald-600 dark:text-emerald-400 truncate mt-1">
                  {topProfitableClients[0]?.client.name || "—"}
                </h4>
                <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                  <span className="text-xs font-mono font-black text-txtmain">
                    {(topProfitableClients[0]?.pureProfit || 0).toLocaleString()} {companyCurrency}
                  </span>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-600 py-0.5 px-1.5 rounded-sm shrink-0">
                    {topProfitableClients[0]?.profitMargin || 0}%
                  </span>
                </div>
              </div>
            </div>

            {/* Average Reliability Index */}
            <div className="bg-cardbk p-5 rounded-2xl border border-borderline shadow-xs flex items-center gap-4 text-start">
              <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500 border border-amber-500/20 shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] text-txtmuted font-bold uppercase tracking-wider">
                  {language === "ar" ? "مؤشر موثوقية دفع الفواتير" : "Receivables Safety Index"}
                </p>
                <h4 className="text-lg font-mono font-black text-txtmain mt-0.5">
                  {averageReliabilityIndex}%
                </h4>
                <p className="text-[10px] text-txtmuted">
                  {language === "ar" ? "متوسط التزام العملاء بسداد الفواتير المستحقة" : "Company-wide invoice settlement reliability"}
                </p>
              </div>
            </div>

          </div>

          {/* Top customer charts & ranking grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="client_charts_container">
            
            {/* Visual Recharts Bar Representation */}
            <div className="lg:col-span-7 bg-cardbk p-6 rounded-2xl border border-borderline text-start space-y-4" id="client_bar_graph">
              <div>
                <h3 className="font-bold text-sm text-txtmain">
                  {language === "ar" ? "مقارنة الحجم المالي والأرباح لكل عميل" : "Client Financial Magnitude & Net Profits"}
                </h3>
                <p className="text-[10px] text-txtmuted mt-0.5">
                  {language === "ar" ? "توضيح العلاقة بين إجمالي النفقات الملزمة وصافي أرباح التشغيل الناتجة" : "Direct visual comparing client's gross billing value versus the actual net enterprise margin achieved"}
                </p>
              </div>

              {topClientsChartData.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center border border-dashed border-borderline rounded-xl text-txtmuted">
                  <FileSpreadsheet className="w-8 h-8 opacity-30 mb-2" />
                  <p className="text-xs">{language === "ar" ? "بانتظار تسجيل عمليات لتمثيل المخطط البياني" : "Log operations to populate comparative graph."}</p>
                </div>
              ) : (
                <div className="h-72 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={topClientsChartData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100 dark:stroke-slate-800" />
                      <XAxis dataKey="name" stroke="#888888" fontSize={10} tickLine={false} />
                      <YAxis stroke="#888888" fontSize={10} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'var(--color-bg-cardbk)', 
                          borderColor: 'var(--color-border-borderline)',
                          borderRadius: '12px',
                          color: 'var(--color-text-txtmain)',
                          fontSize: '11px',
                          textAlign: 'start'
                        }} 
                      />
                      <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                      <Bar 
                        name={language === "ar" ? "إجمالي الإنفاق" : "Gross Contracted Spent"} 
                        dataKey={language === "ar" ? "إجمالي الإنفاق (العميل)" : "Client Total Spent"} 
                        fill="#4f46e5" 
                        radius={[4, 4, 0, 0]} 
                      />
                      <Bar 
                        name={language === "ar" ? "صافي أرباح المنشأة" : "Net Profit Contribution"} 
                        dataKey={language === "ar" ? "صافي أرباح المنشأة" : "Net Profit Earned"} 
                        fill="#10b981" 
                        radius={[4, 4, 0, 0]} 
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Profitability Medal Leaderboard list */}
            <div className="lg:col-span-5 bg-cardbk p-6 rounded-2xl border border-borderline text-start space-y-4 flex flex-col justify-between" id="client_leaderboard_ledger">
              <div className="space-y-1">
                <h3 className="font-bold text-sm text-txtmain">
                  {language === "ar" ? "تصنيف كفاءة وعوائد العملاء" : "Account Profit Efficiency Ranking"}
                </h3>
                <p className="text-[10px] text-txtmuted">
                  {language === "ar" ? "ترتيب العملاء تنازلياً حسب إسهام الأرباح الصافية الحقيقية" : "Accounts structured sequentially based on cumulative net profit yield contribution"}
                </p>
              </div>

              <div className="divide-y divide-borderline/50 overflow-y-auto max-h-72 mt-2 w-full pr-1">
                {topProfitableClients.length === 0 ? (
                  <div className="py-12 text-center text-txtmuted text-xs">
                    {language === "ar" ? "لا تتوفر جهات اتصال" : "No client records registered."}
                  </div>
                ) : (
                  topProfitableClients.map((item, idx) => {
                    const isSelected = selectedTimelineClientId === item.client.id;
                    const medals = ["🥇", "🥈", "🥉"];
                    return (
                      <div 
                        key={item.client.id}
                        onClick={() => setSelectedTimelineClientId(item.client.id)}
                        className={`flex items-center justify-between py-3 px-2 rounded-xl transition-all cursor-pointer group hover:bg-slate-500/5 ${isSelected ? "bg-indigo-600/5 border border-indigo-500/10" : "border border-transparent"}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-sm shrink-0 font-bold select-none text-center w-5">
                            {idx < 3 ? medals[idx] : idx + 1}
                          </span>
                          <div className="min-w-0">
                            <h4 className="font-bold text-xs text-txtmain group-hover:text-indigo-500 transition-colors truncate">
                              {item.client.name}
                            </h4>
                            <p className="text-[9px] text-txtmuted truncate">
                              {item.client.company || "—"}
                            </p>
                          </div>
                        </div>

                        <div className="text-end shrink-0">
                          <span className="block font-mono font-extrabold text-xs text-txtmain">
                            {item.pureProfit.toLocaleString()} {companyCurrency}
                          </span>
                          <span className="text-[9px] font-mono text-txtmuted">
                            {language === "ar" ? "هامش" : "Margin"}: {item.profitMargin}%
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="bg-indigo-50/50 dark:bg-slate-800/30 border border-indigo-100/30 rounded-xl p-2.5 text-[9px] text-txtmuted leading-relaxed mt-2">
                💡 {language === "ar" 
                  ? "انقر على أي عميل في القائمة لتنشيط تفاصيل تاريخ تعاملاته السابقة ومخطط القيمة المتكاملة له بالأسفل." 
                  : "Click on any client profile registered above to populate their transaction audit path and cumulative value track below."
                }
              </div>
            </div>

          </div>

          {/* Interactive Drilldown section: selected client historical timeline & LTV trend */}
          {selectedTimelineClientId && selectedTimelineClientData && (
            <div className="bg-cardbk rounded-2xl border border-borderline p-6 space-y-6 animate-in fade-in duration-300 text-start" id="client_drilldown_workspace">
              
              {/* Header block details */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-borderline pb-4 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 flex items-center justify-center font-black">
                    {selectedTimelineClientData.client.name.substring(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-txtmain flex items-center gap-1.5 flex-wrap">
                      <span>{selectedTimelineClientData.client.name}</span>
                      {selectedTimelineClientData.client.company && (
                        <span className="text-[10px] bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
                          <Building2 className="w-3 h-3" />
                          {selectedTimelineClientData.client.company}
                        </span>
                      )}
                    </h3>
                    <p className="text-[10px] text-txtmuted mt-0.5">
                      {language === "ar" ? "رقم الهاتف والاتصال:" : "Associated phone line:"} <span className="font-mono">{selectedTimelineClientData.client.phone || "—"}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <div className="px-3.5 py-1.5 bg-appbk border border-borderline rounded-xl text-center">
                    <span className="block text-[9px] text-txtmuted uppercase font-bold">{language === "ar" ? "الصفقات المنجزة" : "Contracts"}</span>
                    <span className="font-mono font-black text-xs text-txtmain">{selectedTimelineClientData.opsCount}</span>
                  </div>
                  <div className="px-3.5 py-1.5 bg-appbk border border-borderline rounded-xl text-center">
                    <span className="block text-[9px] text-txtmuted uppercase font-bold">{language === "ar" ? "قيمة المبيعات اللحظية" : "Sub-bills"}</span>
                    <span className="font-mono font-black text-xs text-txtmain">{selectedTimelineClientData.invoicesCount}</span>
                  </div>
                  <div className="px-3.5 py-1.5 bg-appbk border border-borderline rounded-xl text-center">
                    <span className="block text-[9px] text-txtmuted uppercase font-bold">{language === "ar" ? "معدل موثوقية العميل" : "Credit Rating"}</span>
                    <span className={`font-mono font-black text-xs ${selectedTimelineClientData.reliabilityIndex > 75 ? "text-emerald-500" : "text-amber-500"}`}>{selectedTimelineClientData.reliabilityIndex}%</span>
                  </div>
                </div>
              </div>

              {/* Multi Graph Sub-Split */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Visual cumulative LTV track over time chart (AreaChart) */}
                <div className="lg:col-span-6 space-y-3" id="client_ltv_growth_trend">
                  <div>
                    <h4 className="font-bold text-xs text-txtmain">
                      {language === "ar" ? "مسار نمو القيمة الكلية للعميل (LTV Growth Chart)" : "Lifetime Customer Value Growth Chart"}
                    </h4>
                    <p className="text-[10px] text-txtmuted mt-0.5">
                      {language === "ar" ? "تتبع بياني تراكمي لعوائد العميل المالية منذ بداية التعاقدات والعمليات" : "Graphical cumulative spent progress showing dynamic value maturation over operational milestones"}
                    </p>
                  </div>

                  {selectedClientCumulativeSpent.length === 0 ? (
                    <div className="h-64 border border-dashed border-borderline rounded-xl flex flex-col items-center justify-center text-txtmuted">
                      <Clock className="w-8 h-8 opacity-30 mb-2" />
                      <p className="text-xs">{language === "ar" ? "لا تتوفر تعاقدات مسجلة لهذا العميل لتخطيط مساره المالي" : "No registered contracts logged for this specific customer."}</p>
                    </div>
                  ) : (
                    <div className="h-64 w-full pt-3">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={selectedClientCumulativeSpent}
                          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient id="colorLtv" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100 dark:stroke-slate-800" />
                          <XAxis dataKey="date" stroke="#888888" fontSize={9} tickLine={false} />
                          <YAxis stroke="#888888" fontSize={9} tickLine={false} />
                          <Tooltip
                            contentStyle={{ 
                              backgroundColor: 'var(--color-bg-cardbk)', 
                              borderColor: 'var(--color-border-borderline)',
                              borderRadius: '12px',
                              color: 'var(--color-text-txtmain)',
                              fontSize: '11px',
                              textAlign: 'start'
                            }} 
                          />
                          <Area 
                            type="monotone" 
                            name={language === "ar" ? "القيمة التراكمية المستلمة" : "Cumulative Real LTV"} 
                            dataKey={language === "ar" ? "القيمة المتراكمة (LTV)" : "Cumulative LTV"} 
                            stroke="#4f46e5" 
                            fillOpacity={1} 
                            fill="url(#colorLtv)" 
                            strokeWidth={2}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* Vertical interactive chronological timeline of interactions (Contracts & Invoices) */}
                <div className="lg:col-span-6 space-y-4" id="client_history_chronicle">
                  <div>
                    <h4 className="font-bold text-xs text-txtmain">
                      {language === "ar" ? "سجل المعاملات والتعاملات التفصيلي" : "Chronological Interaction Timeline"}
                    </h4>
                    <p className="text-[10px] text-txtmuted mt-0.5">
                      {language === "ar" ? "دفتر مالي وتاريخي يوثق فواتير العميل المصدرة وعقوده التشغيلية حسب تتابعها الزمني" : "Historical record indexing bills, settled items, and operations arranged chronologically"}
                    </p>
                  </div>

                  <div className="overflow-y-auto max-h-64 space-y-3.5 pr-2 w-full">
                    {selectedClientTimeline.length === 0 ? (
                      <div className="py-12 text-center text-txtmuted text-xs border border-dashed border-borderline rounded-xl">
                        {language === "ar" ? "لا توجد معاملات مسجلة" : "No operations or bills published for this entity yet."}
                      </div>
                    ) : (
                      selectedClientTimeline.map((item, index) => {
                        const isOp = item.type === "operation";
                        return (
                          <div 
                            key={`${item.id}-${index}`} 
                            className="relative flex gap-3.5 text-xs animate-in slide-in-from-bottom-2 duration-200"
                          >
                            {/* Date Column representation */}
                            <div className="w-20 sm:w-24 shrink-0 text-end font-mono text-[10px] text-txtmuted pt-1">
                              {item.date}
                            </div>

                            {/* Bullet Connector Line circle */}
                            <div className="relative flex flex-col items-center select-none shrink-0">
                              <div className={`w-3 h-3 rounded-full border-2 ${
                                isOp 
                                  ? "border-indigo-500 bg-white dark:bg-slate-900" 
                                  : item.status === "Paid" 
                                    ? "border-emerald-500 bg-emerald-500" 
                                    : "border-amber-500 bg-amber-500"
                              }`} />
                              {index !== selectedClientTimeline.length - 1 && (
                                <div className="w-0.5 grow bg-borderline mt-1.5" style={{ minHeight: "26px" }} />
                              )}
                            </div>

                            {/* Detailed content info card */}
                            <div className="grow bg-appbk/90 border border-borderline/80 rounded-xl p-3 space-y-1">
                              <div className="flex justify-between items-start gap-2 flex-wrap">
                                <span className="font-bold text-xs text-txtmain leading-tight">
                                  {item.title}
                                </span>
                                <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                                  isOp 
                                    ? "bg-indigo-500/10 text-indigo-500" 
                                    : item.status === "Paid" 
                                      ? "bg-emerald-500/10 text-emerald-500" 
                                      : "bg-amber-500/10 text-amber-500"
                                }`}>
                                  {isOp 
                                    ? (language === "ar" ? "عقد تشغيلي" : "Contract") 
                                    : (item.status === "Paid" ? (language === "ar" ? "فاتورة مدفوعة" : "Fully Settled") : (language === "ar" ? "فاتورة معلقة" : "Accrued Bill"))
                                  }
                                </span>
                              </div>

                              <p className="text-[10px] text-txtmuted line-clamp-1">
                                {item.detail}
                              </p>

                              <div className="flex items-center justify-between pt-1 border-t border-borderline/30">
                                <span className="text-[9px] text-txtmuted">
                                  {item.extra || ""}
                                </span>
                                <span className="font-mono font-extrabold text-[11px] text-txtmain">
                                  {(item.amount).toLocaleString()} {companyCurrency}
                                </span>
                              </div>
                            </div>

                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

              </div>

            </div>
          )}

        </div>
      )}

    </div>
  );
}
