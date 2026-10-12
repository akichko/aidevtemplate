<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { accountingApi, categoryLabels, type Account, type AccountCategory, type Subaccount } from "../api";

const categories: AccountCategory[] = ["asset", "liability", "equity", "profit", "loss"];
const accounts = ref<Account[]>([]);
const categoryFilter = ref("");
const selectedAccountId = ref<number | null>(null);
const accountName = ref("");
const accountCategory = ref<AccountCategory | "">("");
const subaccountName = ref("");
const editingSubaccountId = ref<number | null>(null);
const errorMessage = ref("");
const toastMessage = ref("");
const busy = ref(false);
let toastTimer = 0;

const selectedAccount = computed(() => accounts.value.find((account) => account.id === selectedAccountId.value) ?? null);
const visibleAccounts = computed(() => categoryFilter.value
  ? accounts.value.filter((account) => account.category === categoryFilter.value)
  : accounts.value);

function notify(message: string) {
  toastMessage.value = message;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastMessage.value = "", 2400);
}

async function loadAccounts() {
  accounts.value = await accountingApi.listAccounts(categoryFilter.value || undefined);
  if (selectedAccountId.value && !accounts.value.some((account) => account.id === selectedAccountId.value)) {
    selectedAccountId.value = null;
    resetAccountForm();
  }
  if (selectedAccountId.value) await selectAccount(selectedAccountId.value);
}

async function selectAccount(id: number) {
  errorMessage.value = "";
  try {
    const account = await accountingApi.getAccount(id);
    accounts.value = accounts.value.map((item) => item.id === account.id ? account : item);
    selectedAccountId.value = account.id;
    accountName.value = account.name;
    accountCategory.value = account.category;
    editingSubaccountId.value = null;
    subaccountName.value = "";
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "勘定科目を読み込めませんでした。";
  }
}

function resetAccountForm() {
  selectedAccountId.value = null;
  accountName.value = "";
  accountCategory.value = "";
  editingSubaccountId.value = null;
  subaccountName.value = "";
}

async function saveAccount() {
  errorMessage.value = "";
  if (!accountName.value.trim() || !categories.includes(accountCategory.value as AccountCategory)) {
    errorMessage.value = "勘定科目名と区分を入力してください。";
    return;
  }
  busy.value = true;
  try {
    const isNew = selectedAccountId.value === null;
    const input = { name: accountName.value.trim(), category: accountCategory.value as AccountCategory };
    const saved = selectedAccountId.value
      ? await accountingApi.updateAccount(selectedAccountId.value, input)
      : await accountingApi.createAccount(input);
    await loadAccounts();
    await selectAccount(saved.id);
    notify(isNew ? "勘定科目を登録しました" : "勘定科目を変更しました");
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "勘定科目を保存できませんでした。";
  } finally {
    busy.value = false;
  }
}

function editSubaccount(subaccount: Subaccount) {
  editingSubaccountId.value = subaccount.id;
  subaccountName.value = subaccount.name;
}

async function saveSubaccount() {
  if (!selectedAccountId.value || !subaccountName.value.trim()) {
    errorMessage.value = "勘定科目を選択し、補助科目名を入力してください。";
    return;
  }
  busy.value = true;
  errorMessage.value = "";
  try {
    if (editingSubaccountId.value) {
      await accountingApi.updateSubaccount(selectedAccountId.value, editingSubaccountId.value, subaccountName.value.trim());
      notify("補助科目を変更しました");
    } else {
      await accountingApi.createSubaccount(selectedAccountId.value, subaccountName.value.trim());
      notify("補助科目を追加しました");
    }
    await loadAccounts();
    editingSubaccountId.value = null;
    subaccountName.value = "";
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "補助科目を保存できませんでした。";
  } finally {
    busy.value = false;
  }
}

async function applyFilter() {
  errorMessage.value = "";
  try {
    await loadAccounts();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "勘定科目を読み込めませんでした。";
  }
}

onMounted(async () => {
  try {
    await loadAccounts();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "勘定科目を読み込めませんでした。";
  }
});
</script>

