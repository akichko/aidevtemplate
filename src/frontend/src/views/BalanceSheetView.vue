<script setup lang="ts">
import { onMounted, ref } from "vue";
import { accountingApi, yen, type BalanceSheet, type StatementLine } from "../api";

const asOf = ref(new Date().toISOString().slice(0, 10));
const report = ref<BalanceSheet | null>(null);
const errorMessage = ref("");
const busy = ref(false);

async function loadReport() {
  errorMessage.value = "";
  if (!asOf.value) {
    errorMessage.value = "基準日を入力してください。";
    return;
  }
  busy.value = true;
  try {
    report.value = await accountingApi.getBalanceSheet(asOf.value);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "貸借対照表を取得できませんでした。";
  } finally {
    busy.value = false;
  }
}

function total(lines: StatementLine[]) {
  return lines.reduce((sum, line) => sum + line.amount, 0);
}

onMounted(loadReport);
</script>

<template>
  <div class="page-inner">
    <div class="breadcrumb"><span>会計</span><span aria-hidden="true">/</span><strong>貸借対照表</strong></div>
    <div class="page-heading"><div><p class="eyebrow">財政状態</p><h1>貸借対照表</h1><p class="subtitle">指定した基準日時点の資産・負債・純資産を表示します。</p></div></div>
    <form class="panel form-panel report-filter" @submit.prevent="loadReport"><div class="report-tools"><div class="field"><label for="balance-date">基準日</label><input id="balance-date" v-model="asOf" class="control" type="date" required></div><button class="button" type="submit" :disabled="busy">{{ busy ? "集計中…" : "表示" }}</button><span class="panel-note">単位: 円</span></div></form>
    <p v-if="errorMessage" class="page-error" role="alert">{{ errorMessage }}</p>
    <template v-if="report">
      <div class="report-summary"><article class="summary-card"><div class="summary-card-label">資産合計</div><div class="summary-card-value">{{ yen.format(report.totals.assets) }}<small>円</small></div></article><article class="summary-card"><div class="summary-card-label">負債合計</div><div class="summary-card-value">{{ yen.format(report.totals.liabilities) }}<small>円</small></div></article><article class="summary-card"><div class="summary-card-label">純資産合計</div><div class="summary-card-value">{{ yen.format(report.totals.equity) }}<small>円</small></div></article></div>
      <div class="statement-grid">
        <article class="panel statement-card"><div class="panel-head"><h2 class="panel-title">資産</h2><span class="panel-note">基準日: {{ report.asOf }}</span></div><div class="statement-section"><div v-for="line in report.assets" :key="line.accountId" class="statement-row"><span>{{ line.accountName }}</span><span class="amount">{{ yen.format(line.amount) }}</span></div><p v-if="report.assets.length === 0" class="empty-state">資産の仕訳はありません。</p><div class="statement-row total"><span>資産合計</span><span class="amount">{{ yen.format(total(report.assets)) }}</span></div></div></article>
        <article class="panel statement-card"><div class="panel-head"><h2 class="panel-title">負債・純資産</h2><span class="panel-note">基準日: {{ report.asOf }}</span></div><div class="statement-section"><h3 class="statement-subheading">負債</h3><div v-for="line in report.liabilities" :key="line.accountId" class="statement-row"><span>{{ line.accountName }}</span><span class="amount">{{ yen.format(line.amount) }}</span></div><p v-if="report.liabilities.length === 0" class="empty-state">負債の仕訳はありません。</p><div class="statement-row total"><span>負債合計</span><span class="amount">{{ yen.format(total(report.liabilities)) }}</span></div></div><div class="statement-section"><h3 class="statement-subheading">純資産</h3><div v-for="line in report.equity" :key="line.accountId" class="statement-row"><span>{{ line.accountName }}</span><span class="amount">{{ yen.format(line.amount) }}</span></div><p v-if="report.equity.length === 0" class="empty-state">純資産の仕訳はありません。</p><div class="statement-row total"><span>純資産合計</span><span class="amount">{{ yen.format(total(report.equity)) }}</span></div></div><div class="statement-foot"><span>負債・純資産合計</span><span>{{ yen.format(report.totals.liabilities + report.totals.equity) }} 円</span></div></article>
      </div>
      <p class="report-footnote">純資産には基準日までの利益累計を含みます。</p>
    </template>
  </div>
</template>