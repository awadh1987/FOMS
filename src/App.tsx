import React, { useState, useEffect } from "react";
import { 
  Briefcase, 
  Users, 
  FileText, 
  LayoutDashboard, 
  Building2, 
  Plus, 
  HelpCircle,
  Menu,
  X,
  RefreshCw,
  Sparkles,
  Info,
  Sun,
  Moon,
  Settings,
  Coins,
  Cloud,
  Zap
} from "lucide-react";
import Dashboard from "./components/Dashboard";
import Operations from "./components/Operations";
import Clients from "./components/Clients";
import Invoices from "./components/Invoices";
import SettingsComponent from "./components/Settings";
import Expenses from "./components/Expenses";
import GoogleSync from "./components/GoogleSync";
import NotificationCenter from "./components/NotificationCenter";
import Subscription from "./components/Subscription";
import { Company, Client, Operation, Invoice, DashboardStats } from "./types";
import { useLanguage } from "./lib/LanguageContext";
import Login from "./components/Login";
import { User } from "firebase/auth";
import { initAuth, logout } from "./lib/firebaseAuth";
import { LogOut } from "lucide-react";

export default function App() {
  const { language, setLanguage, t, dir } = useLanguage();

  // Firebase Authentication State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [authChecking, setAuthChecking] = useState<boolean>(true);

  // Authenticate session listener
  useEffect(() => {
    const unsubscribe = initAuth(
      async (user, token) => {
        setCurrentUser(user);
        try {
          const fbToken = await user.getIdToken();
          setIdToken(fbToken);
        } catch (e) {
          console.error("Failed to secure active session idToken:", e);
        }
        setAuthChecking(false);
      },
      () => {
        setCurrentUser(null);
        setIdToken(null);
        setAuthChecking(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Navigation Tabs state
  const [activeTab, setActiveTab ] = useState<"dashboard" | "operations" | "clients" | "invoices" | "expenses" | "sync" | "settings" | "subscriptions">("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Dark mode state
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem("erp_dark_mode") === "true";
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("erp_dark_mode", "true");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("erp_dark_mode", "false");
    }
  }, [darkMode]);

  // Multi-Tenancy state
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("comp-1");
  const [showAddCompanyModal, setShowAddCompanyModal] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");

  // Business entities state
  const [clients, setClients] = useState<Client[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Setup request headers for multi-tenant isolation
  const getHeaders = () => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-company-id": selectedCompanyId
    };
    if (idToken) {
      headers["Authorization"] = `Bearer ${idToken}`;
    }
    return headers;
  };

  // Fetch all companies on launch
  const fetchCompanies = async (chooseFirst = false) => {
    try {
      const res = await fetch("/api/companies", { headers: getHeaders() });
      if (!res.ok) throw new Error("تعذر تحميل قائمة الشركات");
      const data = await res.json();
      setCompanies(data);
      if (chooseFirst && data.length > 0) {
        setSelectedCompanyId(data[0].id);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg("حدث خطأ في تحميل قائمة الشركات المتعددة المستأجرين");
    }
  };

  // Fetch statistics and lists for the selected company
  const loadCompanyData = async (isLoadingIndicator = true) => {
    if (isLoadingIndicator) setLoading(true);
    else setRefreshing(true);
    setErrorMsg("");

    try {
      const headers = getHeaders();

      // Fetch Clients
      const clientsRes = await fetch("/api/clients", { headers });
      if (!clientsRes.ok) throw new Error("تعذر إحضار العملاء");
      const clientsData = await clientsRes.json();
      setClients(clientsData);

      // Fetch Operations
      const opsRes = await fetch("/api/operations", { headers });
      if (!opsRes.ok) throw new Error("تعذر إحضار العمليات");
      const opsData = await opsRes.json();
      setOperations(opsData);

      // Fetch Invoices
      const invsRes = await fetch("/api/invoices", { headers });
      if (!invsRes.ok) throw new Error("تعذر إحضار الفواتير");
      const invsData = await invsRes.json();
      setInvoices(invsData);

      // Fetch general stats
      const statsRes = await fetch("/api/stats", { headers });
      if (!statsRes.ok) throw new Error("تعذر إحضار الإحصائيات");
      const statsData = await statsRes.json();
      setStats(statsData);

    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || "خطأ في الاتصال بالواجهة الخلفية للنظام");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Initialize
  useEffect(() => {
    if (currentUser) {
      const init = async () => {
        // Load companies
        await fetchCompanies();
        // Load selected company data
        await loadCompanyData(true);
      };
      init();
    }
  }, [currentUser]);

  // Reload when company changes
  useEffect(() => {
    if (currentUser && selectedCompanyId) {
      loadCompanyData(true);
    }
  }, [selectedCompanyId, currentUser]);

  // Handle adding a new tenant company
  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;

    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCompanyName })
      });
      if (!res.ok) throw new Error("فشل إنشاء الشركة الجديدة");
      const created: Company = await res.json();
      
      await fetchCompanies();
      setSelectedCompanyId(created.id); // Switch context immediately
      setNewCompanyName("");
      setShowAddCompanyModal(false);
      triggerBannerNotification("تم تسجيل الشركة الجديدة بنجاح وتحويل بيئة العمل إليها");
    } catch (err: any) {
      setErrorMsg(err.message || "خطأ أثناء ربط الشركة");
    }
  };

  // Handle adding client
  const handleCreateClient = async (data: { name: string; company: string; phone: string }) => {
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("فشل تسجيل العميل");
      
      await loadCompanyData(false);
      triggerBannerNotification("تمت إضافة العميل بنجاح إلى قاعدة البيانات الخاصة بالشركة");
    } catch (e: any) {
      throw e;
    }
  };

  // Handle bulk importing clients
  const handleBulkImportClients = async (parsedData: Array<{ name: string; company: string; phone: string }>) => {
    try {
      const res = await fetch("/api/clients/bulk", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(parsedData)
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "فشل استيراد العملاء بالدفعة");
      }
      
      await loadCompanyData(false);
      triggerBannerNotification("تم استيراد حسابات العملاء بنجاح، وتحديث قاعدة البيانات");
    } catch (e: any) {
      throw e;
    }
  };

  // Handle bulk importing operations
  const handleBulkImportOperations = async (parsedData: Array<{ service: string; client_name: string; client_company: string; cost: number; revenue: number; status: string; date: string }>) => {
    try {
      const res = await fetch("/api/operations/bulk", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(parsedData)
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "فشل استيراد العمليات بالشكل المطلوب");
      }
      
      await loadCompanyData(false);
      triggerBannerNotification("تم استيراد الصفقات بنجاح وتوليد الفواتير ومزامنة التقارير المالية");
    } catch (e: any) {
      throw e;
    }
  };

  // Handle adding operation + auto invoice
  const handleCreateOperation = async (data: { service: string; client_id: string; cost: number; revenue: number; status?: "Pending" | "In Progress" | "Completed" }) => {
    try {
      const res = await fetch("/api/operations", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("فشل إدراج العملية وحساب الربح");
      
      await loadCompanyData(false);
      triggerBannerNotification("تم حفظ العملية بنجاح وتوليد الفاتورة التلقائية للمتابعة");
    } catch (e: any) {
      throw e;
    }
  };

  // Handle updating operation status
  const handleUpdateOperationStatus = async (id: string, status: "Pending" | "In Progress" | "Completed") => {
    try {
      const res = await fetch(`/api/operations/${id}`, {
        method: "PATCH",
        headers: getHeaders(),
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error("فشل تحديث حالة العملية");
      
      await loadCompanyData(false);
      triggerBannerNotification("تم تحديث حالة العملية بنجاح");
    } catch (e: any) {
      console.error(e);
      triggerBannerNotification("تعذر تحديث حالة العملية");
    }
  };

  // Handle deleting operation + cancelling invoice
  const handleDeleteOperation = async (id: string) => {
    try {
      const res = await fetch(`/api/operations/${id}`, {
        method: "DELETE",
        headers: getHeaders()
      });
      if (!res.ok) throw new Error("فشل حذف العملية وإلغاء الفاتورة");
      
      await loadCompanyData(false);
      triggerBannerNotification("تم حذف العملية بنجاح وإلغاء وتدمير كافة فواتيرها التلقائية");
    } catch (e: any) {
      console.error(e);
      triggerBannerNotification(e.message || "حدث خطأ غير متوقع");
    }
  };

  // Handle toggling payment status on an invoice
  const handleToggleInvoice = async (invoiceId: string, currentStatus: "Paid" | "Unpaid") => {
    const nextStatus = currentStatus === "Paid" ? "Unpaid" : "Paid";
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: getHeaders(),
        body: JSON.stringify({ status: nextStatus })
      });
      if (!res.ok) throw new Error("فشل تعديل حالة سداد الفاتورة");
      
      await loadCompanyData(false);
      triggerBannerNotification(
        nextStatus === "Paid" 
          ? "تم تحصيل الفاتورة وتحديث تدفق الميزانية بنجاح" 
          : "تم إلغاء تحصيل الفاتورة وإدراج المبالغ للمعلقة"
      );
    } catch (err: any) {
      setErrorMsg(err.message || "فشل تغيير حالة الفاتورة");
    }
  };

  // Toast notification system helper
  const triggerBannerNotification = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => {
      setSuccessMsg("");
    }, 4500);
  };

  // Lookup selected company name
  const getSelectedCompanyName = () => {
    const currentComp = companies.find(c => c.id === selectedCompanyId);
    return currentComp ? currentComp.name : (language === "ar" ? "بيئة عمل افتراضية" : "Default Workspace");
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-3" dir={dir}>
        <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-xs font-semibold tracking-wide text-zinc-500 dark:text-zinc-400">
          {t("auth_securing_access")}
        </p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <Login 
        onSuccess={async (user) => {
          setCurrentUser(user);
          try {
            const token = await user.getIdToken();
            setIdToken(token);
          } catch (e) {
            console.error("Failed to secure active session idToken:", e);
          }
        }} 
        darkMode={darkMode} 
        setDarkMode={setDarkMode} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-appbk flex flex-col font-sans select-none antialiased text-txtmain duration-200">
      
      {/* Dynamic Pop-up Modal for creating new company (Tenant isolation) */}
      {showAddCompanyModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-cardbk rounded-2xl max-w-md w-full p-6 shadow-xl border border-borderline text-start animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-borderline pb-3 mb-4">
              <h4 className="font-bold text-txtmain text-md">{t("tenant_modal_title")}</h4>
              <button 
                onClick={() => setShowAddCompanyModal(false)}
                className="text-txtmuted hover:text-txtmain transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateCompany} className="space-y-4">
              <p className="text-xs text-txtmuted leading-relaxed">
                {t("tenant_modal_desc")}
              </p>
              <div>
                <label className="block text-txtmain text-xs font-bold mb-2">{t("tenant_name_label")}</label>
                <input
                  type="text"
                  placeholder={t("tenant_placeholder")}
                  value={newCompanyName}
                  onChange={e => setNewCompanyName(e.target.value)}
                  className="w-full bg-appbk border border-borderline text-txtmain rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-600 transition-colors placeholder-slate-400"
                  required
                  autoFocus
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCompanyModal(false)}
                  className="px-4 py-2 text-xs font-bold text-txtmuted bg-appbk rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-500 transition-colors"
                >
                  {t("tenant_modal_confirm")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Container Layout */}
      <div className="flex flex-1 relative">
        
        {/* Right Sidebar navigation on desktop, modal on mobile */}
        <aside className={`
          fixed inset-y-0 z-40 w-64 bg-slate-900 text-slate-300 border-slate-800 flex flex-col justify-between transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:h-auto
          ${language === "ar" ? "right-0 border-l" : "left-0 border-r"}
          ${sidebarOpen ? "translate-x-0" : (language === "ar" ? "translate-x-full" : "-translate-x-full")}
        `}>
          
          <div className="p-5 flex flex-col gap-6">
            {/* SaaS Header Logo */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-linear-to-tr from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg text-white font-extrabold text-sm">
                ERP
              </div>
              <div>
                <h1 className="text-sm font-black text-white tracking-wide">{t("platform_name")}</h1>
                <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">{t("saas_erp_suite")}</p>
              </div>
            </div>

            {/* Tenant Switcher Module inside Sidebar */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <span className="text-[10px] text-slate-400 font-bold block uppercase">{t("current_tenant")}</span>
              
              <div className="space-y-2">
                <select
                  value={selectedCompanyId}
                  onChange={e => setSelectedCompanyId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg text-xs p-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => setShowAddCompanyModal(true)}
                  className="w-full bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/25 rounded-lg py-1.5 px-3 text-[10px] font-extrabold flex items-center justify-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t("register_new_tenant")}
                </button>
              </div>
            </div>

            {/* Nav List */}
            <nav className="space-y-1">
              <span className="text-[10px] text-slate-500 font-bold block pb-2 uppercase px-2">{t("dashboards_title")}</span>
              
              <button
                onClick={() => { setActiveTab("dashboard"); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-start ${activeTab === "dashboard" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10 font-bold" : "hover:bg-slate-800/50 hover:text-white"}`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>{t("tab_dashboard")}</span>
              </button>

              <button
                onClick={() => { setActiveTab("operations"); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-start ${activeTab === "operations" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10 font-bold" : "hover:bg-slate-800/50 hover:text-white"}`}
              >
                <Briefcase className="w-4 h-4" />
                <span>{t("tab_operations")}</span>
              </button>

              <button
                onClick={() => { setActiveTab("clients"); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-start ${activeTab === "clients" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10 font-bold" : "hover:bg-slate-800/50 hover:text-white"}`}
              >
                <Users className="w-4 h-4" />
                <span>{t("tab_clients")}</span>
              </button>

              <button
                onClick={() => { setActiveTab("invoices"); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-start ${activeTab === "invoices" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/15 font-bold" : "hover:bg-slate-800/50 hover:text-white"}`}
              >
                <FileText className="w-4 h-4" />
                <span>{t("tab_invoices")}</span>
              </button>

              <button
                onClick={() => { setActiveTab("expenses"); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-start ${activeTab === "expenses" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/15 font-bold" : "hover:bg-slate-800/50 hover:text-white"}`}
              >
                <Coins className="w-4 h-4" />
                <span>{t("tab_expenses")}</span>
              </button>

              <button
                onClick={() => { setActiveTab("sync"); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-start ${activeTab === "sync" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/15 font-bold" : "hover:bg-slate-800/50 hover:text-white"}`}
              >
                <Cloud className="w-4 h-4" />
                <span>{t("tab_google_sync")}</span>
              </button>

              <button
                onClick={() => { setActiveTab("subscriptions"); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-start ${activeTab === "subscriptions" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/15 font-bold" : "hover:bg-slate-800/50 hover:text-white"}`}
              >
                <Zap className="w-4 h-4 text-amber-500 animate-pulse" />
                <span>{t("tab_subscriptions")}</span>
              </button>

              <button
                onClick={() => { setActiveTab("settings"); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-start ${activeTab === "settings" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10 font-bold" : "hover:bg-slate-800/50 hover:text-white"}`}
              >
                <Settings className="w-4 h-4" />
                <span>{t("tab_settings")}</span>
              </button>
            </nav>
          </div>

          <div className="flex flex-col border-t border-slate-800">
            {/* Language toggle switcher in Sidebar */}
            <div className="px-5 py-3 border-b border-slate-800 flex flex-col gap-2">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block">
                🌐 {language === "ar" ? "لغة النظام" : "System Language"}
              </span>
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setLanguage("ar")}
                  className={`flex-1 py-1 px-2 rounded-lg text-[10px] font-bold text-center transition-all ${language === "ar" ? "bg-indigo-600 text-white shadow-md font-extrabold" : "text-slate-400 hover:text-white"}`}
                >
                  العربية
                </button>
                <button
                  onClick={() => setLanguage("en")}
                  className={`flex-1 py-1 px-2 rounded-lg text-[10px] font-bold text-center transition-all ${language === "en" ? "bg-indigo-600 text-white shadow-md font-extrabold" : "text-slate-400 hover:text-white"}`}
                >
                  English
                </button>
              </div>
            </div>

            {/* Dark mode switcher toggle in Sidebar */}
            <div className="px-5 py-3.5 flex items-center justify-between">
              <span className="text-xs text-slate-300 font-bold flex items-center gap-1.5 select-none">
                {darkMode ? <Moon className="w-4 h-4 text-indigo-400" /> : <Sun className="w-4 h-4 text-amber-400" />}
                {t("dark_mode")}
              </span>
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-1 duration-250 shrink-0 ${darkMode ? 'bg-indigo-600' : 'bg-slate-700'}`}
                title={darkMode ? (language === "ar" ? "تبديل إلى الوضع النهاري" : "Switch to Light Mode") : (language === "ar" ? "تبديل إلى الوضع الليلي" : "Switch to Dark Mode")}
                aria-label="تغيير المظهر"
              >
                <span className={`w-4 h-4 rounded-full bg-white shadow-md transition-transform duration-250 ${darkMode ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>

          {/* User profile details in sidebar */}
          {currentUser && (
            <div className="px-5 py-4 border-t border-slate-800 bg-slate-950/25 flex flex-col gap-3">
              <div className="flex items-center gap-3 w-full">
                {currentUser.photoURL ? (
                  <img 
                    src={currentUser.photoURL} 
                    alt={currentUser.displayName || ""} 
                    className="w-9 h-9 rounded-full border border-slate-700 object-cover shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-md">
                    {currentUser.displayName?.charAt(0) || currentUser.email?.charAt(0).toUpperCase() || "?"}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-white truncate max-w-full">{currentUser.displayName || currentUser.email}</p>
                  <p className="text-[9px] text-slate-400 truncate max-w-full">{t("auth_logged_in_as")} {currentUser.email}</p>
                </div>
              </div>

              <button
                onClick={async () => {
                  try {
                    await logout();
                    setCurrentUser(null);
                    setIdToken(null);
                  } catch (e) {
                    console.error("Logout issue:", e);
                  }
                }}
                className="w-full bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 border border-rose-500/15 rounded-xl py-2 px-3 text-[10px] font-extrabold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                {t("auth_sign_out_btn")}
              </button>
            </div>
          )}

          {/* Sidebar Footer details */}
          <div className="p-5 border-t border-slate-800 space-y-3 bg-slate-950/40">
            <div className="flex gap-2 items-center text-[10px] text-slate-500">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              <span>{t("data_security_iso")}</span>
            </div>
            <p className="text-[9px] text-slate-600 leading-relaxed">
              {t("data_security_desc")}
            </p>
          </div>

        </aside>

        {/* Mobile Sidebar backdrop */}
        {sidebarOpen && (
          <div 
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-30 bg-slate-900/50 backdrop-blur-xs md:hidden"
          />
        )}

        {/* Left Side Content Area */}
        <main className="flex-1 flex flex-col min-w-0">
          
          {/* Top Bar Header */}
          <header className="bg-cardbk border-b border-borderline h-16 px-4 md:px-8 flex items-center justify-between sticky top-0 z-20 duration-200">
            
            {/* Sidebar toggle & Current Tab name indicator */}
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 -mr-2 bg-appbk hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-txtmain md:hidden transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="h-5 w-[1px] bg-borderline hidden md:block" />

              <div className="flex items-center gap-2">
                <span className="text-txtmain text-md font-extrabold pr-1">
                  💡 {getSelectedCompanyName()}
                </span>
                <span className="bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 text-[9px] font-black px-2 py-0.5 rounded-md">
                  {t("active_env")}
                </span>
              </div>
            </div>

            {/* Quick action controls (Refresh + System notifications badge) */}
            <div className="flex items-center gap-2">
              <NotificationCenter 
                selectedCompanyId={selectedCompanyId} 
                companyCurrency={companies.find(c => c.id === selectedCompanyId)?.currency || "ر.س"}
                onRefreshData={() => loadCompanyData(false)} 
              />

              <button
                onClick={() => loadCompanyData(false)}
                disabled={refreshing}
                title={language === "ar" ? "تحديث البيانات يدوياً" : "Sync Data Manually"}
                className="p-2 text-txtmuted hover:text-txtmain bg-appbk border border-borderline rounded-xl transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-indigo-600" : ""}`} />
              </button>
              
              <div className="hidden sm:flex items-center gap-2 bg-appbk border border-borderline rounded-xl px-3 py-1.5 text-[11px] text-txtmuted">
                <span className="font-mono text-txtmain font-bold">2026-06-12</span>
                <span className="w-1 h-3 bg-borderline" />
                <span>{t("sys_time")}</span>
              </div>
            </div>

          </header>

          {/* Toast Notification Bar */}
          {successMsg && (
            <div className="mx-4 md:mx-8 mt-4 p-4 bg-emerald-600 text-white rounded-2xl shadow-lg text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-300">
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="mx-4 md:mx-8 mt-4 p-4 bg-rose-600 text-white rounded-2xl shadow-lg text-xs font-semibold flex items-center justify-between gap-2 animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
              <button 
                onClick={() => setErrorMsg("")}
                className="text-white hover:opacity-80 font-black text-sm"
              >
                ×
              </button>
            </div>
          )}

          {/* Actual View Area */}
          <div className="p-4 md:p-8 flex-1 overflow-y-auto">
            
            {loading ? (
              <div className="h-96 flex flex-col items-center justify-center text-slate-400 gap-3">
                <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
                <p className="text-xs font-medium">{t("loading")}</p>
              </div>
            ) : (
              <div className="space-y-6">
                
                {/* Active tab routing layout */}
                {activeTab === "dashboard" && stats && (
                  <Dashboard 
                    stats={stats} 
                    invoices={invoices} 
                    clients={clients} 
                    operations={operations}
                    companyCurrency={companies.find(c => c.id === selectedCompanyId)?.currency || "ر.س"}
                    widgetOrder={companies.find(c => c.id === selectedCompanyId)?.widget_order}
                    primaryColor={companies.find(c => c.id === selectedCompanyId)?.primary_color || "#4F46E5"}
                    currentCompany={companies.find(c => c.id === selectedCompanyId) || null}
                    onUpdateCompany={(updatedCompany) => {
                      setCompanies(companies.map(c => c.id === updatedCompany.id ? updatedCompany : c));
                    }}
                    onToggleInvoice={handleToggleInvoice}
                  />
                )}

                {activeTab === "operations" && (
                  <Operations 
                    operations={operations} 
                    clients={clients} 
                    companyCurrency={companies.find(c => c.id === selectedCompanyId)?.currency || "ر.س"}
                    onCreateOperation={handleCreateOperation} 
                    onDeleteOperation={handleDeleteOperation}
                    onUpdateOperationStatus={handleUpdateOperationStatus}
                    onBulkImportOperations={handleBulkImportOperations}
                  />
                )}

                {activeTab === "clients" && (
                  <Clients 
                    clients={clients} 
                    operations={operations}
                    invoices={invoices}
                    companyCurrency={companies.find(c => c.id === selectedCompanyId)?.currency || "ر.س"}
                    onCreateClient={handleCreateClient} 
                    onBulkImportClients={handleBulkImportClients}
                  />
                )}

                {activeTab === "invoices" && (
                  <Invoices 
                    invoices={invoices} 
                    clients={clients} 
                    operations={operations}
                    currentCompany={companies.find(c => c.id === selectedCompanyId) || null}
                    onToggleInvoice={handleToggleInvoice} 
                  />
                )}

                {activeTab === "expenses" && (
                  <Expenses 
                    companyCurrency={companies.find(c => c.id === selectedCompanyId)?.currency || "ر.س"}
                    selectedCompanyId={selectedCompanyId}
                    onRefreshStats={() => loadCompanyData(false)}
                  />
                )}

                <div className={activeTab === "sync" ? "block" : "hidden"}>
                  <GoogleSync 
                    selectedCompanyId={selectedCompanyId}
                    currentCompany={companies.find(c => c.id === selectedCompanyId) || null}
                    onRefreshStats={() => loadCompanyData(false)}
                    clients={clients}
                    operations={operations}
                    invoices={invoices}
                    stats={stats}
                    companyCurrency={companies.find(c => c.id === selectedCompanyId)?.currency || "ر.س"}
                  />
                </div>

                {activeTab === "settings" && (
                  <SettingsComponent 
                    company={companies.find(c => c.id === selectedCompanyId) || null}
                    onUpdateCompany={(updatedCompany) => {
                      setCompanies(companies.map(c => c.id === updatedCompany.id ? updatedCompany : c));
                    }}
                  />
                )}

                {activeTab === "subscriptions" && (
                  <Subscription 
                    currentCompany={companies.find(c => c.id === selectedCompanyId) || null}
                    companyCurrency={companies.find(c => c.id === selectedCompanyId)?.currency || "ر.س"}
                    onRefreshCompanyData={async () => {
                      await fetchCompanies();
                      await loadCompanyData(false);
                    }}
                  />
                )}

              </div>
            )}

          </div>

        </main>

      </div>
    </div>
  );
}
