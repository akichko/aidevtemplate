import sql from "mssql";
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
  type SystemAccountKey,
} from "../domain/accounting.js";

interface AccountRow {
  id: number;
  systemKey: SystemAccountKey | null;
  isSystem: boolean;
  name: string;
  category: AccountCategory;
  subaccountCount: number;
}

interface SubaccountRow {
  id: number;
  accountId: number;
  name: string;
}

interface FixedAssetRow {
  id: number;
  name: string | null;
  acquisitionDate: string | null;
  acquisitionPrice: number | null;
  depreciationMethod: string | null;
  usefulLife: number | null;
  residualValue: number | null;
  depreciationStartDate: string | null;
}

interface JournalRow {
  id: number;
  entryDate: Date | string;
  description: string;
}

interface JournalLineRow {
  id: number;
  journalEntryId: number;
  accountId: number;
  subaccountId: number | null;
  side: "debit" | "credit";
  amount: number;
}

export class SqlServerAccountingRepository implements AccountingRepository, FixedAssetRepository {
  private pool: sql.ConnectionPool | null = null;

  async initialize(): Promise<void> {
    const host = process.env.SQLSERVER_HOST;
    const database = process.env.SQLSERVER_DATABASE;
    const user = process.env.SQLSERVER_USER;
    const password = process.env.SQLSERVER_PASSWORD;
    if (!host || !database || !user || !password) {
      throw new Error("SQLSERVER_HOST、SQLSERVER_DATABASE、SQLSERVER_USER、SQLSERVER_PASSWORDが必要です。");
    }
    this.pool = await new sql.ConnectionPool({
      server: host,
      port: Number(process.env.SQLSERVER_PORT ?? 1433),
      database,
      user,
      password,
      options: {
        encrypt: process.env.SQLSERVER_ENCRYPT !== "false",
        trustServerCertificate: process.env.SQLSERVER_TRUST_CERT === "true",
      },
      pool: { min: 0, max: 10, idleTimeoutMillis: 30_000 },
    }).connect();
    await this.pool.request().batch(`
      IF OBJECT_ID(N'dbo.accounts', N'U') IS NULL
        CREATE TABLE dbo.accounts (
          id BIGINT IDENTITY(1,1) PRIMARY KEY,
          system_key NVARCHAR(40) NULL,
          is_system BIT NOT NULL DEFAULT 0,
          name NVARCHAR(MAX) NOT NULL,
          category NVARCHAR(20) NOT NULL CHECK (category IN ('asset', 'liability', 'equity', 'profit', 'loss'))
        );
      IF COL_LENGTH(N'dbo.accounts', N'system_key') IS NULL
        ALTER TABLE dbo.accounts ADD system_key NVARCHAR(40) NULL;
      IF COL_LENGTH(N'dbo.accounts', N'is_system') IS NULL
        ALTER TABLE dbo.accounts ADD is_system BIT NOT NULL CONSTRAINT df_accounts_is_system DEFAULT 0;
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ux_accounts_system_key' AND object_id = OBJECT_ID('dbo.accounts'))
        CREATE UNIQUE INDEX ux_accounts_system_key ON dbo.accounts(system_key) WHERE system_key IS NOT NULL;
      IF NOT EXISTS (SELECT 1 FROM dbo.accounts WHERE system_key = N'fixed_asset')
        INSERT INTO dbo.accounts (system_key, is_system, name, category) VALUES (N'fixed_asset', 1, N'固定資産', N'asset');
      IF NOT EXISTS (SELECT 1 FROM dbo.accounts WHERE system_key = N'depreciation_expense')
        INSERT INTO dbo.accounts (system_key, is_system, name, category) VALUES (N'depreciation_expense', 1, N'減価償却費', N'loss');
      IF OBJECT_ID(N'dbo.subaccounts', N'U') IS NULL
        CREATE TABLE dbo.subaccounts (
          id BIGINT IDENTITY(1,1) PRIMARY KEY,
          account_id BIGINT NOT NULL REFERENCES dbo.accounts(id),
          name NVARCHAR(MAX) NOT NULL
        );
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ux_subaccounts_account_id_id' AND object_id = OBJECT_ID('dbo.subaccounts'))
        CREATE UNIQUE INDEX ux_subaccounts_account_id_id ON dbo.subaccounts(account_id, id);
      IF OBJECT_ID(N'dbo.journal_entries', N'U') IS NULL
        CREATE TABLE dbo.journal_entries (
          id BIGINT IDENTITY(1,1) PRIMARY KEY,
          entry_date DATE NOT NULL,
          description NVARCHAR(MAX) NOT NULL,
          created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
        );
      IF OBJECT_ID(N'dbo.journal_lines', N'U') IS NULL
        CREATE TABLE dbo.journal_lines (
          id BIGINT IDENTITY(1,1) PRIMARY KEY,
          journal_entry_id BIGINT NOT NULL REFERENCES dbo.journal_entries(id),
          account_id BIGINT NOT NULL REFERENCES dbo.accounts(id),
          subaccount_id BIGINT NULL,
          side NVARCHAR(10) NOT NULL CHECK (side IN ('debit', 'credit')),
          amount BIGINT NOT NULL CHECK (amount > 0)
        );
      IF COL_LENGTH(N'dbo.journal_lines', N'subaccount_id') IS NULL
        ALTER TABLE dbo.journal_lines ADD subaccount_id BIGINT NULL;
      DECLARE @subaccountForeignKey sysname;
      SELECT @subaccountForeignKey = fk.name
        FROM sys.foreign_keys fk
        WHERE fk.parent_object_id = OBJECT_ID(N'dbo.journal_lines')
          AND fk.referenced_object_id = OBJECT_ID(N'dbo.subaccounts');
      IF @subaccountForeignKey IS NOT NULL
        EXEC(N'ALTER TABLE dbo.journal_lines DROP CONSTRAINT ' + QUOTENAME(@subaccountForeignKey));
      IF OBJECT_ID(N'dbo.fixed_assets', N'U') IS NULL
        CREATE TABLE dbo.fixed_assets (
          id BIGINT IDENTITY(1,1) PRIMARY KEY,
          name NVARCHAR(MAX) NULL,
          acquisition_date NVARCHAR(10) NULL,
          acquisition_price FLOAT NULL,
          depreciation_method NVARCHAR(MAX) NULL,
          useful_life FLOAT NULL,
          residual_value FLOAT NULL,
          depreciation_start_date NVARCHAR(10) NULL
        );
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_journal_entries_date' AND object_id = OBJECT_ID('dbo.journal_entries'))
        CREATE INDEX ix_journal_entries_date ON dbo.journal_entries(entry_date);
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_journal_lines_account' AND object_id = OBJECT_ID('dbo.journal_lines'))
        CREATE INDEX ix_journal_lines_account ON dbo.journal_lines(account_id);
    `);
  }

