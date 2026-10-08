# GEM Accounts, Mining Participants and Membership

## Account lifecycle

The local server middleware mounts the account API at `/api/gem/account`.

- `POST /register`: creates a member account and sends or creates a time-limited email-verification challenge.
- `GET /verify-email?token=...`: consumes a single-use, 30-minute verification token.
- `POST /login`: authenticates email and password.
- `GET /me` and `GET /entitlements`: return the session profile and server-derived feature capabilities.
- `POST /logout`: revokes the current session.
- `POST /password-reset/request` and `POST /password-reset/confirm`: request and consume a single-use, 30-minute password reset.
- `GET /plans`: returns the configured plan catalogue.

Email delivery is configured by server-only environment variables: `GEM_EMAIL_DELIVERY_URL`, `GEM_EMAIL_DELIVERY_TOKEN`, and `GEM_PUBLIC_BASE_URL`. The configured delivery endpoint must accept the documented JSON templates `gem-account-verification` and `gem-password-reset`. When no mail adapter is configured, the development environment may receive a test token in the API response; production does not expose these tokens.

## Mining Participants and tenant model

- `POST /organizations`: creates a corporate participant profile.
- `GET /organizations`: lists only organizations the signed-in user belongs to.
- `GET /organizations/:id` and `PATCH /organizations/:id`: view or edit a specific tenant profile.
- `POST /organizations/:id/members`: adds an already registered GEM account to the tenant.
- `DELETE /organizations/:id/members/:userId`: removes a member, except the owner.
- `POST /organizations/:id/evidence` and `GET /organizations/:id/evidence`: submit private KYB evidence and inspect its review status.
- `GET /organizations/:id/evidence/:evidenceId/download`: downloads evidence after tenant-role authorization and SHA-256 integrity verification.
- `POST /review/evidence/:evidenceId`: internal review endpoint guarded by `GEM_KYB_REVIEW_KEY` (minimum 32 bytes).

Organization roles are `OWNER`, `ADMIN`, `ANALYST`, `TRADER`, and `VIEWER`. Organization queries are tenant-scoped. The owner cannot be removed through the normal member endpoint. A reviewer must approve the three required evidence types — company registration, tax registration and ownership declaration — before status can become `VERIFIED`. Uploading a document never verifies the business by itself.

Evidence uploads accept only PDF, PNG and JPEG files up to 8 MiB. The server validates file signatures, assigns a random storage name, stores files outside `public/` with restrictive file permissions, records SHA-256, and checks the digest again on download. Original names are metadata only, never filesystem paths. Private storage defaults to `.gem-data/private-documents` and is excluded from Git and denied by the Vite filesystem policy.

## Authentication and data storage

The default SQLite database is `.gem-data/gem-accounts.sqlite`; override with server-side `GEM_ACCOUNT_DB`. Override the private document directory with `GEM_PRIVATE_DOCUMENTS_DIR`. Do not commit, serve publicly, or share either location. Keep protected backups with access controls and a documented restore test.

- Passwords use per-user random salts and Node.js scrypt hashes; plaintext passwords are never persisted.
- Session identifiers are random opaque tokens; only SHA-256 token hashes are stored in SQLite.
- Session cookies are HttpOnly and SameSite=Lax; Secure is added for HTTPS requests.
- SQL statements are parameterized, inputs are validated, and responses never include password hashes or session tokens.
- Registration, login and reset requests have process-local rate limits. Production scale requires a distributed limiter and monitoring.
- User-supplied data cannot set their own global role, organization role or paid plan.

## VIP membership and payment confirmation

- `POST /membership-request` records a pending request only; it does not take payment or activate a plan.
- `POST /billing/webhook` accepts a GEM adapter event signed as HMAC-SHA256 over the exact raw JSON body, passed in `X-GEM-Payment-Signature: sha256=<hex>`. Configure `GEM_PAYMENT_WEBHOOK_SECRET` with at least 32 bytes of secret material.
- Supported event types: `subscription.activated`, `subscription.updated`, `subscription.cancelled`, and `subscription.payment_failed`.
- Payment event IDs are idempotently recorded. Membership is derived from active subscription records; the user's plan field alone is not sufficient for paid entitlement.
- This endpoint is an authenticated adapter contract, not a connected checkout. A production payment provider must verify its upstream signature, bind checkout metadata to the correct GEM user, and send only verified lifecycle events through this signed adapter. Do not expose the HMAC secret to the browser.

Configured monthly prices are product assumptions, not a live offer or executed payment. No card details are collected by GEM.

## Required before public production launch

This is a development/security foundation, not yet a production-ready identity provider or regulated payment service. Before an external launch, add MFA or passkeys, full session rotation/revocation policies, distributed abuse detection, review-operator identity and audit controls, backup/restore drills, account deletion/export, privacy and terms consent, verified email delivery monitoring, external security testing, and a real payment provider/checkout integration with verified server-to-server webhooks. Use HTTPS for every non-local deployment.

## Current trust rules

- Account creation does not mean that a business is verified.
- KYB becomes `VERIFIED` only after an authorized reviewer approves all required evidence types.
- A membership request is not a payment, subscription or entitlement.
- Paid entitlements are granted only by an active subscription record written from the signed billing adapter.
