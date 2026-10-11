import Database from "better-sqlite3";
import type { AccountingRepository } from "../application/repository.js";
import {
  calculateBalanceSheet,
  calculateIncomeStatement,
  type Account,
  type AccountCategory,
  type Journal,
  type JournalInput,
  type Subaccount,
} from "../domain/accounting.js";

interface AccountRow {
  id: number;
  name: string;
  category: AccountCategory;
  subaccountCount: number;
}

interface SubaccountRow {
  id: number;
  account_id: number;
  name: string;
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
  side: "debit" | "credit";
  amount: number;
}

export class SqliteAccountingRepository implements AccountingRepository {
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
        side TEXT NOT NULL CHECK (side IN ('debit', 'credit')),
        amount INTEGER NOT NULL CHECK (amount > 0)
      );
      CREATE INDEX IF NOT EXISTS ix_journal_entries_date ON journal_entries(entry_date);
      CREATE INDEX IF NOT EXISTS ix_journal_lines_account ON journal_lines(account_id);
    `);
  }

  async close(): Promise<void> {
    this.database.close();
  }

  async listAccounts(category?: AccountCategory): Promise<Account[]> {
    const rows = this.database.prepare(`
      SELECT a.id, a.name, a.category, COUNT(s.id) AS subaccountCount
      FROM accounts a
      LEFT JOIN subaccounts s ON s.account_id = a.id
      ${category ? "WHERE a.category = ?" : ""}
      GROUP BY a.id, a.name, a.category
      ORDER BY a.category, a.name, a.id
    `).all(...(category ? [category] : [])) as AccountRow[];
    return rows.map((row) => ({ ...row, subaccounts: [] }));
  }

  async getAccount(accountId: number): Promise<Account | null> {
    const row = this.database.prepare(`
      SELECT a.id, a.name, a.category, COUNT(s.id) AS subaccountCount
      FROM accounts a
      LEFT JOIN subaccounts s ON s.account_id = a.id
      WHERE a.id = ?
      GROUP BY a.id, a.name, a.category
    `).get(accountId) as AccountRow | undefined;
    if (!row) return null;
    const subaccounts = this.database.prepare(
      "SELECT id, account_id, name FROM subaccounts WHERE account_id = ? ORDER BY name, id",
    ).all(accountId) as SubaccountRow[];
    return { ...row, subaccounts: subaccounts.map(mapSubaccount) };
  }

  async createAccount(input: { name: string; category: AccountCategory }): Promise<Account> {
    const result = this.database.prepare("INSERT INTO accounts (name, category) VALUES (?, ?)")
      .run(input.name.trim(), input.category);
    return (await this.getAccount(Number(result.lastInsertRowid)))!;
  }

  async updateAccount(accountId: number, input: { name: string; category: AccountCategory }): Promise<Account | null> {
    const result = this.database.prepare("UPDATE accounts SET name = ?, category = ? WHERE id = ?")
      .run(input.name.trim(), input.category, accountId);
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

  async listJournals(): Promise<Journal[]> {
    const headers = this.database.prepare(
      "SELECT id, entry_date, description FROM journal_entries ORDER BY entry_date DESC, id DESC",
    ).all() as JournalRow[];
    const lines = this.database.prepare(
      "SELECT id, journal_entry_id, account_id, side, amount FROM journal_lines ORDER BY id",
    ).all() as JournalLineRow[];
    return headers.map((header) => mapJournal(header, lines.filter((line) => line.journal_entry_id === header.id)));
  }

  async createJournal(input: JournalInput): Promise<Journal> {
    const insertEntry = this.database.prepare(
      "INSERT INTO journal_entries (entry_date, description) VALUES (?, ?)",
    );
    const insertLine = this.database.prepare(
      "INSERT INTO journal_lines (journal_entry_id, account_id, side, amount) VALUES (?, ?, ?, ?)",
    );
    const create = this.database.transaction(() => {
      const result = insertEntry.run(input.date, input.description.trim());
      const id = Number(result.lastInsertRowid);
      for (const line of input.lines) insertLine.run(id, line.accountId, line.side, line.amount);
      return id;
    });
    const id = create();
    return (await this.listJournals()).find((journal) => journal.id === id)!;
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

function mapJournal(header: JournalRow, rows: JournalLineRow[]): Journal {
  const lines = rows.map((row) => ({ accountId: row.account_id, side: row.side, amount: row.amount }));
  return {
    id: header.id,
    date: header.entry_date,
    description: header.description,
    lines,
    debitTotal: lines.filter((line) => line.side === "debit").reduce((sum, line) => sum + line.amount, 0),
    creditTotal: lines.filter((line) => line.side === "credit").reduce((sum, line) => sum + line.amount, 0),
  };
}