import React, { useState, useMemo, useEffect } from "react";
import { Company, AuditLog } from "../types";
import { useLanguage } from "../lib/LanguageContext";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  CreditCard,
  CheckCircle,
  HelpCircle,
  Calendar,
  AlertTriangle,
  RotateCcw,
  Zap,
  Globe,
  Database,
  Building,
  ShieldCheck,
  ChevronRight,
  UserCheck
} from "lucide-react";

interface SubscriptionProps {
  currentCompany: Company | null;
  companyCurrency: string;
  onRefreshCompanyData: () => Promise<void>;
  auditLogs?: AuditLog[];
}

export default function Subscription({
  currentCompany,
  companyCurrency = "ر.س",
  onRefreshCompanyData,
  auditLogs = []
}: SubscriptionProps) {
  const { language, t } = useLanguage();
  const isAr = language === "ar";

  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"Trial" | "Starter" | "Business" | "Enterprise" | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [cardHolder, setCardHolder] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCVV, setCardCVV] = useState("");
  const [localLogs, setLocalLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    if (currentCompany?.id) {
      fetch("/api/audit-logs", {
        headers: {
          "x-company-id": currentCompany.id
        }
      })
        .then((res) => {
          if (res.ok) return res.json();
          return [];
        })
        .then((data) => {
          setLocalLogs(data);
        })
        .catch((err) => console.error("Failed to load subscription logs:", err));
    }
  }, [currentCompany?.id, success]);

  const currentPlan = currentCompany?.subscription_plan || "Trial";
  const currentStatus = currentCompany?.subscription_status || "Active";
  const currentExpiry = currentCompany?.subscription_expiry || "2026-12-31";
  const currentCycle = currentCompany?.subscription_billing_cycle || "monthly";

  // Subscription plan prices in USD & SAR
  const plans = useMemo(() => {
    const isSar = companyCurrency === "ر.س" || companyCurrency === "SAR";
    const symbol = companyCurrency;
    
    const multiplier = isSar ? 3.75 : 1; // Basic conversion if not SAR or USD, let's keep prices matched

    return [
      {
        id: "Trial" as const,
        nameAr: "الباقة التجريبية",
        nameEn: "Trial Plan",
        priceMonthly: 0,
        priceYearly: 0,
        color: "from-slate-500 to-slate-700",
        textColor: "text-slate-400",
        featuresAr: [
          "دعم حتى 3 عمليات تشغيلية",
          "دعم حتى 3 عملاء فقط",
          "إعداد الميزانية في وضع القراءة فقط",
          "تصاميم فواتير افتراضية قياسية"
        ],
        featuresEn: [
          "Standard default layouts",
          "Up to 3 operational logs",
          "Up to 3 client contacts",
          "Read-only dashboard statistics"
        ],
        badgeAr: "مبتدئ",
        badgeEn: "Sandbox"
      },
      {
        id: "Starter" as const,
        nameAr: "باقة الخطوة الأولى",
        nameEn: "Starter Plan",
        priceMonthly: Math.round(19 * multiplier),
        priceYearly: Math.round(190 * multiplier),
        color: "from-blue-500 to-indigo-600",
        textColor: "text-blue-400",
        featuresAr: [
          "دعم حتى 30 عملية تشغيلية/شهر",
          "دعم حتى 20 عميلاً ومؤسسة",
          "منظومة كشف ضريبي مبسط",
          "تصدير التقارير بصيغة PDF",
          "دعم فني عبر البريد الإلكتروني"
        ],
        featuresEn: [
          "Up to 30 active operations/mo",
          "Up to 20 client accounts",
          "Simplified VAT ledger reporting",
          "PDF report exporting",
          "Email support desk access"
        ],
        badgeAr: "الأنسب للأفراد",
        badgeEn: "For Freelancers"
      },
      {
        id: "Business" as const,
        nameAr: "الباقة التجارية الاحترافية",
        nameEn: "Business Premium",
        priceMonthly: Math.round(49 * multiplier),
        priceYearly: Math.round(490 * multiplier),
        color: "from-indigo-500 to-violet-600",
        textColor: "text-indigo-400",
        featuresAr: [
          "عمليات تشغيلية غير محدودة للخدمات",
          "عملاء غير محدودين للمؤسسة",
          "نظام طباعة الفاتورة الضريبية ZATCA",
          "تعديل الهوية واللون وشعار المنشأة",
          "تزامن تلقائي مع Google Sheets",
          "إدارة المصروفات التشغيلية والرسوم البيانية"
        ],
        featuresEn: [
          "Unlimited operational services",
          "Unlimited corporate client registry",
          "ZATCA compliance and QR generator",
          "Custom branding color and logos",
          "Automatic Google Sheets synchronization",
          "Operational expenses distribution charts"
        ],
        badgeAr: "الأكثر مبيعاً",
        badgeEn: "Popular Choice"
      },
      {
        id: "Enterprise" as const,
        nameAr: "باقة الشركات الكبرى",
        nameEn: "Enterprise Solution",
        priceMonthly: Math.round(149 * multiplier),
        priceYearly: Math.round(1490 * multiplier),
        color: "from-amber-500 to-rose-600",
        textColor: "text-amber-500",
        featuresAr: [
          "قاعدة بيانات سحابية معزولة بالكامل (SQL)",
          "تعديل كامل لواجهة الدخول والصلاحيات",
          "مدير حساب مالي تقني مخصص",
          "توافق ISO 27001 للأمن السيبراني",
          "دعم فني متميز عبر الهاتف والواتساب 24/7",
          "تكامل مخصص مع API الخارجي للمؤسسة"
        ],
        featuresEn: [
          "Fully dedicated sandboxed cloud server",
          "Advanced role and access control governance",
          "Dedicated technical account manager",
          "ISO 27001 and high-security hosting",
          "24/7 priority phone & web support access",
          "Custom API and webhook integrations"
        ],
        badgeAr: "للشركات الرائدة",
        badgeEn: "Scale-up Corporates"
      }
    ];
  }, [companyCurrency]);

  const handleOpenCheckout = (planId: "Trial" | "Starter" | "Business" | "Enterprise") => {
    setSelectedPlan(planId);
    setCardHolder("");
    setCardNumber("");
    setCardExpiry("");
    setCardCVV("");
    setSuccess(false);
    setShowCheckout(true);
  };

  const handleConfirmUpgrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan || !currentCompany) return;

    setLoading(true);
    try {
      const selectedPlanData = plans.find((p) => p.id === selectedPlan);
      const price =
        billingCycle === "yearly"
          ? selectedPlanData?.priceYearly || 0
          : selectedPlanData?.priceMonthly || 0;

      const res = await fetch(`/api/companies/${currentCompany.id}/subscription`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-company-id": currentCompany.id
        },
        body: JSON.stringify({
          subscription_plan: selectedPlan,
          subscription_billing_cycle: billingCycle,
          price_paid: price
        })
      });

      if (!res.ok) {
        throw new Error("حدث خطأ أثناء ترقية الاشتراك");
      }

      setSuccess(true);
      await onRefreshCompanyData();
      setTimeout(() => {
        setShowCheckout(false);
        setSuccess(false);
        setSelectedPlan(null);
      }, 2500);
    } catch (err) {
      console.error(err);
      alert(isAr ? "عذراً، فشل تحديث الاشتراك." : "Failed to update package.");
    } finally {
      setLoading(false);
    }
  };

  // Filter subscription audit logs
  const subLogs = useMemo(() => {
    const logs = localLogs.length > 0 ? localLogs : auditLogs;
    return logs
      .filter((log) => log.action === "ترقية خطة الاشتراك والخدمات" || log.action.includes("خطة الاشتراك") || log.action.includes("الاشتراك"))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [localLogs, auditLogs]);

  return (
    <div className="space-y-6">
      {/* Visual Banner Header */}
      <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 rounded-2xl border border-indigo-500/20 p-6 md:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-full text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isAr ? "تحليل النماذج السحابية والاشتراكات" : "SaaS Instance Control"}</span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white leading-tight">
              {isAr ? "إدارة خطط اشتراكات ومميزات الشركة" : "SaaS Subscription & Plan Portal"}
            </h2>
            <p className="text-xs md:text-sm text-slate-400 max-w-2xl leading-relaxed">
              {isAr
                ? "اختر الباقة المناسبة لتفعيل مميزات إضافية معززة، ورفع قيود عدد العمليات، والعملاء، وتخصيص العلامة التجارية لفواتير ZATCA."
                : "Manage your cloud system limits, expand active records, configure custom PDF designs and synchronize Google Sheets modules instantly."}
            </p>
          </div>

          {/* Current plan badge element */}
          <div className="bg-slate-900/80 border border-slate-700/60 p-5 rounded-xl shrink-0 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Zap className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="text-[10px] text-slate-500 uppercase font-black tracking-wider">
                {isAr ? "الاشتراك الحالي للمنشأة" : "Current Active Plan"}
              </div>
              <div className="text-md font-bold text-slate-100 flex items-center gap-2 mt-0.5">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-sky-400 font-extrabold text-lg">
                  {currentPlan}
                </span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">
                  {isAr ? "نشط ومفعل" : "Fully Active"}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-500" />
                <span>
                  {isAr ? "تاريخ التجديد التالي:" : "Next renewal:"} {currentExpiry}
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Subscription Cycle Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-txtmain text-md">
            {isAr ? "الباقات والأسعار المتاحة" : "Available System Subscriptions"}
          </h3>
          <p className="text-xs text-txtmuted">
            {isAr ? "الأسعار معروضة بناءً على العملة الرسمية المعتمدة لشركتك حالياً." : "Subscription fees are rendered dynamic to your Selected Company Currency."}
          </p>
        </div>

        {/* Pricing toggle */}
        <div className="p-1 bg-cardbk border border-borderline rounded-xl inline-flex self-start sm:self-auto shadow-inner">
          <button
            onClick={() => setBillingCycle("monthly")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              billingCycle === "monthly"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-txtmuted hover:text-txtmain"
            }`}
          >
            {isAr ? "فاتورة شهرية" : "Bill Monthly"}
          </button>
          <button
            onClick={() => setBillingCycle("yearly")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              billingCycle === "yearly"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-txtmuted hover:text-txtmain"
            }`}
          >
            <span>{isAr ? "فاتورة سنوية" : "Bill Yearly"}</span>
            <span className="text-[9px] bg-emerald-500 text-white font-extrabold px-1.5 py-0.5 rounded-md leading-none">
              {isAr ? "وفر 20%" : "Save 20%"}
            </span>
          </button>
        </div>
      </div>

      {/* Pricing Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          const price = billingCycle === "yearly" ? plan.priceYearly : plan.priceMonthly;
          const cycleLabel = billingCycle === "yearly" ? (isAr ? "/سنوياً" : "/yr") : (isAr ? "/شهرياً" : "/mo");

          return (
            <div
              key={plan.id}
              className={`bg-cardbk rounded-2xl border transition-all flex flex-col justify-between overflow-hidden relative ${
                isCurrent
                  ? "border-indigo-500 shadow-lg shadow-indigo-500/5 ring-1 ring-indigo-500/30"
                  : "border-borderline hover:border-slate-700/80 hover:shadow-md"
              }`}
            >
              {/* Highlight header if current */}
              {isCurrent && (
                <div className="bg-indigo-600 text-center text-white py-1.5 text-[10px] font-black uppercase tracking-wider">
                  {isAr ? "باقتك النشطة الحالية" : "Your Current Subscription"}
                </div>
              )}

              {/* Package Details header */}
              <div className="p-6 pb-4 border-b border-borderline">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] bg-slate-500/10 text-txtmuted px-2 py-0.5 rounded-md font-bold text-xs">
                      {isAr ? plan.badgeAr : plan.badgeEn}
                    </span>
                    <h4 className="text-base font-black text-txtmain mt-1.5">
                      {isAr ? plan.nameAr : plan.nameEn}
                    </h4>
                  </div>
                  {isCurrent && (
                    <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                  )}
                </div>

                {/* Price Label */}
                <div className="mt-4 flex items-baseline">
                  {price === 0 ? (
                    <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-200 to-slate-400 font-sans">
                      {isAr ? "مجاني" : "FREE"}
                    </span>
                  ) : (
                    <>
                      <span className="text-2xl font-black text-txtmain font-sans">
                        {price.toLocaleString()}
                      </span>
                      <span className="text-xs text-txtmuted font-bold ms-1">
                        {companyCurrency}
                      </span>
                      <span className="text-[10px] text-txtmuted ms-0.5">
                        {cycleLabel}
                      </span>
                    </>
                  )}
                </div>
                {billingCycle === "yearly" && price > 0 && (
                  <p className="text-[9px] text-emerald-400 font-bold mt-1">
                    {isAr ? `توفير مع التجديد السنوي` : `Includes extra premium discounts`}
                  </p>
                )}
              </div>

              {/* Plan limits info panel */}
              <div className="p-6 pt-5 space-y-4 flex-grow">
                <div className="text-[10px] text-txtmuted uppercase font-bold tracking-wider">
                  {isAr ? "المميزات والحدود المتاحة" : "Features & Records Limits"}
                </div>
                <ul className="space-y-3">
                  {(isAr ? plan.featuresAr : plan.featuresEn).map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-txtmain leading-relaxed">
                      <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-1.5 shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* CTA Upgrade Trigger Button */}
              <div className="p-6 border-t border-borderline bg-appbk/40">
                {isCurrent ? (
                  <button
                    disabled
                    className="w-full text-center py-2.5 bg-slate-800 text-slate-500 rounded-xl text-xs font-bold font-sans cursor-default"
                  >
                    {isAr ? "الباقة مفعلة حالياً" : "Currently Active Plan"}
                  </button>
                ) : (
                  <button
                    onClick={() => handleOpenCheckout(plan.id)}
                    className="w-full text-center py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 active:scale-[0.98] text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
                  >
                    {isAr ? `تفعيل أو ترقية إلى (${plan.id})` : `Upgrade to ${plan.id}`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Subscription FAQ and ISO Block */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-cardbk rounded-2xl border border-borderline p-6 space-y-4">
          <h3 className="font-bold text-md text-txtmain flex items-center gap-2 pb-2 border-b border-borderline">
            <HelpCircle className="w-5 h-5 text-indigo-500" />
            <span>{isAr ? "الأسئلة الشائعة وسياسات الدفع" : "Subscription Billing Rules"}</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-txtmain">
                {isAr ? "هل يمكنني الترقية أو إلغاء الاشتراك في أي وقت؟" : "Can I upgrade or downgrade anytime?"}
              </h4>
              <p className="text-[11px] text-txtmuted leading-relaxed">
                {isAr
                  ? "نعم، يمكنك تعديل باقة الاشتراك الحالية والترقية فوراً للحصول على المزيد من السعة. يعاد حساب مبالغ الفواتيرة بصورة تناسبية."
                  : "Yes, you can upgrade your plan at any point. Your storage limits and client capacities will instantly scale to match the upgraded plan."}
              </p>
            </div>

            <div className="space-y-1">
              <h4 className="text-xs font-bold text-txtmain">
                {isAr ? "هل فواتير ZATCA والرموز معتمدة؟" : "Are ZATCA basic invoices supported?"}
              </h4>
              <p className="text-[11px] text-txtmuted leading-relaxed">
                {isAr
                  ? "نعم، إن فواتير الباقتين التجارية والشركات مجهزة لدعم متطلبات هيئة الزكاة والضريبة والجمارك كفواتير مبسطة بالرمز الذاتي QR."
                  : "Absolutely, starter and premium plans generate fully compliant basic simplified tax invoices featuring real-time generated secure QR codes."}
              </p>
            </div>

            <div className="space-y-1">
              <h4 className="text-xs font-bold text-txtmain">
                {isAr ? "كيف تحتسب العملات المختلفة في التحصيل المالي؟" : "How are multiple currencies handled?"}
              </h4>
              <p className="text-[11px] text-txtmuted leading-relaxed">
                {isAr
                  ? "يحتسب الاشتراك ويعرض تلقائياً بناءً على العملة التي اخترتها كعملة رسمية في المنشأة الحالية لتجنب فارق الصرف البنكي."
                  : "Subscription pricing dynamically translates to the selected base currency in your accounting set-up to preserve localized ledger consistency."}
              </p>
            </div>

            <div className="space-y-1">
              <h4 className="text-xs font-bold text-txtmain">
                {isAr ? "هل بياناتي معزولة ومحمية؟" : "Is my company SaaS data isolated?"}
              </h4>
              <p className="text-[11px] text-txtmuted leading-relaxed">
                {isAr
                  ? "نعم، يتم عزل بيانات كل منشأة على حدة (Schema-Level Isolation) لضمان عدم تداخل الفواتير والعمليات مع الحسابات الأخرى."
                  : "Our system isolates each business unit under its separate storage sandbox, rendering financial files completely cross-contamination safe."}
              </p>
            </div>
          </div>
        </div>

        {/* Security Shield Info */}
        <div className="bg-gradient-to-br from-indigo-950/40 to-slate-900 border border-borderline rounded-2xl p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                {isAr ? "أمان مدفوعات معتمد ومحمي" : "Secure Verified Payments"}
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {isAr
                  ? "عملية الترقية والدفع مشفرة بالكامل بنسبة 100٪ ببروتوكولات الأمان ومتوافقة مع معايير PCI-DSS وهيئة الأمن السيبراني."
                  : "All subscription upgrading processes are fully compliant with standard PCI-DSS specifications. Payment cards are never stored on plain text databases."}
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800/80 mt-4 flex items-center justify-between text-[10px] text-slate-500">
            <span>ISO 27001 Secure Node</span>
            <span>PCI-DSS Secured</span>
          </div>
        </div>
      </div>

      {/* Subscription Audit Logs History */}
      <div className="bg-cardbk rounded-2xl border border-borderline p-6">
        <h3 className="font-bold text-md text-txtmain pb-2 border-b border-borderline">
          {isAr ? "سجل اشتراكات وعمليات المنشأة الحالية" : "SaaS Upgrade & Subscription History"}
        </h3>

        {subLogs.length === 0 ? (
          <div className="py-8 text-center text-txtmuted">
            <p className="text-xs">
              {isAr ? "لا توجد ترقيات سابقة مسجلة لهذه المنشأة." : "No historic payment operations detected for this tenant."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-xs text-right whitespace-nowrap">
              <thead>
                <tr className="text-txtmuted border-b border-borderline pb-2">
                  <th className="py-2.5 px-2 text-start">{isAr ? "الحدث / الحركة" : "Event / Log"}</th>
                  <th className="py-2.5 px-2 text-start">{isAr ? "التفاصيل" : "Details"}</th>
                  <th className="py-2.5 px-2 text-center">{isAr ? "المستخدم" : "Responsible Employee"}</th>
                  <th className="py-2.5 px-2 text-center">{isAr ? "التاريخ ووقت التسجيل" : "Timestamp"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderline">
                {subLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/20 text-txtmain">
                    <td className="py-3 px-2 font-bold text-start flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                      <span>{log.action}</span>
                    </td>
                    <td className="py-3 px-2 text-start text-txtmuted leading-normal max-w-sm truncate">
                      {log.details}
                    </td>
                    <td className="py-3 px-2 text-center font-mono text-[11px] text-txtmuted">{log.user}</td>
                    <td className="py-3 px-2 text-center text-txtmuted font-mono">
                      {new Date(log.timestamp).toLocaleString(undefined, {
                        dateStyle: "short",
                        timeStyle: "short"
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Elegant Simulated Checkout Modal Component */}
      <AnimatePresence>
        {showCheckout && selectedPlan && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-cardbk border border-borderline rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative"
            >
              <div className="bg-gradient-to-r from-indigo-700 to-indigo-800 p-5 text-white flex items-center justify-between">
                <div>
                  <h4 className="font-extrabold text-sm">{isAr ? "بوابة الدفع التلقائي الآمنة" : "Secure Payment Portal"}</h4>
                  <p className="text-[10px] text-indigo-100 flex items-center gap-1 mt-0.5">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    <span>{isAr ? "مشفر وآمن بالكامل (SSL)" : "Secured, ISO 27001 Compliant Node"}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCheckout(false)}
                  className="text-white hover:text-indigo-200 text-xs font-bold cursor-pointer bg-black/10 px-2.5 py-1 rounded-md"
                >
                  {isAr ? "إلغاء" : "Close"}
                </button>
              </div>

              <div className="p-6">
                {success ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="py-12 text-center space-y-4"
                  >
                    <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20">
                      <CheckCircle className="w-8 h-8 animate-bounce" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-black text-txtmain text-md">
                        {isAr ? "تهانينا! تم تفعيل اشتراكك بنجاح" : "Subscription Activated Successfully!"}
                      </h4>
                      <p className="text-xs text-txtmuted">
                        {isAr
                          ? "تمت ترقية المنشأة وإعادة إعداد قيود الحساب لتكون صالحة للاستخدام."
                          : "Your business unit limits are successfully restructured in real time."}
                      </p>
                    </div>
                  </motion.div>
                ) : (
                  <form onSubmit={handleConfirmUpgrade} className="space-y-4">
                    {/* Invoice items panel summary */}
                    <div className="bg-appbk rounded-xl p-4 border border-borderline text-xs space-y-2">
                      <div className="flex justify-between items-center text-txtmuted">
                        <span>{isAr ? "المنشأة المستفيدة:" : "Beneficiary tenant:"}</span>
                        <span className="font-bold text-txtmain">{currentCompany?.name}</span>
                      </div>
                      <div className="flex justify-between items-center text-txtmuted">
                        <span>{isAr ? "الترقية للمنتج الرقمي:" : "Upgraded service plan:"}</span>
                        <span className="font-bold text-indigo-400">{selectedPlan}</span>
                      </div>
                      <div className="flex justify-between items-center text-txtmuted">
                        <span>{isAr ? "دورية إصدار الفواتير:" : "Billing frequency:"}</span>
                        <span className="font-bold text-txtmain capitalize">{isAr && billingCycle === "yearly" ? "سنوي (20% توفير)" : billingCycle}</span>
                      </div>
                      <hr className="border-borderline/60" />
                      <div className="flex justify-between items-center text-sm font-bold text-txtmain">
                        <span>{isAr ? "الإجمالي المطلوب للتجهيز:" : "Grand Total Due:"}</span>
                        <span>
                          {billingCycle === "yearly"
                            ? plans.find((p) => p.id === selectedPlan)?.priceYearly.toLocaleString()
                            : plans.find((p) => p.id === selectedPlan)?.priceMonthly.toLocaleString()}{" "}
                          {companyCurrency}
                        </span>
                      </div>
                    </div>

                    {/* Sim card credentials */}
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-txtmain mb-1">
                          {isAr ? "اسم حامل بطاقة الدفع الالكتروني *" : "Card Holder Name *"}
                        </label>
                        <input
                          type="text"
                          required
                          value={cardHolder}
                          onChange={(e) => setCardHolder(e.target.value)}
                          placeholder={isAr ? "مثال: عوض الزهراني" : "e.g. Awadh Al-Zahrani"}
                          className="w-full bg-appbk border border-borderline rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 text-txtmain text-start"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-txtmain mb-1">
                          {isAr ? "رقم بطاقة الائتمان / مدى *" : "Credit / Mada Card Number *"}
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            required
                            maxLength={19}
                            value={cardNumber}
                            onChange={(e) => {
                              // Fast auto spacing format helper for credit card
                              const val = e.target.value.replace(/\D/g, "");
                              const matches = val.match(/\d{4,16}/g);
                              const match = (matches && matches[0]) || "";
                              const parts = [];
                              for (let i = 0, len = match.length; i < len; i += 4) {
                                parts.push(match.substring(i, i + 4));
                              }
                              if (parts.length > 0) {
                                setCardNumber(parts.join(" "));
                              } else {
                                setCardNumber(val);
                              }
                            }}
                            placeholder="4000 1234 5678 9010"
                            className="w-full bg-appbk border border-borderline rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 text-txtmain tracking-widest text-start"
                          />
                          <CreditCard className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-txtmain mb-1">
                            {isAr ? "تاريخ معيار الانتهاء (MM/YY) *" : "Expiry Date (MM/YY) *"}
                          </label>
                          <input
                            type="text"
                            required
                            maxLength={5}
                            value={cardExpiry}
                            onChange={(e) => {
                              let val = e.target.value.replace(/\D/g, "");
                              if (val.length > 2) {
                                val = val.substring(0, 2) + "/" + val.substring(2);
                              }
                              setCardExpiry(val);
                            }}
                            placeholder="12/29"
                            className="w-full bg-appbk border border-borderline rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 text-txtmain text-center"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-txtmain mb-1">
                            {isAr ? "الرمز الأمني (CVV) *" : "Secure CVV *"}
                          </label>
                          <input
                            type="password"
                            required
                            maxLength={3}
                            value={cardCVV}
                            onChange={(e) => setCardCVV(e.target.value.replace(/\D/g, ""))}
                            placeholder="•••"
                            className="w-full bg-appbk border border-borderline rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 text-txtmain text-center tracking-widest"
                          />
                        </div>
                      </div>
                    </div>

                    <p className="text-[9px] text-txtmuted text-start leading-normal">
                      * {isAr ? "بالنقر على الترقية، فإنك تأذن بتفعيل هذه الهوية وتحديث رصيد العمليات المرتبط بقاعدة بيانات هذه المنشأة حالياً." : "By confirming transaction, you authorize updating internal record limit pools and activating this enterprise plan configuration."}
                    </p>

                    {/* Confirm Button */}
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3 mt-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-extrabold rounded-xl text-xs transition-all shadow-md shadow-emerald-600/10 active:scale-[0.98] cursor-pointer"
                    >
                      {loading ? (isAr ? "جاري الترخيص والتحقق..." : "Processing...") : (isAr ? `تأكيد الدفع والتفعيل (${billingCycle === "yearly" ? "سنوياً" : "شهرياً"})` : "Confirm Secure Payment")}
                    </button>
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
