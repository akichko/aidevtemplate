<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { accountingApi, yen, type Journal } from "../api";

const props = defineProps<{ month: string }>();
const emit = defineEmits<{
  monthChange: [month: string];
  create: [];
  edit: [journalId: number];
}>();

const journals = ref<Journal[]>([]);
const errorMessage = ref("");
const loading = ref(false);
const deletingId = ref<number | null>(null);
let requestSequence = 0;

const monthLabel = computed(() => {
  const [year, month] = props.month.split("-").map(Number);
  return `${year}年${month}月`;
});

async function loadJournals() {
  const sequence = ++requestSequence;
  loading.value = true;
  errorMessage.value = "";
  try {
    const result = await accountingApi.listJournals(props.month);
    if (sequence === requestSequence) journals.value = result;
  } catch (error) {
    if (sequence === requestSequence) {
      errorMessage.value = error instanceof Error ? error.message : "仕訳一覧を取得できませんでした。";
    }
  } finally {
    if (sequence === requestSequence) loading.value = false;
  }
}

function shiftMonth(offset: number) {
  const [year, month] = props.month.split("-").map(Number);
  const shifted = new Date(year, month - 1 + offset, 1);
  emit("monthChange", `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}`);
}

async function deleteJournal(journal: Journal) {
  const confirmed = window.confirm(`「${journal.description}」を削除します。削除した仕訳は復元できません。よろしいですか？`);
  if (!confirmed) return;
  deletingId.value = journal.id;
  errorMessage.value = "";
  try {
    await accountingApi.deleteJournal(journal.id);
    await loadJournals();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "仕訳を削除できませんでした。";
  } finally {
    deletingId.value = null;
  }
}

watch(() => props.month, () => void loadJournals(), { immediate: true });
</script>

<template>
  <div class="page-inner">
    <div class="breadcrumb"><span>会計</span><span aria-hidden="true">/</span><strong>仕訳一覧</strong></div>
    <div class="page-heading"><div><p class="eyebrow">仕訳の確認</p><h1>仕訳一覧</h1><p class="subtitle">月ごとの仕訳を確認し、登録・編集・削除を行います。</p></div><span class="panel-note">削除した仕訳は復元できません</span></div>

    <section class="panel form-panel journal-list-toolbar" aria-label="仕訳一覧の期間">
      <button class="button secondary" type="button" aria-label="前月" @click="shiftMonth(-1)">‹ 前月</button>
      <div class="field month-field"><label for="journal-month">対象年月</label><input id="journal-month" class="control" type="month" :value="month" @change="emit('monthChange', ($event.target as HTMLInputElement).value)"></div>
      <button class="button secondary" type="button" aria-label="翌月" @click="shiftMonth(1)">翌月 ›</button>
      <button class="button create-journal-button" type="button" @click="emit('create')">＋ 仕訳を登録</button>
    </section>

    <p v-if="errorMessage" class="page-error" role="alert">{{ errorMessage }}</p>
    <section class="panel journal-list-panel" aria-labelledby="journal-list-heading">
      <div class="panel-head"><h2 id="journal-list-heading" class="panel-title">{{ monthLabel }}の仕訳</h2><span class="panel-note">{{ loading ? "読み込み中…" : `${journals.length} 件` }}</span></div>
      <div class="table-scroll"><table><thead><tr><th>取引日</th><th>摘要</th><th class="right">借方合計</th><th class="right">貸方合計</th><th class="right">操作</th></tr></thead><tbody>
        <tr v-for="journal in journals" :key="journal.id">
          <td>{{ journal.date }}</td><td>{{ journal.description }}</td>
          <td class="right">{{ yen.format(journal.debitTotal) }} 円</td><td class="right">{{ yen.format(journal.creditTotal) }} 円</td>
          <td class="right row-actions"><button class="text-button" type="button" :disabled="deletingId === journal.id" @click="emit('edit', journal.id)">編集</button><button class="text-button danger" type="button" :disabled="deletingId === journal.id" @click="deleteJournal(journal)">{{ deletingId === journal.id ? "削除中…" : "削除" }}</button></td>
        </tr>
        <tr v-if="!loading && journals.length === 0"><td class="empty-row" colspan="5">この月の仕訳はありません</td></tr>
      </tbody></table></div>
    </section>
  </div>
</template>