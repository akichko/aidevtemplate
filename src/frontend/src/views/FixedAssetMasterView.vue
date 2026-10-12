<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { accountingApi, type FixedAsset, type FixedAssetInput } from "../api";

interface FixedAssetForm {
  name: string;
  acquisitionDate: string;
  acquisitionPrice: string;
  depreciationMethod: string;
  usefulLife: string;
  residualValue: string;
  depreciationStartDate: string;
}

function emptyForm(): FixedAssetForm {
  return {
    name: "",
    acquisitionDate: "",
    acquisitionPrice: "",
    depreciationMethod: "",
    usefulLife: "",
    residualValue: "",
    depreciationStartDate: "",
  };
}

const assets = ref<FixedAsset[]>([]);
const selectedId = ref<number | null>(null);
const form = ref<FixedAssetForm>(emptyForm());
const errorMessage = ref("");
const toastMessage = ref("");
const busy = ref(false);
const editing = computed(() => selectedId.value !== null);
let toastTimer = 0;

function notify(message: string) {
  toastMessage.value = message;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastMessage.value = "", 2400);
}

async function loadAssets() {
  assets.value = await accountingApi.listFixedAssets();
}

function selectAsset(asset: FixedAsset) {
  selectedId.value = asset.id;
  form.value = {
    name: asset.name ?? "",
    acquisitionDate: asset.acquisitionDate ?? "",
    acquisitionPrice: asset.acquisitionPrice === undefined ? "" : String(asset.acquisitionPrice),
    depreciationMethod: asset.depreciationMethod ?? "",
    usefulLife: asset.usefulLife === undefined ? "" : String(asset.usefulLife),
    residualValue: asset.residualValue === undefined ? "" : String(asset.residualValue),
    depreciationStartDate: asset.depreciationStartDate ?? "",
  };
  errorMessage.value = "";
}

function startNew() {
  selectedId.value = null;
  form.value = emptyForm();
  errorMessage.value = "";
}

function optionalText(value: string): string | undefined {
  return value.trim() || undefined;
}

function optionalNumber(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : Number.NaN;
}

function getInput(): FixedAssetInput | null {
  const acquisitionPrice = optionalNumber(form.value.acquisitionPrice);
  const usefulLife = optionalNumber(form.value.usefulLife);
  const residualValue = optionalNumber(form.value.residualValue);
  const name = optionalText(form.value.name);
  const depreciationMethod = optionalText(form.value.depreciationMethod);
  if ([acquisitionPrice, usefulLife, residualValue].some((value) => Number.isNaN(value))) {
    errorMessage.value = "数値項目を確認してください。";
    return null;
  }
  return {
    ...(name === undefined ? {} : { name }),
    ...(form.value.acquisitionDate ? { acquisitionDate: form.value.acquisitionDate } : {}),
    ...(acquisitionPrice === undefined ? {} : { acquisitionPrice }),
    ...(depreciationMethod === undefined ? {} : { depreciationMethod }),
    ...(usefulLife === undefined ? {} : { usefulLife }),
    ...(residualValue === undefined ? {} : { residualValue }),
    ...(form.value.depreciationStartDate ? { depreciationStartDate: form.value.depreciationStartDate } : {}),
  };
}

async function saveAsset() {
  errorMessage.value = "";
  const input = getInput();
  if (!input) return;
  const isNew = selectedId.value === null;
  busy.value = true;
  try {
    const saved = selectedId.value
      ? await accountingApi.updateFixedAsset(selectedId.value, input)
      : await accountingApi.createFixedAsset(input);
    await loadAssets();
    const refreshed = assets.value.find((asset) => asset.id === saved.id);
    if (refreshed) selectAsset(refreshed);
    notify(isNew ? "固定資産を登録しました" : "固定資産を変更しました");
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "固定資産を保存できませんでした。";
  } finally {
    busy.value = false;
  }
}

onMounted(async () => {
  try {
    await loadAssets();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "固定資産を読み込めませんでした。";
  }
});
</script>

<template>
  <div class="page-inner">
    <div class="breadcrumb"><span>資産</span><span aria-hidden="true">/</span><strong>固定資産マスタ</strong></div>
    <div class="page-heading"><div><p class="eyebrow">資産の設定</p><h1>固定資産マスタ</h1><p class="subtitle">固定資産情報を登録・変更します。</p></div></div>

    <div class="master-layout">
      <section class="panel master-list-panel" aria-labelledby="fixed-asset-list-heading">
        <div class="panel-head master-list-head"><h2 class="panel-title" id="fixed-asset-list-heading">固定資産一覧</h2><button class="button subtle" type="button" @click="startNew">＋ 新規</button></div>
        <div class="table-scroll"><table class="master-table"><thead><tr><th>固定資産名</th><th>取得日</th></tr></thead><tbody>
          <tr v-for="asset in assets" :key="asset.id" :aria-selected="asset.id === selectedId"><td><button class="master-select" type="button" @click="selectAsset(asset)">{{ asset.name?.trim() || `固定資産 ${asset.id}` }}</button></td><td>{{ asset.acquisitionDate || "-" }}</td></tr>
          <tr v-if="assets.length === 0"><td class="empty-row" colspan="2">固定資産はありません</td></tr>
        </tbody></table></div>
      </section>

      <section class="panel master-editor-panel" aria-labelledby="fixed-asset-editor-heading">
        <div class="panel-head"><h2 class="panel-title" id="fixed-asset-editor-heading">{{ editing ? "固定資産を変更" : "固定資産を登録" }}</h2></div>
        <form class="master-form" @submit.prevent="saveAsset">
          <div class="master-fields">
            <div class="field"><label for="fixed-asset-name">固定資産名</label><input id="fixed-asset-name" v-model="form.name" class="control" type="text"></div>
            <div class="field"><label for="fixed-asset-acquisition-date">取得日</label><input id="fixed-asset-acquisition-date" v-model="form.acquisitionDate" class="control" type="date"></div>
            <div class="field"><label for="fixed-asset-price">取得価額</label><input id="fixed-asset-price" v-model="form.acquisitionPrice" class="control" type="number" step="any"></div>
            <div class="field"><label for="fixed-asset-method">償却方法</label><input id="fixed-asset-method" v-model="form.depreciationMethod" class="control" type="text"></div>
            <div class="field"><label for="fixed-asset-useful-life">耐用年数</label><input id="fixed-asset-useful-life" v-model="form.usefulLife" class="control" type="number" step="any"></div>
            <div class="field"><label for="fixed-asset-residual-value">残存価額</label><input id="fixed-asset-residual-value" v-model="form.residualValue" class="control" type="number" step="any"></div>
            <div class="field"><label for="fixed-asset-depreciation-start">償却開始日</label><input id="fixed-asset-depreciation-start" v-model="form.depreciationStartDate" class="control" type="date"></div>
          </div>
          <div class="form-footer"><button v-if="editing" class="button secondary" type="button" @click="startNew">新規入力に戻る</button><button class="button" type="submit" :disabled="busy">{{ editing ? "変更を保存" : "固定資産を登録" }}</button></div>
        </form>
      </section>
    </div>
    <p v-if="errorMessage" class="page-error" role="alert">{{ errorMessage }}</p><div v-if="toastMessage" class="toast" role="status">{{ toastMessage }}</div>
  </div>
</template>
