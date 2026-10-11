<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { accountingApi, categoryLabels, yen, type Account, type Journal, type JournalLineInput } from "../api";

interface EntryRow {
  key: number;
  accountId: string;
  amount: string;
}

let nextRowKey = 1;
const accounts = ref<Account[]>([]);
const debitRows = ref<EntryRow[]>([newRow()]);
const creditRows = ref<EntryRow[]>([newRow()]);
const date = ref(new Date().toISOString().slice(0, 10));
const description = ref("");
const journals = ref<Journal[]>([]);
const errorMessage = ref("");
const toastMessage = ref("");
const busy = ref(false);
let toastTimer = 0;

function newRow(): EntryRow {
  return { key: nextRowKey++, accountId: "", amount: "" };
}

const debitTotal = computed(() => sumRows(debitRows.value));
const creditTotal = computed(() => sumRows(creditRows.value));
const balanced = computed(() => debitTotal.value > 0 && debitTotal.value === creditTotal.value);
const balanceStatus = computed(() => balanced.value ? "貸借一致" : debitTotal.value || creditTotal.value ? "金額が不一致" : "金額を入力");

function sumRows(rows: EntryRow[]): number {
  return rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
}

function notify(message: string) {
  toastMessage.value = message;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastMessage.value = "", 2600);
}

function clearForm() {
  date.value = new Date().toISOString().slice(0, 10);
  description.value = "";
  debitRows.value = [newRow()];
  creditRows.value = [newRow()];
  errorMessage.value = "";
}

function removeRow(side: "debit" | "credit", row: EntryRow) {
  const rows = side === "debit" ? debitRows : creditRows;
  if (rows.value.length === 1) {
    row.accountId = "";
    row.amount = "";
  } else {
    rows.value = rows.value.filter((item) => item.key !== row.key);
  }
}

async function loadData() {
  try {
    [accounts.value, journals.value] = await Promise.all([accountingApi.listAccounts(), accountingApi.listJournals()]);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "データを読み込めませんでした。";
  }
}

async function submitJournal() {
  errorMessage.value = "";
  if (!date.value || !description.value.trim()) {
    errorMessage.value = "取引日と摘要を入力してください。";
    return;
  }
  const lines: JournalLineInput[] = [];
  for (const [side, rows] of [["debit", debitRows.value], ["credit", creditRows.value]] as const) {
    for (const row of rows) {
      const amount = Number(row.amount);
      if (!row.accountId && !row.amount) continue;
      if (!row.accountId || !Number.isSafeInteger(amount) || amount <= 0) {
        errorMessage.value = "各明細の勘定科目と1円以上の金額を入力してください。";
        return;
      }
      lines.push({ accountId: Number(row.accountId), side, amount });
    }
  }
  if (!balanced.value) {
    errorMessage.value = "借方合計と貸方合計を一致させてください。";
    return;
  }
  busy.value = true;
  try {
    await accountingApi.createJournal({ date: date.value, description: description.value.trim(), lines });
    await loadData();
    clearForm();
    notify("仕訳を登録しました");
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "仕訳を登録できませんでした。";
  } finally {
    busy.value = false;
  }
}

onMounted(loadData);
</script>

