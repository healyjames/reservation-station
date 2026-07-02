---
description: Launch a service, send test data, and monitor logs to verify behavior
argument-hint: <service-name> <scenario-description>
---

# Live Test

Launch a service via monitor, send test data to the local Service Bus emulator, and observe the results. This is ephemeral testing for verifying current work or investigating bugs — no test files are saved to the repo.

## Usage

`/live-test <service-name> "<scenario description>"`

## Examples

```
/live-test content-service "development with expired offer should be filtered out"
/live-test product-service "COINS phase message should create inbound phase-create event"
/live-test search-service "plot with status Released should be indexed"
```

## Instructions

1. Parse the service name and scenario description from: $ARGUMENTS
2. Dispatch the `live-tester` agent with the service name and scenario details
3. The agent handles the full protocol: prerequisites check, build, launch, test data construction, approval, send, observe, report, and downstream links

## Rules

- All test data identifiers must use the `-local-test` suffix
- Must show the full payload and get explicit approval before sending
- Must list all receiving subscriptions and mark each as MONITORED / RUNNING / NOT RUNNING
- Must provide downstream verification links (Algolia / Builder.io) after testing
- Must end with a cleanup reminder for `-local-test` data
