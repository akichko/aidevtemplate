import Database from "better-sqlite3";
import type { AccountingRepository } from "../application/repository.js";
import type { FixedAssetRepository } from "../application/fixed-asset-repository.js";
import {
  calculateBalanceSheet,
  calculateIncomeStatement,
  journalMonthRange,
  type Account,
  type AccountCategory,
  type FixedAsset,
  type FixedAssetInput,
  type FixedAssetOption,
  type Journal,
  type JournalInput,
  type Subaccount,
} from "../domain/accounting.js";

interface AccountRow {
  id: number;
  system_key: string | null;
  is_system: number;
  name: string;
  category: AccountCategory;
  subaccountCount: number;
}

interface SubaccountRow {
  id: number;
  account_id: number;
  name: string;
}

interface FixedAssetRow {
  id: number;
  name: string | null;
  acquisition_date: string | null;
  acquisition_price: number | null;
  depreciation_method: string | null;
  useful_life: number | null;
  residual_value: number | null;
  depreciation_start_date: string | null;
}

interface JournalRow {
  id: number;
  entry_date: string;
  description: string;
}

interface JournalLineRow {
  id: number;
  journal_entry_id: number;
  account_id: number;
  subaccount_id: number | null;
  side: "debit" | "credit";
  amount: number;
}

export class SqliteAccountingRepository implements AccountingRepository, FixedAssetRepository {
  private readonly database: Database.Database;

  constructor(path: string) {
    this.database = new Database(path);
    this.database.pragma("foreign_keys = ON");
    this.database.pragma("journal_mode = WAL");
  }

