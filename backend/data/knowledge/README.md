# JustTap cleaned knowledge dataset

## Canonical RAG files

- `justtap_knowledge.csv`
- `justtap_knowledge.json`
- `knowledge.schema.json`
- `DATA_REPORT.json`

## Raw files

The original uploaded CSV and JSONL are preserved under `raw/`.

## Important data rule

No service names, answers, locations, or provider details were invented.
The source CSV does not contain a separate `service` column, so the canonical
`service` field is intentionally empty rather than using hardcoded mappings.

`subService` is preserved from the source `sub_service` field.

The next RAG implementation should use:
intent -> category/subService -> urgency/specificity -> ranking.

Generic queries must not be matched to a more specific record merely because
they share words such as "book", "repair", or "service".
