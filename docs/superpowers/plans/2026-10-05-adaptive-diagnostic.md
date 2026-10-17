# Adaptive Diagnostic Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline; preserve draft-only release status.

**Goal:** Build and test an additive, no-dependency diagnostic and offline commercial-learning report.
**Architecture:** Pure deterministic engine; static accessible UI; separate offline CRM aggregator. Existing payment/application code unchanged.
**Tech Stack:** ES modules, browser DOM, CSS, Node 22 native test runner; existing Python Playwright/Chromium for local verification.
**Spec:** `docs/superpowers/specs/2026-10-05-adaptive-diagnostic-design.md`

## Global Constraints
At most seven questions. Exactly GBP 0/25000/75000 minor units. No purchase, transmission, persistence, tracking, fabricated probabilities or self-awarded P95. All new files except four exact static exemptions in `vercel.json`; base commit `ba4c4b2844f9ad0093916805d87c2b14f43f72e3`, base tree `c886b3374c565a8a98805358f95fa820bdf71b17`.

## Review Focus
Out-of-order transcripts fail; editing truncates downstream state; unknowns cannot drive paid recommendations; money arithmetic and denominators remain honest; browser interactions neither persist nor transmit answers.

## Task 1 — engine
Create `client/public/diagnostic/engine.mjs` and `tests/diagnostic/engine.test.mjs`.
Interfaces: `getQuestion(answers)`, `answer(answers, questionId, optionId)`, `rewind(answers, index)`, `getResult(answers)`, exported frozen `OFFERS`.
- [x] Assert empty transcript starts at pain, relevant branching, fallback, all offer paths, strict validation and complete graph termination.
- [x] Run native tests RED; implement only the specified engine; rerun GREEN.

## Task 2 — UI
Create `index.html`, `styles.css`, `app.mjs` beside engine, and `tests/diagnostic/assets.test.mjs`.
- [x] Assert CSP/no trackers, relative assets, accessibility semantics and no network/storage primitives.
- [x] Run RED; implement native radio form, back/reset, result, download, explicit contact link and limitations.
- [ ] Run GREEN; exercise actual desktop/mobile/keyboard/download in local Chromium; inspect screenshots.

## Task 3 — offline learning
Create `tools/diagnostic/analyse-crm.mjs` and `tests/diagnostic/crm.test.mjs`.
Interface: `analyseCrm(document)` -> aggregate-only descriptive report; CLI `node tools/diagnostic/analyse-crm.mjs path.json`.
- [x] Assert empty/sparse data, denominator, refunds/costs, duplicates, schema rejection, nonfinite values and no ID leakage.
- [x] Run RED; implement strict allowlisted ingestion and aggregate metrics; rerun GREEN.

## Task 4 — publish review candidate
Create `.github/workflows/adaptive-diagnostic.yml` and `DIAGNOSTIC_MVP.md` with reproducible verification and known limitations.
- [ ] Run all local feature tests and browser checks, record results and hashes.
- [ ] Create GitHub tree/commit from pinned base, new branch and draft PR; verify remote path/blob hashes and main unchanged.
- [ ] Report feature verification separately from full-repo CI, independent P95 and production admission.

## Execution ruling
The connected GitHub API is available, but this isolated container cannot resolve github.com and contains no full checkout/dependencies. Build/test the additive files locally and publish via Git data API preserving the full pinned base tree. Full-repository tests/build are delegated to the existing PR workflow, not represented as locally passed. No unrelated machine/worktree is touched. The local browser attempt was blocked by administrator policy; no retry or bypass. Browser acceptance remains pending.

## Verification checkpoint
49 native tests pass; browser navigation BLOCKED by administrator policy; full-repository build and independent P95 remain pending. Publishing a draft candidate does not assert release qualification.
