# Cloudflare Metrics Analysis — Maximum Bookings

**Date of export:** 2026-07-22
**Sources:** `all_sites_for_account_2026-07-22T10_23_37.881Z.csv` (requests by country) + Cloudflare dashboard screenshot (Security / Cache / Errors / Network).

---

## TL;DR

The application is **very well optimised** for both performance and cost on Cloudflare. The traffic profile is exactly what you want for a Workers + Static Assets + D1 app: the vast majority of requests are cacheable static assets served from the edge, only a small slice (`json`) actually invokes the Worker and touches D1, encryption and protocol modernity are near-perfect, and server-side errors are negligible.

The only two things worth a glance are the **4xx rate (3.74%)** and a tiny amount of **unencrypted (`none`) traffic (53 requests)** — neither is alarming, but both are cheap to investigate.

---

## The numbers at a glance

| Area | Metric | Value | Verdict |
|------|--------|-------|---------|
| Volume | Total requests | **5,581** | 🟢 Well within free-tier limits |
| Security | Encrypted requests rate | **99.05%** | 🟢 Excellent |
| Security | Encrypted bandwidth rate | **99.99%** | 🟢 Excellent |
| Cache | Cached requests rate | **76.62%** | 🟢 Very good (see note) |
| Cache | Cached bandwidth rate | **87.57%** | 🟢 Excellent |
| Errors | 5xx error rate | **0.13%** (7) | 🟢 Excellent |
| Errors | 4xx error rate | **3.74%** (209) | 🟡 Worth a quick look |
| Network | HTTP/3 + HTTP/2 share | **~94%** | 🟢 Modern |
| Network | TLSv1.3 share | **~99%** | 🟢 Modern |

---

## What looks good ✅

### 1. Cost profile is essentially free
- **5,581 total requests** over the period. Cloudflare's free tier is 100,000 Worker requests/**day**, so you are orders of magnitude below any billing threshold.
- Crucially, requests break down by content type as: `css 1.92k`, `js 1.78k`, `json 1.05k`, `html 274`, `ttf 267`. Only the **`json` (~1,050)** requests are real API calls that invoke the Worker and query D1. Everything else (`css`, `js`, `ttf`, and the SPA `html` shell) is served by **Cloudflare Static Assets**, which does **not** count as a billable Worker invocation.
- **D1 load is tiny** — at most ~1,050 read/write operations for the whole period, nowhere near D1's free-tier limits (5M rows read/day, 100k written/day). Your decision to keep the API surface small and asset-heavy pays off directly here.

### 2. Caching is doing its job
- **76.62% cached requests / 87.57% cached bandwidth.** The bandwidth figure being higher than the request figure is the tell-tale sign that your *heavy* assets (fonts `ttf` 276 MB-class, JS bundles) are being served from the edge cache rather than re-fetched — exactly what you want.
- The ~23% of *uncached* requests are almost entirely accounted for by the `json` API calls (~1,050 ≈ 19%) plus the `html` SPA shell (274). These are dynamic/personalised by nature and **should not** be cached, so in practice your cache hit rate is close to the realistic ceiling. There's little headroom to "improve" without caching things that shouldn't be cached.

### 3. Security & protocol modernity
- **99.05% encrypted requests / 99.99% encrypted bandwidth** — practically all traffic is HTTPS.
- **TLSv1.3 on ~5.53k of 5.58k requests (~99%)**, with only 2 requests on the older TLSv1.2. Excellent.
- **HTTP/3 = 4.11k (~74%)** and HTTP/2 = 1.16k, so **~94% of traffic is on a modern multiplexed protocol**. Only 5 requests fell back to HTTP/1.0. This gives you lower latency handshakes and better connection reuse for free.

### 4. Backend stability
- **5xx error rate of 0.13% (just 7 errors).** Your Worker/D1 path is stable — no meaningful rate of crashes, timeouts, or DB failures. For a Hono + D1 app this is a very healthy signal.

### 5. Traffic geography
- **GB = 4,832 (86.6%)** and **US = 528 (9.5%)** — ~96% of traffic is UK + US. The remaining long tail (CA, NL, IE, HK, DE, BD, BR, SG, TW, BE, ES, FR, RU, KE, AR) is single/low-double-digit noise.
- Because Workers and Static Assets run at the edge in all regions automatically, this concentration doesn't cost you anything or require region-specific config. It does mean **Smart Placement is unnecessary** for you (see below).

---

## What to keep an eye on 🟡

### 1. 4xx error rate: 3.74% (209 requests)
Not inherently bad — 4xx means *client* errors, not server faults — but 209 is worth a quick categorisation because some 4xx sources are legitimate to eliminate. Likely contributors in this app:
- **404s** — favicon/asset probes, or bad `?tenant=` codes hitting `GET /api/tenants/:tenant_code` (returns 404 for unknown tenants).
- **401s** — expected from the admin surface (`/api/admin/*`, `/api/auth/login`) when tokens are missing/expired.
- **400s** — Zod validation rejections on `POST /api/reservations` etc.
- **422s** — same-day-blocked or `max_covers`-exceeded booking attempts (these are *correct* business-rule rejections).

**Suggested action:** filter the Cloudflare dashboard (or `wrangler tail`) by status code for a few minutes to see the split. If it's dominated by 422/401 it's just your business logic and auth working as designed — leave it. If you see a lot of 404s for a specific missing asset (e.g. `/favicon.ico`), add the file to `public/` to clean it up.

### 2. Unencrypted traffic: `none` = 53 requests (~0.95%)
A small number of requests arrived over plain HTTP (SSL "none"). This is minor, but since this app handles personal booking data (names, emails, phone numbers) you may want zero plaintext:
- Enable **"Always Use HTTPS"** and **HSTS** in the Cloudflare dashboard (SSL/TLS → Edge Certificates) to force every request onto TLS before it reaches the Worker.
- This costs nothing and closes the small plaintext gap.

---

## Configuration notes

- **Smart Placement (`placement.mode = "smart"`) is correctly left disabled.** It helps when a Worker makes many round-trips to a *centralised* origin far from the edge. Your data is in D1 (already co-located/replicated by Cloudflare) and 96% of your users are UK/US — enabling it would add complexity with no benefit. Keep it off.
- **`observability.enabled = true`** is on, which is why you have this data — good.
- **`nodejs_compat` + `global_fetch_strictly_public`** flags are appropriate and don't affect the cost/perf picture.

---

## Bottom line

You set out to build something performant and cheap to run on Cloudflare, and the metrics confirm you achieved it:

- **Cost:** effectively $0 — asset-heavy traffic bypasses Worker billing, and D1 usage is a rounding error.
- **Performance:** ~94% modern protocol adoption, ~88% of bandwidth served from edge cache, near-100% TLS.
- **Reliability:** 0.13% 5xx.

The two small follow-ups (categorise the 4xx, force HTTPS) are polish, not problems. No architectural changes needed.
