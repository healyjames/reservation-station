# Environment Clear-Down

Perform a full clear-down of all data stores, service buses, blob storage, and Builder.io content for a given environment.

## Instructions

1. Ask the user which environment to clear down: **DEV**, **ACC**, or **PRD**
2. **For PRD**: Require explicit double-confirmation before proceeding ("Are you absolutely sure? This will wipe all production data.")
3. Generate a single correlation ID (`uuidgen`) for the entire clear-down run. Pass it to every curl via `-H "x-correlation-id: $CORR_ID"`. Report it to the user so they can filter KQL.
4. Run all 5 clear-down endpoints in the order specified below.
5. After each curl, check the HTTP status code and response body. Report a summary to the user (service name, status, counts).
6. If any endpoint returns an unexpected status, follow the status code handling rules below.
7. After all 5 succeed, provide the verification KQL query (pre-filled with the correlation ID and timestamp).

## Environment URLs

The APIM gateway pattern is `https://{env}-api.persimmonhomes.com/{service}/management/clear-all?confirm=true`

| Service | DEV                                                                            | ACC                                                                            | PRD                                                                            |
| ------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Search  | `https://dev-api.persimmonhomes.com/search/management/clear-all?confirm=true`  | `https://acc-api.persimmonhomes.com/search/management/clear-all?confirm=true`  | `https://prd-api.persimmonhomes.com/search/management/clear-all?confirm=true`  |
| Content | `https://dev-api.persimmonhomes.com/content/management/clear-all?confirm=true` | `https://acc-api.persimmonhomes.com/content/management/clear-all?confirm=true` | `https://prd-api.persimmonhomes.com/content/management/clear-all?confirm=true` |
| Portal  | `https://dev-api.persimmonhomes.com/portal/management/clear-all?confirm=true`  | `https://acc-api.persimmonhomes.com/portal/management/clear-all?confirm=true`  | `https://prd-api.persimmonhomes.com/portal/management/clear-all?confirm=true`  |
| Product | `https://dev-api.persimmonhomes.com/product/management/clear-all?confirm=true` | `https://acc-api.persimmonhomes.com/product/management/clear-all?confirm=true` | `https://prd-api.persimmonhomes.com/product/management/clear-all?confirm=true` |
| Sales   | `https://dev-api.persimmonhomes.com/sales/management/clear-all?confirm=true`   | `https://acc-api.persimmonhomes.com/sales/management/clear-all?confirm=true`   | `https://prd-api.persimmonhomes.com/sales/management/clear-all?confirm=true`   |

### Direct Function App URLs (bypass APIM)

Pattern: `https://func-{env}-ngw-{service}-uks-001.azurewebsites.net/{service}/management/clear-all?confirm=true`

Services: `search`, `content`, `portal`, `product`, `sales`

## Execution Order

Run in this exact order (downstream consumers first, then upstream):

1. **Search Service** — clears Algolia indexes
2. **Content Service** — clears blob storage + SB queues + Builder.io content (plot, development, scheme models)
3. **Portal Service** — clears CosmosDB (plots + developments)
4. **Product Service** — clears CosmosDB + purges all 3 Service Buses (18 subscriptions + DLQs, drained in parallel by namespace)
5. **Sales Service** — clears SQL SyncHistory table

## How to Run Each Endpoint

First, generate the correlation ID for the run:

```bash
CORR_ID=$(uuidgen)
```

Report the correlation ID to the user immediately: "Correlation ID for this clear-down: `$CORR_ID`"

For each service, run:

```bash
curl -s -w "\n%{http_code}" -X DELETE -H "x-correlation-id: $CORR_ID" "<URL>"
```

Parse the output: the last line is the HTTP status code, everything before it is the JSON response body.

### Status Code Handling