  async close(): Promise<void> {
    await this.pool?.close();
    this.pool = null;
  }

  async listAccounts(category?: AccountCategory): Promise<Account[]> {
    const request = this.connection().request();
    let query = `SELECT a.id, a.system_key AS systemKey, a.is_system AS isSystem, a.name, a.category, COUNT(s.id) AS subaccountCount
      FROM dbo.accounts a LEFT JOIN dbo.subaccounts s ON s.account_id = a.id`;
    if (category) {
      request.input("category", sql.NVarChar(20), category);
      query += " WHERE a.category = @category";
    }
    query += " GROUP BY a.id, a.system_key, a.is_system, a.name, a.category ORDER BY a.category, a.name, a.id";
    const result = await request.query<AccountRow>(query);
    return result.recordset.map((row) => ({ ...row, id: Number(row.id), isSystem: Boolean(row.isSystem), subaccountCount: Number(row.subaccountCount), subaccounts: [] }));
  }

  async getAccount(accountId: number): Promise<Account | null> {
    const result = await this.connection().request().input("id", sql.BigInt, accountId).query<AccountRow>(`
      SELECT a.id, a.system_key AS systemKey, a.is_system AS isSystem, a.name, a.category, COUNT(s.id) AS subaccountCount
      FROM dbo.accounts a LEFT JOIN dbo.subaccounts s ON s.account_id = a.id
      WHERE a.id = @id GROUP BY a.id, a.system_key, a.is_system, a.name, a.category
    `);
    const row = result.recordset[0];
    if (!row) return null;
    const subaccounts = await this.connection().request().input("accountId", sql.BigInt, accountId)
      .query<SubaccountRow>("SELECT id, account_id AS accountId, name FROM dbo.subaccounts WHERE account_id = @accountId ORDER BY name, id");
    return {
      ...row,
      id: Number(row.id),
      isSystem: Boolean(row.isSystem),
      subaccountCount: Number(row.subaccountCount),
      subaccounts: subaccounts.recordset.map(mapSubaccount),
    };
  }

