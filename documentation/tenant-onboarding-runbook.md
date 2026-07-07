# Tenant Onboarding Runbook

Tenant onboarding is performed with `POST /api/tenants`, protected by the `X-Admin-Key` header. The endpoint creates the tenant, first admin user, and seven opening-hours rows atomically.

## Set or rotate `SUPER_ADMIN_KEY`

Generate a high-entropy value in your password manager, then set it as a Worker secret:

```powershell
npx wrangler secret put SUPER_ADMIN_KEY
```

Paste the secret at the prompt. To rotate it, run the same command with a new value and update the password-manager record.

For local development, put `SUPER_ADMIN_KEY=<value>` in `.env` or `.dev.vars`; never commit it.

## Call `POST /api/tenants` safely

This PowerShell flow prompts for secrets so the admin password is not written into shell history:

```powershell
$baseUrl = "https://your-worker.example.com"
$superAdminKey = Read-Host "SUPER_ADMIN_KEY"
$adminPasswordSecure = Read-Host "Initial admin password" -AsSecureString
$passwordPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($adminPasswordSecure)
$adminPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPtr)

try {
  $body = @{
    tenant = @{
      name = "Example Restaurant"
      tenant_code = "example-restaurant"
      max_guests = 8
      max_covers = 40
      status = "active"
      concurrent_guests_time_limit = 120
      contact_email = "owner@example.com"
    }
    admin = @{
      email = "admin@example.com"
      password = $adminPassword
    }
  } | ConvertTo-Json -Depth 5

  $body | curl.exe -sS -X POST "$baseUrl/api/tenants" `
    -H "Content-Type: application/json" `
    -H "X-Admin-Key: $superAdminKey" `
    --data-binary "@-"
}
finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPtr)
  Remove-Variable adminPassword -ErrorAction SilentlyContinue
}
```

If you need custom opening hours, add an `opening_hours` array with exactly seven entries, one for each `day_of_week` from `0` to `6`.

## Verify the admin can log in

Prompt for the same password and call login:

```powershell
$baseUrl = "https://your-worker.example.com"
$adminPasswordSecure = Read-Host "Admin password" -AsSecureString
$passwordPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($adminPasswordSecure)
$adminPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPtr)

try {
  @{
    email = "admin@example.com"
    password = $adminPassword
  } | ConvertTo-Json | curl.exe -sS -X POST "$baseUrl/api/auth/login" `
    -H "Content-Type: application/json" `
    --data-binary "@-"
}
finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPtr)
  Remove-Variable adminPassword -ErrorAction SilentlyContinue
}
```

A successful response includes `success: true`, a token, and the tenant details.

## Recover from a failed request

The onboarding request is atomic. If validation, authentication, or uniqueness checks fail, no tenant/admin/opening-hours partial state should persist.

- `401`: check `SUPER_ADMIN_KEY` and the `X-Admin-Key` header.
- `400`: fix the request shape, tenant fields, admin email/password, or opening-hours entries.
- `409`: choose a unique `tenant_code` or admin email.
- `500`: retry only after checking Worker logs for the safe tenant/admin identifiers logged by the server.

## Contract for tests

### Request

```http
POST /api/tenants
X-Admin-Key: <SUPER_ADMIN_KEY>
Content-Type: application/json
```

```json
{
  "tenant": {
    "name": "Example Restaurant",
    "tenant_code": "example-restaurant",
    "max_guests": 8,
    "max_covers": 40,
    "status": "active",
    "concurrent_guests_time_limit": 120,
    "contact_email": "owner@example.com"
  },
  "admin": {
    "email": "admin@example.com",
    "password": "at-least-12-chars"
  },
  "opening_hours": [
    { "day_of_week": 0, "is_closed": 1, "open_time": null, "close_time": null },
    { "day_of_week": 1, "is_closed": 1, "open_time": null, "close_time": null },
    { "day_of_week": 2, "is_closed": 1, "open_time": null, "close_time": null },
    { "day_of_week": 3, "is_closed": 1, "open_time": null, "close_time": null },
    { "day_of_week": 4, "is_closed": 1, "open_time": null, "close_time": null },
    { "day_of_week": 5, "is_closed": 1, "open_time": null, "close_time": null },
    { "day_of_week": 6, "is_closed": 1, "open_time": null, "close_time": null }
  ]
}
```

`opening_hours` is optional. If omitted, the endpoint creates seven closed rows with null times.

### Success response

Status `201`:

```json
{
  "success": true,
  "data": {
    "tenant": {
      "id": "generated-uuid",
      "tenant_code": "example-restaurant",
      "name": "Example Restaurant"
    },
    "admin": {
      "email": "admin@example.com"
    }
  }
}
```

### Error cases

- `401` missing `X-Admin-Key`: `{ "success": false, "error": "Unauthorized" }`
- `401` invalid `X-Admin-Key`: `{ "success": false, "error": "Unauthorized" }`
- `409` duplicate `tenant_code`: `{ "success": false, "error": "A tenant with that tenant_code already exists" }`
- `409` duplicate admin email: `{ "success": false, "error": "An admin with that email already exists" }`
- `400` invalid tenant payload: `{ "success": false, "error": "<Zod validation summary>" }`
- `400` invalid admin email: `{ "success": false, "error": "<Zod validation summary>" }`
- `400` invalid admin password shorter than 12 characters: `{ "success": false, "error": "<Zod validation summary>" }`

All failures must leave zero partial onboarding rows.

### Existing tests affected

`test/tenants.spec.ts` contains the old tenant-only `POST /api/tenants` contract. The test `POST /api/tenants > creates a tenant with valid X-Admin-Key and returns 201` will now fail because the endpoint requires `{ tenant, admin, opening_hours? }` and returns `{ success, data }`. The `POST /api/tenants` invalid tenant-only payload tests are stale even if they still return `400`.
