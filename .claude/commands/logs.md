---
description: Parse and analyse Azure Application Insights logs exported as CSV
argument-hint: <service-name or file-path> [product-id] [additional context]
---

# Log Parser

Parse and analyse logs exported from Azure Application Insights via KQL queries.

## Arguments

$ARGUMENTS — Can be:

- A **service name** (e.g., `search-service`, `product-service`) — fetches the latest `query_data*.csv` from `~/Downloads`
- A **file path** — parses that specific file
- Multiple file paths separated by spaces
- A service name + product ID for focused analysis (e.g., `search-service 110-PH-344-DEV`)

## Step 1: Locate the log file(s)

**If a file path was provided:** Use that path directly. If multiple paths, process all of them.

**If a service name or no file was provided:** Find the most recent log export:

```bash
ls -t ~/Downloads/query_data*.csv 2>/dev/null | head -5
```

Pick the most recent file. If no files found, inform the user and suggest they export logs from Azure Application Insights using a KQL query (see Step 5).

## Step 2: Initial parse

Logs can be large. Read the first 100 lines to understand the structure and content:

1. Read the CSV header row to identify columns
2. Read the first ~100 data rows
3. Note the time range covered by these rows

**Known issue:** Our OpenTelemetry + Azure Monitor setup currently produces duplicate log entries. When analysing, deduplicate by matching on `timestamp` + `message` + key dimension values. Do not flag duplicates as anomalies — this is a known infrastructure bug.

## Step 3: Analyse

Based on the user's request and the arguments provided, analyse the logs for:

- **Error patterns**: Look for ERROR/WARN level logs, exceptions, and failure messages
- **Flow tracing**: If a product ID was provided, trace the full lifecycle of that entity across the logs
- **Timing**: Note any gaps, slow operations, or unusual sequencing
- **Service-specific context**: Use knowledge of our service architecture (Product Service → Service Bus → Orchestrator → downstream services) to understand the flow

If the initial 100 rows aren't sufficient to answer the user's question, read additional rows in batches of 100 until you have enough context or reach the end of the file.

## Step 4: Report

Present findings as:

1. **Summary**: What the logs show at a high level
2. **Timeline**: Key events in chronological order (deduplicated)
3. **Issues found**: Any errors, warnings, or unexpected behaviour
4. **Recommendations**: Next steps for investigation if applicable

If the user provided a product ID, focus the report around that entity's journey through the system.

## Step 5: KQL assistance

If the user needs to gather different or more targeted logs, offer a KQL query. Ask the user:

- Which service(s) they want logs from
- Any product IDs, development IDs, or other identifiers to filter on
- The time range they care about

Our services are: `product-service`, `sales-service`, `search-service`, `content-service`, `portal-service`, `lead-service`, `location-service`

### Template KQL for service + product ID filtering:

See `docs/logging-strategy.md` for the full list of standard custom dimensions.

```
traces
| extend
    LogLevel = tostring(customDimensions["log.level"]),
    LoggerName = tostring(customDimensions["log.logger"]),
    ServiceName = cloud_RoleName,
    Pipeline = tostring(customDimensions["pipeline"]),
    TraceId = tostring(customDimensions["trace_id"]),
    SpanId = tostring(customDimensions["span_id"]),
    EntityType = tostring(customDimensions["entityType"]),
    ProductId = tostring(customDimensions["productId"]),
    Brand = tostring(customDimensions["brand"]),
    Method = tostring(customDimensions["method"]),
    ProductIds = tostring(customDimensions["productIds"]),
    Reason = tostring(customDimensions["reason"]),
    Operation = tostring(customDimensions["operation"]),
    DiffType = tostring(customDimensions["diffType"])
| where LoggerName startswith "<SERVICE_NAME>"
| where ProductId in ("<PRODUCT_ID>")
    or ProductIds contains "<PRODUCT_ID>"
    or message contains "<PRODUCT_ID>"
    or tostring(customDimensions) contains "<PRODUCT_ID>"
| project
    timestamp,
    ServiceName,
    LogLevel,
    LoggerName,
    Pipeline,
    message,
    EntityType,
    ProductId,
    Brand,
    Method,
    ProductIds,
    Reason,
    customDimensions
| order by timestamp desc
```

### Template KQL for general service logs:

```
traces
| extend
    LogLevel = tostring(customDimensions["log.level"]),
    LoggerName = tostring(customDimensions["log.logger"]),
    ServiceName = cloud_RoleName
| where LoggerName startswith "<SERVICE_NAME>"
| where LogLevel in ("ERROR", "WARN")
| project timestamp, ServiceName, LogLevel, LoggerName, message, customDimensions
| order by timestamp desc
| take 500
```

If the user hasn't provided enough context to know what KQL they used, ask them — understanding the query helps interpret the results correctly.

## Rules

- Always deduplicate logs before analysis (known OTel duplication bug)
- Start with 100 rows, expand only if needed
- If the CSV has no data or is malformed, tell the user and suggest re-exporting
- When product IDs span multiple services, note which service each log came from
- Do not modify log files