  async createAccount(input: { name: string; category: AccountCategory }): Promise<Account> {
    const result = await this.connection().request()
      .input("name", sql.NVarChar(sql.MAX), input.name.trim())
      .input("category", sql.NVarChar(20), input.category)
      .query<{ id: number }>("INSERT INTO dbo.accounts (name, category) OUTPUT INSERTED.id VALUES (@name, @category)");
    return (await this.getAccount(Number(result.recordset[0].id)))!;
  }

  async updateAccount(accountId: number, input: { name: string; category: AccountCategory }): Promise<Account | null> {
    const result = await this.connection().request()
      .input("id", sql.BigInt, accountId)
      .input("name", sql.NVarChar(sql.MAX), input.name.trim())
      .input("category", sql.NVarChar(20), input.category)
      .query("UPDATE dbo.accounts SET name = @name, category = @category WHERE id = @id AND (is_system = 0 OR category = @category); SELECT @@ROWCOUNT AS changes;");
    return Number(result.recordset[0]?.changes) === 0 ? null : this.getAccount(accountId);
  }

  async createSubaccount(accountId: number, name: string): Promise<Subaccount | null> {
    const result = await this.connection().request()
      .input("accountId", sql.BigInt, accountId)
      .input("name", sql.NVarChar(sql.MAX), name.trim())
      .query<{ id: number }>("INSERT INTO dbo.subaccounts (account_id, name) OUTPUT INSERTED.id SELECT @accountId, @name WHERE EXISTS (SELECT 1 FROM dbo.accounts WHERE id = @accountId)");
    const row = result.recordset[0];
    return row ? { id: Number(row.id), accountId, name: name.trim() } : null;
  }

  async updateSubaccount(accountId: number, subaccountId: number, name: string): Promise<Subaccount | null> {
    const result = await this.connection().request()
      .input("accountId", sql.BigInt, accountId)
      .input("id", sql.BigInt, subaccountId)
      .input("name", sql.NVarChar(sql.MAX), name.trim())
      .query("UPDATE dbo.subaccounts SET name = @name WHERE id = @id AND account_id = @accountId; SELECT @@ROWCOUNT AS changes;");
    return Number(result.recordset[0]?.changes) === 0 ? null : { id: subaccountId, accountId, name: name.trim() };
  }

  async listFixedAssets(): Promise<FixedAsset[]> {
    const result = await this.connection().request().query<FixedAssetRow>(`
      SELECT id, name, acquisition_date AS acquisitionDate, acquisition_price AS acquisitionPrice,
        depreciation_method AS depreciationMethod, useful_life AS usefulLife, residual_value AS residualValue,
        depreciation_start_date AS depreciationStartDate
      FROM dbo.fixed_assets ORDER BY name, id
    `);
    return result.recordset.map(mapFixedAsset);
  }

  async getFixedAsset(fixedAssetId: number): Promise<FixedAsset | null> {
    const result = await this.connection().request().input("id", sql.BigInt, fixedAssetId).query<FixedAssetRow>(`
      SELECT id, name, acquisition_date AS acquisitionDate, acquisition_price AS acquisitionPrice,
        depreciation_method AS depreciationMethod, useful_life AS usefulLife, residual_value AS residualValue,
        depreciation_start_date AS depreciationStartDate
      FROM dbo.fixed_assets WHERE id = @id
    `);
    return result.recordset[0] ? mapFixedAsset(result.recordset[0]) : null;
  }

  async createFixedAsset(input: FixedAssetInput): Promise<FixedAsset> {
    const result = await this.connection().request()
      .input("name", sql.NVarChar(sql.MAX), input.name ?? null)
      .input("acquisitionDate", sql.NVarChar(10), input.acquisitionDate ?? null)
      .input("acquisitionPrice", sql.Float, input.acquisitionPrice ?? null)
      .input("depreciationMethod", sql.NVarChar(sql.MAX), input.depreciationMethod ?? null)
      .input("usefulLife", sql.Float, input.usefulLife ?? null)
      .input("residualValue", sql.Float, input.residualValue ?? null)
      .input("depreciationStartDate", sql.NVarChar(10), input.depreciationStartDate ?? null)
      .query<{ id: number }>(`INSERT INTO dbo.fixed_assets (name, acquisition_date, acquisition_price, depreciation_method, useful_life, residual_value, depreciation_start_date)
        OUTPUT INSERTED.id VALUES (@name, @acquisitionDate, @acquisitionPrice, @depreciationMethod, @usefulLife, @residualValue, @depreciationStartDate)`);
    return (await this.getFixedAsset(Number(result.recordset[0].id)))!;
  }