  async initialize(): Promise<void> {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY,
        system_key TEXT,
        is_system INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0, 1)),
        name TEXT NOT NULL,
        category TEXT NOT NULL CHECK (category IN ('asset', 'liability', 'equity', 'profit', 'loss'))
      );
      CREATE TABLE IF NOT EXISTS subaccounts (
        id INTEGER PRIMARY KEY,
        account_id INTEGER NOT NULL REFERENCES accounts(id),
        name TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS journal_entries (
        id INTEGER PRIMARY KEY,
        entry_date TEXT NOT NULL,
        description TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS journal_lines (
        id INTEGER PRIMARY KEY,
        journal_entry_id INTEGER NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
        account_id INTEGER NOT NULL REFERENCES accounts(id),
        subaccount_id INTEGER,
        side TEXT NOT NULL CHECK (side IN ('debit', 'credit')),
          amount INTEGER NOT NULL CHECK (amount > 0)
      );
        CREATE TABLE IF NOT EXISTS fixed_assets (
          id INTEGER PRIMARY KEY,
          name TEXT,
          acquisition_date TEXT,
          acquisition_price REAL,
          depreciation_method TEXT,
          useful_life REAL,
          residual_value REAL,
          depreciation_start_date TEXT
        );
      CREATE INDEX IF NOT EXISTS ix_journal_entries_date ON journal_entries(entry_date);
    `);
    const accountColumns = this.database.pragma("table_info(accounts)") as Array<{ name: string }>;
    if (!accountColumns.some((column) => column.name === "system_key")) {
      this.database.exec("ALTER TABLE accounts ADD COLUMN system_key TEXT");
    }
    if (!accountColumns.some((column) => column.name === "is_system")) {
      this.database.exec("ALTER TABLE accounts ADD COLUMN is_system INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0, 1))");
    }
    this.database.exec("CREATE UNIQUE INDEX IF NOT EXISTS ux_accounts_system_key ON accounts(system_key)");
    this.database.prepare(`
      INSERT OR IGNORE INTO accounts (system_key, is_system, name, category)
      VALUES (?, 1, ?, ?)
    `).run("fixed_asset", "固定資産", "asset");
    this.database.prepare(`
      INSERT OR IGNORE INTO accounts (system_key, is_system, name, category)
      VALUES (?, 1, ?, ?)
    `).run("depreciation_expense", "減価償却費", "loss");
    this.database.exec(
      "CREATE UNIQUE INDEX IF NOT EXISTS ux_subaccounts_account_id_id ON subaccounts(account_id, id)",
    );
    const lineColumns = this.database.pragma("table_info(journal_lines)") as Array<{ name: string }>;
    if (!lineColumns.some((column) => column.name === "subaccount_id")) {
      const migrate = this.database.transaction(() => {
        this.database.exec(`
          CREATE TABLE journal_lines_new (
            id INTEGER PRIMARY KEY,
            journal_entry_id INTEGER NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
            account_id INTEGER NOT NULL REFERENCES accounts(id),
            subaccount_id INTEGER,
            side TEXT NOT NULL CHECK (side IN ('debit', 'credit')),
            amount INTEGER NOT NULL CHECK (amount > 0)
          );
          INSERT INTO journal_lines_new (id, journal_entry_id, account_id, subaccount_id, side, amount)
            SELECT id, journal_entry_id, account_id, NULL, side, amount FROM journal_lines;
          DROP TABLE journal_lines;
          ALTER TABLE journal_lines_new RENAME TO journal_lines;
        `);
      });
      migrate();
    }
    const lineForeignKeys = this.database.pragma("foreign_key_list(journal_lines)") as Array<{ table: string }>;
    if (lineForeignKeys.some((foreignKey) => foreignKey.table === "subaccounts")) {
      const migrate = this.database.transaction(() => {
        this.database.exec(`
          CREATE TABLE journal_lines_new (
            id INTEGER PRIMARY KEY,
            journal_entry_id INTEGER NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
            account_id INTEGER NOT NULL REFERENCES accounts(id),
            subaccount_id INTEGER,
            side TEXT NOT NULL CHECK (side IN ('debit', 'credit')),
            amount INTEGER NOT NULL CHECK (amount > 0)
          );
          INSERT INTO journal_lines_new (id, journal_entry_id, account_id, subaccount_id, side, amount)
            SELECT id, journal_entry_id, account_id, subaccount_id, side, amount FROM journal_lines;
          DROP TABLE journal_lines;
          ALTER TABLE journal_lines_new RENAME TO journal_lines;
        `);
      });
      migrate();
    }
    this.database.exec("CREATE INDEX IF NOT EXISTS ix_journal_lines_account ON journal_lines(account_id)");
  }

  async close(): Promise<void> {
    this.database.close();
  }

  async listAccounts(category?: AccountCategory): Promise<Account[]> {
    const rows = this.database.prepare(`
      SELECT a.id, a.system_key, a.is_system, a.name, a.category, COUNT(s.id) AS subaccountCount
      FROM accounts a
      LEFT JOIN subaccounts s ON s.account_id = a.id
      ${category ? "WHERE a.category = ?" : ""}
      GROUP BY a.id, a.system_key, a.is_system, a.name, a.category
      ORDER BY a.category, a.name, a.id
    `).all(...(category ? [category] : [])) as AccountRow[];
    return rows.map((row) => mapAccount(row, []));
  }

  async getAccount(accountId: number): Promise<Account | null> {
    const row = this.database.prepare(`
      SELECT a.id, a.system_key, a.is_system, a.name, a.category, COUNT(s.id) AS subaccountCount
      FROM accounts a
      LEFT JOIN subaccounts s ON s.account_id = a.id
      WHERE a.id = ?
      GROUP BY a.id, a.system_key, a.is_system, a.name, a.category
    `).get(accountId) as AccountRow | undefined;
    if (!row) return null;
    const subaccounts = this.database.prepare(
      "SELECT id, account_id, name FROM subaccounts WHERE account_id = ? ORDER BY name, id",
    ).all(accountId) as SubaccountRow[];
    return mapAccount(row, subaccounts.map(mapSubaccount));
  }

  async createAccount(input: { name: string; category: AccountCategory }): Promise<Account> {
    const result = this.database.prepare("INSERT INTO accounts (name, category) VALUES (?, ?)")
      .run(input.name.trim(), input.category);
    return (await this.getAccount(Number(result.lastInsertRowid)))!;
  }

  async updateAccount(accountId: number, input: { name: string; category: AccountCategory }): Promise<Account | null> {
    const result = this.database.prepare(
      "UPDATE accounts SET name = ?, category = ? WHERE id = ? AND (is_system = 0 OR category = ?)",
    ).run(input.name.trim(), input.category, accountId, input.category);
    return result.changes === 0 ? null : this.getAccount(accountId);
  }

  async createSubaccount(accountId: number, name: string): Promise<Subaccount | null> {
    if (!this.database.prepare("SELECT 1 FROM accounts WHERE id = ?").get(accountId)) return null;
    const result = this.database.prepare("INSERT INTO subaccounts (account_id, name) VALUES (?, ?)")
      .run(accountId, name.trim());
    return { id: Number(result.lastInsertRowid), accountId, name: name.trim() };
  }

  async updateSubaccount(accountId: number, subaccountId: number, name: string): Promise<Subaccount | null> {
    const result = this.database.prepare(
      "UPDATE subaccounts SET name = ? WHERE id = ? AND account_id = ?",
    ).run(name.trim(), subaccountId, accountId);
    return result.changes === 0 ? null : { id: subaccountId, accountId, name: name.trim() };
  }

  async listFixedAssets(): Promise<FixedAsset[]> {
    const rows = this.database.prepare(`
      SELECT id, name, acquisition_date, acquisition_price, depreciation_method, useful_life, residual_value, depreciation_start_date
      FROM fixed_assets ORDER BY name, id
    `).all() as FixedAssetRow[];
    return rows.map(mapFixedAsset);
  }

  async getFixedAsset(fixedAssetId: number): Promise<FixedAsset | null> {
    const row = this.database.prepare(`
      SELECT id, name, acquisition_date, acquisition_price, depreciation_method, useful_life, residual_value, depreciation_start_date
      FROM fixed_assets WHERE id = ?
    `).get(fixedAssetId) as FixedAssetRow | undefined;
    return row ? mapFixedAsset(row) : null;
  }

  async createFixedAsset(input: FixedAssetInput): Promise<FixedAsset> {
    const result = this.database.prepare(`
      INSERT INTO fixed_assets (name, acquisition_date, acquisition_price, depreciation_method, useful_life, residual_value, depreciation_start_date)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.name ?? null,
      input.acquisitionDate ?? null,
      input.acquisitionPrice ?? null,
      input.depreciationMethod ?? null,
      input.usefulLife ?? null,
      input.residualValue ?? null,
      input.depreciationStartDate ?? null,
    );
    return (await this.getFixedAsset(Number(result.lastInsertRowid)))!;
  }

  async updateFixedAsset(fixedAssetId: number, input: FixedAssetInput): Promise<FixedAsset | null> {
    const result = this.database.prepare(`
      UPDATE fixed_assets SET name = ?, acquisition_date = ?, acquisition_price = ?, depreciation_method = ?, useful_life = ?, residual_value = ?, depreciation_start_date = ?
      WHERE id = ?
    `).run(
      input.name ?? null,
      input.acquisitionDate ?? null,
      input.acquisitionPrice ?? null,
      input.depreciationMethod ?? null,
      input.usefulLife ?? null,
      input.residualValue ?? null,
      input.depreciationStartDate ?? null,
      fixedAssetId,
    );
    return result.changes === 0 ? null : this.getFixedAsset(fixedAssetId);
  }

  async listJournalOptions(): Promise<FixedAssetOption[]> {
    return (await this.listFixedAssets()).map((asset) => ({
      id: asset.id,
      name: asset.name?.trim() || `固定資産 ${asset.id}`,
    }));
  }

  async getJournalOption(fixedAssetId: number): Promise<FixedAssetOption | null> {
    const asset = await this.getFixedAsset(fixedAssetId);
    return asset ? { id: asset.id, name: asset.name?.trim() || `固定資産 ${asset.id}` } : null;
  }

  async listJournals(month?: string): Promise<Journal[]> {
    const range = month ? journalMonthRange(month) : null;
    const headers = this.database.prepare(`
      SELECT id, entry_date, description FROM journal_entries
      ${range ? "WHERE entry_date >= ? AND entry_date < ?" : ""}
      ORDER BY entry_date DESC, id DESC
    `).all(...(range ? [range.startDate, range.endDate] : [])) as JournalRow[];
    const lines = this.database.prepare(
      "SELECT id, journal_entry_id, account_id, subaccount_id, side, amount FROM journal_lines ORDER BY id",
    ).all() as JournalLineRow[];
    return headers.map((header) => mapJournal(header, lines.filter((line) => line.journal_entry_id === header.id)));
  }

  async getJournal(journalId: number): Promise<Journal | null> {
    const header = this.database.prepare(
      "SELECT id, entry_date, description FROM journal_entries WHERE id = ?",
    ).get(journalId) as JournalRow | undefined;
    if (!header) return null;
    const lines = this.database.prepare(
      "SELECT id, journal_entry_id, account_id, subaccount_id, side, amount FROM journal_lines WHERE journal_entry_id = ? ORDER BY id",
    ).all(journalId) as JournalLineRow[];
    return mapJournal(header, lines);
  }

  async createJournal(input: JournalInput): Promise<Journal> {
    const insertEntry = this.database.prepare(
      "INSERT INTO journal_entries (entry_date, description) VALUES (?, ?)",
    );
    const insertLine = this.database.prepare(
      "INSERT INTO journal_lines (journal_entry_id, account_id, subaccount_id, side, amount) VALUES (?, ?, ?, ?, ?)",
    );
    const create = this.database.transaction(() => {
      const result = insertEntry.run(input.date, input.description.trim());
      const id = Number(result.lastInsertRowid);
      for (const line of input.lines) insertLine.run(id, line.accountId, line.subaccountId ?? null, line.side, line.amount);
      return id;
    });
    const id = create();
    return (await this.getJournal(id))!;
  }

  async updateJournal(journalId: number, input: JournalInput): Promise<Journal | null> {
    const update = this.database.prepare("UPDATE journal_entries SET entry_date = ?, description = ? WHERE id = ?");
    const deleteLines = this.database.prepare("DELETE FROM journal_lines WHERE journal_entry_id = ?");
    const insertLine = this.database.prepare(
      "INSERT INTO journal_lines (journal_entry_id, account_id, subaccount_id, side, amount) VALUES (?, ?, ?, ?, ?)",
    );
    const save = this.database.transaction(() => {
      const result = update.run(input.date, input.description.trim(), journalId);
      if (result.changes === 0) return false;
      deleteLines.run(journalId);
      for (const line of input.lines) insertLine.run(journalId, line.accountId, line.subaccountId ?? null, line.side, line.amount);
      return true;
    });
    return save() ? this.getJournal(journalId) : null;
  }

  async deleteJournal(journalId: number): Promise<boolean> {
    const deleteEntry = this.database.prepare("DELETE FROM journal_entries WHERE id = ?");
    const remove = this.database.transaction(() => deleteEntry.run(journalId).changes > 0);
    return remove();
  }

  async getBalanceSheet(asOf: string) {
    const accounts = await this.listAccounts();
    const journals = (await this.listJournals()).filter((journal) => journal.date <= asOf);
    return calculateBalanceSheet(asOf, accounts, journals);
  }

  async getIncomeStatement(start: string, end: string) {
    const [accounts, journals] = await Promise.all([this.listAccounts(), this.listJournals()]);
    return calculateIncomeStatement(start, end, accounts, journals);
  }
}

