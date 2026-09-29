# Google sign-in and user isolation

Google sign-in was recovered from `feat/visual-analytics-and-insights` and integrated
with the redesigned interface. Open the app and use **Sign in with Google**. Grant
read-only Gmail access to import bank notifications. Signed-in users see their
profile, **Sync Gmail**, and **Sign out** above the dashboard.

## Configuration

Keep the existing `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env` (never in
frontend variables). Compose forwards these settings to the API. The Google Cloud
OAuth web client must allow the exact `GOOGLE_REDIRECT_URI`:

`http://localhost:8000/api/v1/auth/google/callback`

`FRONTEND_URL` defaults to `http://localhost:3000`. Use this hostname consistently
for the UI and callback. On deployment, set both URLs to your HTTPS domain;
session cookies automatically become Secure. The reverse proxy should serve the
frontend and `/api` on the same host. Keep Gmail API enabled. If the Google OAuth
app is still in Testing, add other users as test users in Google Cloud; otherwise
complete Google's publishing/verification requirements for the requested scopes.
See [Google's OAuth web server documentation](https://developers.google.com/identity/protocols/oauth2/web-server).

Apply migrations before starting the updated API:

```sh
docker compose build api worker frontend
docker compose run --rm api alembic upgrade head
docker compose up -d api worker frontend
```

## Security and data ownership

- OAuth state is random, tied to an HttpOnly browser cookie, expires after ten
  minutes, and is consumed once in Redis. Google profiles must have a verified
  email and subject identifier.
- Sessions last seven days. Only an opaque HttpOnly cookie reaches the browser;
  its SHA-256 digest is stored in the database. OAuth tokens stay on the server.
- Logout expires the server session. Mutating session routes verify Origin.
- Transaction lists, details, and event streams require a session and verify
  account ownership. Other users' transaction details return 404.
- Gmail imports identify accounts by user, bank, mask, and currency. The worker
  only processes existing accounts; it never invents random owners. Importers
  check stored transaction IDs and isolate duplicate checks by account.
- Background Gmail polling runs every minute for authenticated users. Sync is
  serialized per user via Redis. Signing out stops subsequent background syncs.
- Targets and reviewed flags are stored per user in this browser. They are not
  synced between devices. Signing in as another user remounts the dashboard.

## Legacy ownership

The previous importer assigned random account owners and reused bank/card account
identifiers across profiles. These records cannot safely be assigned from their
bank names or card suffixes. They remain inaccessible until ownership is confirmed.
The included `scripts/assign_legacy_accounts.py` is an administrator-only CLI with
a dry run by default. It requires an existing profile UUID and explicit account
UUIDs; `--apply` updates only those unassigned accounts, transactionally. It refuses
to take an account already owned by a known Google profile. There is no public
endpoint for claiming historical accounts.

## Checks

`npm run test:e2e --prefix frontend` covers public sign-in, demo separation, sync,
sign-out, expired sessions, per-user browser storage, and the dashboard flows.
`tests/test_auth_isolation.py` uses a separate PostgreSQL database with rollback per
test. Set `AUTH_TEST_DATABASE_URL` to a disposable database whose name contains
`test`. It verifies two-user isolation, OAuth state, cookies, revocation, streams,
and Gmail account separation. External Google calls are mocked; the real consent
flow must be completed interactively by the account owner.


### Sync recovery and status

Gmail sync runs in the background. The frontend polls the authenticated
`GET /api/v1/auth/google/sync-status` endpoint and refreshes activity while the
import runs. Gmail scanning is bounded to two minutes; failed scans release
their lock and report an error. Multiple API processes coordinate polling in Redis.
Queued transactions are processed separately, and the dashboard refreshes every
30 seconds. A completed Gmail scan does not mean every queued transaction is saved.

Worker failures are retained in the dead-letter topic and release the Gmail
deduplication key so a later sync can retry. For imports failed before that fix,
run `python -m scripts.replay_failed_gmail` to preview recoverable records, then
add `--apply` to replay them. Only Gmail events for accounts already owned by a
verified Google profile are eligible; existing transactions are skipped, and
account ownership and dead-letter records remain unchanged.