<template>
  <div class="page-inner">
    <div class="breadcrumb"><span>会計</span><span aria-hidden="true">/</span><strong>仕訳登録</strong></div>
    <div class="page-heading"><div><p class="eyebrow">日々の記帳</p><h1>仕訳登録</h1><p class="subtitle">取引を借方・貸方に分けて記録します。</p></div><span class="panel-note">入力内容はSQLiteに保存されます</span></div>

    <form class="panel form-panel" @submit.prevent="submitJournal">
      <div class="form-top">
        <div class="field"><label for="entry-date">取引日</label><input id="entry-date" v-model="date" class="control" type="date" required></div>
        <div class="field"><label for="entry-description">摘要</label><input id="entry-description" v-model="description" class="control" type="text" placeholder="例: 消耗品を購入" required></div>
      </div>

      <section class="entry-section debit" aria-labelledby="debit-heading">
        <div class="entry-section-heading"><h2 id="debit-heading"><span class="section-mark" aria-hidden="true"></span>借方</h2><span>借方合計 <strong>{{ yen.format(debitTotal) }}</strong> 円</span></div>
        <div class="entry-rows">
          <div v-for="(row, index) in debitRows" :key="row.key" class="entry-row">
            <span class="row-index" aria-hidden="true">{{ index + 1 }}</span>
            <label class="sr-only" :for="`debit-account-${row.key}`">借方勘定科目</label>
            <select :id="`debit-account-${row.key}`" v-model="row.accountId" class="control account-select"><option value="">勘定科目を選択</option><option v-for="account in accounts" :key="account.id" :value="String(account.id)">{{ account.name }}（{{ categoryLabels[account.category] }}）</option></select>
            <div class="amount-wrap"><label class="sr-only" :for="`debit-amount-${row.key}`">借方金額</label><input :id="`debit-amount-${row.key}`" v-model="row.amount" class="control amount-input" type="text" inputmode="numeric" pattern="[1-9][0-9]*" placeholder="金額"><span class="currency">円</span></div>
            <button class="remove-row" type="button" :aria-label="`借方明細${index + 1}を削除`" @click="removeRow('debit', row)">×</button>
          </div>
        </div>
        <button class="button subtle add-row" type="button" @click="debitRows.push(newRow())">＋ 借方明細を追加</button>
      </section>

      <section class="entry-section credit" aria-labelledby="credit-heading">
        <div class="entry-section-heading"><h2 id="credit-heading"><span class="section-mark" aria-hidden="true"></span>貸方</h2><span>貸方合計 <strong>{{ yen.format(creditTotal) }}</strong> 円</span></div>
        <div class="entry-rows">
          <div v-for="(row, index) in creditRows" :key="row.key" class="entry-row">
            <span class="row-index" aria-hidden="true">{{ index + 1 }}</span>
            <label class="sr-only" :for="`credit-account-${row.key}`">貸方勘定科目</label>
            <select :id="`credit-account-${row.key}`" v-model="row.accountId" class="control account-select"><option value="">勘定科目を選択</option><option v-for="account in accounts" :key="account.id" :value="String(account.id)">{{ account.name }}（{{ categoryLabels[account.category] }}）</option></select>
            <div class="amount-wrap"><label class="sr-only" :for="`credit-amount-${row.key}`">貸方金額</label><input :id="`credit-amount-${row.key}`" v-model="row.amount" class="control amount-input" type="text" inputmode="numeric" pattern="[1-9][0-9]*" placeholder="金額"><span class="currency">円</span></div>
            <button class="remove-row" type="button" :aria-label="`貸方明細${index + 1}を削除`" @click="removeRow('credit', row)">×</button>
          </div>
        </div>
        <button class="button subtle add-row" type="button" @click="creditRows.push(newRow())">＋ 貸方明細を追加</button>
      </section>

      <div class="balance-strip" aria-live="polite">
        <div class="balance-item"><span class="balance-label">借方合計</span><strong class="balance-value">¥{{ yen.format(debitTotal) }}</strong></div>
        <div class="balance-item"><span class="balance-label">貸方合計</span><strong class="balance-value">¥{{ yen.format(creditTotal) }}</strong></div>
        <div class="balance-status" :class="{ 'is-balanced': balanced, 'is-unbalanced': !balanced && (debitTotal || creditTotal) }">{{ balanceStatus }}</div>
      </div>
      <div class="form-footer"><p v-if="errorMessage" class="inline-error" role="alert">{{ errorMessage }}</p><button class="button secondary" type="button" @click="clearForm">入力をクリア</button><button class="button" type="submit" :disabled="!balanced || busy">{{ busy ? "登録中…" : "仕訳を登録" }}</button></div>
    </form>

    <section class="panel recent-panel" aria-labelledby="recent-heading">
      <div class="panel-head"><h2 class="panel-title" id="recent-heading">登録済み仕訳</h2><span class="panel-note">{{ journals.length }} 件</span></div>
      <div class="table-scroll"><table><thead><tr><th>取引日</th><th>摘要</th><th class="right">借方合計</th><th class="right">貸方合計</th></tr></thead><tbody>
        <tr v-for="journal in journals.slice(0, 10)" :key="journal.id"><td>{{ journal.date }}</td><td>{{ journal.description }}</td><td class="right">{{ yen.format(journal.debitTotal) }} 円</td><td class="right">{{ yen.format(journal.creditTotal) }} 円</td></tr>
        <tr v-if="journals.length === 0"><td class="empty-row" colspan="4">登録した仕訳はありません</td></tr>
      </tbody></table></div>
    </section>
    <div v-if="toastMessage" class="toast" role="status">{{ toastMessage }}</div>
  </div>
</template>