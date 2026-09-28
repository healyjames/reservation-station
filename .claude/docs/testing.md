# Testing Guidelines

## Method

Predict-then-verify when changing code that has existing tests: read the existing tests, predict which will break and why, implement, run the tests, compare against predictions, then fix code (not tests) for any unpredicted break.

## What we test (coverage philosophy)

Business logic must always have full test coverage. If a function transforms data, assert on the transformation result; if it filters, assert on what's included and excluded. Don't chase 100% line coverage of trivial/mid-function implementation detail — but every new exported function or significant code path needs tests before the task is considered complete.

## Black-box testing — test the contract, not the implementation

Tests verify **what** a function produces for a given input, not **how** it produces it internally. Treat the function under test as a black box.

**Test this (boundary/contract):**

- Given valid input → returns expected output
- Given invalid input → returns error / empty result / throws
- Given edge case input (empty array, null, boundary values) → handles gracefully

**Do NOT test this (implementation detail):**

- Whether a logger was called mid-function
- Internal method call order
- Private helper function behavior (test through the public API)

## Test levels

- **Backend:** `test/**/*.spec.ts`, run against a real D1 instance via `@cloudflare/vitest-pool-workers` — not mocked. Seed tables directly with `INSERT OR REPLACE` helpers.
- **Frontend:** `src/frontend/**/*.test.{ts,tsx}`, using `@testing-library/preact` in a jsdom environment (`// @vitest-environment jsdom`).
- No separate e2e layer currently exists.

## Mocking

- Mock at module level (`vi.mock()`), before imports are used.
- Reset mocks in `beforeEach` with `vi.clearAllMocks()`.
- Prefer factory functions for test data (an `overrides` object pattern), not one-off literals repeated across tests.
- Store shared mocks in a `/mock` folder for reuse across multiple test files.

## Libraries & tools

Vitest, `@cloudflare/vitest-pool-workers` (backend, real D1), `@testing-library/preact` (frontend components). Run via `npm run test` (both projects) or `npm run test:frontend` (frontend only).

## UI components

Preact components are tested in-app via `@testing-library/preact`, colocated with their source file as `Component.test.tsx`.

## Formatting

- Test names must match assertions — a test named "and returns 404" must assert the 404.
- Maintain consistent blank lines between `it()` blocks within a `describe()`.
- Every new exported function or significant code path needs test coverage before the task is considered complete.

## Schema-code consistency

Any code change that introduces, removes, or renames a value validated by a Zod schema (`src/schema/index.ts`) must update that schema in the same change, and the tests must be updated to match. Missing this causes runtime validation errors.
