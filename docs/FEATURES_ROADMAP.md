# Features Roadmap and Implementation Checklist

This document lists requested features, short descriptions, priorities, and a standard implementation checklist. Before implementing any feature, ALWAYS follow the "Verify Before Implement" checklist below.

## Feature List

1. Edit Message
   - Concept: Allow users to edit sent messages. Show an "edited" label.
   - Priority: High
    - Notes: Verified end-to-end (backend endpoint, frontend UI, migration present).
    - Status: done (backend/app/routes/messages.py, frontend/src/pages/MessagesNew.tsx, supabase/migrations/11_add_messages_edited_at.sql)

2. Save (Saved Library with folders)
   - Concept: Users save posts into named folders; search and browse saved items.
   - Priority: High
    - Notes: Verified end-to-end (saves routes, Saved library UI, migrations for `save_folders` + `saved_posts`).
    - Status: done (backend/app/routes/saves.py, frontend/src/pages/SavedNew.tsx, supabase/migrations/13_add_save_folders.sql, supabase/migrations/01_init.sql)

3. Message Reactions
   - Concept: Emoji reactions on messages.
   - Priority: High
    - Notes: Verified end-to-end (reactions table + endpoints + UI picker/pills).
    - Status: done (backend/app/routes/messages.py, frontend/src/pages/MessagesNew.tsx, supabase/migrations/14_add_message_reactions.sql)

4. Global Search
   - Concept: Search users, posts, messages, saved content with live suggestions.
   - Priority: High
    - Notes: Verified end-to-end with users/posts/messages/saved + suggestions UI.
    - Status: done (backend/app/routes/search.py, frontend/src/pages/SearchPage.tsx, frontend/src/lib/backend-api.ts)

5. Follow / Unfollow
   - Concept: Follow users to see their content, unfollow to stop.
   - Priority: High
    - Notes: Follow/unfollow implemented with a separate follows table and UI, and following feed uses it.
    - Status: done (backend/app/routes/follows.py, backend/app/routes/posts.py, frontend/src/pages/ProfileNew.tsx, supabase/migrations/17_add_follows.sql)

6. Suggested Users
   - Concept: Recommend users by interests, connections, or activity.
   - Priority: Medium
    - Notes: Suggestions endpoint + UI tab exist (simple "not connected" algorithm).
    - Status: done (backend/app/routes/connections.py, frontend/src/pages/NetworkNew.tsx)

7. Chat with Connections
   - Concept: Messaging scoped to connections (connection only or optional).
   - Priority: High
    - Notes: Enforced on backend send and guarded in UI; people search limited to accepted connections.
    - Status: done (backend/app/routes/messages.py, frontend/src/pages/MessagesNew.tsx)

8. Block User
   - Concept: Block removes visibility and messaging from blocked users.
   - Priority: High
    - Notes: Implemented simple block using `connections.status='blocked'` (backend endpoints + frontend UI). RLS/policies and automated tests still required.
  - Status: partial (backend+frontend implemented, RLS/tests pending)

9. Profile Privacy
   - Concept: Public/private profile settings
   - Priority: Medium
   - Notes: Requires profile flags and RLS / query filters.
   - Status: planned

10. Switch Account
    - Concept: Multi-account quick switching in-app
    - Priority: Low
    - Status: planned

11. Activity Status
    - Concept: Show online/active presence (green dot)
    - Priority: Medium
    - Notes: Requires presence / heartbeat mechanism or last-active timestamp.
    - Status: planned

12. Last Seen
    - Concept: Show last active timestamp
    - Priority: Medium
    - Status: planned

13. Theme (Light/Dark)
    - Concept: App-wide theme toggle and persistent preference
    - Priority: Low
    - Status: planned

14. Social Media Links
    - Concept: Add external links to profile
    - Priority: Low
    - Status: planned

