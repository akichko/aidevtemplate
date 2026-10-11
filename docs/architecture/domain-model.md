# ドメインモデル

## 境界づけられたコンテキスト

初期リリースでは、仕訳記録と財務諸表を「会計」コンテキストとして扱う。業務概念とルールは[ドメイン要件](../requirements/domain-requirements.md)を参照する。

```mermaid
erDiagram
    JOURNAL ||--|{ JOURNAL_LINE : "複数の明細で構成する"
    ACCOUNT ||--o{ JOURNAL_LINE : "分類する"
    ACCOUNT ||--o{ SUBACCOUNT : "内訳を持つ"
    SUBACCOUNT o|--o{ JOURNAL_LINE : "明細での指定は要確認"
```

仕訳明細は借方・貸方で共通の概念とする。借方・貸方の区別方法や補助科目を仕訳明細に指定する条件は未確定であり、[未確定事項](../requirements/domain-requirements.md#未確定事項)を参照する。

| ID | ルール | 関連要件 |
|---|---|---|
| DES-DOM-001 | 仕訳は複数の共通形式の仕訳明細から構成される。 | BR-002、REQ-F-001 |
| DES-DOM-002 | 仕訳明細は1つの勘定科目を参照し、勘定科目は0件以上の補助科目を持つ。 | BR-003、BR-005、REQ-F-004、REQ-F-005 |
| DES-DOM-003 | 勘定科目は資産、負債、純資産、利益、損失の区分を持つ。 | BR-004、REQ-F-004 |
