export type AccountCategory = "asset" | "liability" | "equity" | "profit" | "loss";

export interface Subaccount {
  id: number;
  accountId: number;
  name: string;
}

export interface Account {
  id: number;
  systemKey: "fixed_asset" | "depreciation_expense" | null;
  isSystem: boolean;
  name: string;
  category: AccountCategory;
  subaccountCount: number;
  subaccounts: Subaccount[];
}

export interface JournalLineInput {
  accountId: number;
  subaccountId?: number;
  side: "debit" | "credit";
  amount: number;
}

export interface Journal {
  id: number;
  date: string;
  description: string;
  lines: JournalLineInput[];
  debitTotal: number;
  creditTotal: number;
}

export interface FixedAssetInput {
  name?: string;
  acquisitionDate?: string;
  acquisitionPrice?: number;
  depreciationMethod?: string;
  usefulLife?: number;
  residualValue?: number;
  depreciationStartDate?: string;
}

export interface FixedAsset extends FixedAssetInput {
  id: number;
}

export interface FixedAssetOption {
  id: number;
  name: string;
}

export interface StatementLine {
  accountId: number;
  accountName: string;
  amount: number;
}

export interface BalanceSheet {
  asOf: string;
  assets: StatementLine[];
  liabilities: StatementLine[];
  equity: StatementLine[];
  totals: { assets: number; liabilities: number; equity: number };
}

export interface IncomeStatement {
  start: string;
  end: string;
  revenues: StatementLine[];
  expenses: StatementLine[];
  totals: { revenues: number; expenses: number; netIncome: number };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(payload?.error?.message ?? "処理に失敗しました。時間をおいて再度お試しください。");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const accountingApi = {
  listAccounts(category?: string) {
    const query = category ? `?category=${encodeURIComponent(category)}` : "";
    return request<Account[]>(`/accounts${query}`);
  },
  getAccount(id: number) {
    return request<Account>(`/accounts/${id}`);
  },
  createAccount(input: { name: string; category: AccountCategory }) {
    return request<Account>("/accounts", { method: "POST", body: JSON.stringify(input) });
  },
  updateAccount(id: number, input: { name: string; category: AccountCategory }) {
    return request<Account>(`/accounts/${id}`, { method: "PUT", body: JSON.stringify(input) });
  },
  createSubaccount(accountId: number, name: string) {
    return request<Subaccount>(`/accounts/${accountId}/subaccounts`, {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  },
  updateSubaccount(accountId: number, subaccountId: number, name: string) {
    return request<Subaccount>(`/accounts/${accountId}/subaccounts/${subaccountId}`, {
      method: "PUT",
      body: JSON.stringify({ name }),
    });
  },
  listFixedAssets() {
    return request<FixedAsset[]>("/fixed-assets");
  },
  getFixedAsset(id: number) {
    return request<FixedAsset>(`/fixed-assets/${id}`);
  },
  createFixedAsset(input: FixedAssetInput) {
    return request<FixedAsset>("/fixed-assets", { method: "POST", body: JSON.stringify(input) });
  },
  updateFixedAsset(id: number, input: FixedAssetInput) {
    return request<FixedAsset>(`/fixed-assets/${id}`, { method: "PUT", body: JSON.stringify(input) });
  },
  listFixedAssetOptions() {
    return request<FixedAssetOption[]>("/fixed-assets/journal-options");
  },
  listJournals(month: string) {
    return request<Journal[]>(`/journals?month=${encodeURIComponent(month)}`);
  },
  getJournal(id: number) {
    return request<Journal>(`/journals/${id}`);
  },
  createJournal(input: { date: string; description: string; lines: JournalLineInput[] }) {
    return request<Journal>("/journals", { method: "POST", body: JSON.stringify(input) });
  },
  updateJournal(id: number, input: { date: string; description: string; lines: JournalLineInput[] }) {
    return request<Journal>(`/journals/${id}`, { method: "PUT", body: JSON.stringify(input) });
  },
  deleteJournal(id: number) {
    return request<void>(`/journals/${id}`, { method: "DELETE" });
  },
  getBalanceSheet(asOf: string) {
    return request<BalanceSheet>(`/reports/balance-sheet?asOf=${encodeURIComponent(asOf)}`);
  },
  getIncomeStatement(start: string, end: string) {
    return request<IncomeStatement>(`/reports/income-statement?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
  },
};

export const categoryLabels: Record<AccountCategory, string> = {
  asset: "資産",
  liability: "負債",
  equity: "純資産",
  profit: "利益",
  loss: "損失",
};

export const yen = new Intl.NumberFormat("ja-JP");