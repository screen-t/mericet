import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { backendApi } from "@/lib/backend-api";
import { PostCardNew } from "@/components/feed/PostCardNew";
import { useAuth } from "@/lib/auth";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { FolderOpen, Users, ArrowLeft, Loader2, Inbox } from "lucide-react";

export default function PublicFolderPage() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["publicFolder", shareToken],
    queryFn: () => backendApi.saves.getPublicFolder(shareToken!),
    enabled: !!shareToken,
  });

  const followMutation = useMutation({
    mutationFn: () =>
      data?.is_following
        ? backendApi.saves.unfollowFolder(data.folder.id)
        : backendApi.saves.followFolder(data!.folder.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["publicFolder", shareToken] });
      queryClient.invalidateQueries({ queryKey: ["followingFolders"] });
      toast({ title: data?.is_following ? "Unfollowed" : "Now following this folder" });
    },
    onError: () => toast({ title: "Action failed", variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!data || !data.folder) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto px-2 py-16 text-center space-y-3">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto">
            <FolderOpen className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-bold">Folder not found</h2>
          <p className="text-sm text-muted-foreground">
            This folder may have been made private or deleted.
          </p>
        </div>
      </AppLayout>
    );
  }

  const { folder, owner, posts, is_following } = data as {
    folder: { id: string; folder_name: string; description?: string; color: string; post_count: number; follower_count: number; user_id: string };
    owner: { id: string; first_name: string; last_name: string; username?: string; avatar_url?: string } | null;
    posts: any[];
    is_following: boolean;
  };

  const isOwner = user?.id === folder.user_id;

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-4 px-2 pt-2 pb-20">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-ml-2">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>

        {/* Folder header */}
        <div className="flex items-start gap-4">
          <div
            className="h-14 w-14 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: folder.color }}
          >
            <FolderOpen className="h-7 w-7 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold leading-tight">{folder.folder_name}</h1>
            {folder.description && (
              <p className="text-sm text-muted-foreground mt-0.5">{folder.description}</p>
            )}
            <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
              <span>{folder.post_count} post{folder.post_count !== 1 ? "s" : ""}</span>
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {folder.follower_count} follower{folder.follower_count !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {/* Follow button */}
          {!isOwner && (
            user ? (
              <Button
                size="sm"
                variant={is_following ? "outline" : "default"}
                onClick={() => followMutation.mutate()}
                disabled={followMutation.isPending}
                className="shrink-0"
              >
                {followMutation.isPending
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : is_following ? "Unfollow" : "Follow"}
              </Button>
            ) : (
              <Link to="/login" className="shrink-0">
                <Button size="sm">Sign in to follow</Button>
              </Link>
            )
          )}
        </div>

        {/* Owner info */}
        {owner && (
          <Link
            to={`/profile/${owner.id}`}
            className="flex items-center gap-2.5 text-sm hover:opacity-80 transition-opacity"
          >
            <UserAvatar src={owner.avatar_url} name={owner.first_name} size="sm" />
            <span className="font-medium">{owner.first_name} {owner.last_name}</span>
            {owner.username && (
              <span className="text-muted-foreground">@{owner.username}</span>
            )}
          </Link>
        )}

        <div className="border-t pt-4" />

        {/* Posts */}
        {posts.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <Inbox className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">This folder has no posts yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post: any) => <PostCardNew key={post.id} post={post} />)}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