15. Pin Chat
    - Concept: Pin important conversations to top
    - Priority: Medium
    - Notes: Verified end-to-end (pin toggle endpoint + is_pinned in conversation list + sorting).
    - Status: done (backend/app/routes/messages.py, frontend/src/pages/MessagesNew.tsx, supabase/migrations/15_add_pin_conversation.sql)

16. Delete Message for Everyone
    - Concept: Remove message from both sides within time limit
    - Priority: Medium
    - Status: done (backend/app/routes/messages.py, frontend/src/pages/MessagesNew.tsx, supabase/migrations/16_add_message_soft_delete.sql)

17. Mute Notifications
    - Concept: Mute notifications per-user or per-post
    - Priority: Low
    - Status: planned

18. Report Content / User
    - Concept: Reporting flow + moderation queue
    - Priority: High
    - Notes: User-facing report submission is implemented for posts and profiles; moderation queue/admin review still pending.
    - Status: partial (backend/app/routes/reports.py, backend/app/models/report.py, frontend/src/components/modals/ReportDialog.tsx)

19. Typing Indicator Control
    - Concept: Toggle typing indicator visibility
    - Priority: Low
    - Status: planned

20. Profile Completion Indicator
    - Concept: Profile strength meter
    - Priority: Low
    - Status: planned

21. Connection Notes (Private)
    - Concept: Private notes on connections
    - Priority: Low
    - Status: planned

22. Draft Auto Save (Posts)
    - Concept: Automatically persist drafts
    - Priority: Medium
    - Status: planned

23. Quick Share (Internal)
    - Concept: Share posts directly into chats
    - Priority: Medium
    - Status: planned

24. Search Filters (Advanced)
    - Concept: Filter search by category
    - Priority: Medium
    - Status: planned

25. Connection Request Cancel
    - Concept: Cancel sent connection requests
    - Priority: Low
    - Status: planned

---

## Verify Before Implement (required step for every feature)

Before coding, perform these checks and document the findings in this file (update the "Status" field):

1. Repo search
   - Search for API endpoints, DB tables, migrations, and frontend components related to the feature.
   - Suggested search tokens: feature name, table names (`messages`, `reactions`, `saved_*`, `blocks`), route paths (`/messages`, `/search`, `/reactions`).

2. Backend verification
   - Check `backend/app/routes` for existing endpoints.
   - Check `backend/app/models` for Pydantic models.
   - Check `supabase/migrations` for existing schema changes.
   - If DB fields/tables exist, verify RLS policies and indexes.

3. Frontend verification
   - Search `frontend/src/pages` and `frontend/src/components` for related UI.
   - Check `frontend/src/lib` for API helpers.
   - Check `frontend/src/types` for types related to the feature.

4. Tests & CI
   - Search `backend/tests` and `frontend` tests for coverage.

5. If feature requires DB changes
   - Add SQL migration files to `supabase/migrations/` using the next available numeric prefix and a descriptive filename, e.g. `10_add_message_edits.sql`.
   - Keep migration SQL compatible with Supabase/Postgres and include rollbacks where appropriate.

6. Document decision
   - If feature already exists and is complete: mark `Status: done` and reference files.
   - If partially implemented: mark `Status: partial` and list gaps.
   - If not present: mark `Status: planned` and create an implementation ticket with scope and required migrations.

---

## Migration guidelines

- Place migrations in `supabase/migrations/` following the existing numbering scheme (e.g., `01_init.sql`, `02_schema_update.sql`).
- To determine the next prefix, list current files and use the next integer with zero-padded prefix.
- New migrations should:
  - Create necessary tables/columns
  - Add indexes or constraints
  - Provide `COMMENT` statements where helpful
  - Be reversible when practical

---

## How to use this document

- Update the `Status` for a feature after researching (use `done`, `partial`, `planned`, `blocked`).
- For any `planned` item, add a short task plan and the required DB migration filename if applicable.
- Link to code with workspace-relative paths when documenting where functionality exists.

---

Created by the dev agent to coordinate feature rollout. Update this file as you verify and implement features.
