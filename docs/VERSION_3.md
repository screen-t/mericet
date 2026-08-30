# Version 3 — Planned Features

Running list of features planned for v3. Add to this list as new ideas come up.

## 1. Real-Time Sync (Messages & Notifications)

Move messages and notifications from polling to instant push updates using **Supabase Realtime**.

- **Postgres Changes** — push new messages/notifications to the recipient the moment they're written, instead of waiting on the current polling interval.
- **Presence** — instant online/active-now status instead of the current last-seen approach.
- **Scope for v3**: start narrow — just the `messages` and `notifications` tables, not a full realtime rewrite of the app.
- **Key risk**: the frontend currently never talks to Supabase directly for data (everything goes through the FastAPI backend, which enforces block/connection/privacy rules). Supabase Realtime's Postgres Changes bypasses that backend layer and relies on RLS instead — RLS needs to be set up correctly for these two tables before enabling it (we already hit a bug this cycle where a table had RLS enabled with no policies and silently blocked all access).

## 2. Active Sessions / Device Management

Let users see every device currently logged into their account and log any of them out remotely.

- Standard account-security feature (LinkedIn, Google, GitHub all have it) — lets a user spot and revoke unauthorized access.
- Supabase Auth tracks refresh-token sessions internally but doesn't expose rich device metadata (browser, OS) by default.
- Needs: a lightweight `sessions`/`devices` table capturing device info (parsed from User-Agent) at login time, backend endpoints to list and revoke sessions, and a Settings page UI. Revoking a session must actually invalidate that refresh token via Supabase's admin API, not just remove it from our own table.
- Independent of the realtime work above — can be built separately if it's wanted sooner.

## 3. Footer — Professional Contact Info

Add a professional email address and phone number to the site footer.

- Gives users/visitors a direct, official way to reach the team (support, business inquiries, press) instead of only in-app channels.
- Needs: a dedicated professional email (not a personal address) and a phone number designated for this purpose before implementation.
