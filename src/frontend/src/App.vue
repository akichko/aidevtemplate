<script setup lang="ts">
import { computed, ref } from "vue";
import AccountMasterView from "./views/AccountMasterView.vue";
import BalanceSheetView from "./views/BalanceSheetView.vue";
import IncomeStatementView from "./views/IncomeStatementView.vue";
import JournalView from "./views/JournalView.vue";

const screens = [
  { id: "journal", title: "仕訳登録", icon: "＋", component: JournalView },
  { id: "balance", title: "貸借対照表", icon: "▤", component: BalanceSheetView },
  { id: "income", title: "損益計算書", icon: "▥", component: IncomeStatementView },
  { id: "accounts", title: "勘定科目マスタ", icon: "≡", component: AccountMasterView },
] as const;

const activeScreenId = ref<(typeof screens)[number]["id"]>("journal");
const currentScreen = computed(() => screens.find((screen) => screen.id === activeScreenId.value) ?? screens[0]);
</script>

<template>
  <header class="shell-topbar">
    <a class="brand-wrap" href="#" aria-label="帳務 ホーム" @click.prevent="activeScreenId = 'journal'">
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
          :aria-current="activeScreenId === screen.id ? 'page' : undefined"
          type="button"
          @click="activeScreenId = screen.id"
        >
          <span class="nav-glyph" aria-hidden="true">{{ screen.icon }}</span>{{ screen.title }}
        </button>
      </nav>
      <div class="side-spacer"></div>
      <div class="workspace-card"><div class="workspace-card-label">データ保存先</div><div class="workspace-name">SQLite ローカルDB</div><div class="workspace-state"><span class="state-dot" aria-hidden="true"></span>API接続</div></div>
    </aside>

    <main class="content-region">
      <component :is="currentScreen.component" />
    </main>
  </div>
</template>