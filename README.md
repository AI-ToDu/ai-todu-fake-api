# AI-ToDu · Fake REST API

TB1 academic prototype · v0.2.0 · English API contract.

This package is the **canonical source** of the shared demo engine. The Angular repository vendors an exact copy for static hosting and the integrated local demonstration. Its provenance manifest records this repository commit and file hashes; use its sync tool when updating the engine.

```sh
npm test
npm start -- --port 8853
```

Node 24+ is required. No runtime dependencies are needed. The process binds to `127.0.0.1` and persists `.demo-data/state.json`, excluded from Git. The standalone package serves `/api/v1` requests; it has no compiled Angular interface. For the complete browser flow, run `npm run demo` in [ai-todu-webapp](https://github.com/AI-ToDu/ai-todu-webapp/tree/fix/tb1-readiness). That bundled server uses the same engine and serves the compiled workspace on port 8850.

- [OpenAPI 3.1 contract](openapi.json): implemented demo endpoints only.
- [35-table relational design](database/schema.sql): migration target, not the JSON persistence adapter.
- [Architecture and coverage](https://github.com/AI-ToDu/ai-todu-report/blob/fix/tb1-readiness/design/architecture.md).

Demo identities: `admin@demo.ai-todu.test`, `warehouse@demo.ai-todu.test`, `sales@demo.ai-todu.test`, `logistics@demo.ai-todu.test`; all use the intentionally public test password `DemoOnly2026!`. Use fictional data. These credentials and client-side/JSON storage are unsuitable for production.

A sale validates every line before committing sale, snapshots, payment/demo receipt, stock and movements. Invalid quantities, duplicate SKU, blocked stock, excess receipt, oversale, repeated cancellation, resource conflicts and cross-tenant references are rejected. Returns cannot exceed sold quantities or occur during an unfinished dispatch. Confirmed delivery requires a recipient. Tests exercise actual HTTP concurrency and persistence across restart as well as domain failures.

Browser transport: the frontend's Service Worker imports the same engine and commits one IndexedDB transaction per accepted request. The static Pages URL is **not a public backend callable by curl**; records are local to a browser/origin and are not shared between devices. Node HTTP is a local development alternative. No real payments, fiscal receipts, reset emails, user invitations, subscriptions, route optimization or production security are implemented.

## Branching and review

`main` and `develop` begin at package initialization. `fix/tb1-readiness` contains the reviewable TB1 implementation, domain/design and documentation commits. Review and merge deliberately; no fabricated author history or backdated sprint records. Production Java/Spring Boot, PostgreSQL/JPA and secure server authentication remain AV2 work.