<template>
  <div class="page-inner">
    <div class="breadcrumb"><span>設定</span><span aria-hidden="true">/</span><strong>勘定科目マスタ</strong></div>
    <div class="page-heading"><div><p class="eyebrow">勘定科目の設定</p><h1>勘定科目マスタ</h1><p class="subtitle">勘定科目と、科目ごとの補助科目を管理します。</p></div><span class="panel-note">保存先: SQLite</span></div>

    <div class="master-layout">
      <section class="panel master-list-panel" aria-labelledby="account-list-heading">
        <div class="panel-head master-list-head"><h2 class="panel-title" id="account-list-heading">勘定科目一覧</h2><button class="button subtle" type="button" @click="resetAccountForm">＋ 新規</button></div>
        <div class="master-filter"><label class="sr-only" for="category-filter">勘定科目区分で絞り込み</label><select id="category-filter" v-model="categoryFilter" class="control" @change="applyFilter"><option value="">すべての区分</option><option v-for="category in categories" :key="category" :value="category">{{ categoryLabels[category] }}</option></select></div>
        <div class="table-scroll"><table class="master-table"><thead><tr><th>勘定科目名</th><th>区分</th><th class="right">補助科目</th></tr></thead><tbody>
          <tr v-for="account in visibleAccounts" :key="account.id" :aria-selected="account.id === selectedAccountId"><td><button class="master-select" type="button" @click="selectAccount(account.id)">{{ account.name }}</button><span v-if="account.isSystem" class="panel-note"> システム</span></td><td>{{ categoryLabels[account.category] }}</td><td class="right">{{ account.subaccountCount }}</td></tr>
          <tr v-if="visibleAccounts.length === 0"><td class="empty-row" colspan="3">{{ accounts.length ? "該当する勘定科目はありません" : "勘定科目はありません" }}</td></tr>
        </tbody></table></div>
      </section>

      <div class="master-detail">
        <section class="panel master-editor-panel" aria-labelledby="account-editor-heading">
          <div class="panel-head"><h2 class="panel-title" id="account-editor-heading">{{ selectedAccount ? "勘定科目を変更" : "勘定科目を登録" }}</h2></div>
          <form class="master-form" @submit.prevent="saveAccount">
            <div class="master-fields"><div class="field"><label for="account-name">勘定科目名</label><input id="account-name" v-model="accountName" class="control" type="text" required></div><div class="field"><label for="account-category">勘定科目区分</label><select id="account-category" v-model="accountCategory" class="control" required :disabled="selectedAccount?.isSystem"><option value="">区分を選択</option><option v-for="category in categories" :key="category" :value="category">{{ categoryLabels[category] }}</option></select><span v-if="selectedAccount?.isSystem" class="panel-note">システム勘定科目の区分は変更できません。</span></div></div>
            <div class="form-footer"><button v-if="selectedAccount" class="button secondary" type="button" @click="resetAccountForm">新規入力に戻る</button><button class="button" type="submit" :disabled="busy">{{ selectedAccount ? "変更を保存" : "勘定科目を登録" }}</button></div>
          </form>
        </section>

        <section class="panel subaccount-panel" aria-labelledby="subaccount-heading">
          <div class="panel-head"><div><h2 class="panel-title" id="subaccount-heading">補助科目</h2><p class="panel-note">{{ selectedAccount?.name ?? "勘定科目を選択してください" }}</p></div></div>
          <p v-if="selectedAccount?.systemKey === 'fixed_asset'" class="empty-state">固定資産は固定資産マスタで管理します。</p>
          <template v-else>
          <form class="subaccount-form" @submit.prevent="saveSubaccount"><div class="field"><label for="subaccount-name">補助科目名</label><input id="subaccount-name" v-model="subaccountName" class="control" type="text" required :disabled="!selectedAccount"></div><button class="button subtle" type="submit" :disabled="!selectedAccount || busy">{{ editingSubaccountId ? "変更を保存" : "補助科目を追加" }}</button></form>
          <div class="table-scroll"><table class="master-table"><thead><tr><th>補助科目名</th><th class="right">操作</th></tr></thead><tbody>
            <tr v-for="subaccount in selectedAccount?.subaccounts ?? []" :key="subaccount.id"><td>{{ subaccount.name }}</td><td class="right"><button class="text-button" type="button" @click="editSubaccount(subaccount)">変更</button></td></tr>
            <tr v-if="selectedAccount && selectedAccount.subaccounts.length === 0"><td class="empty-row" colspan="2">補助科目はありません</td></tr>
            <tr v-if="!selectedAccount"><td class="empty-row" colspan="2">勘定科目を選択してください</td></tr>
          </tbody></table></div>
          </template>
        </section>
      </div>
    </div>
    <p v-if="errorMessage" class="page-error" role="alert">{{ errorMessage }}</p><div v-if="toastMessage" class="toast" role="status">{{ toastMessage }}</div>
  </div>
</template>