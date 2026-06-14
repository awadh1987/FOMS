import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeFirestore, collection, doc, getDocs, setDoc, deleteDoc, writeBatch } from "firebase/firestore";
import fs from "fs";
import path from "path";

let dbInstance: any = null;

function getDb() {
  if (dbInstance) return dbInstance;

  try {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (!fs.existsSync(configPath)) {
      console.warn("firebase-applet-config.json not found on backend. Sync is disabled.");
      return null;
    }
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const app = getApps().length === 0 ? initializeApp(config) : getApp();
    dbInstance = initializeFirestore(app, {
      experimentalForceLongPolling: true,
    }, config.firestoreDatabaseId);
    return dbInstance;
  } catch (err) {
    console.error("Failed to initialize Firebase on server:", err);
    return null;
  }
}

// Clear undefined properties recursively so Firestore doesn't throw errors
function sanitize(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(sanitize);
  } else if (obj !== null && typeof obj === "object") {
    const fresh: any = {};
    for (const key of Object.keys(obj)) {
      if (obj[key] !== undefined) {
        fresh[key] = sanitize(obj[key]);
      }
    }
    return fresh;
  }
  return obj;
}

export async function loadFromFirestore(): Promise<any> {
  const db = getDb();
  if (!db) return null;

  try {
    console.log("Loading SaaS backoffice data from Firestore...");
    
    const companiesSnapshot = await getDocs(collection(db, "companies"));
    if (companiesSnapshot.empty) {
      console.log("Firestore database is empty. Will seed from initial local state.");
      return null;
    }

    const companies: any[] = [];
    const clients: any[] = [];
    const operations: any[] = [];
    const invoices: any[] = [];
    const expenses: any[] = [];
    const audit_logs: any[] = [];

    for (const companyDoc of companiesSnapshot.docs) {
      const companyId = companyDoc.id;
      companies.push({ id: companyId, ...companyDoc.data() });

      // Load sub-collections
      const clientsSnapshot = await getDocs(collection(db, "companies", companyId, "clients"));
      clientsSnapshot.forEach(doc => clients.push({ id: doc.id, ...doc.data() }));

      const operationsSnapshot = await getDocs(collection(db, "companies", companyId, "operations"));
      operationsSnapshot.forEach(doc => operations.push({ id: doc.id, ...doc.data() }));

      const invoicesSnapshot = await getDocs(collection(db, "companies", companyId, "invoices"));
      invoicesSnapshot.forEach(doc => invoices.push({ id: doc.id, ...doc.data() }));

      const expensesSnapshot = await getDocs(collection(db, "companies", companyId, "expenses"));
      expensesSnapshot.forEach(doc => expenses.push({ id: doc.id, ...doc.data() }));

      const logsSnapshot = await getDocs(collection(db, "companies", companyId, "audit_logs"));
      logsSnapshot.forEach(doc => audit_logs.push({ id: doc.id, ...doc.data() }));
    }

    console.log(`Successfully completed Firestore load. Loaded ${companies.length} companies, ${clients.length} clients, ${operations.length} operations, ${invoices.length} invoices.`);
    
    return {
      companies,
      clients,
      operations,
      invoices,
      expenses,
      audit_logs
    };
  } catch (err) {
    console.error("Error loading backing ledger database state from Firestore:", err);
    return null;
  }
}

