import React, { useState, useEffect } from "react";
import { 
  Cloud, 
  Database, 
  FileSpreadsheet, 
  Lock, 
  RefreshCw, 
  ArrowLeftRight, 
  ExternalLink, 
  CheckCircle, 
  AlertCircle, 
  Trash2, 
  FolderOpen,
  Calendar,
  Sparkles,
  Link
} from "lucide-react";
import { 
  initAuth, 
  googleSignIn, 
  logout, 
  getAccessToken 
} from "../lib/firebaseAuth";
import { useLanguage } from "../lib/LanguageContext";
import { Company, Client, Operation, Invoice, Expense, DashboardStats } from "../types";

interface GoogleSyncProps {
  selectedCompanyId: string;
  currentCompany: Company | null;
  onRefreshStats: () => void;
  clients: Client[];
  operations: Operation[];
  invoices: Invoice[];
  stats: DashboardStats | null;
  companyCurrency: string;
}

interface DriveFile {
  id: string;
  name: string;
  webViewLink: string;
  createdTime: string;
  iconLink?: string;
}

export default function GoogleSync({
  selectedCompanyId,
  currentCompany,
  onRefreshStats,
  clients,
  operations,
  invoices,
  stats,
  companyCurrency
}: GoogleSyncProps) {
  const { language, t } = useLanguage();

  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Sync operations state
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "success" | "error">("idle");
  const [lastSyncedSheet, setLastSyncedSheet] = useState<{ id: string; url: string; name: string } | null>(null);
  const [statusMsg, setStatusMsg] = useState("");

  // Drive files state
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  // Auto sync configurations state
  const [autoSync, setAutoSync] = useState(() => {
    return localStorage.getItem(`erp_auto_sync_${selectedCompanyId}`) === "true";
  });

  // Expenses for the current company needed for full sheet integration
  const [expenses, setExpenses] = useState<Expense[]>([]);

  // Helper to resolve month keys and clean display names in multi-language context
  const getMonthKeyAndName = React.useCallback((dateStr: string) => {
    if (!dateStr) return { key: "unknown", name: language === "ar" ? "غير محدد" : "Unspecified" };
    const parts = dateStr.split("-");
    if (parts.length >= 2) {
      const year = parts[0];
      const month = parseInt(parts[1], 10);
      const monthsAr = [
        "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
        "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
      ];
      const monthsEn = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];
      const monthName = language === "ar" ? monthsAr[month - 1] : monthsEn[month - 1];
      return {
        key: `${year}-${parts[1]}`,
        name: `${monthName} ${year}`
      };
    }
    return { key: "unknown", name: language === "ar" ? "غير محدد" : "Unspecified" };
  }, [language]);

  // Memoized aggregator to compile financial performance matrices of all synced records by month
  const monthlySummary = React.useMemo(() => {
    const monthsMap: Record<string, {
      monthKey: string;
      monthName: string;
      totalRevenue: number;
      totalCost: number;
      netProfit: number;
      expenseAmount: number;
      invoicedAmount: number;
      paidAmount: number;
      unpaidAmount: number;
      operationsCount: number;
      invoicesCount: number;
    }> = {};

    const ensureMonth = (key: string, name: string) => {
      if (!monthsMap[key]) {
        monthsMap[key] = {
          monthKey: key,
          monthName: name,
          totalRevenue: 0,
          totalCost: 0,
          netProfit: 0,
          expenseAmount: 0,
          invoicedAmount: 0,
          paidAmount: 0,
          unpaidAmount: 0,
          operationsCount: 0,
          invoicesCount: 0,
        };
      }
      return monthsMap[key];
    };

    // Synthesize Operational revenue and costs
    operations.forEach(o => {
      const { key, name } = getMonthKeyAndName(o.date);
      if (key !== "unknown") {
        const entry = ensureMonth(key, name);
        entry.totalRevenue += Number(o.revenue) || 0;
        entry.totalCost += Number(o.cost) || 0;
        entry.operationsCount += 1;
      }
    });

    // Synthesize Invoiced records and receivables
    invoices.forEach(i => {
      const dateSource = i.due_date || i.payment_date || "";
      const { key, name } = getMonthKeyAndName(dateSource);
      if (key !== "unknown") {
        const entry = ensureMonth(key, name);
        entry.invoicedAmount += Number(i.amount) || 0;
        entry.invoicesCount += 1;
        if (i.status === "Paid") {
          entry.paidAmount += Number(i.amount) || 0;
        } else {
          entry.unpaidAmount += Number(i.amount) || 0;
        }
      }
    });

    // Synthesize auxiliary expenses
    expenses.forEach(e => {
      const { key, name } = getMonthKeyAndName(e.date);
      if (key !== "unknown") {
        const entry = ensureMonth(key, name);
        entry.expenseAmount += Number(e.amount) || 0;
      }
    });

    // Compute net profit as (Revenue - Direct Cost - Expenses) and sort chronologically descending
    return Object.values(monthsMap).map(m => {
      m.netProfit = m.totalRevenue - m.totalCost - m.expenseAmount;
      return m;
    }).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  }, [operations, invoices, expenses, getMonthKeyAndName]);

  // Track the signature of all datasets to detect updates
  const dataSignature = JSON.stringify({
    ops: operations.map(o => ({ id: o.id, rev: o.revenue, cost: o.cost, service: o.service })),
    invs: invoices.map(i => ({ id: i.id, amount: i.amount, status: i.status })),
    cls: clients.map(c => c.id),
    exp: expenses.map(e => ({ id: e.id, amount: e.amount }))
  });

  const lastSignatureRef = React.useRef<string>("");

  useEffect(() => {
    setAutoSync(localStorage.getItem(`erp_auto_sync_${selectedCompanyId}`) === "true");
    lastSignatureRef.current = ""; // Reset signature tracking on company switch
  }, [selectedCompanyId]);

  // Fetch local expenses in ERP to send to Sheets
  const fetchExpenses = async () => {
    try {
      const res = await fetch("/api/expenses", {
        headers: {
          "Content-Type": "application/json",
          "x-company-id": selectedCompanyId
        }
      });
      if (res.ok) {
        const data = await res.json();
        setExpenses(data);
      }
    } catch (err) {
      console.error("Error loading expenses for sheets sync:", err);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [selectedCompanyId]);

  // Handle Firebase Auth listening
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, cachedToken) => {
        setUser(currentUser);
        setToken(cachedToken);
        setNeedsAuth(false);
      },
      () => {
        setUser(null);
        setToken(null);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  // Sync / load files whenever token is available
  useEffect(() => {
    if (token) {
      fetchSpreadsheets();
      // Load saved spreadsheet from localStorage if any
      const savedId = localStorage.getItem(`erp_sync_sheet_id_${selectedCompanyId}`);
      const savedName = localStorage.getItem(`erp_sync_sheet_name_${selectedCompanyId}`);
      if (savedId) {
        setLastSyncedSheet({
          id: savedId,
          name: savedName || "جدول بيانات ERP المخصص",
          url: `https://docs.google.com/spreadsheets/d/${savedId}`
        });
      }
    } else {
      setDriveFiles([]);
      setLastSyncedSheet(null);
    }
  }, [token, selectedCompanyId]);

  // Automatic background synchronization trigger on data change
  useEffect(() => {
    if (!autoSync || !token || !lastSyncedSheet?.id) {
      lastSignatureRef.current = dataSignature;
      return;
    }

    // Capture initial load without triggering a sync
    if (!lastSignatureRef.current) {
      lastSignatureRef.current = dataSignature;
      return;
    }

    if (lastSignatureRef.current === dataSignature) {
      return;
    }

    // Debounce triggers to prevent API thrashing
    const delayTimer = setTimeout(() => {
      lastSignatureRef.current = dataSignature;
      console.log("[Auto-Sync] Data change detected, updating Google Sheets...");
      handleSyncToSheets(false);
    }, 3000);

    return () => clearTimeout(delayTimer);
  }, [dataSignature, autoSync, token, lastSyncedSheet?.id]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setStatusMsg("");
    try {
      const result = await googleSignIn();
      if (result) {
        setToken(result.accessToken);
        setUser(result.user);
        setNeedsAuth(false);
      }
    } catch (err: any) {
      console.error("Login failed:", err);
      setStatusMsg(language === "ar" ? "تعذر الاتصال بحساب Google. حاول مرة أخرى." : "Failed to authenticate with Google. Try again.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    if (window.confirm(language === "ar" ? "هل تريد بالتأكيد إلغاء ربط الحساب السحابي لقوقل؟" : "Are you sure you want to decouple Google Cloud integration?")) {
      await logout();
      setUser(null);
      setToken(null);
      setNeedsAuth(true);
      setLastSyncedSheet(null);
    }
  };

  // Fetch created spreadsheets from user's Drive folder matching "نظام ERP"
  const fetchSpreadsheets = async () => {
    const activeToken = token || (await getAccessToken());
    if (!activeToken) return;

    setLoadingFiles(true);
    try {
      // Query search criteria: only spreadsheets (mimeType) and name includes "ERP"
      const q = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and name contains 'ERP' and trashed = false");
      const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,webViewLink,createdTime)&orderBy=createdTime desc&pageSize=10`;
      
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${activeToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDriveFiles(data.files || []);
      }
    } catch (err) {
      console.error("Failed to query files from Google Drive:", err);
    } finally {
      setLoadingFiles(false);
    }
  };

  const postSyncLog = async (sheetName: string, sheetUrl: string, method: string) => {
    try {
      await fetch("/api/audit-logs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-company-id": selectedCompanyId
        },
        body: JSON.stringify({
          action: language === "ar" ? "مزامنة سحابة Google" : "Google Cloud Sync",
          details: language === "ar" 
            ? `تم بنجاح ${method} جدول البيانات "${sheetName}" على Google Sheets ومزامنة ${invoices.length} فاتورة و ${operations.length} عملية.`
            : `Success ${method} of spreadsheet "${sheetName}" on Google Sheets with ${invoices.length} invoices and ${operations.length} operations.`,
          user: user?.email || "awadh.a.1987@gmail.com"
        })
      });
      onRefreshStats();
    } catch (err) {
      console.error("Failed to send sync audit log:", err);
    }
  };

  // Main Export & Sync Action
  const handleSyncToSheets = async (isNew = false) => {
    const activeToken = token || (await getAccessToken());
    if (!activeToken) {
      setNeedsAuth(true);
      return;
    }

    setSyncing(true);
    setSyncStatus("idle");
    setStatusMsg("");

    const companyName = currentCompany?.name || "المنشأة الحالية";
    let targetSpreadsheetId = lastSyncedSheet?.id;

    try {
      // Step 1: Create Spreadsheet if we don't have one or if forcing a new file
      if (isNew || !targetSpreadsheetId) {
        setStatusMsg(language === "ar" ? "جاري إنشاء مستند جديد على Google Sheets..." : "Creating a fresh template on Google Sheets...");
        
        const createRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${activeToken}`
          },
          body: JSON.stringify({
            properties: {
              title: `نظام ERP - مزامنة بيانات ${companyName}`
            },
            sheets: [
              { properties: { title: "الملخص واللوحة" } },
              { properties: { title: "دفتر الفواتير" } },
              { properties: { title: "العمليات التشغيلية" } },
              { properties: { title: "سجل العملاء" } },
              { properties: { title: "سجل المصروفات" } },
              { properties: { title: "الأداء المالي الشهري" } }
            ]
          })
        });

        if (!createRes.ok) throw new Error("تعذر إنشاء جدول البيانات");
        const sheetData = await createRes.json();
        targetSpreadsheetId = sheetData.spreadsheetId;
      }

      if (!targetSpreadsheetId) throw new Error("رقم المستند غير متوفر");

      // Step 2: Clear old cell ranges if we are updating (to prevent ghost leftovers)
      if (!isNew && lastSyncedSheet?.id) {
        setStatusMsg(language === "ar" ? "جاري تهيئة ومسح الحقول السابقة..." : "Clearing stale cells to push clean records...");
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${targetSpreadsheetId}/values:batchClear`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${activeToken}`
          },
          body: JSON.stringify({
            ranges: [
              "الملخص واللوحة!A1:C100",
              "دفتر الفواتير!A1:G1000",
              "العمليات التشغيلية!A1:G1000",
              "سجل العملاء!A1:D1000",
              "سجل المصروفات!A1:F1000",
              "الأداء المالي الشهري!A1:J100"
            ]
          })
        });
      }

      // Step 3: Populate values
      setStatusMsg(language === "ar" ? "جاري تحويل وتصنيف جداول البيانات وتنسيقها..." : "Transforming and format-mapping enterprise logs...");

      // 3.1. Dashboard Summaries
      const dashboardValues = [
        ["شاشة المؤشرات العامة والمطابقة لـ ERP", companyName, `توقيت المزامنة: ${new Date().toLocaleString(language === "ar" ? "ar-SA" : "en-US")}`],
        [],
        ["مؤشرات الأداء الرئيسية", "القيمة المالية", "الوحدة المعتمدة"],
        ["إجمالي الإيرادات المبيعات", stats?.totalRevenue || 0, companyCurrency],
        ["إجمالي التكاليف والمصروفات", stats?.totalCost || 0, companyCurrency],
        ["صافي الأرباح التشغيلية", stats?.totalProfit || 0, companyCurrency],
        ["هامش الربح التشغيلي", `${stats?.profitMargin || 0}%`, "نسبة مئوية من الأداء"],
        [],
        ["إحصائيات الكيانات والأوراق المنجزة", "البيان والكمية", "صيغة المراقبة"],
        ["عدد العملاء النشطين", stats?.clientsCount || 0, "عميل مسجل"],
        ["عدد العمليات التشغيلية المنفذة", stats?.operationsCount || 0, "عقد/تفويض"],
        ["عدد الفواتير المصدرة", stats?.invoicesCount || 0, "فاتورة تسوية"],
        ["إجمالي التحصيلات (الفواتير المسددة)", stats?.paidAmount || 0, companyCurrency],
        ["إجمالي الذمم الدائنة (الفواتير غير المسددة)", stats?.unpaidAmount || 0, companyCurrency],
        ["أكثر الفواتير تأخراً وتجاوزاً لاستحقاقها", stats?.overdueCount || 0, "إصدار متأخر"]
      ];

      // 3.2. Invoices
      const invoicesValues = [
        ["رقم الفاتورة الموحد", "العميل المستفيد", "البيان والخدمة المنجزة", "القيمة المالية الضريبية", "الحالة للسداد", "تاريخ الاستحقاق", "تاريخ التحصيل والدفع"],
        ...invoices.map(i => {
          const client = clients.find(c => c.id === i.client_id)?.name || "عميل غير معروف";
          const op = operations.find(o => o.id === i.op_id);
          const service = op ? op.service : "—";
          return [
            i.id,
            client,
            service,
            i.amount,
            i.status === "Paid" ? "مدفوعة ومحصلة" : "معلقة غير مسددة",
            i.due_date,
            i.payment_date || "—"
          ];
        })
      ];

      // 3.3. Operations
      const operationsValues = [
        ["رقم العملية التشغيلية", "العميل المتعاقد", "بيان الخدمة المتفق عليها", "الإيرادات المستهدفة", "التكاليف الأساسية", "صافي ربحية العقد", "تاريخ العقد/العملية"],
        ...operations.map(o => {
          const client = clients.find(c => c.id === o.client_id)?.name || "—";
          return [
            o.id,
            client,
            o.service,
            o.revenue,
            o.cost,
            o.profit,
            o.date
          ];
        })
      ];

      // 3.4. Clients
      const clientsValues = [
        ["رقم العميل الموحد (ID)", "الاسم الكريم للعميل", "الشركة / المؤسسة التابعة للعميل", "رقم الاتصال المرتبط"],
        ...clients.map(c => [
          c.id,
          c.name,
          c.company,
          c.phone
        ])
      ];

      // 3.5. Expenses
      const expensesValues = [
        ["رقم المصروف", "فئة المصاريف", "القيمة المالية الصافية", "دورية تكرار المصروف", "تاريخ السداد / الخصم", "بيان وتفاصيل المصروف التشغيلي"],
        ...expenses.map(e => {
          const catAr = e.category === "rent" ? "إيجار مقرات" : e.category === "salaries" ? "رواتب ومكافآت" : e.category === "subscriptions" ? "اشتراكات برمجية وسحابية" : e.category === "utilities" ? "خدمات ومرافق عامة" : e.category === "marketing" ? "حملات تسويقية وإعلانات" : "مصروفات تشغيلية أخرى";
          const freqAr = e.frequency === "weekly" ? "أسبوعي" : e.frequency === "monthly" ? "شهري" : e.frequency === "yearly" ? "سنوي" : "يدوي مرة واحدة";
          return [
            e.id,
            catAr,
            e.amount,
            freqAr,
            e.date,
            e.description || "—"
          ];
        })
      ];

      // 3.6. Monthly Financial Performance Summary Values
      const monthlyPerformanceValues = [
        ["الشهر التمويلي", "عدد العمليات التشغيلية", "إيرادات العمليات المستهدفة", "تكاليف العمليات المباشرة", "قيمة المصروفات الفرعية والمقرات", "الفواتير المصدرة", "التحصيلات المحرزة", "الذمم المدينة المتبقية", "صافي أرباح الشهر (Net Profit)", "هامش الربحية للمنظومة %"],
        ...monthlySummary.map(m => {
          const margin = m.totalRevenue > 0 ? Math.round((m.netProfit / m.totalRevenue) * 100) : 0;
          return [
            m.monthName,
            m.operationsCount,
            m.totalRevenue,
            m.totalCost,
            m.expenseAmount,
            m.invoicedAmount,
            m.paidAmount,
            m.unpaidAmount,
            m.netProfit,
            `${margin}%`
          ];
        })
      ];

      // Batch update fetch
      const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${targetSpreadsheetId}/values:batchUpdate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${activeToken}`
        },
        body: JSON.stringify({
          valueInputOption: "USER_ENTERED",
          data: [
            { range: "الملخص واللوحة!A1", values: dashboardValues },
            { range: "دفتر الفواتير!A1", values: invoicesValues },
            { range: "العمليات التشغيلية!A1", values: operationsValues },
            { range: "سجل العملاء!A1", values: clientsValues },
            { range: "سجل المصروفات!A1", values: expensesValues },
            { range: "الأداء المالي الشهري!A1", values: monthlyPerformanceValues }
          ]
        })
      });

      if (!updateRes.ok) throw new Error("تعذر إدراج وتحديث قيم الجداول السحابية");

      // Save spreadsheet ID to state and localStorage
      const finalName = `نظام ERP - مزامنة بيانات ${companyName}`;
      const finalUrl = `https://docs.google.com/spreadsheets/d/${targetSpreadsheetId}`;

      localStorage.setItem(`erp_sync_sheet_id_${selectedCompanyId}`, targetSpreadsheetId);
      localStorage.setItem(`erp_sync_sheet_name_${selectedCompanyId}`, finalName);

      setLastSyncedSheet({
        id: targetSpreadsheetId,
        name: finalName,
        url: finalUrl
      });

      setSyncStatus("success");
      setStatusMsg(language === "ar" ? "تمت المزامنة السحابية وتحديث جداول قوقل بنجاح!" : "Cloud synchronization and updates committed successfully!");
      
      // Post log inside backend ERP audit database
      await postSyncLog(finalName, finalUrl, isNew ? "إنشاء وتصدير" : "تحديث ومزامنة");
      
      // Refresh Drive list
      fetchSpreadsheets();
    } catch (err: any) {
      console.error(err);
      setSyncStatus("error");
      setStatusMsg(language === "ar" ? "حدثت مشكلة أثناء إرسال البيانات السحابية لقوقل شيتس." : "An error occurred during Google sheets cloud data payload transfer.");
    } finally {
      setSyncing(false);
    }
  };

  const handleCreateNewSheet = () => {
    const confirmed = window.confirm(
      language === "ar" 
        ? "هل تود بالتأكيد تصدير وإنشاء نسخة مستقلة جديدة لملف Google Sheets؟ سيؤدي ذلك لإنشاء ملف جديد كلياً في حساب Google Drive الخاص بك."
        : "Do you confirm initiating to export a brand new standalone Google Sheets spreadsheet instance in Google Drive?"
    );
    if (confirmed) {
      handleSyncToSheets(true);
    }
  };

  return (
    <div className="space-y-6 text-start">
      {/* View Title */}
      <div>
        <h2 className="text-2xl font-bold text-txtmain flex items-center gap-2">
          <Cloud className="w-6 h-6 text-blue-500" />
          {language === "ar" ? "التكامل السحابي وقوقل شيتس (Google Cloud Ecosystem & Sheets Sync)" : "Google Cloud Integration & Sheets sync"}
        </h2>
        <p className="text-txtmuted text-sm mt-1 max-w-2xl">
          {language === "ar" 
            ? "يوفر هذا الملحق ربطاً مباشراً للفواتير النشطة، والأرباح والمصروفات وجداول العمليات مع Google Sheets و Google Drive لمزامنة تقارير المنشأة بمرونة وأمان كامل."
            : "Connect, synchronize, and live-export your live ledger matrices, operational expenses and invoice sheets with Google Sheets and Google Drive."}
        </p>
      </div>

      {needsAuth ? (
        /* Unauthorized State Block */
        <div className="bg-cardbk rounded-2xl border border-borderline p-8 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center border border-blue-500/20 text-blue-500">
            <Lock className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-md font-bold text-txtmain">
              {language === "ar" ? "يتطلب هذا ربط حساب Google الخاص بك" : "Authentication Required"}
            </h3>
            <p className="text-txtmuted text-xs mt-1.5 max-w-sm">
              {language === "ar"
                ? "يرجى تسجيل الدخول بحساب Google المعتمد لتمنح التطبيق صلاحيات آمنة لإنشاء وتحديث مستندات Google Sheets و Google Drive."
                : "Decoupled state. Please click below to grant cloud scopes to interface files inside Google Sheets and Drive safely."}
            </p>
          </div>

          <button
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="gsi-material-button font-bold text-xs cursor-pointer shadow-md shadow-slate-900/15"
          >
            <div className="gsi-material-button-state"></div>
            <div className="gsi-material-button-content-wrapper">
              <div className="gsi-material-button-icon">
                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: "block" }}>
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  <path fill="none" d="M0 0h48v48H0z"></path>
                </svg>
              </div>
              <span className="gsi-material-button-contents">
                {isLoggingIn 
                  ? (language === "ar" ? "جاري الاتصال السحابي..." : "Connecting Accounts...") 
                  : (language === "ar" ? "ربط الحساب وتسجيل الدخول بحساب Google" : "Connect with Google Account")}
              </span>
            </div>
          </button>

          {statusMsg && (
            <p className="text-xs font-semibold text-rose-500 mt-2">{statusMsg}</p>
          )}
        </div>
      ) : (
        /* Authorized State Block layout */
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* User Account Details & General Sync Control */}
          <div className="lg:col-span-1 space-y-6">
            {/* Authenticated credentials card */}
            <div className="bg-cardbk rounded-2xl border border-borderline p-5 space-y-4">
              <h3 className="font-bold text-xs text-txtmuted uppercase tracking-wider">
                🟢 {language === "ar" ? "الحساب المرتبط حالياً" : "Connected Google Profile"}
              </h3>
              
              <div className="flex items-center gap-3">
                {user?.photoURL ? (
                  <img 
                    src={user.photoURL} 
                    alt="avatar" 
                    referrerPolicy="no-referrer"
                    className="w-11 h-11 rounded-full border border-borderline shadow-inner"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-blue-500/10 text-blue-500 font-bold flex items-center justify-center border border-blue-500/20 text-sm">
                    {user?.displayName ? user.displayName.substring(0, 1) : "G"}
                  </div>
                )}
                <div className="min-w-0">
                  <h4 className="font-black text-sm text-txtmain truncate">{user?.displayName || "Google Cloud Integration"}</h4>
                  <p className="font-mono text-txtmuted text-[11px] truncate">{user?.email}</p>
                </div>
              </div>

              <div className="pt-2 border-t border-borderline flex items-center justify-between">
                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-md font-bold">
                  {language === "ar" ? "حساب معتمد" : "Validated SSO"}
                </span>

                <button 
                  onClick={handleLogout}
                  className="text-xs text-rose-500 hover:text-rose-400 font-bold transition-colors cursor-pointer"
                >
                  {language === "ar" ? "إلغاء ربط الحساب" : "Decouple Account"}
                </button>
              </div>
            </div>

            {/* Sync trigger control panel card */}
            <div className="bg-cardbk rounded-2xl border border-borderline p-6 space-y-5">
              <div className="flex items-center gap-2 border-b border-borderline pb-3">
                <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
                <h3 className="font-bold text-sm text-txtmain">
                  {language === "ar" ? "إعدادات مزامنة البيانات" : "Spreadsheet Sync Workspace"}
                </h3>
              </div>

              {lastSyncedSheet ? (
                /* Saved Sheet Widget status view */
                <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" />
                      {language === "ar" ? "مرتبط بمستند حالي" : "Active Sheet Decoupled ID"}
                    </span>
                    <button
                      onClick={() => {
                        localStorage.removeItem(`erp_sync_sheet_id_${selectedCompanyId}`);
                        localStorage.removeItem(`erp_sync_sheet_name_${selectedCompanyId}`);
                        setLastSyncedSheet(null);
                      }}
                      title={language === "ar" ? "إلغاء ربط المستند الحالي" : "De-register this Spreadsheet ID"}
                      className="text-slate-400 hover:text-rose-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <h4 className="font-black text-txtmain text-xs leading-normal truncate" title={lastSyncedSheet.name}>
                    {lastSyncedSheet.name}
                  </h4>
                  <a 
                    href={lastSyncedSheet.url} 
                    target="_blank" 
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-blue-500 hover:underline font-bold"
                  >
                    <span>{language === "ar" ? "فتح المستند في تبويب جديد" : "Open sheet on Google Drive"}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ) : (
                <div className="p-3.5 bg-slate-500/5 border border-dashed border-borderline rounded-xl text-center text-txtmuted text-xs">
                  <p>{language === "ar" ? "لم يتم تصدير أو ربط أي ملف حالي بعد." : "No saved spreadsheet reference found."}</p>
                </div>
              )}

              {/* Automatic Sync Switcher Toggle */}
              {lastSyncedSheet && (
                <div className="p-3.5 bg-indigo-50/50 dark:bg-slate-800/40 border border-indigo-100/40 dark:border-borderline rounded-xl space-y-2 animate-in fade-in duration-200 text-start">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs text-txtmain select-none flex items-center gap-1.5">
                      <RefreshCw className={`w-3.5 h-3.5 text-indigo-500 ${autoSync ? "animate-spin" : ""}`} />
                      {language === "ar" ? "المزامنة التلقائية اللحظية" : "Live Auto-Sync"}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const nextVal = !autoSync;
                        setAutoSync(nextVal);
                        localStorage.setItem(`erp_auto_sync_${selectedCompanyId}`, String(nextVal));
                        if (nextVal) {
                          lastSignatureRef.current = ""; // Forces sync comparison trigger
                        }
                      }}
                      className={`w-10 h-6 rounded-full transition-colors relative flex items-center px-1 duration-200 cursor-pointer shrink-0 ${autoSync ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                      title={language === "ar" ? "تمكين المزامنة في الوقت الفعلي" : "Enable real-time cloud publishing"}
                    >
                      <span 
                        className="w-4 h-4 rounded-full bg-white shadow-xs transition-transform duration-200" 
                        style={{
                          transform: autoSync 
                            ? (language === "ar" ? "translateX(-16px)" : "translateX(16px)") 
                            : "translateX(0px)"
                        }}
                      />
                    </button>
                  </div>
                  <p className="text-[10px] text-txtmuted leading-relaxed">
                    {language === "ar" 
                      ? "عند إضافة أو تحديث الفواتير، المصروفات، والعمليات التشغيلية، سيقوم النظام تلقائياً بتحديث مستند قوقل شيتس النشط في الخلفية."
                      : "Adding or updating records anywhere in the ERP publishes the delta instantly to safety buffers on your Google Sheet."}
                  </p>
                </div>
              )}

              <div className="space-y-2 pt-2">
                {/* Sync / Update Data Button */}
                <button
                  type="button"
                  disabled={syncing}
                  onClick={() => handleSyncToSheets(false)}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/15 disabled:opacity-50 cursor-pointer transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
                  {syncing 
                    ? (language === "ar" ? "جاري التموضع في السحابة..." : "Transferring Payload...") 
                    : lastSyncedSheet 
                      ? (language === "ar" ? "تحديث وتحديث تبيانات شيت الحالي" : "Sync Latest ERP Data to Sheet")
                      : (language === "ar" ? "تعديل وإنشاء ملف شيتس ومزامنة" : "Create Sheet and Sync Data")}
                </button>

                {/* Force create brand new file button */}
                {lastSyncedSheet && (
                  <button
                    type="button"
                    disabled={syncing}
                    onClick={handleCreateNewSheet}
                    className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-txtmain border border-borderline/80 font-bold py-2.5 px-3 rounded-xl text-[11px] flex items-center justify-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>{language === "ar" ? "تصدير إلى ملف شيتس جديد كلياً" : "Export to New Google Sheet Container"}</span>
                  </button>
                )}
              </div>

              {/* Status Banner */}
              {statusMsg && (
                <div className={`p-3 rounded-xl text-xs flex gap-2 leading-relaxed animate-in fade-in ${
                  syncStatus === "success" 
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : syncStatus === "error"
                      ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                      : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                }`}>
                  {syncStatus === "success" ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                  <span>{statusMsg}</span>
                </div>
              )}
            </div>
          </div>

          {/* Drive Spreasheets Explorer list on the right */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-cardbk rounded-2xl border border-borderline p-6 space-y-4">
              <div className="flex justify-between items-center border-b border-borderline pb-3">
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-5 h-5 text-amber-500" />
                  <h3 className="font-bold text-sm text-txtmain">
                    {language === "ar" ? "ملفات ومستندات ERP المزامنة في Google Drive" : "Synced Enterprise Notebooks (Google Drive)"}
                  </h3>
                </div>
                
                <button
                  onClick={fetchSpreadsheets}
                  disabled={loadingFiles}
                  title={language === "ar" ? "تحديث قائمة الملفات" : "Refresh files cache"}
                  className="p-1 px-2.5 text-[11px] font-bold border border-borderline bg-appbk hover:bg-borderline/30 rounded-lg text-txtmuted transition-all disabled:opacity-50 flex items-center gap-1 shrink-0"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingFiles ? "animate-spin" : ""}`} />
                  <span>{language === "ar" ? "تحديث" : "Refresh"}</span>
                </button>
              </div>

              <p className="text-[11px] text-txtmuted leading-relaxed">
                {language === "ar"
                  ? "تسرد هذه القائمة آخر مستندات Google Sheets تم إنشاؤها عبر حسابك وتحمل اسم نظام ERP. يتسنى لك تصفحها وفتحها بلمسة واحدة."
                  : "These spreadsheets reside in your active Google Drive context. You can launch them directly in a new tab."}
              </p>

              {loadingFiles ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-3">
                  <div className="w-8 h-8 border-3 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
                  <p className="text-xs font-medium">{t("loading")}</p>
                </div>
              ) : driveFiles.length === 0 ? (
                <div className="py-12 border border-dashed border-borderline rounded-xl flex flex-col items-center justify-center text-txtmuted text-center p-4">
                  <FileSpreadsheet className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-2.5" />
                  <h4 className="font-bold text-xs text-txtmain">{language === "ar" ? "لم نعثر على مستندات مطابقة في درايف" : "No folders found"}</h4>
                  <p className="text-[11px] text-txtmuted mt-1 max-w-xs">
                    {language === "ar" ? "اضغط على زر (إنشاء مستند) لتنفيذ أول عملية مزامنة لبيانات لوحتك المالية." : "Click on sync button to onboard your first synced ERP record file."}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-borderline border border-borderline rounded-xl overflow-hidden bg-appbk">
                  {driveFiles.map((file) => (
                    <div 
                      key={file.id} 
                      className="p-3.5 flex items-center justify-between hover:bg-borderline/10 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-500 border border-emerald-500/20 shrink-0">
                          <FileSpreadsheet className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 text-start">
                          <h4 className="font-bold text-xs text-txtmain truncate" title={file.name}>
                            {file.name}
                          </h4>
                          <span className="text-[10px] text-txtmuted font-mono flex items-center gap-1 mt-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(file.createdTime).toLocaleDateString(language === "ar" ? "ar-SA" : "en-US")}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Quick Register as Main Sheet button */}
                        {lastSyncedSheet?.id !== file.id && (
                          <button
                            onClick={() => {
                              localStorage.setItem(`erp_sync_sheet_id_${selectedCompanyId}`, file.id);
                              localStorage.setItem(`erp_sync_sheet_name_${selectedCompanyId}`, file.name);
                              setLastSyncedSheet({
                                id: file.id,
                                name: file.name,
                                url: file.webViewLink
                              });
                            }}
                            title={language === "ar" ? "تعيين كالمستند الرئيسي لمزامنة الشركة" : "Bind as the primary ERP Spreadsheet"}
                            className="p-1.5 text-txtmuted hover:text-indigo-500 bg-cardbk hover:bg-indigo-500/5 border border-borderline rounded-lg transition-all"
                          >
                            <Link className="w-3.5 h-3.5" />
                          </button>
                        )}
                        
                        <a 
                          href={file.webViewLink} 
                          target="_blank" 
                          rel="noreferrer"
                          title={language === "ar" ? "مراجعة المستند في سحابة Google" : "View Sheet"}
                          className="p-1.5 px-3 bg-cardbk border border-borderline hover:bg-borderline/30 rounded-lg text-txtmain flex items-center gap-1 text-[11px] font-bold"
                        >
                          <span>{language === "ar" ? "استعراض" : "Open"}</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Privacy compliance informational card */}
            <div className="bg-sky-50 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900/30 rounded-2xl p-4 flex gap-3 text-start">
              <Database className="w-5 h-5 text-sky-500 shrink-0 mt-0.5" />
              <div className="text-xs">
                <h4 className="font-bold text-sky-800 dark:text-sky-300">
                  {language === "ar" ? "أمان البيانات وتكامل المعايير المعتمد" : "GDPR Sandbox Trust Compliancy"}
                </h4>
                <p className="text-sky-700/85 dark:text-sky-400/85 mt-1 leading-relaxed">
                  {language === "ar"
                    ? "يتكامل نظام ERP الضريبي مع خوادم قوقل بنظام مصادقة OAuth آمن. لا يحتفظ خادمنا أو يتبادل رموز المزامنة (Access Tokens) بل تُحفظ في ذاكرة متصفح العميل المؤقتة فقط لضمان سلامة وخصوصية أرقام منشأتك."
                    : "SSO access tokens expire natively and are preserved exclusively in volatile local client browser buffers. Our systems never intercept, clone, or serialize user session credentials."}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Custom Monthly Performance Analysis section */}
        <div className="bg-cardbk rounded-2xl border border-borderline p-6 space-y-4 animate-in fade-in duration-300 text-start">
          <div className="flex items-center justify-between border-b border-borderline pb-3.5 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-500 border border-indigo-500/20">
                <ArrowLeftRight className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-txtmain">
                  {language === "ar" ? "تحليل الأداء المالي والربحية الشهري لمستند قوقل" : "Analyzed Monthly Enterprise Financial Ledger"}
                </h3>
                <p className="text-[10px] text-txtmuted mt-0.5">
                  {language === "ar" ? "تجميع لحظي لتدفقات المبيعات، ومصروفات التشغيل، والأرباح وعوائد الأعمال" : "Calculated synthesis of operations, custom invoices, collection progress, and overhead margins"}
                </p>
              </div>
            </div>
            <span className="text-[10px] bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-md font-extrabold uppercase font-mono tracking-wider">
              {language === "ar" ? "مطابق سحابياً" : "Cloud Matched"}
            </span>
          </div>

          {monthlySummary.length === 0 ? (
            <div className="py-12 border border-dashed border-borderline rounded-xl flex flex-col items-center justify-center text-txtmuted text-center p-4">
              <FileSpreadsheet className="w-10 h-10 text-slate-300 dark:text-slate-700 mb-2" />
              <h4 className="font-bold text-xs text-txtmain">{language === "ar" ? "لا تتوفر قيود كافية للتحليل" : "No sufficient entries found"}</h4>
              <p className="text-[10px] text-txtmuted mt-0.5 max-w-xs">
                {language === "ar" ? "سجل بعض العمليات والمبيعات والمصروفات أولاً لتوليد ملخص الربحية الشهري." : "Log operations or operational expenses first to compile historical summary trends."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto border border-borderline rounded-xl bg-appbk">
                <table className="w-full text-xs text-start divide-y divide-borderline">
                  <thead className="bg-slate-50 dark:bg-slate-800/45 text-txtmuted font-bold text-[11px]">
                    <tr>
                      <th className="p-3.5 text-start whitespace-nowrap">{language === "ar" ? "الشهر التمويلي" : "Finance Period"}</th>
                      <th className="p-3.5 text-center whitespace-nowrap">{language === "ar" ? "العمليات" : "Ops"}</th>
                      <th className="p-3.5 text-end whitespace-nowrap">{language === "ar" ? "إيراد مستهدف" : "Target Rev."}</th>
                      <th className="p-3.5 text-end whitespace-nowrap">{language === "ar" ? "تكلفة مباشرة" : "Direct Cost"}</th>
                      <th className="p-3.5 text-end whitespace-nowrap">{language === "ar" ? "المصاريف الجانبية" : "Overheads"}</th>
                      <th className="p-3.5 text-end whitespace-nowrap">{language === "ar" ? "المبالغ المفوترة" : "Invoiced"}</th>
                      <th className="p-3.5 text-end whitespace-nowrap">{language === "ar" ? "المبلّغ المحصل" : "Cash Received"}</th>
                      <th className="p-3.5 text-end whitespace-nowrap">{language === "ar" ? "الذمم المتبقية" : "Unpaid debt"}</th>
                      <th className="p-3.5 text-end whitespace-nowrap">{language === "ar" ? "صافي أرباح الشهر" : "Net Profit"}</th>
                      <th className="p-3.5 text-center whitespace-nowrap">{language === "ar" ? "هامش الربحية" : "Margin"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-borderline/50">
                    {monthlySummary.map((m) => {
                      const margin = m.totalRevenue > 0 ? Math.round((m.netProfit / m.totalRevenue) * 100) : 0;
                      const hasProfit = m.netProfit >= 0;
                      return (
                        <tr key={m.monthKey} className="hover:bg-borderline/5 transition-colors">
                          <td className="p-3.5 font-bold text-txtmain whitespace-nowrap">{m.monthName}</td>
                          <td className="p-3.5 text-center font-mono text-txtmuted">{m.operationsCount} {language === "ar" ? "عقد" : "contracts"}</td>
                          <td className="p-3.5 text-end font-mono text-txtmain font-bold">
                            {(m.totalRevenue).toLocaleString()} <span className="text-[10px] text-txtmuted font-sans font-normal">{companyCurrency}</span>
                          </td>
                          <td className="p-3.5 text-end font-mono text-indigo-500/90">
                            {(m.totalCost).toLocaleString()} <span className="text-[10px] text-txtmuted font-sans font-normal">{companyCurrency}</span>
                          </td>
                          <td className="p-3.5 text-end font-mono text-rose-500">
                            {(m.expenseAmount).toLocaleString()} <span className="text-[10px] text-rose-400 font-sans font-normal">{companyCurrency}</span>
                          </td>
                          <td className="p-3.5 text-end font-mono text-txtmain/95">
                            {(m.invoicedAmount).toLocaleString()} <span className="text-[10px] text-txtmuted font-sans font-normal">{companyCurrency}</span>
                          </td>
                          <td className="p-3.5 text-end font-mono text-emerald-500">
                            {(m.paidAmount).toLocaleString()} <span className="text-[10px] text-emerald-400 font-sans font-normal">{companyCurrency}</span>
                          </td>
                          <td className="p-3.5 text-end font-mono text-amber-500">
                            {(m.unpaidAmount).toLocaleString()} <span className="text-[10px] text-amber-400 font-sans font-normal">{companyCurrency}</span>
                          </td>
                          <td className={`p-3.5 text-end font-mono font-black text-xs ${hasProfit ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                            {hasProfit ? "+" : ""}{(m.netProfit).toLocaleString()} <span className="text-[10px] font-sans font-normal opacity-80">{companyCurrency}</span>
                          </td>
                          <td className="p-3.5 text-center shrink-0">
                            <span className={`inline-block px-2 py-0.5 rounded-md font-mono font-bold text-[10px] ${
                              margin > 40 
                                ? "bg-emerald-500/10 text-emerald-500" 
                                : margin > 0 
                                  ? "bg-amber-500/10 text-amber-500" 
                                  : "bg-rose-500/10 text-rose-500"
                            }`}>
                              {margin}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
