# QA local

Run after API migration and seed: `node --test tests/api.test.mjs`.
Optional PowerShell API URL: `$env:TEST_API_URL='http://localhost:3001/api'`.
Tests create a real COD order and consume one item per run. Use disposable demo data.

Concurrency requires a freshly seeded **real PostgreSQL** database and consumes its stock=1 product:
`$env:TEST_POSTGRES_CONCURRENCY='1'; node --test tests/api.test.mjs`.
Do not enable that flag for pg-mem: memory emulation does not verify PostgreSQL row locks.

## Browser acceptance flow

1. At desktop and phone widths, open the catalog; verify all six categories, Vietnamese text and integer VND prices.
2. Search by name/brand, filter category, then search for absent text; verify empty message and recovery by clearing search.
3. Open product detail, add to cart, change quantity, remove item and reload; verify totals and persistence.
4. Add an in-stock product; open checkout. Submit empty/invalid customer fields and verify validation.
5. Fill name, phone and address; choose COD and submit once. Verify confirmation order ID, DB price total and cleared cart.
6. Confirm purchased product stock decreased. Verify zero-stock products cannot be purchased.
7. Stop API/reload to inspect readable error and retry; restore API and verify recovery.

Record actual run results separately; this checklist alone is not evidence of a browser run.

## Recorded verification — 2026-11-17

Command: `node tests/api.test.mjs`, Node 18 against `http://localhost:3001/api`, integrated API using `DEMO_DB=memory`.

- All four nested API groups passed: catalog/search/filter/details/empty result; validation including malformed JSON, duplicate IDs and missing product; stock rejection and unchanged valid-item stock after failed mixed basket; COD with forged client prices ignored and stock decreased by one.
- No failed assertions. PostgreSQL concurrency test explicitly skipped. Real PostgreSQL transaction isolation and concurrent last-unit ordering remain unverified.
- Final suite run completed after adding malformed JSON coverage. Two successful suite runs consumed two stock units and created two COD orders in demo memory.
- Browser checklist above remains for manager verification: cart controls/persistence, responsive rendering, customer validation, checkout confirmation and cart clearing, and API-error recovery. API success does not establish those UI results.

## Final browser verification — reported by manager

The manager completed the integrated browser checks after the UTF-8 display and phone-validation fixes:

- Desktop: searched RTX 4060, opened detail, added to cart, changed quantity from 1 to 2, reloaded and confirmed persistence, then changed back to 1. Empty checkout submission was blocked. Valid COD submission created real API order `f47a1748-ab95-43e3-88d7-92dd47d03188`, total 8,290,000 VND; confirmation appeared and cart cleared.
- Mobile at 390 × 844: no horizontal overflow. Phone value `abc` was rejected after the pattern fix. Valid SSD COD checkout created real API order `8f1324ea-711f-4eab-9fec-9384f36e939d`, total 2,590,000 VND; cart cleared.
- Search with no matches displayed the empty state. SSD category filter showed two products; the out-of-stock WD product had its purchase action disabled.
- Simulated failures used intercepted browser responses: catalog HTTP 503 displayed an error, then retry recovered all 12 products; order HTTP 409 displayed an alert and preserved both cart and customer form. These interception checks validate UI error handling; they are distinct from the two successful COD orders submitted to the real running API (using demo memory storage).
- Final UTF-8 display and phone-validation regressions were fixed and checked. No further API test run was needed because the API was unchanged.

Real PostgreSQL concurrency and database locking remain unverified; the explicit concurrency skip above still applies.
