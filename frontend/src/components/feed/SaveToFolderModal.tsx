import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { backendApi } from "@/lib/backend-api";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FolderOpen, Plus, Bookmark, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Folder {
  id: string;
  folder_name: string;
  color: string;
  post_count: number;
}

interface SaveToFolderModalProps {
  postId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

const PRESET_COLORS = [
  "#6366f1", "#ec4899", "#f59e0b", "#10b981",
  "#3b82f6", "#ef4444", "#8b5cf6", "#14b8a6",
];

export function SaveToFolderModal({ postId, open, onOpenChange, onSaved }: SaveToFolderModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState(PRESET_COLORS[0]);
  const [savingFolderId, setSavingFolderId] = useState<string | null>(null);

  const { data: folders = [], isLoading } = useQuery<Folder[]>({
    queryKey: ["saveFolders"],
    queryFn: () => backendApi.saves.getFolders() as Promise<Folder[]>,
    enabled: open,
  });

  const createFolderMutation = useMutation({
    mutationFn: (name: string) =>
      backendApi.saves.createFolder({ folder_name: name, color: newFolderColor }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saveFolders"] });
      setNewFolderName("");
      setCreatingFolder(false);
    },
    onError: () => {
      toast({ title: "Failed to create folder", variant: "destructive" });
    },
  });

  const saveMutation = useMutation({
    mutationFn: ({ folderId }: { folderId?: string }) =>
      backendApi.saves.saveToFolder(postId, folderId),
    onSuccess: (_data, { folderId }) => {
      const folderName = folders.find((f) => f.id === folderId)?.folder_name;
      toast({ title: folderName ? `Saved to "${folderName}"` : "Post saved" });
      queryClient.invalidateQueries({ queryKey: ["savedPosts"] });
      queryClient.invalidateQueries({ queryKey: ["allSaved"] });
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      onSaved();
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Failed to save post", variant: "destructive" });
    },
    onSettled: () => setSavingFolderId(null),
  });

  function handleSaveToFolder(folderId?: string) {
    setSavingFolderId(folderId ?? "__none__");
    saveMutation.mutate({ folderId });
  }

  function handleCreateAndSave() {
    if (!newFolderName.trim()) return;
    createFolderMutation.mutate(newFolderName.trim(), {
      onSuccess: (resp: { data?: { id?: string } }) => {
        const createdId = resp?.data?.id;
        if (createdId) handleSaveToFolder(createdId);
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bookmark className="h-5 w-5 text-primary" />
            Save to folder
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pt-1">
          {/* Save without folder */}
          <button
            onClick={() => handleSaveToFolder(undefined)}
            disabled={saveMutation.isPending}
            className="w-full flex items-center gap-3 rounded-lg border p-3 text-left hover:bg-muted/50 transition-colors"
          >
            {savingFolderId === "__none__" && saveMutation.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin shrink-0 text-muted-foreground" />
            ) : (
              <Bookmark className="h-5 w-5 shrink-0 text-muted-foreground" />
            )}
            <div>
              <p className="text-sm font-medium">Save without folder</p>
              <p className="text-xs text-muted-foreground">Goes to your unsorted saves</p>
            </div>
          </button>

          {/* Existing folders */}
          {isLoading && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && folders.length > 0 && (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => handleSaveToFolder(folder.id)}
                  disabled={saveMutation.isPending}
                  className="w-full flex items-center gap-3 rounded-lg border p-3 text-left hover:bg-muted/50 transition-colors"
                >
                  {savingFolderId === folder.id && saveMutation.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin shrink-0" />
                  ) : (
                    <div
                      className="h-5 w-5 rounded shrink-0 flex items-center justify-center"
                      style={{ backgroundColor: folder.color }}
                    >
                      <FolderOpen className="h-3 w-3 text-white" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{folder.folder_name}</p>
                    <p className="text-xs text-muted-foreground">{folder.post_count} posts</p>
                  </div>
                  <Check className="h-4 w-4 opacity-0 group-hover:opacity-100 text-primary" />
                </button>
              ))}
            </div>
          )}

          {/* Create new folder */}
          {!creatingFolder ? (
            <button
              onClick={() => setCreatingFolder(true)}
              className="w-full flex items-center gap-3 rounded-lg border border-dashed p-3 text-left hover:bg-muted/50 transition-colors"
            >
              <Plus className="h-5 w-5 shrink-0 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Create new folder</p>
            </button>
          ) : (
            <div className="rounded-lg border p-3 space-y-3">
              <Input
                placeholder="Folder name (e.g. Business Ideas)"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                autoFocus
                maxLength={100}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateAndSave();
                  if (e.key === "Escape") setCreatingFolder(false);
                }}
              />
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Color:</span>
                <div className="flex gap-1.5">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setNewFolderColor(c)}
                      className={cn(
                        "h-5 w-5 rounded-full transition-transform",
                        newFolderColor === c && "ring-2 ring-offset-1 ring-primary scale-110"
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleCreateAndSave}
                  disabled={!newFolderName.trim() || createFolderMutation.isPending || saveMutation.isPending}
                  className="flex-1"
                >
                  {createFolderMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create & Save"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setCreatingFolder(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
