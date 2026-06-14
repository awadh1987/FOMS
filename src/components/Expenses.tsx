import React, { useState, useEffect, useMemo } from "react";
import { Expense } from "../types";
import {
  Coins,
  Plus,
  Trash2,
  Calendar,
  Home,
  UserCheck,
  Cloud,
  Zap,
  Megaphone,
  Briefcase,
  Search,
  DollarSign,
  TrendingDown,
  Info,
  Paperclip,
  Sparkles
} from "lucide-react";
import { useLanguage } from "../lib/LanguageContext";
import { motion } from "motion/react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

interface ExpensesProps {
  companyCurrency?: string;
  selectedCompanyId: string;
  onRefreshStats: () => void;
}

export default function Expenses({
  companyCurrency = "ر.س",
  selectedCompanyId,
  onRefreshStats
}: ExpensesProps) {
  const { language, t } = useLanguage();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Form states
  const [category, setCategory] = useState("rent");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<"weekly" | "monthly" | "yearly" | "once">("monthly");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [categorizing, setCategorizing] = useState(false);
  const [suggestion, setSuggestion] = useState<{ category: string; confidence: number; reasoning: string } | null>(null);

  const handleSmartCategorize = async () => {
    if (!description.trim()) {
      setErrorMsg(language === "ar" ? "يرجى كتابة وصف المصروف أولاً لتصنيفه ذكياً" : "Please input an expense description first to run smart classification");
      return;
    }

    setCategorizing(true);
    setErrorMsg("");
    setSuccessMsg("");
    setSuggestion(null);

    try {
      const res = await fetch("/api/expenses/categorize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ description: description.trim() })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData?.error || "فشل التصنيف الذكي");
      }

      const data = await res.json();
      if (data && data.category) {
        setCategory(data.category);
        setSuggestion(data);
        setSuccessMsg(language === "ar" ? "تم تحديد الفئة المقترحة بواسطة الذكاء الاصطناعي!" : "Auto-detected category using Gemini AI!");
      } else {
        throw new Error("استجابة غير صالحة من خادم الذكاء الاصطناعي");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(
        language === "ar"
          ? `عذراً، فشل التصنيف الذكي: ${err.message || ""}`
          : `Failed to classify: ${err.message || ""}`
      );
    } finally {
      setCategorizing(false);
    }
  };

  // Filter state
  const [search, setSearch] = useState("");

  const getHeaders = () => {
    return {
      "Content-Type": "application/json",
      "x-company-id": selectedCompanyId
    };
  };

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/expenses", { headers: getHeaders() });
      if (!res.ok) throw new Error("تعذر تحميل المصروفات");
      const data = await res.json();
      setExpenses(data);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(language === "ar" ? "فشل قراءة المصروفات التشغيلية" : "Failed to load operational expenses");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [selectedCompanyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      setErrorMsg(language === "ar" ? "يرجى إدخال مبلغ صحيح أكبر من الصفر" : "Please input a positive non-zero amount");
      return;
    }

    setSaving(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          category,
          amount: Number(amount),
          frequency,
          date,
          description
        })
      });

      if (!res.ok) throw new Error("فشل الحفظ");

      // Reset form
      setAmount("");
      setDescription("");
      setDate(new Date().toISOString().split("T")[0]);

      setSuccessMsg(language === "ar" ? "تم تسجيل المصروف الدوري بنجاح" : "Operational expense recorded successfully");
      await fetchExpenses();
      onRefreshStats(); // Update dashboard values
    } catch (err: any) {
      console.error(err);
      setErrorMsg(language === "ar" ? "حدث خطأ أثناء حفظ المصروف" : "An error occurred while saving the expense");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(language === "ar" ? "هل أنت متأكد من حذف هذا المصروف التشغيلي؟" : "Are you sure you want to delete this operational expense?")) {
      return;
    }

    try {
      const res = await fetch(`/api/expenses/${id}`, {
        method: "DELETE",
        headers: getHeaders()
      });

      if (!res.ok) throw new Error("فشل الحذف");

      setSuccessMsg(language === "ar" ? "تم حذف المصروف بنجاح" : "Expense deleted successfully");
      await fetchExpenses();
      onRefreshStats(); // Update dashboard values
    } catch (err: any) {
      console.error(err);
      setErrorMsg(language === "ar" ? "حدث خطأ أثناء حذف المصروف" : "An error occurred while deleting the expense");
    }
  };

  // Get localized category name
  const getCategoryName = (cat: string) => {
    switch (cat) {
      case "rent":
        return t("exp_category_rent");
      case "salaries":
        return t("exp_category_salaries");
      case "office_supplies":
        return t("exp_category_office_supplies");
      case "subscriptions":
        return t("exp_category_subscriptions");
      case "utilities":
        return t("exp_category_utilities");
      case "marketing":
        return t("exp_category_marketing");
      default:
        return t("exp_category_other");
    }
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case "rent":
        return <Home className="w-4 h-4 text-amber-500" />;
      case "salaries":
        return <UserCheck className="w-4 h-4 text-emerald-500" />;
      case "office_supplies":
        return <Paperclip className="w-4 h-4 text-cyan-500" />;
      case "subscriptions":
        return <Cloud className="w-4 h-4 text-blue-500" />;
      case "utilities":
        return <Zap className="w-4 h-4 text-amber-400" />;
      case "marketing":
        return <Megaphone className="w-4 h-4 text-indigo-500" />;
      default:
        return <Briefcase className="w-4 h-4 text-slate-500" />;
    }
  };

  const getFrequencyName = (freq: string) => {
    switch (freq) {
      case "weekly":
        return t("exp_freq_weekly");
      case "yearly":
        return t("exp_freq_yearly");
      case "once":
        return t("exp_freq_once");
      default:
        return t("exp_freq_monthly");
    }
  };

  // Filter list
  const filtered = expenses.filter(exp => {
    const term = search.toLowerCase();
    const matchesDesc = (exp.description || "").toLowerCase().includes(term);
    const matchesCat = getCategoryName(exp.category).toLowerCase().includes(term);
    return matchesDesc || matchesCat;
  });

  // Monthly Recurring Burden Estimate
  const monthlyRecurringBurden = expenses.reduce((sum, exp) => {
    const amt = exp.amount;
    switch (exp.frequency) {
      case "weekly":
        return sum + amt * 4;
      case "monthly":
        return sum + amt;
      case "yearly":
        return sum + amt / 12;
      case "once":
        // Distribute manual one-time expenses over monthly estimate mildly or exclude based on taste
        return sum + amt / 12;
      default:
        return sum + amt;
    }
  }, 0);

  // Aggregated data for Pie Chart showing distribution per category
  const categorySummary = useMemo(() => {
    const summary: Record<string, number> = {};
    expenses.forEach((e) => {
      summary[e.category] = (summary[e.category] || 0) + Number(e.amount);
    });

    const totalAmount = Object.values(summary).reduce((a, b) => a + b, 0);

    const colors: Record<string, string> = {
      rent: "#eab308", // Yellow/Amber
      salaries: "#10b981", // Emerald
      office_supplies: "#06b6d4", // Cyan
      subscriptions: "#3b82f6", // Blue
      utilities: "#f97316", // Orange
      marketing: "#6366f1", // Indigo
      other: "#94a3b8" // Slate
    };

    return Object.entries(summary).map(([cat, val]) => ({
      name: getCategoryName(cat),
      category: cat,
      value: val,
      color: colors[cat] || "#94a3b8",
      percentage: totalAmount > 0 ? ((val / totalAmount) * 100).toFixed(1) : "0"
    })).sort((a, b) => b.value - a.value);
  }, [expenses, language]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-txtmain flex items-center gap-2">
            <Coins className="w-6 h-6 text-red-500" />
            {t("exp_title")}
          </h2>
          <p className="text-txtmuted text-sm mt-1 max-w-2xl">{t("exp_desc")}</p>
        </div>

        {/* Dynamic Burden Counter Widget */}
        <div className="bg-rose-50 dark:bg-rose-950/20 text-rose-800 dark:text-rose-300 px-5 py-3 rounded-2xl border border-rose-100 dark:border-rose-900/35 flex items-center gap-3">
          <div className="w-10 h-10 bg-rose-500/10 rounded-xl flex items-center justify-center border border-rose-500/20 text-rose-600 dark:text-rose-400">
            <TrendingDown className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-rose-500/90 tracking-wider">
              {t("exp_total_monthly_recurring")}
            </span>
            <p className="text-lg font-black leading-tight">
              {monthlyRecurringBurden.toLocaleString("ar-SA", { maximumFractionDigits: 1 })}{" "}
              <span className="text-xs font-medium">{companyCurrency}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Instant Success / Error Banners */}
      {successMsg && (
        <div className="p-4 bg-emerald-600 text-white rounded-2xl text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200">
          <span>✓ {successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-4 bg-rose-600 text-white rounded-2xl text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200">
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Record Expense Form Block */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-cardbk rounded-2xl border border-borderline p-6 space-y-4">
            <h3 className="font-bold text-md text-txtmain border-b border-borderline pb-2">
              {t("exp_add_title")}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4 text-start">
              {/* Category */}
              <div>
                <label className="block text-txtmain text-xs font-bold mb-1.5">
                  {t("exp_category_label")}
                </label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full bg-appbk border border-borderline text-txtmain rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-600 transition-colors"
                >
                  <option value="rent">{t("exp_category_rent")}</option>
                  <option value="salaries">{t("exp_category_salaries")}</option>
                  <option value="office_supplies">{t("exp_category_office_supplies")}</option>
                  <option value="subscriptions">{t("exp_category_subscriptions")}</option>
                  <option value="utilities">{t("exp_category_utilities")}</option>
                  <option value="marketing">{t("exp_category_marketing")}</option>
                  <option value="other">{t("exp_category_other")}</option>
                </select>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-txtmain text-xs font-bold mb-1.5">
                  {t("exp_amount_label")} ({companyCurrency})
                </label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full bg-appbk border border-borderline text-txtmain rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-600 transition-colors placeholder-slate-400"
                  required
                  min="1"
                  step="any"
                />
              </div>

              {/* Recurrence Periodicity */}
              <div>
                <label className="block text-txtmain text-xs font-bold mb-1.5">
                  {t("exp_frequency_label")}
                </label>
                <select
                  value={frequency}
                  onChange={e => setFrequency(e.target.value as any)}
                  className="w-full bg-appbk border border-borderline text-txtmain rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-600 transition-colors"
                >
                  <option value="weekly">{t("exp_freq_weekly")}</option>
                  <option value="monthly">{t("exp_freq_monthly")}</option>
                  <option value="yearly">{t("exp_freq_yearly")}</option>
                  <option value="once">{t("exp_freq_once")}</option>
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-txtmain text-xs font-bold mb-1.5">
                  {t("exp_date_label")}
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full bg-appbk border border-borderline text-txtmain rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-600 transition-colors"
                  required
                />
              </div>

              {/* Description Statement */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-txtmain text-xs font-bold">
                    {t("exp_desc_label")}
                  </label>
                  <button
                    type="button"
                    onClick={handleSmartCategorize}
                    disabled={categorizing || !description.trim()}
                    className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-500 hover:text-indigo-400 disabled:opacity-40 transition-opacity cursor-pointer bg-indigo-500/5 hover:bg-indigo-500/10 px-2 py-1 rounded-lg border border-indigo-500/10"
                    title={language === "ar" ? "تحديد الفئة بشكل تلقائي بالذكاء الاصطناعي" : "AI auto-classify this expense"}
                  >
                    <Sparkles className={`w-3 h-3 ${categorizing ? "animate-spin text-amber-500" : "text-indigo-400"}`} />
                    <span>
                      {categorizing 
                        ? (language === "ar" ? "جاري التصنيف..." : "Classifying...") 
                        : (language === "ar" ? "تصنيف ذكي" : "AI Smart Categorize")}
                    </span>
                  </button>
                </div>
                <textarea
                  placeholder={t("exp_desc_placeholder")}
                  value={description}
                  onChange={e => {
                    setDescription(e.target.value);
                    if (suggestion) setSuggestion(null); // Clear suggestion on edit
                  }}
                  className="w-full bg-appbk border border-borderline text-txtmain rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-indigo-600 transition-colors placeholder-slate-400 h-20 resize-none text-start"
                  required
                />

                {suggestion && (
                  <div className="mt-2.5 p-3 bg-indigo-500/5 text-indigo-400 rounded-xl border border-indigo-500/10 text-xs space-y-1">
                    <div className="flex items-center justify-between font-bold">
                      <span className="flex items-center gap-1 text-[11px] text-indigo-300">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                        {language === "ar" ? "اقتراح الذكاء الاصطناعي" : "Gemini AI Category"}
                      </span>
                      <span className="text-[10px] bg-indigo-500/10 px-1.5 py-0.5 rounded-md font-mono text-indigo-300">
                        {(suggestion.confidence * 100).toFixed(0)}% Match
                      </span>
                    </div>
                    <p className="text-[11px] text-txtmuted leading-relaxed">
                      {suggestion.reasoning}
                    </p>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-rose-600/10 transition-colors disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                {saving ? (language === "ar" ? "تسجيل..." : "Recording...") : t("exp_submit_btn")}
              </button>
            </form>
          </div>

          {/* Categorized Expense Distribution Pie Chart */}
          <div className="bg-cardbk rounded-2xl border border-borderline p-6 space-y-4">
            <h3 className="font-bold text-sm text-txtmain border-b border-borderline pb-2.5">
              {language === "ar" ? "تحليل توزيع المصروفات التشغيلية" : "Operational Expenses Breakdown"}
            </h3>

            {expenses.length === 0 ? (
              <div className="py-12 text-center text-txtmuted">
                <p className="text-xs">{language === "ar" ? "لا توجد مصروفات مسجلة لعرض التوزيع البياني حالياً." : "No recorded expenses to display visual distribution yet."}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Recharts Pie Donut */}
                <div className="h-[180px] w-full flex items-center justify-center relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categorySummary}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {categorySummary.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => [`${Number(value).toLocaleString()} ${companyCurrency}`, ""]}
                        contentStyle={{
                          backgroundColor: "#1e293b",
                          borderColor: "#334155",
                          borderRadius: "12px",
                          color: "#f8fafc",
                          fontFamily: "inherit",
                          fontSize: "11px",
                          textAlign: language === "ar" ? "right" : "left"
                        }}
                        itemStyle={{ color: "#f8fafc" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Absolute Center Counter */}
                  <div className="absolute flex flex-col items-center justify-center pointer-events-none text-center">
                    <span className="text-[9px] text-txtmuted uppercase font-bold tracking-wider">
                      {language === "ar" ? "إجمالي المصاريف" : "Total Outflow"}
                    </span>
                    <span className="text-[13px] font-black text-txtmain font-sans mt-0.5">
                      {expenses.reduce((sum, e) => sum + Number(e.amount), 0).toLocaleString()}
                    </span>
                    <span className="text-[8.5px] text-txtmuted font-medium">
                      {companyCurrency}
                    </span>
                  </div>
                </div>

                {/* Elegant Custom Mini Table-Legend with Progress Bars */}
                <div className="space-y-2.5 pt-2 max-h-[220px] overflow-y-auto pr-1">
                  {categorySummary.map((entry) => (
                    <div key={entry.category} className="text-[11px] space-y-1 text-right select-none">
                      <div className="flex items-center justify-between font-medium">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                          <span className="text-txtmain font-bold text-xs">{entry.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-txtmuted font-mono text-[10.5px]">
                          <span>{entry.value.toLocaleString()} {companyCurrency}</span>
                          <span className="text-[9px] bg-sky-500/10 text-sky-500 dark:text-sky-400 font-bold px-1.5 py-0.5 rounded-md">
                            {entry.percentage}%
                          </span>
                        </div>
                      </div>
                      
                      {/* Interactive Visual Progress Bar */}
                      <div className="w-full bg-appbk border border-borderline/40 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${entry.percentage}%`, backgroundColor: entry.color }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Expenses List ledger Ledger Block */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-cardbk rounded-2xl border border-borderline p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="font-bold text-md text-txtmain">
                  {t("exp_ledger_title")}
                </h3>
              </div>

              {/* Quick Search */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute top-3 flex items-center left-3" />
                <input
                  type="text"
                  placeholder={t("exp_search_placeholder")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-appbk border border-borderline rounded-xl pl-9 pr-3.5 py-2 text-xs focus:outline-none focus:border-indigo-600 transition-colors placeholder-slate-400"
                />
              </div>
            </div>

            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-3">
                <div className="w-8 h-8 border-3 border-slate-200 border-t-rose-600 rounded-full animate-spin" />
                <p className="text-xs font-medium">{t("loading")}</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-12 border-2 border-dashed border-borderline rounded-xl flex flex-col items-center justify-center text-txtmuted">
                <Coins className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-3" />
                <p className="text-xs font-semibold">{t("exp_no_expenses")}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-borderline text-txtmuted">
                      <th className="py-3 px-4 font-bold text-start">{t("exp_col_category")}</th>
                      <th className="py-3 px-4 font-bold text-start">{t("exp_col_desc")}</th>
                      <th className="py-3 px-4 font-bold text-start">{t("exp_col_freq")}</th>
                      <th className="py-3 px-4 font-bold text-start">{t("exp_col_date")}</th>
                      <th className="py-3 px-4 font-bold text-start">{t("exp_col_amount")}</th>
                      <th className="py-3 px-4 font-bold text-center">{t("db_col_action")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-borderline">
                    {filtered.map((exp) => (
                      <tr
                        key={exp.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors"
                      >
                        {/* Category */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2 font-bold text-txtmain">
                            <span className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg shrink-0">
                              {getCategoryIcon(exp.category)}
                            </span>
                            <span>{getCategoryName(exp.category)}</span>
                          </div>
                        </td>

                        {/* Statement (Description) */}
                        <td className="py-3 px-4 max-w-[200px] truncate text-txtmuted font-medium">
                          {exp.description || "—"}
                        </td>

                        {/* Frequency */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${
                            exp.frequency === "once"
                              ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                              : exp.frequency === "weekly"
                              ? "bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400"
                              : "bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400"
                          }`}>
                            {getFrequencyName(exp.frequency)}
                          </span>
                        </td>

                        {/* Rent/Outflow Date */}
                        <td className="py-3 px-4 whitespace-nowrap text-txtmuted font-mono">
                          {exp.date}
                        </td>

                        {/* Amount */}
                        <td className="py-3 px-4 whitespace-nowrap font-black text-rose-600 dark:text-rose-400">
                          - {exp.amount.toLocaleString()} {companyCurrency}
                        </td>

                        {/* Action buttons */}
                        <td className="py-3 px-4 whitespace-nowrap text-center">
                          <button
                            onClick={() => handleDelete(exp.id)}
                            className="p-1.5 text-txtmuted hover:text-red-600 dark:hover:text-red-400 bg-appbk hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors"
                            title={t("delete")}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Quick Notice Card */}
          <div className="bg-sky-50 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900/30 rounded-2xl p-4 flex gap-3 text-start">
            <Info className="w-5 h-5 text-sky-500 shrink-0 mt-0.5" />
            <div className="text-xs">
              <h4 className="font-bold text-sky-800 dark:text-sky-300">
                {language === "ar" ? "تأثير المصروفات على الأرباح" : "Bottom-line Profit Impact"}
              </h4>
              <p className="text-sky-700/85 dark:text-sky-400/85 mt-1 leading-relaxed">
                {language === "ar"
                  ? "تُخصم هذه المصروفات المسجلة تلقائياً من 'صافي الأرباح التشغيلية' لتمنح الإدارة العليا وشركاء المنشأة رؤية واقعية ودقيقة لربحية الشركة وصافي هامش الربح بعد المصاريف الثابتة."
                  : "These entries are automatically subtracted from your Net Operating Profits, providing leadership and partners with a realistic accounting of cash-flow and net profit margin after fixed burden deduction."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
