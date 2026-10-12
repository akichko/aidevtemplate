import type { FixedAsset, FixedAssetInput, FixedAssetOption } from "../domain/accounting.js";

export interface FixedAssetRepository {
  listFixedAssets(): Promise<FixedAsset[]>;
  getFixedAsset(fixedAssetId: number): Promise<FixedAsset | null>;
  createFixedAsset(input: FixedAssetInput): Promise<FixedAsset>;
  updateFixedAsset(fixedAssetId: number, input: FixedAssetInput): Promise<FixedAsset | null>;
}

export interface FixedAssetCandidateQuery {
  listJournalOptions(): Promise<FixedAssetOption[]>;
  getJournalOption(fixedAssetId: number): Promise<FixedAssetOption | null>;
}