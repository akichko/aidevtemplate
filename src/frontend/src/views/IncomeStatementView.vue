<script setup lang="ts">
import { onMounted, ref } from "vue";
import { accountingApi, yen, type IncomeStatement } from "../api";

function currentPeriod() {
  const now = new Date();
  const year = now.getFullYear() - (now.getMonth() < 3 ? 1 : 0);
  return { start: `${year}-04-01`, end: `${year + 1}-03-31` };
}

const period = currentPeriod();
const start = ref(period.start);
const end = ref(period.end);
const report = ref<IncomeStatement | null>(null);
const errorMessage = ref("");
const busy = ref(false);

async function loadReport() {
  errorMessage.value = "";
  if (!start.value || !end.value || start.value > end.value) {
    errorMessage.value = "有効な期間を入力してください。";
    return;
  }
  busy.value = true;
  try {
    report.value = await accountingApi.getIncomeStatement(start.value, end.value);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "損益計算書を取得できませんでした。";
  } finally {
    busy.value = false;
  }
}

onMounted(loadReport);
</script>

<template>
  <div class="page-inner">
    <div class="breadcrumb"><span>会計</span><span aria-hidden="true">/</span><strong>損益計算書</strong></div>
    <div class="page-heading"><div><p class="eyebrow">経営成績</p><h1>損益計算書</h1><p class="subtitle">指定期間の収益・費用と利益を表示します。</p></div></div>
    <form class="panel form-panel report-filter" @submit.prevent="loadReport"><div class="report-tools"><div class="field range"><label for="income-start">開始日</label><input id="income-start" v-model="start" class="control" type="date" required></div><span class="range-separator">から</span><div class="field range"><label for="income-end">終了日</label><input id="income-end" v-model="end" class="control" type="date" required></div><button class="button" type="submit" :disabled="busy">{{ busy ? "集計中…" : "表示" }}</button><span class="panel-note">単位: 円</span></div></form>
    <p v-if="errorMessage" class="page-error" role="alert">{{ errorMessage }}</p>
    <template v-if="report">
      <div class="report-summary"><article class="summary-card"><div class="summary-card-label">収益合計</div><div class="summary-card-value">{{ yen.format(report.totals.revenues) }}<small>円</small></div></article><article class="summary-card"><div class="summary-card-label">費用合計</div><div class="summary-card-value">{{ yen.format(report.totals.expenses) }}<small>円</small></div></article><article class="summary-card"><div class="summary-card-label">当期純利益</div><div class="summary-card-value" :class="{ 'negative-value': report.totals.netIncome < 0 }">{{ yen.format(report.totals.netIncome) }}<small>円</small></div></article></div>
      <div class="statement-grid"><article class="panel statement-card"><div class="panel-head"><h2 class="panel-title">収益</h2><span class="panel-note">{{ report.start }} ～ {{ report.end }}</span></div><div class="statement-section"><div v-for="line in report.revenues" :key="line.accountId" class="statement-row"><span>{{ line.accountName }}</span><span class="amount">{{ yen.format(line.amount) }}</span></div><p v-if="report.revenues.length === 0" class="empty-state">対象期間の収益はありません。</p><div class="statement-row total"><span>収益合計</span><span class="amount">{{ yen.format(report.totals.revenues) }}</span></div></div></article>
        <article class="panel statement-card"><div class="panel-head"><h2 class="panel-title">費用</h2><span class="panel-note">{{ report.start }} ～ {{ report.end }}</span></div><div class="statement-section"><div v-for="line in report.expenses" :key="line.accountId" class="statement-row"><span>{{ line.accountName }}</span><span class="amount">{{ yen.format(line.amount) }}</span></div><p v-if="report.expenses.length === 0" class="empty-state">対象期間の費用はありません。</p><div class="statement-row total"><span>費用合計</span><span class="amount">{{ yen.format(report.totals.expenses) }}</span></div></div><div class="statement-foot"><span>当期純利益</span><span>{{ yen.format(report.totals.netIncome) }} 円</span></div></article></div>
    </template>
  </div>
</template>