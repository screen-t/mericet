# Folder Thumbnails

## Current implementation (Option 1 — Auto)

Folder cards automatically use the first image found in the folder's saved posts as a cover thumbnail. No DB column required — the thumbnail is computed server-side in `GET /saves/folders` and `GET /saves/following` by querying `saved_posts` and `post_media` (2 queries total, regardless of folder count).

If a folder contains no image posts, the card falls back to the folder's color with a folder icon.

**Backend:** `save_repo.get_folder_thumbnails(folder_ids)` in `save_repo.py`
**Frontend:** `FolderCard` and `FollowingFolderCard` in `SavedNew.tsx`

---

## Planned (Option 2 — User picks from saved posts)

Allow the folder owner to choose which image from the folder's posts to use as the cover.

### What needs to be built

**DB migration:**
```sql
ALTER TABLE save_folders ADD COLUMN cover_image_url TEXT;
```

**Backend:**
- `PUT /saves/folders/:id/cover` — accepts `{ cover_image_url: string }`, validates the URL belongs to a post in that folder, stores it.
- Update `get_folders` to prefer `cover_image_url` over the auto-computed thumbnail when set.

**Frontend:**
- In the folder detail view (`/saved/:folderId`), add a "Change cover" option in the `...` dropdown.
- Opens a bottom sheet / modal showing a grid of all image thumbnails from posts in the folder.
- Tapping one sets it as the cover via the API above.
- "Reset to auto" option clears `cover_image_url` back to `null`.

### Notes
- Only images from posts already in the folder should be selectable (no external upload).
- If the selected post is later removed from the folder, the cover falls back to auto.
- For followed folders (public), the cover is set by the owner only.
