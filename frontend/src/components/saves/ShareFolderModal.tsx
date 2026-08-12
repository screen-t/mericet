import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { useToast } from "@/hooks/use-toast";
import { backendApi } from "@/lib/backend-api";
import { Search, X, Loader2, Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface Peer {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
  username?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  folderName: string;
  shareUrl: string;
}

export function ShareFolderModal({ open, onOpenChange, folderName, shareUrl }: Props) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Map<string, Peer>>(new Map());

  const { data, isLoading } = useQuery({
    queryKey: ["connections-for-share"],
    queryFn: async () => {
      const res = await backendApi.connections.getConnections("accepted", 100, 0);
      return (res.connections as any[]).map((c: any): Peer => ({
        id: c.user?.id ?? "",
        first_name: c.user?.first_name ?? "",
        last_name: c.user?.last_name ?? "",
        avatar_url: c.user?.avatar_url,
        username: c.user?.username,
      })).filter(p => p.id);
    },
    enabled: open,
    staleTime: 60_000,
  });

  const peers = data ?? [];

  const filtered = useMemo(() => {
    if (!query.trim()) return peers;
    const q = query.toLowerCase();
    return peers.filter(p =>
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
      (p.username ?? "").toLowerCase().includes(q)
    );
  }, [peers, query]);

  const sendMutation = useMutation({
    mutationFn: async () => {
      const message = `📂 I shared a folder with you on Mericet: "${folderName}"\n${shareUrl}`;
      await Promise.all(
        Array.from(selected.keys()).map(id =>
          backendApi.messages.sendMessage(id, message)
        )
      );
    },
    onSuccess: () => {
      const count = selected.size;
      toast({ title: `Folder shared with ${count} ${count === 1 ? "person" : "people"}` });
      handleClose();
    },
    onError: () => toast({ title: "Failed to send messages", variant: "destructive" }),
  });

  function toggle(peer: Peer) {
    setSelected(prev => {
      const next = new Map(prev);
      if (next.has(peer.id)) next.delete(peer.id);
      else next.set(peer.id, peer);
      return next;
    });
  }

  function handleClose() {
    onOpenChange(false);
    setQuery("");
    setSelected(new Map());
  }

  const selectedList = Array.from(selected.values());

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share via message</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Selected chips */}
          {selectedList.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedList.map(p => (
                <span
                  key={p.id}
                  className="flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-1 rounded-full"
                >
                  {p.first_name} {p.last_name}
                  <button onClick={() => toggle(p)} className="hover:opacity-70">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search connections…"
              className="pl-9"
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoFocus
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-64 overflow-y-auto -mx-1 space-y-0.5">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">
                {query ? "No connections match your search." : "You have no connections yet."}
              </p>
            ) : (
              filtered.map(peer => {
                const isSelected = selected.has(peer.id);
                return (
                  <button
                    key={peer.id}
                    onClick={() => toggle(peer)}
                    className={cn(
                      "w-full flex items-center gap-3 px-2 py-2 rounded-md transition-colors text-left",
                      isSelected ? "bg-primary/10" : "hover:bg-muted/60"
                    )}
                  >
                    <UserAvatar src={peer.avatar_url} name={`${peer.first_name} ${peer.last_name}`} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{peer.first_name} {peer.last_name}</p>
                      {peer.username && (
                        <p className="text-xs text-muted-foreground">@{peer.username}</p>
                      )}
                    </div>
                    {/* Checkbox indicator */}
                    <div className={cn(
                      "h-4 w-4 rounded-full border-2 shrink-0 transition-colors",
                      isSelected ? "border-primary bg-primary" : "border-muted-foreground"
                    )} />
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-1 border-t">
            <Button variant="ghost" onClick={handleClose}>Cancel</Button>
            <Button
              onClick={() => sendMutation.mutate()}
              disabled={selected.size === 0 || sendMutation.isPending}
            >
              {sendMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send{selected.size > 0 ? ` to ${selected.size}` : ""}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
