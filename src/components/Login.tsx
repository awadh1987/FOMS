import React, { useState } from "react";
import { motion } from "motion/react";
import { 
  Lock, 
  ShieldCheck, 
  Database, 
  Sparkles, 
  Building2, 
  Sun, 
  Moon, 
  Coins, 
  LayoutDashboard 
} from "lucide-react";
import { useLanguage } from "../lib/LanguageContext";
import { googleSignIn } from "../lib/firebaseAuth";

interface LoginProps {
  onSuccess: (user: any) => void;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
}

export default function Login({ onSuccess, darkMode, setDarkMode }: LoginProps) {
  const { language, setLanguage, t, dir } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSignIn = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const result = await googleSignIn();
      if (result) {
        onSuccess(result.user);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(
        language === "ar" 
          ? "فشل تسجيل الدخول عبر Google. يرجى التحقق من أذونات متصفحك أو المحاولة لاحقاً." 
          : "Google Sign-In failed. Please check browser permissions and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-between transition-colors duration-300 font-sans" dir={dir}>
      
      {/* Header controls */}
      <header className="max-w-7xl mx-auto w-full px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-tr from-indigo-500 to-violet-600 rounded-lg flex items-center justify-center text-white font-extrabold text-xs shadow-md shadow-indigo-500/10">
            ERP
          </div>
          <span className="text-sm font-black text-slate-800 dark:text-white">{t("saas_erp_suite")}</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Language selector */}
          <div className="flex bg-slate-200/50 dark:bg-slate-900/50 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setLanguage("ar")}
              className={`py-1 px-3.5 rounded-lg text-xs font-bold transition-all ${language === "ar" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"}`}
            >
              العربية
            </button>
            <button
              onClick={() => setLanguage("en")}
              className={`py-1 px-3.5 rounded-lg text-xs font-bold transition-all ${language === "en" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"}`}
            >
              English
            </button>
          </div>

          {/* Theme toggler */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 bg-slate-200/50 dark:bg-slate-900/50 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-xl transition-all"
            title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
          </button>
        </div>
      </header>

      {/* Main card */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 flex items-center justify-center py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full max-w-5xl bg-white dark:bg-slate-900 rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800/80 shadow-2xl shadow-indigo-500/5 relative">
          
          {/* Brand/Hero section - left/right depending on language */}
          <div className="lg:col-span-5 bg-gradient-to-br from-indigo-700 via-indigo-800 to-violet-900 p-8 lg:p-12 text-white flex flex-col justify-between gap-10">
            <div className="space-y-4">
              <span className="bg-indigo-500/20 text-indigo-200 border border-indigo-400/25 text-[10px] font-black tracking-widest uppercase px-3 py-1 rounded-full inline-block">
                {t("data_security_iso")}
              </span>
              <h2 className="text-2xl font-black leading-tight tracking-tight">
                {t("auth_benefits_title")}
              </h2>
            </div>

            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="w-10 h-10 shrink-0 rounded-xl bg-white/10 flex items-center justify-center border border-white/10">
                  <Building2 className="w-5 h-5 text-indigo-300" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white mb-1">
                    Multi-Tenant Isolation
                  </h3>
                  <p className="text-xs text-indigo-200/80 leading-relaxed">
                    {t("auth_benefit_isolation")}
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-10 h-10 shrink-0 rounded-xl bg-white/10 flex items-center justify-center border border-white/10">
                  <Database className="w-5 h-5 text-indigo-300" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white mb-1">
                    Secure Firestore Encrypted Kernels
                  </h3>
                  <p className="text-xs text-indigo-200/80 leading-relaxed">
                    {t("auth_benefit_firestore")}
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-10 h-10 shrink-0 rounded-xl bg-white/10 flex items-center justify-center border border-white/10">
                  <Lock className="w-5 h-5 text-indigo-300" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white mb-1">
                    Unified Google SSO
                  </h3>
                  <p className="text-xs text-indigo-200/80 leading-relaxed">
                    {t("auth_benefit_google")}
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-white/10 flex gap-2 items-center text-xs text-indigo-200">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>{t("data_security_iso")}</span>
            </div>
          </div>

          {/* Form/Login box */}
          <div className="lg:col-span-7 p-8 lg:p-12 flex flex-col justify-center">
            <div className="max-w-md mx-auto w-full space-y-8">
              
              <div className="space-y-3">
                <div className="inline-flex p-2.5 bg-indigo-50 dark:bg-indigo-950/40 rounded-2xl border border-indigo-100 dark:border-indigo-900/30">
                  <Lock className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h1 className="text-xl lg:text-2xl font-black text-slate-800 dark:text-white tracking-tight">
                  {t("auth_welcome_title")}
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {t("auth_welcome_subtitle")}
                </p>
              </div>

              {errorMsg && (
                <div className="p-4 bg-rose-50 dark:bg-rose-950/25 border border-rose-100 dark:border-rose-900/30 rounded-2xl text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-rose-600 dark:bg-rose-500 rounded-full shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="space-y-4 pt-2">
                <button
                  onClick={handleSignIn}
                  disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/60 text-white rounded-2xl px-6 py-4 text-xs font-bold flex items-center justify-center gap-3 transition-all transform hover:-translate-y-0.5 active:translate-y-0 shadow-lg shadow-indigo-500/10 cursor-pointer"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path d="M12.24 10.285V13.4h6.887C18.2 15.614 15.645 18 12.24 18c-3.86 0-7-3.14-7-7s3.14-7 7-7c1.7 0 3.3.65 4.5 1.8l2.422-2.422C17.218 1.636 14.89 1 12.24 1a10 10 0 100 20c5.388 0 9.873-3.882 9.873-10.3 0-.6-.057-1.127-.16-1.415H12.24z" />
                    </svg>
                  )}
                  <span>{loading ? t("auth_securing_access") : t("auth_sign_in_btn")}</span>
                </button>
              </div>

              <div className="text-[10px] text-slate-400 dark:text-slate-500 text-center leading-relaxed">
                {language === "ar" 
                  ? "تسجيل الدخول يساهم في تحديد هويتك لحفظ معلومات شركتك المعزولة بشكل كامل." 
                  : "Signing in securely routes your access credentials to your dedicated corporate workspace isolation partition."}
              </div>

            </div>
          </div>

        </div>
      </main>

      {/* Footer details */}
      <footer className="max-w-7xl mx-auto w-full px-6 py-6 border-t border-slate-200 dark:border-slate-900 text-center text-[10px] text-slate-400 dark:text-slate-600">
        <p className="leading-relaxed">
          {language === "ar"
            ? "المنصة المالية المتكاملة © 2026. كافة حقوق البيانات مشفرة سحابياً بموجب نظام حماية البيانات الشخصية."
            : "Integrated ERP © 2026. All company database schema components secure-certified and verified."}
        </p>
      </footer>

    </div>
  );
}
