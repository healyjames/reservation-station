---
description: Get current Jira ticket informatoin from branch name or provided ticket
argument-hint: <ticket-number> optional
---

# Jira Ticket Analysis

Fetch and analyse the current Jira ticket based on the git branch or provided ticket number, then help plan work or assess progress against acceptance criteria.

## Setup Verification

Jira integration is optional. If not configured, guide the user through setup.

Check for Jira credentials at `/Users/$USER/AI/config/jira.env`:

```
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-api-token
```

**Steps to verify:**

1. Read the jira.env file at `/Users/$USER/AI/config/jira.env`
2. If the file doesn't exist or is missing required variables, run the **interactive setup wizard** (see below)
3. If credentials are present, proceed to fetch the ticket

### Interactive Setup Wizard

If credentials are missing, walk the user through setup interactively:

**Step 1 — Ask for their Jira email:**

```
Jira isn't set up yet. I can configure it for you now.

What email address do you use for Jira? (e.g., stuart@company.com)
```

**STOP and wait for the user to provide their email.**

**Step 2 — Ask for their Jira base URL (if not already known):**

Our Jira instance is `https://persimmonplc.atlassian.net`. Confirm this with the user:

```
Is your Jira instance https://persimmonplc.atlassian.net? (y/n)
```

If no, ask them for the correct URL.

**Step 3 — Direct them to generate an API token:**

```
Now I need an API token. Please:

1. Open: https://id.atlassian.com/manage-profile/security/api-tokens
2. Click "Create API token"
3. Give it a label (e.g., "Claude Code")
4. Copy the token and paste it here

Paste your API token:
```

**STOP and wait for the user to paste the token.**

**Step 4 — Create the config file:**

Once you have all three values, create the directory and write the file:

```bash
mkdir -p ~/AI/config
```

Then write `~/AI/config/jira.env` with:

```
JIRA_BASE_URL=<their base URL>
JIRA_EMAIL=<their email>
JIRA_API_TOKEN=<their token>
```

**Step 5 — Verify it works:**

Make a test API call to confirm credentials are valid:

```bash
source ~/AI/config/jira.env && curl -s -w "\nHTTP_CODE:%{http_code}" \
  -H "Authorization: Basic $(echo -n "$JIRA_EMAIL:$JIRA_API_TOKEN" | base64)" \
  -H "Content-Type: application/json" \
  "$JIRA_BASE_URL/rest/api/3/myself" | tail -5
```

If successful, confirm and proceed. If 401, tell the user the token may be incorrect and offer to retry from Step 3.

## Ticket Identification

Get the current git branch name using `git branch --show-current`. The branch should follow the pattern `BOARD-123-description` where `BOARD-123` is the Jira ticket ID.
The user may instead have provided a ticket number, if so use that, but remind the user to swap to a branch for this ticket and provide a branch name.
If the branch doesn't match this pattern and no ticket id was given, ask the user to provide the ticket ID manually.

## Jira API Usage

**IMPORTANT:** Do NOT use `curl -u` for authentication. API tokens containing `=` characters break `curl -u` parsing. Always use an explicit `Authorization: Basic` header instead:

```bash
curl -s -H "Authorization: Basic $(echo -n "$JIRA_EMAIL:$JIRA_API_TOKEN" | base64)" \
  -H "Content-Type: application/json" \
  "$JIRA_BASE_URL/rest/api/3/issue/TICKET-ID?expand=subtasks"
```

### Error Handling

- **401 Unauthorized**: Token is invalid or expired. Offer to fix it interactively:

  ```
  Jira authentication failed (401). Your API token may have expired.

  Would you like me to help you regenerate it? I'll walk you through it.
  ```

  If the user says yes, direct them to https://id.atlassian.com/manage-profile/security/api-tokens to create a new token, wait for them to paste it, then update `~/AI/config/jira.env` with the new `JIRA_API_TOKEN` value and retry the request.

  If the user says no, continue without Jira context.

- **403 Forbidden**: User doesn't have access to this ticket or project
- **404 Not Found**: Ticket doesn't exist — check the ticket ID is correct
- **Network errors / connection refused**: Check JIRA_BASE_URL is correct and accessible
- **Any other error**: Show the HTTP status code and response body, then suggest the user check their credentials

## Output

Once the ticket is fetched, provide:

1. **Ticket Summary**: Title, status, assignee
2. **Description**: Full ticket description
3. **Acceptance Criteria**: Extract and list any acceptance criteria
4. **Subtasks**: List all subtasks with their status

Then inform the user if you have enough information to start working, or prompt the user for more information and run /begin if they confirm.
If the ticket does not contain enough information to start work, inform the user, and tell them to run /begin manually.

## Arguments

$ARGUMENTS - Optional: Ticket ID to fetch directly (e.g., `/jira BOARD-123`) or action (`plan`, `assess`, `summary`)