function mapSubaccount(row: SubaccountRow): Subaccount {
  return { id: row.id, accountId: row.account_id, name: row.name };
}

function mapFixedAsset(row: FixedAssetRow): FixedAsset {
  return {
    id: row.id,
    ...(row.name === null ? {} : { name: row.name }),
    ...(row.acquisition_date === null ? {} : { acquisitionDate: row.acquisition_date }),
    ...(row.acquisition_price === null ? {} : { acquisitionPrice: row.acquisition_price }),
    ...(row.depreciation_method === null ? {} : { depreciationMethod: row.depreciation_method }),
    ...(row.useful_life === null ? {} : { usefulLife: row.useful_life }),
    ...(row.residual_value === null ? {} : { residualValue: row.residual_value }),
    ...(row.depreciation_start_date === null ? {} : { depreciationStartDate: row.depreciation_start_date }),
  };
}

function mapAccount(row: AccountRow, subaccounts: Subaccount[]): Account {
  return {
    id: row.id,
    systemKey: row.system_key as Account["systemKey"],
    isSystem: row.is_system === 1,
    name: row.name,
    category: row.category,
    subaccountCount: row.subaccountCount,
    subaccounts,
  };
}

function mapJournal(header: JournalRow, rows: JournalLineRow[]): Journal {
  const lines = rows.map((row) => ({
    accountId: row.account_id,
    ...(row.subaccount_id === null ? {} : { subaccountId: row.subaccount_id }),
    side: row.side,
    amount: row.amount,
  }));
  return {
    id: header.id,
    date: header.entry_date,
    description: header.description,
    lines,
    debitTotal: lines.filter((line) => line.side === "debit").reduce((sum, line) => sum + line.amount, 0),
    creditTotal: lines.filter((line) => line.side === "credit").reduce((sum, line) => sum + line.amount, 0),
  };
}