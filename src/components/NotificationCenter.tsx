import React, { useState, useEffect, useRef } from "react";
import { Bell, BellOff, Calendar, DollarSign, CheckCircle2, RefreshCw, AlertTriangle, ShieldCheck } from "lucide-react";
import { useLanguage } from "../lib/LanguageContext";

interface OverdueInvoice {
  id: string;
  company_id: string;
  op_id: string;
  client_id: string;
  amount: number;
  status: "Paid" | "Unpaid";
  due_date: string;
  client_name: string;
}

interface NotificationCenterProps {
  selectedCompanyId: string;
  companyCurrency?: string;
  onRefreshData?: () => void;
}

export default function NotificationCenter({ selectedCompanyId, companyCurrency = "ر.س", onRefreshData }: NotificationCenterProps) {
  const { language, t } = useLanguage();
  const [overdueInvoices, setOverdueInvoices] = useState<OverdueInvoice[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Fetch overdue invoices
  const fetchOverdueInvoices = async (showLoading = false) => {
    if (!selectedCompanyId) return;
    if (showLoading) setLoading(true);
    try {
      const res = await fetch("/api/invoices/overdue", {
        headers: {
          "x-company-id": selectedCompanyId,
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setOverdueInvoices(data);
        }
      }
    } catch (err) {
      console.warn("Silent alert: Could not check overdue invoices at this moment", err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // Poll API for overdue invoices every 30 seconds
  useEffect(() => {
    fetchOverdueInvoices(true);

    const interval = setInterval(() => {
      fetchOverdueInvoices(false);
    }, 30000);

    return () => clearInterval(interval);
  }, [selectedCompanyId]);

  // Mark invoice as Paid / Collected immediately
  const handleCollectInvoice = async (invoiceId: string) => {
    setActionLoadingId(invoiceId);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-company-id": selectedCompanyId,
        },
        body: JSON.stringify({ status: "Paid" }),
      });
      if (res.ok) {
        // Remove locally from list
        setOverdueInvoices(prev => prev.filter(inv => inv.id !== invoiceId));
        // Refresh master states
        if (onRefreshData) {
          onRefreshData();
        }
      }
    } catch (err) {
      console.error("Failed to collect invoice:", err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Translate labels locally
  const texts = {
    notificationsTitleAr: "مركز التنبيهات الذكي",
    notificationsTitleEn: "Smart Alert Center",
    overdueWarningAr: "تنبيه: فواتير متأخرة الموت",
    overdueWarningEn: "Alert: Overdue Accounts",
    noNotificationsAr: "لا توجد أي فواتير متأخرة حالياً. أداء مالي ممتاز!",
    noNotificationsEn: "Excellent! There are no overdue invoices at this time.",
    collectAr: "تحصيل الآن",
    collectEn: "Collect Now",
    amountAr: "المبلغ المستحق:",
    amountEn: "Due Amount:",
    dueDateAr: "تاريخ الاستحقاق:",
    dueDateEn: "Due Date:",
    daysOverdueAr: (days: number) => `متأخرة منذ ${days} يوم`,
    daysOverdueEn: (days: number) => `Overdue by ${days} ${days === 1 ? 'day' : 'days'}`,
    secSecureBackupAr: "مؤمن بالكامل",
    secSecureBackupEn: "Fully Secured",
    refreshAr: "تحديث قائمة الإنذار",
    refreshEn: "Sync alert list"
  };

  const getDaysOverdue = (dueDateStr: string) => {
    try {
      const due = new Date(dueDateStr);
      due.setHours(0,0,0,0);
      const today = new Date();
      today.setHours(0,0,0,0);
      const diffTime = today.getTime() - due.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > 0 ? diffDays : 1;
    } catch {
      return 1;
    }
  };

  const isAr = language === "ar";

  return (
    <div className="relative font-sans text-right" style={{ direction: isAr ? "rtl" : "ltr" }} ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2.5 text-txtmuted hover:text-txtmain bg-appbk border border-borderline rounded-xl transition-all relative flex items-center justify-center cursor-pointer"
        title={isAr ? "التنبيهات والإنذارات" : "Alerts & Notifications"}
        id="notification-bell-btn"
      >
        <Bell className={`w-4 h-4 ${overdueInvoices.length > 0 ? "animate-swing" : ""}`} />
        {overdueInvoices.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full text-[9px] font-black w-4.5 h-4.5 flex items-center justify-center border-2 border-cardbk shadow-sm animate-pulse">
            {overdueInvoices.length}
          </span>
        )}
      </button>

      {/* Styled Dropdown Panel */}
      {isOpen && (
        <div 
          className={`absolute mt-2.5 w-80 sm:w-96 bg-cardbk border border-borderline shadow-xl rounded-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-150 ${
            isAr ? "left-0 origin-top-left" : "right-0 origin-top-right"
          }`}
        >
          {/* Header */}
          <div className="p-4 border-b border-borderline flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                {overdueInvoices.length > 0 && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                )}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${overdueInvoices.length > 0 ? "bg-red-500" : "bg-emerald-500"}`}></span>
              </span>
              <h4 className="font-bold text-xs text-txtmain select-none">
                {isAr ? texts.notificationsTitleAr : texts.notificationsTitleEn}
              </h4>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => fetchOverdueInvoices(true)}
                disabled={loading}
                className="p-1.5 text-txtmuted hover:text-indigo-400 rounded-lg hover:bg-appbk transition-colors"
                title={isAr ? texts.refreshAr : texts.refreshEn}
              >
                <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin text-indigo-500" : ""}`} />
              </button>
              
              <span className="text-[10px] text-txtmuted font-bold px-2 py-0.5 rounded-full bg-appbk border border-borderline select-none">
                {overdueInvoices.length} {isAr ? "متأخرة" : "overdue"}
              </span>
            </div>
          </div>

          {/* List Content */}
          <div className="max-h-[360px] overflow-y-auto divide-y divide-borderline px-1 py-1">
            {overdueInvoices.length === 0 ? (
              <div className="p-8 text-center text-txtmuted space-y-2">
                <div className="w-10 h-10 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto text-emerald-500">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <p className="text-[11px] leading-relaxed max-w-[220px] mx-auto font-medium">
                  {isAr ? texts.noNotificationsAr : texts.noNotificationsEn}
                </p>
              </div>
            ) : (
              overdueInvoices.map((inv) => {
                const daysOverdue = getDaysOverdue(inv.due_date);
                const shortInvId = inv.id.split("-").pop() || inv.id;
                
                return (
                  <div key={inv.id} className="p-3 hover:bg-appbk/40 rounded-xl transition-all space-y-2.5">
                    
                    {/* Invoice Meta Row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-start space-y-0.5">
                        <span className="font-mono text-[10px] bg-red-500/10 text-red-500 dark:text-red-400 px-2 py-0.5 rounded border border-red-500/15 font-bold">
                          #INV-{shortInvId.toUpperCase()}
                        </span>
                        
                        <p className="text-[11.5px] font-bold text-txtmain select-all pt-1">
                          {inv.client_name}
                        </p>
                      </div>

                      {/* Expiration warning tag */}
                      <span className="text-[9.5px] text-red-500 dark:text-red-400 bg-red-500/5 px-2 py-0.5 rounded-full border border-red-500/10 font-bold flex items-center gap-1 shrink-0 select-none">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        <span>
                          {isAr ? texts.daysOverdueAr(daysOverdue) : texts.daysOverdueEn(daysOverdue)}
                        </span>
                      </span>
                    </div>

                    {/* Details Panel */}
                    <div className="p-2 bg-appbk/60 rounded-lg border border-borderline/50 grid grid-cols-2 gap-1.5 text-[10.5px]">
                      
                      <div className="text-start space-y-0.5">
                        <span className="text-txtmuted text-[9.5px] block leading-none">
                          {isAr ? texts.amountAr : texts.amountEn}
                        </span>
                        <span className="font-mono font-black text-txtmain text-[11px]">
                          {inv.amount.toLocaleString()} {companyCurrency}
                        </span>
                      </div>

                      <div className="text-start space-y-0.5">
                        <span className="text-txtmuted text-[9.5px] block leading-none">
                          {isAr ? texts.dueDateAr : texts.dueDateEn}
                        </span>
                        <span className="font-mono font-medium text-txtmuted">
                          {inv.due_date}
                        </span>
                      </div>

                    </div>

                    {/* Quick collect CTA */}
                    <button
                      onClick={() => handleCollectInvoice(inv.id)}
                      disabled={actionLoadingId === inv.id}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-1.5 px-3 rounded-lg text-[10px] transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-emerald-500/10"
                    >
                      {actionLoadingId === inv.id ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      <span>{isAr ? texts.collectAr : texts.collectEn}</span>
                    </button>

                  </div>
                );
              })
            )}
          </div>

          {/* Footer Security Badge */}
          <div className="p-2.5 bg-appbk/40 border-t border-borderline text-[9.5px] text-txtmuted text-center rounded-b-2xl font-mono flex items-center justify-center gap-1">
            <span className="w-1 h-1 rounded-full bg-emerald-500 inline-block"></span>
            <span>ERP Notification Vault • {isAr ? texts.secSecureBackupAr : texts.secSecureBackupEn}</span>
          </div>

        </div>
      )}
    </div>
  );
}