- **200**: Success — completed synchronously. Parse JSON and report the key counts.
- **202**: Accepted — synchronous work completed but background work is running:
  - **Content Service**: Blob storage and queues cleared synchronously. Builder.io content purge (plot, development, scheme models) runs in background with rate-limit-aware retries and verification passes. The response includes `builder.status: "purging"`.
  - **Product Service**: CosmosDB cleared but Service Bus purge is running in background (very high message volume, >2000). The response includes `serviceBus.messageCounts` showing the volumes.
  - Tell the user the background work will complete and provide the KQL query to verify.
- **400**: Missing `?confirm=true` — this should not happen since the URL includes it.
- **401/403**: APIM authentication issue. Stop and ask the user.
- **500**: Server error — stop and show the error details.
- **504**: Gateway Timeout — Azure Front Door timed out, but the function may still be running or may have been killed.
  - Tell the user: "Gateway timeout — the function may still be running behind Front Door."
  - Wait 30 seconds.
  - Retry the same endpoint once.
  - If the retry succeeds (200/202 with fast response), the data was likely already cleared by the first attempt. Continue to the next service.
  - If the retry also returns 504, ask the user how to proceed. Suggest:
    1. Skip this service and continue with the rest, come back later.
    2. Check KQL for logs from this correlation ID.
    3. For Product Service specifically: if Azure CLI is available, check SB message counts directly via `az servicebus topic subscription list`.

Report each result in a summary table as you go:

| #   | Service | Status | Result                                            |
| --- | ------- | ------ | ------------------------------------------------- |
| 1   | Search  | 200    | 8 indexes cleared                                 |
| 2   | Content | 202    | 7321 blobs deleted, 0 queue msgs, Builder purging |
| ... | ...     | ...    | ...                                               |

## Post Clear-Down Verification

After all 5 endpoints succeed, present a final summary table showing all results. Each endpoint's response body contains the deletion counts — this is the primary verification. A 200 or 202 status with expected counts confirms success.

Provide this KQL query for Application Insights, pre-filled with the correlation ID and timestamp:

```kql
let clearDownTime = datetime({TIMESTAMP});
let correlationId = "{CORR_ID}";
traces
| where timestamp >= clearDownTime
| where cloud_RoleName has_any (
    "product-service", "content-service", "portal-service",
    "search-service", "sales-service"
  )
| extend
    LogLevel = tostring(customDimensions["log.level"]),
    LoggerName = tostring(customDimensions["log.logger"]),
    CorrelationId = tostring(customDimensions["correlationId"]),
    ServiceName = cloud_RoleName
| where CorrelationId == correlationId
    or LoggerName has_any (
      "clearAllProducts", "purgeServiceBus",
      "clearAllContentData", "purgeBuilderContent",
      "clearAllPortalData",
      "clearAllIndexes",
      "clearAllSalesData"
    )
    or message has "clear-all"
    or message has "cleared"
    or message has "purged"
    or message has "Purging"
    or message has "SyncHistory"
    or message has "Builder"
    or message has "purge completed"
| project
    timestamp,
    ServiceName,
    LogLevel,
    LoggerName,
    CorrelationId,
    message,
    customDimensions
| order by timestamp asc
```

Tell the user:

- The clear-down is complete
- The correlation ID can be used to filter KQL for this specific run
- Content Service Builder.io purge may still be running in background — check KQL for "Builder.io content purge completed" log
- The next Sales Service cron run will perform a full sync (no sync history = full pull from source database)
- Paste the KQL above into Application Insights to verify all services logged their clear-down successfully
- Remind them to check the Sales Service cron is enabled if they paused it before the clear-down

## Important Notes

- No API key is required — APIM handles authentication via `x-functions-key` transparently
- Service Bus subscriptions are drained in parallel by namespace (CONSTRUCTION, PRODUCT, CUSTOMER concurrently) with 1s poll timeout per batch
- Content Service Builder.io purge is rate-limit-aware: 100ms between deletes, exponential backoff on 429s, verification pass after all deletes
- `CONTENT_BULK_REGEN_SB_QUEUE` is session-enabled and will be skipped during purge (messages expire via TTL)
- If Product Service SB purge fails, CosmosDB will still be cleared — check the response body for details
- For more KQL queries broken down by individual service, see `docs/clear-down-guide.md`
