# GEM Accounts, Mining Participants and Membership

## First implementation

The first account layer is mounted at `/api/gem/account` by the local Vite provider stack.

- `POST /register`: creates an individual account and an Intelligence membership.
- `POST /login`: authenticates email/password.
- `GET /me`: returns the current session profile.
- `POST /logout`: revokes the current session.
- `GET /plans`: returns the configured membership catalog.
- `POST /membership-request`: records a pending Trading or Enterprise upgrade request.

The default SQLite database is `.gem-data/gem-accounts.sqlite`; override with server-side `GEM_ACCOUNT_DB`. Keep `.gem-data` out of source control and back it up securely.

## Security controls in this foundation

- Passwords use per-user random salts and Node.js scrypt hashes; plaintext passwords are never persisted.
- Session identifiers are random opaque tokens; only SHA-256 token hashes are stored in SQLite.
- Session cookies are HttpOnly and SameSite=Lax; Secure is added for HTTPS requests.
- User input is validated and SQL statements are parameterized.
- Registration/login have process-local request limits.
- Client responses never include password hashes or session tokens.
- Users cannot self-assign elevated roles or paid plans.

## Membership and payments

Membership upgrade requests remain `PENDING_PROVIDER_CHECKOUT`. This module does not collect card data, execute payments, verify invoices, or grant paid entitlements. A production payment-provider integration must verify signed server-to-server webhooks and idempotency before changing membership status. The configured monthly prices are product assumptions, not a connected checkout.

## Production blockers before public launch

This is a development foundation, not yet a production-ready identity provider. Before opening it to external customers, implement and verify email ownership confirmation, password reset, MFA/passkeys, distributed rate limiting, session revocation/rotation policy, audit monitoring, backup/restore, account deletion/export, privacy and terms consent, tenant isolation, security testing, and payment-provider webhook verification. Use HTTPS in any non-local deployment. Add an external identity provider if operationally appropriate.

## Mining Participants next steps

The account modal is available from the profile control, and the primary module is named **Mining Participants**. Account creation is separate from corporate/participant verification. The next increment should add participant organization profiles, authorized team members, KYB evidence workflow, verification states, and tenant-scoped participant visibility. A company must not be displayed as verified without reviewed evidence.
