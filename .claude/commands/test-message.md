---
description: Send a test message to the local Service Bus emulator and verify the result
argument-hint: <scenario-description>
---

# Test Message

Send a test message to the local Service Bus emulator, monitor the receiving service(s), and verify the output in Algolia or Builder.io.

## Usage

`/test-message <scenario description>`

## Examples

```
/test-message "coming-soon plot should not inflate price_max"
/test-message "development with 3 available plots sets correct bedroom_counts"
/test-message "plot with hideFromWebsite=true is removed from Algolia"
```

---

## Instructions

### Step 0 — Prerequisites check

1. **Azure emulators must be running.** Check with:

   ```bash
   docker ps --filter "name=azure-emulator" --format "{{.Names}}"
   ```

   If not running: `cd azure-emulators && docker compose up -d`

2. **Identify which service(s) you are testing.** Only start services you are actively testing. Do NOT start all downstream services unless explicitly requested — you don't want test data flowing to content-service, portal-service, etc. unless that is the test.

3. **Check if the target service is already running:**

   ```bash
   lsof -ti:<port>
   ```

   Port reference: search-service=7078, content-service=7071, portal-service=7073, product-service=7075

   - **If running via ngw-dev:** Ask the user to stop it so you can launch a monitored instance.
   - **If not running:** Build and launch it yourself (see Step 2).

4. If the user has the service running in their own terminal, use Monitor to attach to it rather than starting a new instance.

---

### Step 1 — Read context

Before constructing test data:

- Read the relevant Zod schema in `libs/types/` for the entity you're testing
- Read `apps/services/<service>/src/utils/mapping/` to understand how messages are transformed
- If the service has a `BUSINESS_LOGIC.md`, read it
- Read `apps/services/<service>/.env` for Algolia App IDs (needed for verification links)

---

### Step 2 — Build and launch the service (if not already running)