export async function saveToFirestore(dbData: any): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    const cleanData = sanitize(dbData);
    
    const companies = cleanData.companies || [];
    const clients = cleanData.clients || [];
    const operations = cleanData.operations || [];
    const invoices = cleanData.invoices || [];
    const expenses = cleanData.expenses || [];
    const audit_logs = cleanData.audit_logs || [];

    // 1. Sync companies
    for (const company of companies) {
      const { id, ...payload } = company;
      await setDoc(doc(db, "companies", id), payload);
    }

    // 2. Map current item lists for lookup during prune / clean up phases
    const activeClientsByCompany = new Map<string, string[]>();
    const activeOperationsByCompany = new Map<string, string[]>();
    const activeInvoicesByCompany = new Map<string, string[]>();
    const activeExpensesByCompany = new Map<string, string[]>();
    const activeLogsByCompany = new Map<string, string[]>();

    // 3. Write sub-collections
    for (const client of clients) {
      const { id, company_id, ...payload } = client;
      if (company_id) {
        if (!activeClientsByCompany.has(company_id)) activeClientsByCompany.set(company_id, []);
        activeClientsByCompany.get(company_id)!.push(id);
        
        await setDoc(doc(db, "companies", company_id, "clients", id), { company_id, ...payload });
      }
    }

    for (const op of operations) {
      const { id, company_id, ...payload } = op;
      if (company_id) {
        if (!activeOperationsByCompany.has(company_id)) activeOperationsByCompany.set(company_id, []);
        activeOperationsByCompany.get(company_id)!.push(id);

        await setDoc(doc(db, "companies", company_id, "operations", id), { company_id, ...payload });
      }
    }

    for (const inv of invoices) {
      const { id, company_id, ...payload } = inv;
      if (company_id) {
        if (!activeInvoicesByCompany.has(company_id)) activeInvoicesByCompany.set(company_id, []);
        activeInvoicesByCompany.get(company_id)!.push(id);

        await setDoc(doc(db, "companies", company_id, "invoices", id), { company_id, ...payload });
      }
    }

    for (const exp of expenses) {
      const { id, company_id, ...payload } = exp;
      if (company_id) {
        if (!activeExpensesByCompany.has(company_id)) activeExpensesByCompany.set(company_id, []);
        activeExpensesByCompany.get(company_id)!.push(id);

        await setDoc(doc(db, "companies", company_id, "expenses", id), { company_id, ...payload });
      }
    }

    // Since audit logs grow, only write new ones
    for (const log of audit_logs) {
      const { id, company_id, ...payload } = log;
      if (company_id) {
        if (!activeLogsByCompany.has(company_id)) activeLogsByCompany.set(company_id, []);
        activeLogsByCompany.get(company_id)!.push(id);

        await setDoc(doc(db, "companies", company_id, "audit_logs", id), { company_id, ...payload });
      }
    }

    // 4. PRUNING: Delete orphans from Firestore that are no longer in DB state (e.g. deleted operations, invoices, expenses)
    for (const company of companies) {
      const companyId = company.id;

      // Clients Prune
      const clientsSnapshot = await getDocs(collection(db, "companies", companyId, "clients"));
      const keptClientIds = activeClientsByCompany.get(companyId) || [];
      for (const snapDoc of clientsSnapshot.docs) {
        if (!keptClientIds.includes(snapDoc.id)) {
          await deleteDoc(doc(db, "companies", companyId, "clients", snapDoc.id));
        }
      }

      // Operations Prune
      const opsSnapshot = await getDocs(collection(db, "companies", companyId, "operations"));
      const keptOpIds = activeOperationsByCompany.get(companyId) || [];
      for (const snapDoc of opsSnapshot.docs) {
        if (!keptOpIds.includes(snapDoc.id)) {
          await deleteDoc(doc(db, "companies", companyId, "operations", snapDoc.id));
        }
      }

      // Invoices Prune
      const invsSnapshot = await getDocs(collection(db, "companies", companyId, "invoices"));
      const keptInvIds = activeInvoicesByCompany.get(companyId) || [];
      for (const snapDoc of invsSnapshot.docs) {
        if (!keptInvIds.includes(snapDoc.id)) {
          await deleteDoc(doc(db, "companies", companyId, "invoices", snapDoc.id));
        }
      }

      // Expenses Prune
      const expsSnapshot = await getDocs(collection(db, "companies", companyId, "expenses"));
      const keptExpIds = activeExpensesByCompany.get(companyId) || [];
      for (const snapDoc of expsSnapshot.docs) {
        if (!keptExpIds.includes(snapDoc.id)) {
          await deleteDoc(doc(db, "companies", companyId, "expenses", snapDoc.id));
        }
      }
    }

    return true;
  } catch (err) {
    console.error("Error synchronizing active state transaction payload to Firestore:", err);
    return false;
  }
}