  async updateFixedAsset(fixedAssetId: number, input: FixedAssetInput): Promise<FixedAsset | null> {
    const result = await this.connection().request()
      .input("id", sql.BigInt, fixedAssetId)
      .input("name", sql.NVarChar(sql.MAX), input.name ?? null)
      .input("acquisitionDate", sql.NVarChar(10), input.acquisitionDate ?? null)
      .input("acquisitionPrice", sql.Float, input.acquisitionPrice ?? null)
      .input("depreciationMethod", sql.NVarChar(sql.MAX), input.depreciationMethod ?? null)
      .input("usefulLife", sql.Float, input.usefulLife ?? null)
      .input("residualValue", sql.Float, input.residualValue ?? null)
      .input("depreciationStartDate", sql.NVarChar(10), input.depreciationStartDate ?? null)
      .query("UPDATE dbo.fixed_assets SET name = @name, acquisition_date = @acquisitionDate, acquisition_price = @acquisitionPrice, depreciation_method = @depreciationMethod, useful_life = @usefulLife, residual_value = @residualValue, depreciation_start_date = @depreciationStartDate WHERE id = @id; SELECT @@ROWCOUNT AS changes;");
    return Number(result.recordset[0]?.changes) === 0 ? null : this.getFixedAsset(fixedAssetId);
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
    const headerRequest = this.connection().request();
    const lineRequest = this.connection().request();
    let headerQuery = "SELECT id, entry_date AS entryDate, description FROM dbo.journal_entries";
    let lineQuery = "SELECT id, journal_entry_id AS journalEntryId, account_id AS accountId, subaccount_id AS subaccountId, side, amount FROM dbo.journal_lines";
    if (range) {
      headerRequest.input("startDate", sql.Date, range.startDate).input("endDate", sql.Date, range.endDate);
      lineRequest.input("startDate", sql.Date, range.startDate).input("endDate", sql.Date, range.endDate);
      headerQuery += " WHERE entry_date >= @startDate AND entry_date < @endDate";
      lineQuery += " WHERE journal_entry_id IN (SELECT id FROM dbo.journal_entries WHERE entry_date >= @startDate AND entry_date < @endDate)";
    }
    headerQuery += " ORDER BY entry_date DESC, id DESC";
    lineQuery += " ORDER BY id";
    const [headers, lines] = await Promise.all([
      headerRequest.query<JournalRow>(headerQuery),
      lineRequest.query<JournalLineRow>(lineQuery),
    ]);
    return headers.recordset.map((header) => mapJournal(header, lines.recordset.filter((line) => Number(line.journalEntryId) === Number(header.id))));
  }

  async getJournal(journalId: number): Promise<Journal | null> {
    const header = await this.connection().request().input("id", sql.BigInt, journalId)
      .query<JournalRow>("SELECT id, entry_date AS entryDate, description FROM dbo.journal_entries WHERE id = @id");
    const row = header.recordset[0];
    if (!row) return null;
    const lines = await this.connection().request().input("id", sql.BigInt, journalId)
      .query<JournalLineRow>("SELECT id, journal_entry_id AS journalEntryId, account_id AS accountId, subaccount_id AS subaccountId, side, amount FROM dbo.journal_lines WHERE journal_entry_id = @id ORDER BY id");
    return mapJournal(row, lines.recordset);
  }

