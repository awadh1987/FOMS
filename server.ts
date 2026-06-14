import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { loadFromFirestore, saveToFirestore } from "./src/lib/firebaseServer";
import { GoogleGenAI, Type } from "@google/genai";

interface Company {
  id: string;
  name: string;
  logo_url?: string;
  primary_color?: string;
  currency?: string;
  widget_order?: string;
  subscription_plan?: "Trial" | "Starter" | "Business" | "Enterprise";
  subscription_status?: "Active" | "Expired" | "Pending" | "Suspended";
  subscription_expiry?: string;
  subscription_price_paid?: number;
  subscription_billing_cycle?: "monthly" | "yearly";
}

interface Client {
  id: string;
  company_id: string;
  name: string;
  company: string;
  phone: string;
}

interface Operation {
  id: string;
  company_id: string;
  client_id: string;
  service: string;
  cost: number;
  revenue: number;
  profit: number;
  date: string; // YYYY-MM-DD
  status?: "Pending" | "In Progress" | "Completed";
}

interface Invoice {
  id: string;
  company_id: string;
  op_id: string;
  client_id: string;
  amount: number;
  status: "Paid" | "Unpaid";
  due_date: string; // YYYY-MM-DD
  payment_date?: string; // YYYY-MM-DD
}

interface AuditLog {
  id: string;
  company_id: string;
  timestamp: string;
  action: string;
  details: string;
  user: string;
}

interface Expense {
  id: string;
  company_id: string;
  category: string;
  amount: number;
  frequency: "weekly" | "monthly" | "yearly" | "once";
  date: string;
  description?: string;
}

// Lowdb simplified alternative using direct fs reading/writing
const DB_FILE = path.join(process.cwd(), "db_data.json");

function logEvent(db: any, companyId: string, action: string, details: string, user = "awadh.a.1987@gmail.com") {
  db.audit_logs = db.audit_logs || [];
  db.audit_logs.push({
    id: "log-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
    company_id: companyId,
    timestamp: new Date().toISOString(),
    action,
    details,
    user
  });
}

function readDb() {
  const initialLogs = [
    { id: "log-initial-1", company_id: "comp-1", timestamp: "2026-06-12T09:00:00.000Z", action: "تأسيس المنشأة وتوليد الضريبة الافتراضية", details: "تم تسجيل وإعداد الكيان المالي الموحد لشركة النخبة للخدمات التقنية وتفعيل نظام الفاتورة المبسطة", user: "awadh.a.1987@gmail.com" },
    { id: "log-initial-2", company_id: "comp-1", timestamp: "2026-06-12T10:15:00.000Z", action: "إنشاء عميل جديد", details: "تم تسجيل عميل جديد باسم: عبدالله الشمري (مؤسسة الأفق)", user: "awadh.a.1987@gmail.com" },
    { id: "log-initial-3", company_id: "comp-1", timestamp: "2026-06-12T11:00:00.000Z", action: "إنشاء عملية تشغيلية وتوليد الفاتورة التلقائية", details: "تطوير تطبيق ويب ERP للعميل عبدالله الشمري بمبلغ 25,000 ر.س وتوليد الفاتورة التلقائية #INV-20260601001", user: "awadh.a.1987@gmail.com" }
  ];

  if (!fs.existsSync(DB_FILE)) {
    const initialData = {
      companies: [
        { id: "comp-1", name: "شركة النخبة للخدمات التقنية", logo_url: "", primary_color: "", currency: "ر.س" },
        { id: "comp-2", name: "مجموعة الرواد اللوجستية", logo_url: "", primary_color: "", currency: "ر.س" }
      ],
      clients: [
        { id: "cli-1", company_id: "comp-1", name: "عبدالله الشمري", company: "مؤسسة الأفق", phone: "+966501234567" },
        { id: "cli-2", company_id: "comp-1", name: "فاطمة العمودي", company: "شركة الابتكار", phone: "+966555543210" },
        { id: "cli-3", company_id: "comp-2", name: "أحمد بن علي", company: "نقليات الخليج", phone: "+966547788990" }
      ],
      operations: [
        { id: "op-1", company_id: "comp-1", client_id: "cli-1", service: "تطوير تطبيق ويب ERP", cost: 12000, revenue: 25000, profit: 13000, date: "2026-06-01" },
        { id: "op-2", company_id: "comp-1", client_id: "cli-2", service: "حملة تسويق رقمي", cost: 3500, revenue: 8000, profit: 4500, date: "2026-06-05" }
      ],
      invoices: [
        { id: "INV-20260601001", company_id: "comp-1", op_id: "op-1", client_id: "cli-1", amount: 25000, status: "Paid", due_date: "2026-06-08", payment_date: "2026-06-07" },
        { id: "INV-20260605002", company_id: "comp-1", op_id: "op-2", client_id: "cli-2", amount: 8000, status: "Unpaid", due_date: "2026-06-12" }
      ],
      expenses: [
        { id: "exp-1", company_id: "comp-1", category: "rent", amount: 1500, frequency: "monthly", date: "2026-06-01", description: "إيجار مقر المكتب الرئيسي" },
        { id: "exp-2", company_id: "comp-1", category: "subscriptions", amount: 350, frequency: "monthly", date: "2026-06-02", description: "اشتراك خوادم سحابية AWS و OpenAI" }
      ],
      audit_logs: initialLogs
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), "utf-8");
    return initialData;
  }
  try {
    const db = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
    if (!db.expenses) {
      db.expenses = [
        { id: "exp-1", company_id: "comp-1", category: "rent", amount: 1500, frequency: "monthly", date: "2026-06-01", description: "إيجار مقر المكتب الرئيسي" },
        { id: "exp-2", company_id: "comp-1", category: "subscriptions", amount: 350, frequency: "monthly", date: "2026-06-02", description: "اشتراك خوادم سحابية AWS و OpenAI" }
      ];
      fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
    }
    if (!db.audit_logs) {
      db.audit_logs = initialLogs;
      fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
    }
    // Set default subscription values on companies if not present
    if (db.companies) {
      let updated = false;
      db.companies.forEach((c: any) => {
        if (!c.subscription_plan) {
          c.subscription_plan = c.id === "comp-1" ? "Business" : "Trial";
          c.subscription_status = "Active";
          c.subscription_expiry = "2027-06-14";
          c.subscription_price_paid = c.id === "comp-1" ? 150 : 0;
          c.subscription_billing_cycle = "monthly";
          updated = true;
        }
      });
      if (updated) {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
      }
    }
    return db;
  } catch (e) {
    return { companies: [], clients: [], operations: [], invoices: [], expenses: [], audit_logs: [] };
  }
}

