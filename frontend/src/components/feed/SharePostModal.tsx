import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { backendApi } from "@/lib/backend-api";
import { useToast } from "@/hooks/use-toast";
import { Connection } from "@/types/api";
import { Search, Loader2, Send } from "lucide-react";

interface SharePostModalProps {
  postId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SharePostModal = ({ postId, open, onOpenChange }: SharePostModalProps) => {
  const { toast } = useToast();
  const [search, setSearch] = useState("");

  const { data: connectionsData, isLoading } = useQuery({
    queryKey: ['connections', 'accepted'],
    queryFn: () => backendApi.connections.getConnections('accepted', 100, 0),
    enabled: open,
  });

  const sendMutation = useMutation({
    mutationFn: (receiverId: string) => {
      const postUrl = `${window.location.origin}/posts/${postId}`;
      return backendApi.messages.sendMessage(receiverId, postUrl);
    },
    onSuccess: () => {
      toast({ title: "Post shared!" });
      onOpenChange(false);
    },
    onError: () => toast({ title: "Failed to share post", variant: "destructive" }),
  });

  const connections = (connectionsData?.connections || []).filter((c: Connection) => {
    if (!c.user) return false;
    if (!search) return true;
    const name = `${c.user.first_name} ${c.user.last_name} ${c.user.username}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share post</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search connections..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="max-h-64 overflow-y-auto space-y-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : connections.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {search ? "No connections found" : "No connections yet"}
            </p>
          ) : (
            connections.map((conn: Connection) => (
              <button
                key={conn.id}
                onClick={() => sendMutation.mutate(conn.user!.id)}
                disabled={sendMutation.isPending}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
              >
                <UserAvatar
                  src={conn.user?.avatar_url}
                  name={`${conn.user?.first_name} ${conn.user?.last_name}`}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {conn.user?.first_name} {conn.user?.last_name}
                  </p>
                  {conn.user?.username && (
                    <p className="text-xs text-muted-foreground">@{conn.user.username}</p>
                  )}
                </div>
                <Send className="w-4 h-4 text-muted-foreground" />
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
