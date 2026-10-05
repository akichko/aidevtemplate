# Deployment Architecture

| Environment | Purpose |
|---|---|
| dev | 開発 |
| stg | 検証 |
| prod | 本番 |

```mermaid
flowchart LR
    Git[Git] --> CI[CI]
    CI --> Test[Test]
    Test --> Deploy[Deploy]
    Deploy --> SWA[Azure Static Web Apps]
```
