<script setup lang="ts">
import { computed, ref } from "vue";
import AccountMasterView from "./views/AccountMasterView.vue";
import BalanceSheetView from "./views/BalanceSheetView.vue";
import IncomeStatementView from "./views/IncomeStatementView.vue";
import FixedAssetMasterView from "./views/FixedAssetMasterView.vue";
import JournalListView from "./views/JournalListView.vue";
import JournalView from "./views/JournalView.vue";

const screens = [
  { id: "journals", title: "仕訳一覧", icon: "☷", component: JournalListView },
  { id: "balance", title: "貸借対照表", icon: "▤", component: BalanceSheetView },
  { id: "income", title: "損益計算書", icon: "▥", component: IncomeStatementView },
  { id: "fixed-assets", title: "固定資産マスタ", icon: "▧", component: FixedAssetMasterView },
  { id: "accounts", title: "勘定科目マスタ", icon: "≡", component: AccountMasterView },
] as const;

interface JournalFormState {
  mode: "create" | "edit";
  journalId: number | null;
  returnMonth: string;
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

const activeScreenId = ref<(typeof screens)[number]["id"]>("journals");
const selectedMonth = ref(currentMonth());
const journalForm = ref<JournalFormState | null>(null);
const currentScreen = computed(() => screens.find((screen) => screen.id === activeScreenId.value) ?? screens[0]);

function openCreateJournal() {
  journalForm.value = { mode: "create", journalId: null, returnMonth: selectedMonth.value };
}

function openEditJournal(journalId: number) {
  journalForm.value = { mode: "edit", journalId, returnMonth: selectedMonth.value };
}

function finishJournal(date?: string) {
  if (date) selectedMonth.value = date.slice(0, 7);
  journalForm.value = null;
  activeScreenId.value = "journals";
}

function cancelJournal() {
  if (journalForm.value) selectedMonth.value = journalForm.value.returnMonth;
  journalForm.value = null;
  activeScreenId.value = "journals";
}

function navigateTo(screenId: (typeof screens)[number]["id"]) {
  journalForm.value = null;
  activeScreenId.value = screenId;
}
</script>

<template>
  <header class="shell-topbar">
    <a class="brand-wrap" href="#" aria-label="帳務 ホーム" @click.prevent="navigateTo('journals')">
      <span class="brand-mark" aria-hidden="true">帳</span>
      <span><span class="brand">帳務</span><span class="brand-caption">会計ワークスペース</span></span>
    </a>
    <div class="top-context"><span>会計ワークスペース</span><span class="context-divider" aria-hidden="true"></span><span>ローカル帳簿</span></div>
    <div class="top-actions"><span class="connection-state"><span class="state-dot" aria-hidden="true"></span>ローカル保存</span><span class="avatar" aria-label="利用者">事</span></div>
  </header>

  <div class="shell-workspace">
    <aside class="sidebar" aria-label="メインメニュー">
      <p class="side-label">会計</p>
      <nav class="nav-list" aria-label="画面">
        <button
          v-for="screen in screens"
          :key="screen.id"
          class="nav-item"
          :aria-current="!journalForm && activeScreenId === screen.id ? 'page' : undefined"
          type="button"
          @click="navigateTo(screen.id)"
        >
          <span class="nav-glyph" aria-hidden="true">{{ screen.icon }}</span>{{ screen.title }}
        </button>
      </nav>
      <div class="side-spacer"></div>
      <div class="workspace-card"><div class="workspace-card-label">データ保存先</div><div class="workspace-name">SQLite ローカルDB</div><div class="workspace-state"><span class="state-dot" aria-hidden="true"></span>API接続</div></div>
    </aside>

    <main class="content-region">
      <JournalListView
        v-if="activeScreenId === 'journals' && !journalForm"
        :month="selectedMonth"
        @month-change="selectedMonth = $event"
        @create="openCreateJournal"
        @edit="openEditJournal"
      />
      <JournalView
        v-else-if="journalForm"
        :key="`${journalForm.mode}-${journalForm.journalId ?? 'new'}`"
        :mode="journalForm.mode"
        :journal-id="journalForm.journalId ?? undefined"
        @complete="finishJournal"
        @cancel="cancelJournal"
      />
      <component :is="currentScreen.component" v-else />
    </main>
  </div>
</template>