**Always use the `serve:dev` target** — it runs `func start` via Azure Functions Core Tools, which registers Service Bus consumers. Using `npx nx serve` runs the app in Node.js test mode and skips function registration (Service Bus triggers won't fire).

```bash
# Build first (cached if no changes)
npx nx build <service-name>

# Then start with func host
npx nx run <service-name>:serve:dev 2>&1
```

Run via `Bash` with `run_in_background: true`. Monitor the output file and wait for `Host started` before sending any messages:

```bash
tail -f <output-file> | grep --line-buffered -E "Host started|Error|FATAL"
```

The `serve:dev` target runs `func start --javascript --port <port>` from `dist/apps/services/<service>/`.

---

### Step 3 — Construct test data

Build realistic message payloads based on the Zod schema and the scenario being tested.

**Suffix rules:**

- All test IDs must end with `-LCL` (local test marker)
- Format: `LCL-<ticket>-<entity>` e.g. `LCL-5472-DEV`, `LCL-5472-1`
- Slug/name fields should also include `LCL` e.g. `"test-development-lcl"`

Do NOT use real production IDs.

**Plot `schemes` field:** Always use `schemes: []` (empty array) in test plot payloads. The full `SchemeProductSchema` requires `brand` (EnumSchema), `buyerTypes` (array of EnumSchema), and `media` (array) — these are cumbersome to fake. Empty schemes passes Zod validation and the development-level `ways_to_buy` covers the scheme filter.

**`EnumSchema` fields** (`brand`, `status`, `county`, `town`, `typeOfHouse`, `plotSalesStatus`, `companyNumber`, etc.) are all objects:

```json
{ "key": "some-key", "label": "Some Label" }
```

Brand keys: `"PH"` → Persimmon Homes, `"CC"` → Charles Church.

**Message envelope format:**

```json
{
  "eventType": "developmentPublished",
  "data": {
    /* full DevelopmentProduct or PlotProduct payload */
  }
}
```

Event types:

- Development: `developmentPublished`, `developmentUpdated`, `developmentUnpublished`
- Plot: `plotPublished`, `plotUpdated`, `plotUnpublished`
- Scheme: `schemePublished`, `schemeUpdated`, `schemeUnpublished`

**Unpublish envelope format** (for cleanup):

```json
{ "id": "LCL-5472-DEV", "brand": { "key": "PH", "label": "Persimmon Homes" } }
```

**Topic and subscription reference:**

| Topic           | Subscription          | Service                  |
| --------------- | --------------------- | ------------------------ |
| `local-product` | `search-development`  | search-service           |
| `local-product` | `search-plot`         | search-service           |
| `local-product` | `content-development` | content-service          |
| `local-product` | `content-plot`        | content-service          |
| `local-product` | `content-offer`       | content-service (Scheme) |
| `local-product` | `portals-development` | portal-service           |
| `local-product` | `portals-plot`        | portal-service           |
| `local-sales`   | `development`         | product-service          |
| `local-sales`   | `plot`                | product-service          |

---

### Step 4 — Show payload and get approval

**NEVER send a message without user approval.**

Show the full payload, list every subscription on the target topic, and mark each as MONITORED, RUNNING (but unmonitored), or NOT RUNNING:

```
I'd like to send this message to topic `local-product`:

{
  "eventType": "developmentPublished",
  "data": { ... }
}

Subscriptions on `local-product`:
- search-development → search-service (MONITORED)
- search-plot → search-service (MONITORED)
- content-development → content-service (NOT RUNNING)
- content-plot → content-service (NOT RUNNING)
- portals-development → portal-service (NOT RUNNING)
- portals-plot → portal-service (NOT RUNNING)
- content-offer → content-service (NOT RUNNING)

Send it or Cancel?
```

Wait for explicit approval before proceeding.

---

### Step 5 — Write, run, and delete the send script

Write a `.ts` script to `.claude/temp/<ticket>/send-<slug>.ts`, run it, then **delete it immediately** after it completes. Do not leave send scripts in the repo.

```typescript
// .claude/temp/<ticket>/send-<slug>.ts
import { ServiceBusHelper } from '../../automation-test/helpers/service-bus-emulator-test-helpers';

const CONNECTION_STRING = 'Endpoint=sb://localhost;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=SAS_KEY_VALUE;UseDevelopmentEmulator=true;';

async function run(): Promise<void> {
  const helper = new ServiceBusHelper(CONNECTION_STRING);

  await helper.sendMessage('local-product', {
    body: {
      /* approved payload */
    },
    applicationProperties: { entityType: 'Development' },
  });

  await helper.close();
}

run().catch(console.error);
```

Run with — **always use the `automation-test/product-service/tsconfig.json`** to avoid module resolution errors:

```bash
npx ts-node -P automation-test/product-service/tsconfig.json .claude/temp/<ticket>/send-<slug>.ts
```

Delete after running:

```bash
rm .claude/temp/<ticket>/send-<slug>.ts
```

---

### Step 6 — Read logs and report

Read the background Monitor output. Report exactly what was observed:

```
## Monitor Results

Sent: Development message `LCL-5472-DEV`
Service: search-service (monitored)

### Observed Logs
- Upserting development in search index — plotCount: 0
- Development message processed successfully

### Verdict
✓ Development indexed. Now sending plots...
```

For unexpected results: quote the exact log line and explain what it means.

---

### Step 7 — Verify the output

**Search Service → Algolia (REST API — no SDK needed):**

Read `apps/services/<service>/.env` for `ALGOLIA_PH_APP_ID` and `ALGOLIA_PH_API_KEY`, then query:

```bash
curl -s "https://<APP_ID>-dsn.algolia.net/1/indexes/<index>/<objectID>" \
  -H "X-Algolia-Application-Id: <APP_ID>" \
  -H "X-Algolia-API-Key: <API_KEY>" | python3 -c "
import json, sys
r = json.load(sys.stdin)
print(json.dumps({ 'price_min': r.get('price_min'), 'price_max': r.get('price_max'), 'bedroom_counts': r.get('bedroom_counts') }, indent=2))
"
```

Index names:

- PH Development → `persimmon_developments`
- CC Development → `charles_church_developments`
- PH Plot → `persimmon_plots`
- CC Plot → `charles_church_plots`

**Content Service → Builder.io:**

```
Check Builder.io:
https://builder.io/content
→ Filter to the model (development/plot)
→ Search for "LCL"
→ Delete test entries when done
```

---

### Step 8 — Cleanup

After reporting results, always ask whether to clean up. If yes:

1. **Send unpublish messages** (removes from Algolia via the service — preferred over manual deletion):

   Write a cleanup script to `.claude/temp/<ticket>/unpublish-<slug>.ts`, run it, then delete it.

   Unpublish envelope:

   ```json
   {
     "eventType": "developmentUnpublished",
     "data": { "id": "LCL-5472-DEV", "brand": { "key": "PH", "label": "Persimmon Homes" } }
   }
   ```

   Send with `applicationProperties: { entityType: 'Development' }` (or `'Plot'`).

2. **Or delete directly from Algolia** (if the service is no longer running):
   ```
   https://dashboard.algolia.com/apps/<APP_ID>/explorer/browse/<index>
   → Search for "LCL"
   → Select all → Delete
   ```

Always show the unpublish payloads and get approval before sending.

---

## Rules

- NEVER send a message without showing the full payload and getting explicit approval
- NEVER start services that are not being tested
- ALL test IDs must end with `-LCL`
- Always use `serve:dev` target, never `nx serve` (test mode won't register SB triggers)
- Always use `automation-test/product-service/tsconfig.json` when running ts-node scripts
- Write send/unpublish scripts to `.claude/temp/<ticket>/`, delete them immediately after use
- Always list all subscriptions on the target topic with their running status
- Always end with a cleanup prompt
