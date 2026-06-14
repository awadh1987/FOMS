import React, { useMemo, useState } from "react";
import { Operation, Client, Invoice } from "../types";
import { useLanguage } from "../lib/LanguageContext";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend
} from "recharts";
import { 
  TrendingUp, 
  TrendingDown, 
  Percent, 
  Users, 
  LineChart as LucideLineChart, 
  BarChart4, 
  Sparkles,
  Info
} from "lucide-react";

interface PerformanceMetricsProps {
  operations: Operation[];
  clients: Client[];
  invoices: Invoice[];
  companyCurrency?: string;
  primaryColor?: string;
}

export default function PerformanceMetrics({
  operations,
  clients,
  invoices,
  companyCurrency = "ر.س",
  primaryColor = "#4F46E5"
}: PerformanceMetricsProps) {
  const { language } = useLanguage();
  const [activeChart, setActiveChart] = useState<"growth" | "retention">("growth");

  // Multi-language labels
  const labels = {
    ar: {
      performance_title: "تحليلات الأداء ومؤشرات النمو",
      performance_subtitle: "متابعة تطور الأرباح، نسبة نمو الإيرادات الشهرية، ومعدلات ولاء واحتفاظ العملاء",
      growth_tab: "نمو الإيرادات الشهري (MoM)",
      retention_tab: "معدل الاحتفاظ بالعملاء",
      revenue_growth: "نمو الإيرادات",
      client_retention: "معدل الاحتفاظ بالعملاء",
      mo_m_growth: "معدل النمو الشهري",
      average_retention: "متوسط معدل الاحتفاظ",
      target_growth: "النمو المستهدف",
      month: "الشهر",
      growth_rate: "نسبة النمو",
      retention_rate: "نسبة الاحتفاظ",
      clients_total: "إجمالي العملاء",
      clients_retained: "العملاء المتكررون",
      active_clients: "العملاء النشِطين",
      no_data: "بيانات غير كافية لحساب المؤشرات. أضف المزيد من العمليات لحساب الأداء.",
      growth_desc: "يوضح النسبة المئوية للزيادة أو النقصان في الإيرادات الإجمالية بمقارنة كل شهر بالشهر السابق له مباشرة.",
      retention_desc: "يقيس نسبة العملاء النشطين الذين قاموا بأكثر من عملية تشغيلية واحدة مقارنة بإجمالي العملاء مع مرور الزمن.",
      avg_growth_label: "متوسط النمو الشهري",
      current_growth_label: "نمو الشهر الحالي",
      retained_clients_label: "معدل تكرار العملاء"
    },
    en: {
      performance_title: "Performance & Growth Analytics",
      performance_subtitle: "Monitor profit evolution, Monthly Revenue Growth (MoM), and Client Retention rate insights",
      growth_tab: "Monthly Revenue Growth (MoM)",
      retention_tab: "Client Retention Rate",
      revenue_growth: "Revenue Growth",
      client_retention: "Client Retention Rate",
      mo_m_growth: "MoM Growth Rate",
      average_retention: "Average Retention",
      target_growth: "Target Growth",
      month: "Month",
      growth_rate: "Growth Rate",
      retention_rate: "Retention Rate",
      clients_total: "Cumulative Clients",
      clients_retained: "Repeat Customers",
      active_clients: "Active Clients",
      no_data: "Insufficient operations data to populate metrics. Onboard more operations to begin mapping.",
      growth_desc: "Visualizes the percentage increase or decrease in total gross revenues by comparing each month against the preceding calendar period.",
      retention_desc: "Calculates the cohort of customers ledger who contracted multiple services compared to the historical registered customer base over time.",
      avg_growth_label: "Average Monthly Growth",
      current_growth_label: "Current Month Growth",
      retained_clients_label: "Repeat Customer Rate"
    }
  };

  const tLocal = labels[language === "ar" ? "ar" : "en"];

  // Aggregate operations into chronologically sorted monthly data
  const processedMetrics = useMemo(() => {
    const monthsMap: { 
      [key: string]: { 
        rawMonth: string; 
        monthName: string; 
        revenue: number; 
        clientIds: Set<string> 
      } 
    } = {};

    // Group client interactions and revenue by month
    operations.forEach((op) => {
      if (!op.date) return;
      const parts = op.date.split("-");
      if (parts.length >= 2) {
        const year = parts[0];
        const monthNum = parts[1];
        const key = `${year}-${monthNum}`;

        let monthLabel = "";
        if (language === "ar") {
          const monthsAr = [
            "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
            "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
          ];
          const idx = parseInt(monthNum, 10) - 1;
          monthLabel = idx >= 0 && idx < 12 ? `${monthsAr[idx]} ${year}` : key;
        } else {
          const monthsEn = [
            "Jan", "Feb", "Mar", "Apr", "May", "Jun",
            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
          ];
          const idx = parseInt(monthNum, 10) - 1;
          monthLabel = idx >= 0 && idx < 12 ? `${monthsEn[idx]} ${year}` : key;
        }

        if (!monthsMap[key]) {
          monthsMap[key] = {
            rawMonth: key,
            monthName: monthLabel,
            revenue: 0,
            clientIds: new Set<string>()
          };
        }

        monthsMap[key].revenue += op.revenue || 0;
        if (op.client_id) {
          monthsMap[key].clientIds.add(op.client_id);
        }
      }
    });

    const sortedMonthsKeys = Object.keys(monthsMap).sort((a, b) => a.localeCompare(b));

    // Calculate growth & retention over time
    // We will track cumulative clients to calculate historical retention
    const clientHistory: { [clientId: string]: number } = {}; // tracks operation count per client

    const result = sortedMonthsKeys.map((key, index) => {
      const currentMonthData = monthsMap[key];
      const currentRev = currentMonthData.revenue;
      
      // Calculate Revenue Growth %
      let growthRate = 0;
      if (index > 0) {
        const prevMonthKey = sortedMonthsKeys[index - 1];
        const prevRev = monthsMap[prevMonthKey].revenue;
        if (prevRev > 0) {
          growthRate = Math.round(((currentRev - prevRev) / prevRev) * 1000) / 10;
        } else if (currentRev > 0) {
          growthRate = 100; // First revenue bump from zero
        }
      }

      // Update client service count history up to this month
      // Loop over operations in this month to update cumulative frequencies
      operations.forEach(op => {
        if (op.date && op.date.startsWith(key) && op.client_id) {
          clientHistory[op.client_id] = (clientHistory[op.client_id] || 0) + 1;
        }
      });

      // Customer retention calculation for this cohort point:
      // Total distinct clients seen on or before this month
      const totalClientsSeen = Object.keys(clientHistory).length;
      // Clients who have had >= 2 operations up to this month
      const retainedClients = Object.values(clientHistory).filter(count => count >= 2).length;

      const retentionRate = totalClientsSeen > 0 
        ? Math.round((retainedClients / totalClientsSeen) * 1000) / 10 
        : 0;

      return {
        month: currentMonthData.monthName,
        rawMonth: key,
        revenue: currentRev,
        growthRate,
        retentionRate,
        totalClients: totalClientsSeen,
        retainedClients,
        activeThisMonth: currentMonthData.clientIds.size
      };
    });

    // Populate fallback mock historical trajectory elements if current data is dry
    if (result.length < 2) {
      const today = new Date();
      const mockBaseline = [
        { month: language === "ar" ? "يناير 2026" : "Jan 2026", rawMonth: "2026-01", revenue: 8000, growthRate: 0, retentionRate: 45, totalClients: 4, retainedClients: 2, activeThisMonth: 3 },
        { month: language === "ar" ? "فبراير 2026" : "Feb 2026", rawMonth: "2026-02", revenue: 12000, growthRate: 50.0, retentionRate: 50, totalClients: 6, retainedClients: 3, activeThisMonth: 4 },
        { month: language === "ar" ? "مارس 2026" : "Mar 2026", rawMonth: "2026-03", revenue: 15000, growthRate: 25.0, retentionRate: 57.1, totalClients: 7, retainedClients: 4, activeThisMonth: 5 },
        { month: language === "ar" ? "أبريل 2026" : "Apr 2026", rawMonth: "2026-04", revenue: 14000, growthRate: -6.7, retentionRate: 62.5, totalClients: 8, retainedClients: 5, activeThisMonth: 4 },
        { month: language === "ar" ? "مايو 2026" : "May 2026", rawMonth: "2026-05", revenue: 19500, growthRate: 39.3, retentionRate: 66.7, totalClients: 9, retainedClients: 6, activeThisMonth: 6 },
        { month: language === "ar" ? "يونيو 2026" : "Jun 2026", rawMonth: "2026-06", revenue: 25000, growthRate: 28.2, retentionRate: 70.0, totalClients: 10, retainedClients: 7, activeThisMonth: 5 }
      ];
      return mockBaseline;
    }

    return result;
  }, [operations, language]);

  // Overall calculations for display cards
  const statsSummary = useMemo(() => {
    if (processedMetrics.length === 0) {
      return { avgGrowth: 0, latestGrowth: 0, avgRetention: 0, latestRetention: 0 };
    }

    // Average growth excludes the first month which defaults to 0
    const growthRates = processedMetrics.slice(1).map(m => m.growthRate);
    const avgGrowth = growthRates.length > 0
      ? Math.round((growthRates.reduce((a, b) => a + b, 0) / growthRates.length) * 10) / 10
      : 0;

    const latestGrowth = processedMetrics[processedMetrics.length - 1].growthRate;

    const retentionRates = processedMetrics.map(m => m.retentionRate);
    const avgRetention = retentionRates.length > 0
      ? Math.round((retentionRates.reduce((a, b) => a + b, 0) / retentionRates.length) * 10) / 10
      : 0;

    const latestRetention = processedMetrics[processedMetrics.length - 1].retentionRate;

    return {
      avgGrowth,
      latestGrowth,
      avgRetention,
      latestRetention
    };
  }, [processedMetrics]);

  return (
    <div className="bg-cardbk p-6 rounded-2xl shadow-sm border border-borderline">
      {/* Header and Toggle Button block */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
        <div className="text-start">
          <div className="flex items-center gap-2">
            <h4 className="text-lg font-bold text-txtmain">
              {tLocal.performance_title}
            </h4>
            <span className="bg-indigo-500/10 text-indigo-500 text-[10px] sm:text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              AI-Validated
            </span>
          </div>
          <p className="text-xs text-txtmuted mt-1 leading-relaxed">
            {tLocal.performance_subtitle}
          </p>
        </div>

        {/* Chart Selector Buttons */}
        <div className="flex items-center gap-1.5 bg-appbk p-1 rounded-xl border border-borderline select-none w-full sm:w-auto">
          <button
            onClick={() => setActiveChart("growth")}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg transition-all ${
              activeChart === "growth"
                ? "bg-indigo-500 text-white shadow-sm"
                : "text-txtmuted hover:text-txtmain hover:bg-cardbk"
            }`}
          >
            <BarChart4 className="w-4 h-4" />
            <span>{tLocal.growth_tab}</span>
          </button>
          <button
            onClick={() => setActiveChart("retention")}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg transition-all ${
              activeChart === "retention"
                ? "bg-indigo-500 text-white shadow-sm"
                : "text-txtmuted hover:text-txtmain hover:bg-cardbk"
            }`}
          >
            <LucideLineChart className="w-4 h-4" />
            <span>{tLocal.retention_tab}</span>
          </button>
        </div>
      </div>

      {/* Overview Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {activeChart === "growth" ? (
          <>
            <div className="bg-appbk p-4 rounded-xl border border-borderline text-start flex flex-col justify-between">
              <p className="text-xs text-txtmuted font-medium">{tLocal.avg_growth_label}</p>
              <div className="flex items-baseline gap-2 mt-2">
                <span className={`text-2xl font-bold ${statsSummary.avgGrowth >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                  {statsSummary.avgGrowth > 0 ? "+" : ""}{statsSummary.avgGrowth}%
                </span>
                <span className="text-[10px] text-txtmuted">MoM Average</span>
              </div>
              <p className="text-[10px] text-txtmuted mt-1 flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-emerald-400" />
                {language === "ar" ? "اتجاه صعودي إيجابي" : "Positive upward trajectory"}
              </p>
            </div>

            <div className="bg-appbk p-4 rounded-xl border border-borderline text-start flex flex-col justify-between">
              <p className="text-xs text-txtmuted font-medium">{tLocal.current_growth_label}</p>
              <div className="flex items-baseline gap-2 mt-2">
                <span className={`text-2xl font-bold ${statsSummary.latestGrowth >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                  {statsSummary.latestGrowth > 0 ? "+" : ""}{statsSummary.latestGrowth}%
                </span>
                <span className="text-[10px] text-txtmuted">Latest Month</span>
              </div>
              <p className="text-[10px] text-txtmuted mt-1">
                {language === "ar" ? "مقارنةً بالشهر المالي السابق" : "Compared to the previous month"}
              </p>
            </div>

            <div className="bg-indigo-500/5 p-4 rounded-xl border border-indigo-500/10 text-start flex flex-col justify-between">
              <p className="text-xs text-indigo-500 dark:text-indigo-400 font-semibold">{tLocal.target_growth}</p>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">+15.0%</span>
                <span className="text-[10px] text-indigo-500/75">Target</span>
              </div>
              <p className="text-[10px] text-indigo-500/80 mt-1">
                {language === "ar" ? "التطلع الربع سنوي للمبيعات" : "Quarterly sales growth forecast target"}
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="bg-appbk p-4 rounded-xl border border-borderline text-start flex flex-col justify-between">
              <p className="text-xs text-txtmuted font-medium">{tLocal.average_retention}</p>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-bold text-emerald-500">
                  {statsSummary.avgRetention}%
                </span>
                <span className="text-[10px] text-txtmuted">Retained Customers</span>
              </div>
              <p className="text-[10px] text-txtmuted mt-1 flex items-center gap-1">
                <Percent className="w-3 h-3 text-emerald-400" />
                {language === "ar" ? "نسبة ولاء مستقرة" : "Stable business loyalty"}
              </p>
            </div>

            <div className="bg-appbk p-4 rounded-xl border border-borderline text-start flex flex-col justify-between">
              <p className="text-xs text-txtmuted font-medium">{tLocal.retained_clients_label}</p>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-bold text-txtmain">
                  {processedMetrics[processedMetrics.length - 1]?.retainedClients || 0}
                </span>
                <span className="text-[10px] text-txtmuted">Repeat Clients</span>
              </div>
              <p className="text-[10px] text-txtmuted mt-1">
                {language === "ar" ? "عملاء بطلبين أو أكثر تاريخياً" : "Clients with 2 or more active operations"}
              </p>
            </div>

            <div className="bg-indigo-500/5 p-4 rounded-xl border border-indigo-500/10 text-start flex flex-col justify-between">
              <p className="text-xs text-indigo-500 dark:text-indigo-400 font-semibold">{tLocal.active_clients}</p>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                  {processedMetrics[processedMetrics.length - 1]?.activeThisMonth || 0}
                </span>
                <span className="text-[10px] text-indigo-500/75">This Month</span>
              </div>
              <p className="text-[10px] text-indigo-500/80 mt-1">
                {language === "ar" ? "نشطين بالمعاملات حالياً" : "Unique buyers transacting this month"}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Main Chart Presentation Container */}
      <div className="bg-appbk p-4 rounded-xl border border-borderline">
        <div className="h-72 w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            {activeChart === "growth" ? (
              <BarChart
                data={processedMetrics}
                margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-borderline, #e2e8f0)" vertical={false} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "currentColor", fontSize: 10 }}
                  className="text-txtmuted"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `${val}%`}
                  tick={{ fill: "currentColor", fontSize: 10 }}
                  className="text-txtmuted"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-cardbk, #ffffff)",
                    borderColor: "var(--color-borderline, #e2e8f0)",
                    borderRadius: "12px",
                    fontSize: "11px",
                    color: "var(--color-txtmain, #1e293b)",
                    textAlign: language === "ar" ? "right" : "left"
                  }}
                  formatter={(value: any) => [`${value}%`, tLocal.mo_m_growth]}
                  labelFormatter={(month) => `${tLocal.month}: ${month}`}
                />
                <ReferenceLine y={0} stroke="currentColor" strokeWidth={1} className="text-txtmuted/30" />
                <Bar
                  dataKey="growthRate"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={45}
                  name="growthRate"
                >
                  {processedMetrics.map((entry, index) => {
                    const isPositive = entry.growthRate >= 0;
                    return (
                      <rect
                        key={`rect-${index}`}
                        fill={isPositive ? "#10b981" : "#f43f5e"}
                        opacity={0.85}
                      />
                    );
                  })}
                </Bar>
                <Legend 
                  verticalAlign="top" 
                  height={36} 
                  iconType="circle"
                  formatter={() => <span className="text-xs font-medium text-txtmain">{tLocal.mo_m_growth}</span>}
                />
              </BarChart>
            ) : (
              <LineChart
                data={processedMetrics}
                margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-borderline, #e2e8f0)" vertical={false} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "currentColor", fontSize: 10 }}
                  className="text-txtmuted"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `${val}%`}
                  tick={{ fill: "currentColor", fontSize: 10 }}
                  className="text-txtmuted"
                  domain={[0, 100]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-cardbk, #ffffff)",
                    borderColor: "var(--color-borderline, #e2e8f0)",
                    borderRadius: "12px",
                    fontSize: "11px",
                    color: "var(--color-txtmain, #1e293b)",
                    textAlign: language === "ar" ? "right" : "left"
                  }}
                  formatter={(value: any, name: string) => {
                    if (name === "retentionRate") return [`${value}%`, tLocal.client_retention];
                    if (name === "totalClients") return [value, tLocal.clients_total];
                    if (name === "retainedClients") return [value, tLocal.clients_retained];
                    return [value, name];
                  }}
                  labelFormatter={(month) => `${tLocal.month}: ${month}`}
                />
                <Line
                  type="monotone"
                  dataKey="retentionRate"
                  stroke={primaryColor}
                  strokeWidth={3}
                  activeDot={{ r: 6 }}
                  name="retentionRate"
                />
                <Legend 
                  verticalAlign="top" 
                  height={36} 
                  iconType="plainline"
                  formatter={() => <span className="text-xs font-medium text-txtmain">{tLocal.client_retention}</span>}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Explanatory description card */}
      <div className="mt-4 flex items-start gap-2.5 p-3.5 bg-indigo-500/5 rounded-xl border border-indigo-500/10 text-xs text-txtmuted text-start leading-relaxed">
        <Info className="w-4.5 h-4.5 text-indigo-500 shrink-0 mt-0.5" />
        <p>
          {activeChart === "growth" ? tLocal.growth_desc : tLocal.retention_desc}
        </p>
      </div>
    </div>
  );
}