function writeDb(data: any) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  saveToFirestore(data).catch((err) => {
    console.error("Delayed Firestore synchronization write error:", err);
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // On server startup, restore state from Firestore if available
  try {
    const firestoreData = await loadFromFirestore();
    if (firestoreData) {
      console.log("Restored up-to-date SaaS dataset ledger from Firestore on startup.");
      fs.writeFileSync(DB_FILE, JSON.stringify(firestoreData, null, 2), "utf-8");
    } else {
      console.log("No remote database was loaded, synchronization will seed Firestore on primary mutation write.");
      const localData = readDb();
      await saveToFirestore(localData);
    }
  } catch (err) {
    console.error("Firestore sync error during server launch restore sequence:", err);
  }

  app.use(express.json());

  // API Request Logger
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  // API endpoints

  // 1. Get companies
  app.get("/api/companies", (req, res) => {
    const db = readDb();
    res.json(db.companies || []);
  });

  // 2. Create company
  app.post("/api/companies", (req, res) => {
    const db = readDb();
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: "اسم الشركة مطلوب" });
    }
    const newCompany: Company = {
      id: "comp-" + Date.now(),
      name,
      logo_url: "",
      primary_color: "",
      currency: "ر.س"
    };
    db.companies = db.companies || [];
    db.companies.push(newCompany);
    writeDb(db);
    res.json(newCompany);
  });

  // 2.5. Update company settings
  app.put("/api/companies/:id", (req, res) => {
    const { id } = req.params;
    const { name, logo_url, primary_color, currency, widget_order } = req.body;
    const db = readDb();
    
    db.companies = db.companies || [];
    const index = db.companies.findIndex((c: Company) => c.id === id);
    if (index === -1) {
      return res.status(404).json({ error: "الكيان غير موجود" });
    }
    
    const prevName = db.companies[index].name;
    if (name) {
      db.companies[index].name = name;
    }
    db.companies[index].logo_url = logo_url || "";
    db.companies[index].primary_color = primary_color || "";
    db.companies[index].currency = currency || "ر.س";
    db.companies[index].widget_order = widget_order || "";
    
    logEvent(
      db,
      id,
      "تعديل إعدادات وهوية المنشأة",
      `تم تحديث هوية المنشأة "${prevName}" إلى: الاسم "${name || prevName}"، العملة: "${currency || "ر.س"}"، واللون الأساسي: "${primary_color || "تلقائي"}"، وترتيب الإحصائيات: "${widget_order || "تلقائي"}"`
    );
    
    writeDb(db);
    res.json(db.companies[index]);
  });

  // 2.6. Update company subscription plan
  app.put("/api/companies/:id/subscription", (req, res) => {
    const { id } = req.params;
    const { subscription_plan, subscription_billing_cycle, price_paid } = req.body;
    const db = readDb();
    
    db.companies = db.companies || [];
    const index = db.companies.findIndex((c: Company) => c.id === id);
    if (index === -1) {
      return res.status(404).json({ error: "الكيان غير موجود" });
    }
    
    const prevPlan = db.companies[index].subscription_plan || "Trial";
    
    db.companies[index].subscription_plan = subscription_plan;
    db.companies[index].subscription_billing_cycle = subscription_billing_cycle || "monthly";
    db.companies[index].subscription_status = "Active";
    db.companies[index].subscription_price_paid = Number(price_paid) || 0;
    
    const now = new Date();
    if (subscription_billing_cycle === "yearly") {
      now.setFullYear(now.getFullYear() + 1);
    } else {
      now.setMonth(now.getMonth() + 1);
    }
    db.companies[index].subscription_expiry = now.toISOString().split("T")[0];
    
    logEvent(
      db,
      id,
      "ترقية خطة الاشتراك والخدمات",
      `تم تحديث خطة اشتراك المنشأة من "${prevPlan}" إلى "${subscription_plan}" بدورة دفع: "${subscription_billing_cycle === "yearly" ? "سنوية" : "شهرية"}"`
    );
    
    writeDb(db);
    res.json(db.companies[index]);
  });

  // Mid-tier helper to filter by company (tenant)
  const getCompanyId = (req: express.Request): string => {
    return (req.headers["x-company-id"] as string) || "comp-1";
  };

  // 3. Get clients
  app.get("/api/clients", (req, res) => {
    const companyId = getCompanyId(req);
    const db = readDb();
    const clients = (db.clients || []).filter((c: Client) => c.company_id === companyId);
    res.json(clients);
  });

  // 4. Create client
  app.post("/api/clients", (req, res) => {
    const companyId = getCompanyId(req);
    const { name, company, phone } = req.body;
    if (!name) {
      return res.status(400).json({ error: "اسم العميل مطلوب" });
    }
    const db = readDb();
    const newClient: Client = {
      id: "cli-" + Date.now(),
      company_id: companyId,
      name,
      company: company || "",
      phone: phone || ""
    };
    db.clients = db.clients || [];
    db.clients.push(newClient);
    
    logEvent(
      db,
      companyId,
      "إنشاء عميل جديد",
      `تم تسجيل عميل جديد باسم: "${name}" ${company ? `(${company})` : ""} وهاتف: ${phone || "غير متوفر"}`
    );
    
    writeDb(db);
    res.json(newClient);
  });

  // 4a. Bulk create clients
  app.post("/api/clients/bulk", (req, res) => {
    const companyId = getCompanyId(req);
    const { clients } = req.body;

    if (!clients || !Array.isArray(clients) || clients.length === 0) {
      return res.status(400).json({ error: "الرجاء إرسال قائمة عملاء صالحة" });
    }

    const db = readDb();
    db.clients = db.clients || [];

    const newClients: Client[] = [];
    let countImported = 0;

    clients.forEach((c: any, index: number) => {
      if (!c.name || !String(c.name).trim()) return;

      const newC: Client = {
        id: "cli-" + (Date.now() + index),
        company_id: companyId,
        name: String(c.name).trim(),
        company: c.company ? String(c.company).trim() : "",
        phone: c.phone ? String(c.phone).trim() : ""
      };

      db.clients.push(newC);
      newClients.push(newC);
      countImported++;
    });

    if (countImported > 0) {
      logEvent(
        db,
        companyId,
        "استيراد عملاء دفعة واحدة (Bulk)",
        `تم استيراد ${countImported} عميل بموجب استيراد ملف CSV بنجاح`
      );
      writeDb(db);
    }

    res.json({
      status: "success",
      imported: countImported,
      clients: newClients
    });
  });

  // 5. Get operations
  app.get("/api/operations", (req, res) => {
    const companyId = getCompanyId(req);
    const db = readDb();
    const operations = (db.operations || []).filter((o: Operation) => o.company_id === companyId);
    res.json(operations);
  });

  // 6. Create operation
  app.post("/api/operations", (req, res) => {
    const companyId = getCompanyId(req);
    const { client_id, service, cost, revenue, status } = req.body;

    if (!service) {
      return res.status(400).json({ error: "الخدمة مطلوبة" });
    }

    const db = readDb();
    const cVal = Number(cost) || 0;
    const rVal = Number(revenue) || 0;
    const profit = rVal - cVal;

    const newOp: Operation = {
      id: "op-" + Date.now(),
      company_id: companyId,
      client_id: client_id || "",
      service,
      cost: cVal,
      revenue: rVal,
      profit,
      date: new Date().toISOString().split("T")[0],
      status: status || "In Progress"
    };

    db.operations = db.operations || [];
    db.operations.push(newOp);

    // Auto-generate invoice
    const invId = "INV-" + new Date().toISOString().replace(/[-:T.Z]/g, "").substring(0, 14);
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);

    const newInv: Invoice = {
      id: invId,
      company_id: companyId,
      op_id: newOp.id,
      client_id: client_id || "",
      amount: rVal,
      status: "Unpaid",
      due_date: dueDate.toISOString().split("T")[0]
    };

    db.invoices = db.invoices || [];
    db.invoices.push(newInv);

    const clientObj = (db.clients || []).find((c: any) => c.id === client_id);
    const clientNameStr = clientObj ? `للعميل: "${clientObj.name}"` : "لعميل عام";
    
    logEvent(
      db,
      companyId,
      "إنشاء عملية وقص فاتورة",
      `تم إنجاز خدمة: "${service}" بقيمة ${rVal.toLocaleString()} ${db.companies?.find((c: any) => c.id === companyId)?.currency || "ر.س"} ${clientNameStr} وتوليد الفاتورة التلقائية (#${invId})`
    );

    writeDb(db);

    res.json({
      status: "success",
      message: "تم إنشاء العملية بنجاح وتوليد الفاتورة التلقائية",
      operation: newOp,
      invoice: newInv
    });
  });

  // 6a. Bulk create operations
  app.post("/api/operations/bulk", (req, res) => {
    const companyId = getCompanyId(req);
    const { operations } = req.body;

    if (!operations || !Array.isArray(operations) || operations.length === 0) {
      return res.status(400).json({ error: "الرجاء إرسال قائمة عمليات صالحة" });
    }

    const db = readDb();
    db.clients = db.clients || [];
    db.operations = db.operations || [];
    db.invoices = db.invoices || [];

    const newOps: Operation[] = [];
    const newInvs: Invoice[] = [];
    let countImported = 0;

    operations.forEach((op: any, index: number) => {
      if (!op.service || !String(op.service).trim()) return;

      const serviceName = String(op.service).trim();
      let clientId = "";

      // Simple client resolution: if name provided, lookup or create on-the-fly
      if (op.client_name && String(op.client_name).trim()) {
        const cName = String(op.client_name).trim();
        const existingClient = db.clients.find(
          (c: any) => c.company_id === companyId && String(c.name).toLowerCase() === cName.toLowerCase()
        );

        if (existingClient) {
          clientId = existingClient.id;
        } else {
          // Auto create client record
          const newC: Client = {
            id: "cli-" + (Date.now() + index + 5000),
            company_id: companyId,
            name: cName,
            company: op.client_company ? String(op.client_company).trim() : "",
            phone: op.client_phone ? String(op.client_phone).trim() : ""
          };
          db.clients.push(newC);
          clientId = newC.id;
        }
      }

      const costVal = Number(op.cost) || 0;
      const revVal = Number(op.revenue) || 0;
      const profitVal = revVal - costVal;

      let opDate = op.date ? String(op.date).trim() : "";
      if (!opDate || !/^\d{4}-\d{2}-\d{2}$/.test(opDate)) {
        opDate = new Date().toISOString().split("T")[0];
      }

      let opStatus: "Pending" | "In Progress" | "Completed" = "In Progress";
      if (op.status && ["Pending", "In Progress", "Completed"].includes(op.status)) {
        opStatus = op.status;
      }

      const newOp: Operation = {
        id: "op-" + (Date.now() + index),
        company_id: companyId,
        client_id: clientId,
        service: serviceName,
        cost: costVal,
        revenue: revVal,
        profit: profitVal,
        date: opDate,
        status: opStatus
      };

      db.operations.push(newOp);
      newOps.push(newOp);

      // Auto generate Invoice
      const randSuff = Math.floor(100 + Math.random() * 900);
      const invoiceId = "INV-" + opDate.replace(/-/g, "") + randSuff + index;
      const dueDateObj = new Date(opDate);
      dueDateObj.setDate(dueDateObj.getDate() + 7);

      const invoiceStatus = (op.invoice_status === "Paid" || opStatus === "Completed") ? "Paid" : "Unpaid";

      const newInv: Invoice = {
        id: invoiceId,
        company_id: companyId,
        op_id: newOp.id,
        client_id: clientId,
        amount: revVal,
        status: invoiceStatus,
        due_date: dueDateObj.toISOString().split("T")[0]
      };

      if (invoiceStatus === "Paid") {
        newInv.payment_date = opDate;
      }

      db.invoices.push(newInv);
      newInvs.push(newInv);
      countImported++;
    });

    if (countImported > 0) {
      logEvent(
        db,
        companyId,
        "استيراد عمليات وفواتير دفعة واحدة (Bulk)",
        `تم استيراد ${countImported} عملية تشغيلية وتوليد فواتيرها بنجاح بموجب استيراد ملف CSV`
      );
      writeDb(db);
    }

    res.json({
      status: "success",
      imported: countImported,
      operations: newOps,
      invoices: newInvs
    });
  });

  // 6.1. Update operation status
  app.patch("/api/operations/:id", (req, res) => {
    const companyId = getCompanyId(req);
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !["Pending", "In Progress", "Completed"].includes(status)) {
      return res.status(400).json({ error: "حالة العملية غير صالحة" });
    }

    const db = readDb();
    db.operations = db.operations || [];
    const opIndex = db.operations.findIndex((o: any) => o.id === id && o.company_id === companyId);

    if (opIndex === -1) {
      return res.status(404).json({ error: "العملية غير موجودة" });
    }

    const oldStatus = db.operations[opIndex].status || "In Progress";
    db.operations[opIndex].status = status;

    const statusTranslations: Record<string, string> = {
      "Pending": "معلقة",
      "In Progress": "قيد التنفيذ",
      "Completed": "مكتملة"
    };

    logEvent(
      db,
      companyId,
      "تحديث حالة العملية",
      `تم تغيير حالة العملية "${db.operations[opIndex].service}" من (${statusTranslations[oldStatus] || oldStatus}) إلى (${statusTranslations[status] || status})`
    );

    writeDb(db);
    res.json(db.operations[opIndex]);
  });

  // 7. Get invoices
  app.get("/api/invoices", (req, res) => {
    const companyId = getCompanyId(req);
    const db = readDb();
    const invoices = (db.invoices || []).filter((i: Invoice) => i.company_id === companyId);
    res.json(invoices);
  });

  // 7.1. Get overdue invoices for notification center
  app.get("/api/invoices/overdue", (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const db = readDb();
      const todayStr = new Date().toISOString().split("T")[0];
      
      const invoices = (db.invoices || []).filter(
        (i: Invoice) => i.company_id === companyId && i.status === "Unpaid" && i.due_date && i.due_date < todayStr
      );
      
      const clients = db.clients || [];
      const clientMap = new Map(
        clients.filter((c: any) => c && c.id).map((c: any) => [c.id, c.name || ""])
      );
      
      const result = invoices.map((i: Invoice) => ({
        ...i,
        client_name: clientMap.get(i.client_id) || "عميل غير معروف"
      }));
      
      res.json(result);
    } catch (err) {
      console.error("Error in /api/invoices/overdue route:", err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // 8. Put/Patch Update Invoice Payment Status
  app.patch("/api/invoices/:id", (req, res) => {
    const companyId = getCompanyId(req);
    const { id } = req.params;
    const { status } = req.body; // "Paid" | "Unpaid"

    if (status !== "Paid" && status !== "Unpaid") {
      return res.status(400).json({ error: "حالة الفاتورة غير صالحة" });
    }

    const db = readDb();
    const invIndex = (db.invoices || []).findIndex(
      (i: Invoice) => i.id === id && i.company_id === companyId
    );

    if (invIndex === -1) {
      return res.status(404).json({ error: "الفاتورة غير موجودة" });
    }

    db.invoices[invIndex].status = status;
    if (status === "Paid") {
      db.invoices[invIndex].payment_date = new Date().toISOString().split("T")[0];
    } else {
      delete db.invoices[invIndex].payment_date;
    }

    const currInvoice = db.invoices[invIndex];
    const shortInvId = id.split("-").pop() || id;
    const compSetting = (db.companies || []).find((c: any) => c.id === companyId);
    
    logEvent(
      db,
      companyId,
      "تحديث حالة سداد الفاتورة",
      `تحديث فاتورة رقم #${shortInvId} بقيمة ${currInvoice.amount.toLocaleString()} ${compSetting?.currency || "ر.س"} إلى: ${status === "Paid" ? "✅ مدفوعة ومحصلة" : "⏳ غير مدفوعة / قيد الانتظار"}`
    );

    writeDb(db);
    res.json(db.invoices[invIndex]);
  });

  // 9. Get stats & analysis for dashboard
  app.get("/api/stats", (req, res) => {
    const companyId = getCompanyId(req);
    const db = readDb();

    const ops = (db.operations || []).filter((o: Operation) => o.company_id === companyId);
    const invs = (db.invoices || []).filter((i: Invoice) => i.company_id === companyId);
    const clientsCount = (db.clients || []).filter((c: Client) => c.company_id === companyId).length;
    const exps = (db.expenses || []).filter((e: any) => e.company_id === companyId);

    let totalRevenue = 0;
    let totalCost = 0;
    let totalProfit = 0;

    ops.forEach((o: Operation) => {
      totalRevenue += o.revenue;
      totalCost += o.cost;
      totalProfit += o.profit;
    });

    // Sum operational and recurring expenses
    let totalOpExpenses = 0;
    exps.forEach((e: any) => {
      totalOpExpenses += Number(e.amount) || 0;
    });

    totalCost += totalOpExpenses;
    totalProfit -= totalOpExpenses;

    let paidAmount = 0;
    let unpaidAmount = 0;
    let overdueCount = 0;

    const todayStr = new Date().toISOString().split("T")[0];

    invs.forEach((i: Invoice) => {
      if (i.status === "Paid") {
        paidAmount += i.amount;
      } else {
        unpaidAmount += i.amount;
        if (i.due_date && i.due_date < todayStr) {
          overdueCount++;
        }
      }
    });

    res.json({
      totalRevenue,
      totalCost,
      totalProfit,
      clientsCount,
      operationsCount: ops.length,
      invoicesCount: invs.length,
      paidAmount,
      unpaidAmount,
      overdueCount,
      profitMargin: totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : "0"
    });
  });

  // 9.1. Get expenses
  app.get("/api/expenses", (req, res) => {
    const companyId = getCompanyId(req);
    const db = readDb();
    const expenses = (db.expenses || []).filter((e: Expense) => e.company_id === companyId);
    res.json(expenses);
  });

  // 9.2. Create expense
  app.post("/api/expenses", (req, res) => {
    const companyId = getCompanyId(req);
    const { category, amount, frequency, date, description } = req.body;

    if (!category || !amount) {
      return res.status(400).json({ error: "الفئة والملبغ مطلوبان" });
    }

    const db = readDb();
    const newExpense: Expense = {
      id: "exp-" + Date.now(),
      company_id: companyId,
      category,
      amount: Number(amount) || 0,
      frequency: frequency || "monthly",
      date: date || new Date().toISOString().split("T")[0],
      description: description || ""
    };

    db.expenses = db.expenses || [];
    db.expenses.push(newExpense);

    const compSetting = (db.companies || []).find((c: any) => c.id === companyId);
    const categoryNameAr = category === "rent" ? "إيجار" : category === "salaries" ? "رواتب" : category === "subscriptions" ? "اشتراكات" : category === "utilities" ? "مرافق وخدمات" : category === "marketing" ? "تسويق" : "مصروفات تشغيلية أخرى";
    
    logEvent(
      db,
      companyId,
      "تسجيل مصروف تشغيلي جديد",
      `تم تسجيل مصروف دوري فئة: (${categoryNameAr}) بمبلغ ${newExpense.amount.toLocaleString()} ${compSetting?.currency || "ر.س"} بدورية: (${frequency}) ووصف: "${description || "لا يوجد"}"`
    );

    writeDb(db);
    res.json(newExpense);
  });

  // 9.3. Delete expense
  app.delete("/api/expenses/:id", (req, res) => {
    const companyId = getCompanyId(req);
    const { id } = req.params;
    const db = readDb();

    db.expenses = db.expenses || [];
    const index = db.expenses.findIndex((e: any) => e.id === id && e.company_id === companyId);
    if (index === -1) {
      return res.status(404).json({ error: "المصروف غير موجود" });
    }

    const exp = db.expenses[index];
    db.expenses.splice(index, 1);

    const compSetting = (db.companies || []).find((c: any) => c.id === companyId);
    const categoryNameAr = exp.category === "rent" ? "إيجار" : exp.category === "salaries" ? "رواتب" : exp.category === "subscriptions" ? "اشتراكات" : exp.category === "utilities" ? "مرافق وخدمات" : exp.category === "marketing" ? "تسويق" : "مصروفات أخرى";

    logEvent(
      db,
      companyId,
      "حذف مصروف تشغيلي",
      `تم حذف المصروف الدوري فئة: (${categoryNameAr}) بمبلغ ${exp.amount.toLocaleString()} ${compSetting?.currency || "ر.س"}`
    );

    writeDb(db);
    res.json({ success: true, message: "تم حذف المصروف بنجاح" });
  });

  // Lazy initialize GoogleGenAI client (no startup crash if GEMINI_API_KEY is not defined yet)
  let aiClient: GoogleGenAI | null = null;
  function getGeminiClient() {
    if (!aiClient) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not configured in your environment variables. Please check your system or Secrets tab.");
      }
      aiClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });
    }
    return aiClient;
  }

  // 9.4. Categorize expense description using AI (Gemini 3.5 Flash)
  app.post("/api/expenses/categorize", async (req, res) => {
    const { description } = req.body;
    if (!description || typeof description !== "string" || !description.trim()) {
      return res.status(400).json({ error: "الوصف مطلوب للتصنيف الذكي" });
    }

    try {
      const ai = getGeminiClient();
      const systemInstruction = `You are a professional accountant and CFO assistant. 
Categorize the user's corporate/company expense description into exactly one of the standard categories:
- rent (rent, real estate, office space lease, warehouse, landlord payment)
- salaries (wages, payroll, bonuses, salary, contractor payouts, employee compensation)
- office_supplies (paper, pens, printers, stationary, desks, office chairs, kitchen coffee/tea supplies)
- subscriptions (software, cloud hosting, SaaS, AWS, Zoom, Slate, Figma, Salesforce, Azure)
- utilities (electricity, water, gas, internet bill, phone bill, sewage)
- marketing (ads, Google ads, Facebook campaigns, branding, brochures, influencers, event sponsorship)
- other (any general expense that absolutely doesn't fit the specified list)

You must return a raw JSON object complying with the schema with 'category', 'confidence', and 'reasoning' keys. Use professional Arabic for the reasoning.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `Categorize this expense: "${description}"`,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              category: {
                type: Type.STRING,
                description: "Must be exactly one of: rent, salaries, office_supplies, subscriptions, utilities, marketing, other"
              },
              confidence: {
                type: Type.NUMBER,
                description: "Confidence probability of classification from 0.0 to 1.0"
              },
              reasoning: {
                type: Type.STRING,
                description: "Brief professional explanation in Arabic justifying the classification choice"
              }
            },
            required: ["category", "confidence", "reasoning"]
          }
        }
      });

      const jsonText = response.text || "{}";
      const parsedData = JSON.parse(jsonText.trim());
      res.json(parsedData);
    } catch (err: any) {
      console.error("Expense AI categorization error:", err);
      res.status(500).json({ 
        error: err.message || "حدث خطأ أثناء إجراء التصنيف الذكي بواسطة الذكاء الاصطناعي." 
      });
    }
  });

  // 9.5. Get Audit Logs
  app.get("/api/audit-logs", (req, res) => {
    const companyId = getCompanyId(req);
    const db = readDb();
    const logs = (db.audit_logs || []).filter((l: AuditLog) => l.company_id === companyId);
    const sorted = [...logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    res.json(sorted);
  });

  // 9.6. Log custom action from client
  app.post("/api/audit-logs", (req, res) => {
    const companyId = getCompanyId(req);
    const { action, details, user } = req.body;
    if (!action) {
      return res.status(400).json({ error: "اسم الإجراء مطلوب" });
    }
    const db = readDb();
    logEvent(db, companyId, action, details || "", user || "awadh.a.1987@gmail.com");
    writeDb(db);
    res.json({ status: "success" });
  });

  // 9.7. Delete operation and cancel invoice
  app.delete("/api/operations/:id", (req, res) => {
    const companyId = getCompanyId(req);
    const { id } = req.params;
    const db = readDb();

    db.operations = db.operations || [];
    const opIndex = (db.operations || []).findIndex((o: any) => o.id === id && o.company_id === companyId);
    if (opIndex === -1) {
      return res.status(404).json({ error: "العملية التشغيلية غير موجودة" });
    }

    const op = db.operations[opIndex];

    // Delete associated invoices
    db.invoices = (db.invoices || []).filter((i: any) => !(i.op_id === id && i.company_id === companyId));

    // Remove operation
    db.operations.splice(opIndex, 1);

    // Get client details for logging
    const clientObj = (db.clients || []).find((c: any) => c.id === op.client_id);
    const clientNameStr = clientObj ? `للعميل "${clientObj.name}"` : "لعميل عام";
    const compSetting = (db.companies || []).find((c: any) => c.id === companyId);

    logEvent(
      db,
      companyId,
      "حذف عملية تشغيلية",
      `تم حذف الخدمة: "${op.service}" بقيمة ${op.revenue.toLocaleString()} ${compSetting?.currency || "ر.س"} ${clientNameStr}، وإلغاء فواتيرها التلقائية والافتراضية المرتبطة به.`
    );

    writeDb(db);
    res.json({ success: true, message: "تم حذف العملية التشغيلية وإلغاء الفواتير بنجاح" });
  });

  // --- Database Resilience & Daily Secure Backups Service ---
  const BACKUP_DIR = path.join(process.cwd(), "secure_storage_bucket");
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  function triggerBackup(isAuto: boolean, companyId = "comp-1"): { success: boolean; filename: string; size: number; timestamp: string } {
    try {
      const db = readDb();
      const dateStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
      const timestampStr = Date.now();
      const filename = `backup-${dateStr}-${timestampStr}-${isAuto ? "auto" : "manual"}.json`;
      const destPath = path.join(BACKUP_DIR, filename);
      
      const dbContent = JSON.stringify(db, null, 2);
      fs.writeFileSync(destPath, dbContent, "utf-8");
      
      const size = fs.statSync(destPath).size;
      
      logEvent(
        db,
        companyId,
        isAuto ? "نسخ احتياطي تلقائي للبيانات" : "نسخ احتياطي يدوي للبيانات",
        `تم إنشاء نسخة احتياطية بنجاح وحفظها في الحاوية السحابية الآمنة باسم: ${filename} بحجم ${(size / 1024).toFixed(2)} KB.`
      );
      writeDb(db);
      
      return { success: true, filename, size, timestamp: new Date().toISOString() };
    } catch (error) {
      console.error("Backup failed:", error);
      throw error;
    }
  }

  function runDailyBackupCheck() {
    try {
      if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
      }
      const files = fs.readdirSync(BACKUP_DIR);
      const dateToday = new Date().toISOString().split("T")[0];
      
      const hasBackupForToday = files.some(file => file.startsWith(`backup-${dateToday}-`));
      
      if (!hasBackupForToday) {
        console.log(`[Backup Service] No backup found for today (${dateToday}). Performing automatic system daily backup...`);
        const result = triggerBackup(true, "comp-1");
        console.log(`[Backup Service] Daily automatic backup completed successfully: ${result.filename}`);
      } else {
        console.log(`[Backup Service] Daily backup already exists for today (${dateToday}). Skipping daily run.`);
      }
    } catch (err) {
      console.error("[Backup Service] Failed running daily automatic backup check:", err);
    }
  }

  // Run immediately on boot and set hourly interval (3600000 ms)
  runDailyBackupCheck();
  setInterval(runDailyBackupCheck, 3600000);

  // 9.8. Get backups list
  app.get("/api/backups", (req, res) => {
    try {
      if (!fs.existsSync(BACKUP_DIR)) {
        return res.json([]);
      }
      const files = fs.readdirSync(BACKUP_DIR);
      const backups = files
        .filter(f => f.startsWith("backup-") && f.endsWith(".json"))
        .map(f => {
          const stats = fs.statSync(path.join(BACKUP_DIR, f));
          const type = f.includes("auto") ? "auto" : "manual";
          return {
            filename: f,
            size: stats.size,
            created_at: stats.mtime.toISOString(),
            type
          };
        })
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      res.json(backups);
    } catch (error: any) {
      res.status(500).json({ error: "تعذر قراءة ملفات النسخ الاحتياطي: " + error.message });
    }
  });

  // 9.9. Trigger Backup manually
  app.post("/api/backups/trigger", (req, res) => {
    const companyId = getCompanyId(req);
    try {
      const result = triggerBackup(false, companyId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: "تعذر تنفيذ النسخ الاحتياطي الكلي: " + error.message });
    }
  });

  // --- Database Archiving Service for Performance Optimization ---
  // Get archive eligibility status & counts
  app.get("/api/archive/status", (req, res) => {
    const companyId = getCompanyId(req);
    const db = readDb();
    
    // Calculates a 1 year cut-off boundary dynamically
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const cutoffDate = oneYearAgo.toISOString().split("T")[0]; // YYYY-MM-DD
    
    const activeOps = db.operations || [];
    const activeInvs = db.invoices || [];
    
    const archivableOps = activeOps.filter((o: any) => o.company_id === companyId && o.date < cutoffDate);
    const archivableOpIds = new Set(archivableOps.map((o: any) => o.id));
    
    const archivableInvs = activeInvs.filter((i: any) => 
      i.company_id === companyId && 
      (i.due_date < cutoffDate || archivableOpIds.has(i.op_id))
    );
    
    const archivedOpsCount = (db.archived_operations || []).filter((o: any) => o.company_id === companyId).length;
    const archivedInvsCount = (db.archived_invoices || []).filter((i: any) => i.company_id === companyId).length;
    
    res.json({
      cutoffDate,
      archivableOpsCount: archivableOps.length,
      archivableInvsCount: archivableInvs.length,
      archivedOpsCount,
      archivedInvsCount
    });
  });

  // Execute database archival moving old data to secondary cold archive storage
  app.post("/api/archive/run", (req, res) => {
    const companyId = getCompanyId(req);
    const db = readDb();
    
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const cutoffDate = oneYearAgo.toISOString().split("T")[0]; // YYYY-MM-DD
    
    db.operations = db.operations || [];
    db.invoices = db.invoices || [];
    db.archived_operations = db.archived_operations || [];
    db.archived_invoices = db.archived_invoices || [];
    
    // Select candidates
    const archivableOps = db.operations.filter((o: any) => o.company_id === companyId && o.date < cutoffDate);
    const archivableOpIds = new Set(archivableOps.map((o: any) => o.id));
    
    const archivableInvs = db.invoices.filter((i: any) => 
      i.company_id === companyId && 
      (i.due_date < cutoffDate || archivableOpIds.has(i.op_id))
    );
    
    if (archivableOps.length === 0 && archivableInvs.length === 0) {
      return res.json({
        success: true,
        message: "لا توجد أي عمليات أو فواتير قديمة (مضى عليها أكثر من عام) لأرشفتها حالياً.",
        archivedOpsCount: 0,
        archivedInvsCount: 0
      });
    }
    
    // Append to archive arrays
    db.archived_operations.push(...archivableOps);
    db.archived_invoices.push(...archivableInvs);
    
    // Remove from active arrays
    db.operations = db.operations.filter((o: any) => !(o.company_id === companyId && o.date < cutoffDate));
    db.invoices = db.invoices.filter((i: any) => 
      !(i.company_id === companyId && (i.due_date < cutoffDate || archivableOpIds.has(i.op_id)))
    );
    
    const compSetting = (db.companies || []).find((c: any) => c.id === companyId);
    const currencyStr = compSetting?.currency || "ر.س";
    const totalRevSaved = archivableOps.reduce((sum: number, o: any) => sum + (o.revenue || 0), 0);
    
    logEvent(
      db,
      companyId,
      "أرشفة البيانات القديمة لتسريع الاستعلام",
      `تمت أرشفة ${archivableOps.length} عملية و ${archivableInvs.length} تفاصيل فواتير مضى عليها أكثر من عام (قبل تاريخ ${cutoffDate}). تم نقلها للأرشيف المستقل بنجاح لزيادة السرعة والأداء. قيمة العقود التشغيلية المؤرشفة: ${totalRevSaved.toLocaleString()} ${currencyStr}.`
    );
    
    writeDb(db);
    
    res.json({
      success: true,
      message: `تم ترحيل البيانات القديمة بنجاح! تم أرشفة ${archivableOps.length} عملية تشغيلية و ${archivableInvs.length} فاتورة.`,
      archivedOpsCount: archivableOps.length,
      archivedInvsCount: archivableInvs.length,
      cutoffDate
    });
  });

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
