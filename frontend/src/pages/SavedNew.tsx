import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { backendApi } from "@/lib/backend-api";
import { PostCardNew } from "@/components/feed/PostCardNew";
import { Post } from "@/types/api";
import { useToast } from "@/hooks/use-toast";
import {
  Bookmark,
  Loader2,
  FolderOpen,
  Plus,
  ArrowLeft,
  Search,
  MoreHorizontal,
  Trash2,
  Pencil,
  X,
  Inbox,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Folder {
  id: string;
  folder_name: string;
  description?: string;
  color: string;
  post_count: number;
  created_at: string;
}

const PRESET_COLORS = [
  "#6366f1", "#ec4899", "#f59e0b", "#10b981",
  "#3b82f6", "#ef4444", "#8b5cf6", "#14b8a6",
];

type Tab = "folders" | "all" | "unsorted";

export default function Saved() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<Tab>("folders");
  const [openFolder, setOpenFolder] = useState<Folder | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderDesc, setNewFolderDesc] = useState("");
  const [newFolderColor, setNewFolderColor] = useState(PRESET_COLORS[0]);

  // Queries
  const { data: folders = [], isLoading: foldersLoading } = useQuery<Folder[]>({
    queryKey: ["saveFolders"],
    queryFn: () => backendApi.saves.getFolders() as Promise<Folder[]>,
  });

  const { data: allSaved = [], isLoading: allLoading } = useQuery<Post[]>({
    queryKey: ["allSaved"],
    queryFn: () => backendApi.saves.getAllSaved(50, 0),
    staleTime: 0,
  });

  const { data: unsorted = [], isLoading: unsortedLoading } = useQuery<Post[]>({
    queryKey: ["unsortedSaved"],
    queryFn: () => backendApi.saves.getUnsorted(50, 0),
    staleTime: 0,
  });

  const { data: folderData, isLoading: folderPostsLoading } = useQuery({
    queryKey: ["folderPosts", openFolder?.id],
    queryFn: () => backendApi.saves.getFolderPosts(openFolder!.id, 50, 0),
    enabled: !!openFolder,
  });

  const { data: searchResults = [], isLoading: searchLoading } = useQuery<Post[]>({
    queryKey: ["savedSearch", searchQuery, openFolder?.id],
    queryFn: () => backendApi.saves.searchSaved(searchQuery, openFolder?.id),
    enabled: searchQuery.length >= 2,
  });

  // Mutations
  const createFolderMutation = useMutation({
    mutationFn: () =>
      backendApi.saves.createFolder({ folder_name: newFolderName.trim(), description: newFolderDesc.trim() || undefined, color: newFolderColor }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saveFolders"] });
      setShowCreateDialog(false);
      setNewFolderName("");
      setNewFolderDesc("");
      setNewFolderColor(PRESET_COLORS[0]);
      toast({ title: "Folder created" });
    },
    onError: () => toast({ title: "Failed to create folder", variant: "destructive" }),
  });

  const updateFolderMutation = useMutation({
    mutationFn: () =>
      backendApi.saves.updateFolder(editingFolder!.id, {
        folder_name: newFolderName.trim(),
        description: newFolderDesc.trim() || undefined,
        color: newFolderColor,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saveFolders"] });
      setEditingFolder(null);
      toast({ title: "Folder updated" });
    },
    onError: () => toast({ title: "Failed to update folder", variant: "destructive" }),
  });

  const deleteFolderMutation = useMutation({
    mutationFn: (folderId: string) => backendApi.saves.deleteFolder(folderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saveFolders"] });
      if (openFolder) setOpenFolder(null);
      toast({ title: "Folder deleted. Posts moved to Unsorted." });
    },
    onError: () => toast({ title: "Failed to delete folder", variant: "destructive" }),
  });

  function openEditDialog(folder: Folder) {
    setEditingFolder(folder);
    setNewFolderName(folder.folder_name);
    setNewFolderDesc(folder.description ?? "");
    setNewFolderColor(folder.color);
  }

  function openCreateDialog() {
    setNewFolderName("");
    setNewFolderDesc("");
    setNewFolderColor(PRESET_COLORS[0]);
    setShowCreateDialog(true);
  }

  const isSearching = searchQuery.length >= 2;
  const displayPosts = isSearching
    ? searchResults
    : openFolder
    ? (folderData?.posts ?? [])
    : activeTab === "all"
    ? allSaved
    : unsorted;

  const postsLoading = isSearching
    ? searchLoading
    : openFolder
    ? folderPostsLoading
    : activeTab === "all"
    ? allLoading
    : unsortedLoading;

  // ── Folder detail view ────────────────────────────────────
  if (openFolder) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto space-y-4 px-2">
          {/* Header */}
          <div className="flex items-center gap-3 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setOpenFolder(null)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <div
              className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: openFolder.color }}
            >
              <FolderOpen className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold truncate">{openFolder.folder_name}</h1>
              {openFolder.description && (
                <p className="text-xs text-muted-foreground">{openFolder.description}</p>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openEditDialog(openFolder)}>
                  <Pencil className="h-4 w-4 mr-2" /> Edit folder
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => deleteFolderMutation.mutate(openFolder.id)}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Delete folder
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Search within folder */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search in this folder…"
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>

          <PostList posts={displayPosts} loading={postsLoading} emptyMessage="This folder is empty." />
        </div>
        <FolderDialog
          open={!!editingFolder}
          onOpenChange={(v) => { if (!v) setEditingFolder(null); }}
          title="Edit folder"
          name={newFolderName}
          desc={newFolderDesc}
          color={newFolderColor}
          onNameChange={setNewFolderName}
          onDescChange={setNewFolderDesc}
          onColorChange={setNewFolderColor}
          onSubmit={() => updateFolderMutation.mutate()}
          isPending={updateFolderMutation.isPending}
          submitLabel="Save changes"
        />
      </AppLayout>
    );
  }

  // ── Library home view ─────────────────────────────────────
  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-4 px-2">
        {/* Header */}
        <div className="flex items-center justify-between pt-2">
          <div>
            <h1 className="text-2xl font-bold">My Library</h1>
            <p className="text-sm text-muted-foreground">Organize saved posts into folders</p>
          </div>
          <Button size="sm" onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-1" /> New Folder
          </Button>
        </div>

        {/* Search (all saves) */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search all saved posts…"
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {isSearching ? (
          <PostList posts={searchResults} loading={searchLoading} emptyMessage="No results found." />
        ) : (
          <>
            {/* Tabs */}
            <div className="flex gap-1 border-b">
              {(["folders", "all", "unsorted"] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors",
                    activeTab === tab
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab === "folders" ? "My Folders" : tab === "all" ? "All Saves" : "Unsorted"}
                </button>
              ))}
            </div>

            {/* My Folders tab */}
            {activeTab === "folders" && (
              <>
                {foldersLoading ? (
                  <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                ) : folders.length === 0 ? (
                  <Card className="p-12 text-center">
                    <div className="max-w-sm mx-auto space-y-4">
                      <div className="flex justify-center">
                        <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                          <FolderOpen className="h-10 w-10 text-primary" />
                        </div>
                      </div>
                      <h2 className="text-xl font-bold">No folders yet</h2>
                      <p className="text-muted-foreground text-sm">
                        Create folders to organise your saved posts — like a personal knowledge library.
                      </p>
                      <Button onClick={openCreateDialog}><Plus className="h-4 w-4 mr-1" /> Create first folder</Button>
                    </div>
                  </Card>
                ) : (
                  <div className="grid grid-cols-2 gap-3 pb-20">
                    {folders.map((folder) => (
                      <FolderCard
                        key={folder.id}
                        folder={folder}
                        onClick={() => setOpenFolder(folder)}
                        onEdit={() => openEditDialog(folder)}
                        onDelete={() => deleteFolderMutation.mutate(folder.id)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {/* All Saves tab */}
            {activeTab === "all" && (
              <PostList posts={allSaved} loading={allLoading} emptyMessage="You haven't saved any posts yet." />
            )}

            {/* Unsorted tab */}
            {activeTab === "unsorted" && (
              <PostList posts={unsorted} loading={unsortedLoading} emptyMessage="No unsorted saves — great organisation!" />
            )}
          </>
        )}
      </div>

      {/* Create folder dialog */}
      <FolderDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        title="New folder"
        name={newFolderName}
        desc={newFolderDesc}
        color={newFolderColor}
        onNameChange={setNewFolderName}
        onDescChange={setNewFolderDesc}
        onColorChange={setNewFolderColor}
        onSubmit={() => createFolderMutation.mutate()}
        isPending={createFolderMutation.isPending}
        submitLabel="Create folder"
      />

      {/* Edit folder dialog */}
      <FolderDialog
        open={!!editingFolder}
        onOpenChange={(v) => { if (!v) setEditingFolder(null); }}
        title="Edit folder"
        name={newFolderName}
        desc={newFolderDesc}
        color={newFolderColor}
        onNameChange={setNewFolderName}
        onDescChange={setNewFolderDesc}
        onColorChange={setNewFolderColor}
        onSubmit={() => updateFolderMutation.mutate()}
        isPending={updateFolderMutation.isPending}
        submitLabel="Save changes"
      />
    </AppLayout>
  );
}

// ── Sub-components ────────────────────────────────────────────

function FolderCard({ folder, onClick, onEdit, onDelete }: {
  folder: Folder;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card
      onClick={onClick}
      className="p-4 cursor-pointer hover:shadow-md transition-shadow relative group"
    >
      <div className="flex items-start justify-between gap-2">
        <div
          className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: folder.color }}
        >
          <FolderOpen className="h-5 w-5 text-white" />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
              <Pencil className="h-4 w-4 mr-2" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
            >
              <Trash2 className="h-4 w-4 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="mt-3">
        <p className="font-semibold text-sm leading-tight">{folder.folder_name}</p>
        {folder.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{folder.description}</p>
        )}
        <p className="text-xs text-muted-foreground mt-2">{folder.post_count} post{folder.post_count !== 1 ? "s" : ""}</p>
      </div>
    </Card>
  );
}

function PostList({ posts, loading, emptyMessage }: { posts: Post[]; loading: boolean; emptyMessage: string }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (posts.length === 0) {
    return (
      <Card className="p-10 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
            <Inbox className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground text-sm">{emptyMessage}</p>
        </div>
      </Card>
    );
  }
  return (
    <div className="space-y-4 pb-20">
      {posts.map((post) => <PostCardNew key={post.id} post={post} />)}
    </div>
  );
}

interface FolderDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  name: string;
  desc: string;
  color: string;
  onNameChange: (v: string) => void;
  onDescChange: (v: string) => void;
  onColorChange: (v: string) => void;
  onSubmit: () => void;
  isPending: boolean;
  submitLabel: string;
}

function FolderDialog({ open, onOpenChange, title, name, desc, color, onNameChange, onDescChange, onColorChange, onSubmit, isPending, submitLabel }: FolderDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Name *</label>
            <Input
              placeholder="e.g. Business Ideas"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              maxLength={100}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && name.trim() && onSubmit()}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <Input
              placeholder="Optional"
              value={desc}
              onChange={(e) => onDescChange(e.target.value)}
              maxLength={300}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Color</label>
            <div className="flex gap-2 mt-1.5">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => onColorChange(c)}
                  className={cn(
                    "h-6 w-6 rounded-full transition-transform",
                    color === c && "ring-2 ring-offset-1 ring-primary scale-110"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={onSubmit} disabled={!name.trim() || isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : submitLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
