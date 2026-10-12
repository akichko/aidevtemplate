import type { FixedAssetCandidateQuery, FixedAssetRepository } from "./fixed-asset-repository.js";
import { NotFoundError } from "./accounting-service.js";
import { validateFixedAssetInput } from "../domain/accounting.js";

export class FixedAssetService {
  constructor(
    private readonly repository: FixedAssetRepository,
    private readonly journalOptions: FixedAssetCandidateQuery,
  ) {}

  async list() {
    return this.repository.listFixedAssets();
  }

  async get(fixedAssetId: number) {
    const asset = await this.repository.getFixedAsset(fixedAssetId);
    if (!asset) throw new NotFoundError("固定資産が見つかりません。");
    return asset;
  }

  async create(input: unknown) {
    return this.repository.createFixedAsset(validateFixedAssetInput(input));
  }

  async update(fixedAssetId: number, input: unknown) {
    const asset = await this.repository.updateFixedAsset(fixedAssetId, validateFixedAssetInput(input));
    if (!asset) throw new NotFoundError("固定資産が見つかりません。");
    return asset;
  }

  async listJournalOptions() {
    return this.journalOptions.listJournalOptions();
  }
}
