import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { backendApi } from "@/lib/backend-api";
import { useToast } from "@/hooks/use-toast";
import { Connection, Post } from "@/types/api";
import { Search, Loader2, Send } from "lucide-react";

interface SharePostModalProps {
  postId: string;
  post?: Post;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SharePostModal = ({ postId, post, open, onOpenChange }: SharePostModalProps) => {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [sendingTo, setSendingTo] = useState<string | null>(null);

  const { data: connectionsData, isLoading } = useQuery({
    queryKey: ['connections', 'accepted'],
    queryFn: () => backendApi.connections.getConnections('accepted', 100, 0),
    enabled: open,
  });

  const sendMutation = useMutation({
    mutationFn: (receiverId: string) => {
      const postUrl = `${window.location.origin}/posts/${postId}`;
      const contentSnippet = (post?.content || "").slice(0, 80);
      const mediaUrls = (post as { media?: Array<{ url: string }> })?.media || [];
      const firstImage = mediaUrls.find(
        (m: { url: string }) => /\.(jpg|jpeg|png|webp|gif)/i.test(m.url)
      );
      const hasImage = !!firstImage;
      const hasText = !!contentSnippet.trim();

      let messageText = `Shared a post\n${postUrl}`;
      if (hasText) {
        const display = contentSnippet + (post!.content!.length > 80 ? "…" : "");
        messageText = `Shared a post: "${display}"\n${postUrl}`;
      } else if (hasImage) {
        messageText = `Shared a photo\n${postUrl}`;
      }

      const metadata: Record<string, string> = {
        type: "shared_post",
        post_id: postId,
      };
      if (hasText) metadata.post_content = post!.content!.slice(0, 150);
      if (firstImage) metadata.post_image = firstImage.url;
      if (post?.author) {
        metadata.author_name = `${post.author.first_name} ${post.author.last_name}`;
        if (post.author.avatar_url) metadata.author_avatar = post.author.avatar_url;
      }

      return backendApi.messages.sendMessage(receiverId, messageText, undefined, metadata);
    },
    onSuccess: () => {
      toast({ title: "Post shared!" });
      setSendingTo(null);
      onOpenChange(false);
    },
    onError: () => {
      setSendingTo(null);
      toast({ title: "Failed to share post", variant: "destructive" });
    },
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
                onClick={() => {
                  setSendingTo(conn.user!.id);
                  sendMutation.mutate(conn.user!.id);
                }}
                disabled={sendMutation.isPending}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
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
                {sendingTo === conn.user?.id && sendMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                ) : (
                  <Send className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