  async createJournal(input: JournalInput): Promise<Journal> {
    const transaction = new sql.Transaction(this.connection());
    await transaction.begin();
    try {
      const insert = await new sql.Request(transaction)
        .input("date", sql.Date, input.date)
        .input("description", sql.NVarChar(sql.MAX), input.description.trim())
        .query<{ id: number }>("INSERT INTO dbo.journal_entries (entry_date, description) OUTPUT INSERTED.id VALUES (@date, @description)");
      const id = Number(insert.recordset[0].id);
      for (const line of input.lines) {
        await new sql.Request(transaction)
          .input("entryId", sql.BigInt, id)
          .input("accountId", sql.BigInt, line.accountId)
          .input("subaccountId", sql.BigInt, line.subaccountId ?? null)
          .input("side", sql.NVarChar(10), line.side)
          .input("amount", sql.BigInt, line.amount)
          .query("INSERT INTO dbo.journal_lines (journal_entry_id, account_id, subaccount_id, side, amount) VALUES (@entryId, @accountId, @subaccountId, @side, @amount)");
      }
      await transaction.commit();
      return (await this.getJournal(id))!;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async updateJournal(journalId: number, input: JournalInput): Promise<Journal | null> {
    const transaction = new sql.Transaction(this.connection());
    await transaction.begin();
    try {
      const update = await new sql.Request(transaction)
        .input("id", sql.BigInt, journalId)
        .input("date", sql.Date, input.date)
        .input("description", sql.NVarChar(sql.MAX), input.description.trim())
        .query<{ id: number }>("UPDATE dbo.journal_entries SET entry_date = @date, description = @description OUTPUT INSERTED.id WHERE id = @id");
      if (!update.recordset[0]) {
        await transaction.rollback();
        return null;
      }
      await new sql.Request(transaction).input("id", sql.BigInt, journalId)
        .query("DELETE FROM dbo.journal_lines WHERE journal_entry_id = @id");
      for (const line of input.lines) {
        await new sql.Request(transaction)
          .input("entryId", sql.BigInt, journalId)
          .input("accountId", sql.BigInt, line.accountId)
          .input("subaccountId", sql.BigInt, line.subaccountId ?? null)
          .input("side", sql.NVarChar(10), line.side)
          .input("amount", sql.BigInt, line.amount)
          .query("INSERT INTO dbo.journal_lines (journal_entry_id, account_id, subaccount_id, side, amount) VALUES (@entryId, @accountId, @subaccountId, @side, @amount)");
      }
      await transaction.commit();
      return this.getJournal(journalId);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async deleteJournal(journalId: number): Promise<boolean> {
    const transaction = new sql.Transaction(this.connection());
    await transaction.begin();
    try {
      await new sql.Request(transaction).input("id", sql.BigInt, journalId)
        .query("DELETE FROM dbo.journal_lines WHERE journal_entry_id = @id");
      const deleted = await new sql.Request(transaction).input("id", sql.BigInt, journalId)
        .query<{ id: number }>("DELETE FROM dbo.journal_entries OUTPUT DELETED.id WHERE id = @id");
      await transaction.commit();
      return deleted.recordset.length > 0;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async getBalanceSheet(asOf: string) {
    const [accounts, journals] = await Promise.all([this.listAccounts(), this.listJournals()]);
    return calculateBalanceSheet(asOf, accounts, journals.filter((journal) => journal.date <= asOf));
  }

  async getIncomeStatement(start: string, end: string) {
    const [accounts, journals] = await Promise.all([this.listAccounts(), this.listJournals()]);
    return calculateIncomeStatement(start, end, accounts, journals);
  }

  private connection(): sql.ConnectionPool {
    if (!this.pool) throw new Error("SQL Serverリポジトリは初期化されていません。");
    return this.pool;
  }
}

function mapSubaccount(row: SubaccountRow): Subaccount {
  return { id: Number(row.id), accountId: Number(row.accountId), name: row.name };
}

function mapFixedAsset(row: FixedAssetRow): FixedAsset {
  return {
    id: Number(row.id),
    ...(row.name === null ? {} : { name: row.name }),
    ...(row.acquisitionDate === null ? {} : { acquisitionDate: row.acquisitionDate }),
    ...(row.acquisitionPrice === null ? {} : { acquisitionPrice: Number(row.acquisitionPrice) }),
    ...(row.depreciationMethod === null ? {} : { depreciationMethod: row.depreciationMethod }),
    ...(row.usefulLife === null ? {} : { usefulLife: Number(row.usefulLife) }),
    ...(row.residualValue === null ? {} : { residualValue: Number(row.residualValue) }),
    ...(row.depreciationStartDate === null ? {} : { depreciationStartDate: row.depreciationStartDate }),
  };
}

function mapJournal(header: JournalRow, rows: JournalLineRow[]): Journal {
  const lines = rows.map((row) => ({
    accountId: Number(row.accountId),
    ...(row.subaccountId === null ? {} : { subaccountId: Number(row.subaccountId) }),
    side: row.side,
    amount: Number(row.amount),
  }));
  return {
    id: Number(header.id),
    date: header.entryDate instanceof Date ? header.entryDate.toISOString().slice(0, 10) : String(header.entryDate).slice(0, 10),
    description: header.description,
    lines,
    debitTotal: lines.filter((line) => line.side === "debit").reduce((sum, line) => sum + line.amount, 0),
    creditTotal: lines.filter((line) => line.side === "credit").reduce((sum, line) => sum + line.amount, 0),
  };
}