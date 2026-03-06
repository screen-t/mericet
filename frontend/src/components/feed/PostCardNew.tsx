import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { backendApi } from "@/lib/backend-api";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { Post, CommentsResponse } from '@/types/api';
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  MoreHorizontal,
  Globe,
  Users,
  Lock,
  Repeat2,
  Send,
  X,
  BarChart3,
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

interface PostCardNewProps {
  post: Post;
}

const visibilityIcons = {
  public: Globe,
  connections: Users,
  private: Lock,
};

export const PostCardNew = ({ post }: PostCardNewProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [showRepostDialog, setShowRepostDialog] = useState(false);
  const [repostComment, setRepostComment] = useState("");

  const VisibilityIcon = visibilityIcons[post.visibility as keyof typeof visibilityIcons] || Globe;

  // Like mutation — currentlyLiked is passed explicitly at click time to avoid stale closure bugs
  const likeMutation = useMutation({
    mutationFn: (currentlyLiked: boolean) =>
      currentlyLiked
        ? backendApi.posts.unlikePost(post.id)
        : backendApi.posts.likePost(post.id),
    onMutate: async (currentlyLiked: boolean) => {
      // Cancel any in-flight feed refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ['feed'] });

      // Snapshot all current feed cache entries for rollback
      const previousQueries = queryClient.getQueriesData<Post[]>({ queryKey: ['feed'] });

      // Directly patch every feed cache entry that contains this post
      queryClient.setQueriesData<Post[]>({ queryKey: ['feed'] }, (old) => {
        if (!Array.isArray(old)) return old;
        return old.map((p) =>
          p.id === post.id
            ? {
                ...p,
                is_liked: !currentlyLiked,
                like_count: currentlyLiked
                  ? Math.max((p.like_count ?? 0) - 1, 0)
                  : (p.like_count ?? 0) + 1,
              }
            : p
        );
      });

      // Return snapshot so onError can roll back
      return { previousQueries };
    },
    onError: (_err, _vars, context) => {
      // Roll back cache to snapshot
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      toast({ title: "Failed to update like", variant: "destructive" });
    },
    onSettled: () => {
      // Silently sync with server after optimistic update is already shown
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });

  const displayLiked = post.is_liked ?? false;
  const displayLikeCount = post.like_count ?? post.likes_count ?? 0;

  // Comment mutation
  const commentMutation = useMutation({
    mutationFn: (content: string) => backendApi.posts.addComment(post.id, content),
    onSuccess: () => {
      toast({ title: "Comment added!" });
      setCommentText("");
      queryClient.invalidateQueries({ queryKey: ['comments', post.id] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
    onError: () => {
      toast({ title: "Failed to add comment", variant: "destructive" });
    },
  });

  // Repost mutation
  const repostMutation = useMutation({
    mutationFn: async () => {
      if (post.is_reposted) {
        await backendApi.posts.unrepost(post.id);
      } else {
        await backendApi.posts.repost(post.id, repostComment || undefined);
      }
    },
    onSuccess: () => {
      toast({ title: post.is_reposted ? "Repost removed" : "Reposted!" });
      setShowRepostDialog(false);
      setRepostComment("");
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
    onError: () => {
      toast({ title: "Failed to repost", variant: "destructive" });
    },
  });

  // Fetch comments
  const { data: commentsData } = useQuery<CommentsResponse>({
    queryKey: ['comments', post.id],
    queryFn: () => backendApi.posts.getComments(post.id, 10, 0),
    enabled: showComments,
  });

  const comments = commentsData?.comments || [];

  // Handle actions
  const handleLike = () => {
    if (likeMutation.isPending) return; // prevent double-click
    likeMutation.mutate(displayLiked);  // pass like state at click time — avoids stale closure
  };
  
  const handleComment = () => {
    if (commentText.trim()) {
      commentMutation.mutate(commentText);
    }
  };

  const handleRepost = () => {
    repostMutation.mutate();
  };

  const handleVote = (optionIndex: number) => {
    const optionId = (post as { poll?: { options?: Array<{ id: string }> } }).poll?.options?.[optionIndex]?.id;
    if (!optionId) {
      toast({ title: "Failed to vote", variant: "destructive" });
      return;
    }
    backendApi.posts.votePoll(post.id, optionId)
      .then(() => {
        toast({ title: "Vote recorded!" });
        queryClient.invalidateQueries({ queryKey: ['feed'] });
      })
      .catch(() => {
        toast({ title: "Failed to vote", variant: "destructive" });
      });
  };

  const formatDate = (dateString: string) => {
    try {
      // Supabase timestamps may omit a timezone suffix, causing JS to parse them
      // as local time instead of UTC, making posts appear N hours old.
      // Ensure the string is treated as UTC by appending "Z" if no offset is present.
      const hasOffset = dateString.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(dateString);
      const normalized = hasOffset ? dateString : dateString + "Z";
      return formatDistanceToNow(new Date(normalized), { addSuffix: true });
    } catch {
      return "recently";
    }
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-xl border border-border p-5 shadow-sm hover:shadow-md transition-shadow"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3">
          <Link to={`/profile/${post.author?.id}`}>
            <UserAvatar
              src={post.author?.avatar_url}
              name={`${post.author?.first_name} ${post.author?.last_name}`}
              size="md"
            />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <Link to={`/profile/${post.author?.id}`}>
                <h4 className="font-semibold hover:text-primary cursor-pointer transition-colors">
                  {post.author?.first_name} {post.author?.last_name}
                </h4>
              </Link>
              {post.author?.username && (
                <span className="text-muted-foreground text-sm">
                  @{post.author.username}
                </span>
              )}
            </div>
            {post.author?.headline && (
              <p className="text-sm text-muted-foreground">{post.author.headline}</p>
            )}
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-muted-foreground">
                {formatDate(post.created_at)}
              </span>
              <VisibilityIcon className="h-3 w-3 text-muted-foreground" />
            </div>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Copy link</DropdownMenuItem>
            <DropdownMenuItem>Report</DropdownMenuItem>
            <DropdownMenuItem>Hide</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Content */}
      <div className="mb-4">
        <p className="text-foreground whitespace-pre-wrap leading-relaxed">
          {post.content}
        </p>
      </div>

      {/* Media */}
      {(() => {
        // Backend returns media as an array of objects: [{ url, media_type, ... }]
        // but the Post type also has a legacy media_urls string array — support both.
        const mediaItems: Array<{ url: string; media_type?: string }> =
          (post as any).media?.length
            ? (post as any).media
            : (post.media_urls ?? []).map((u: string) => ({ url: u }));
        if (!mediaItems.length) return null;
        return (
          <div className="mb-4 space-y-2">
            {mediaItems.map((item, idx) => (
              item.media_type === "video" ? (
                <video
                  key={idx}
                  src={item.url}
                  controls
                  className="w-full rounded-lg max-h-96 object-cover"
                />
              ) : (
                <img
                  key={idx}
                  src={item.url}
                  alt="Post media"
                  className="w-full rounded-lg object-cover max-h-96"
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
              )
            ))}
          </div>
        );
      })()}

      {/* Poll */}
      {(() => {
        // Backend returns poll as: { id, question, ends_at, options: [{ id, option_text, vote_count, display_order }], user_vote: <option_id> | null }
        // Legacy shape: post.poll_options (string[]) with post.poll_votes / post.total_votes
        const pollObj = (post as any).poll as { id?: string; question?: string; options?: Array<{ id: string; option_text: string; vote_count: number; display_order: number }>; user_vote?: string | null } | undefined;
        const legacyOptions = post.poll_options;

        if (pollObj?.options?.length) {
          const totalVotes = pollObj.options.reduce((sum, o) => sum + (o.vote_count || 0), 0);
          const hasVoted = !!pollObj.user_vote;
          return (
            <div className="mb-4 space-y-2">
              {pollObj.options.map((option, index) => {
                const percentage = totalVotes > 0 ? (option.vote_count / totalVotes) * 100 : 0;
                const isSelected = pollObj.user_vote === option.id;
                return (
                  <button
                    key={option.id}
                    onClick={() => !hasVoted && handleVote(index)}
                    disabled={hasVoted}
                    className={cn(
                      "w-full p-3 rounded-lg border text-left relative overflow-hidden transition-colors",
                      hasVoted ? "cursor-not-allowed" : "hover:border-primary",
                      isSelected && "border-primary bg-primary/5"
                    )}
                  >
                    <div className="absolute inset-0 bg-primary/10" style={{ width: `${percentage}%` }} />
                    <div className="relative flex items-center justify-between">
                      <span className="font-medium">{option.option_text}</span>
                      {hasVoted && <span className="text-sm text-muted-foreground">{percentage.toFixed(0)}%</span>}
                    </div>
                  </button>
                );
              })}
              {totalVotes > 0 && (
                <p className="text-xs text-muted-foreground text-center">
                  {totalVotes} vote{totalVotes !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          );
        }

        // Legacy fallback
        if (legacyOptions?.length) {
          const totalVotes = post.total_votes || 0;
          const hasVoted = post.user_vote !== undefined && post.user_vote !== null;
          return (
            <div className="mb-4 space-y-2">
              {legacyOptions.map((option: string, index: number) => {
                const pollVote = post.poll_votes?.find(pv => pv.option_index === index);
                const votes = Number(pollVote?.votes_count || 0);
                const percentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
                const isSelected = post.user_vote === index;
                return (
                  <button
                    key={index}
                    onClick={() => !hasVoted && handleVote(index)}
                    disabled={hasVoted}
                    className={cn(
                      "w-full p-3 rounded-lg border text-left relative overflow-hidden transition-colors",
                      hasVoted ? "cursor-not-allowed" : "hover:border-primary",
                      isSelected && "border-primary bg-primary/5"
                    )}
                  >
                    <div className="absolute inset-0 bg-primary/10" style={{ width: `${percentage}%` }} />
                    <div className="relative flex items-center justify-between">
                      <span className="font-medium">{option}</span>
                      {hasVoted && <span className="text-sm text-muted-foreground">{percentage.toFixed(0)}%</span>}
                    </div>
                  </button>
                );
              })}
              {totalVotes > 0 && (
                <p className="text-xs text-muted-foreground text-center">
                  {totalVotes} vote{totalVotes !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          );
        }
        return null;
      })()}

      {/* Actions */}
      <div className="flex items-center justify-between pt-3 border-t">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLike}
          className={cn(
            "gap-2 transition-colors",
            displayLiked && "text-red-500 hover:text-red-600"
          )}
        >
          <Heart className={cn("h-4 w-4 transition-all", displayLiked && "fill-current scale-110")} />
          <span>{displayLikeCount}</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowComments(!showComments)}
          className="gap-2"
        >
          <MessageCircle className="h-4 w-4" />
          <span>{post.comment_count ?? post.comments_count ?? 0}</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowRepostDialog(true)}
          className={cn(
            "gap-2",
            post.is_reposted && "text-green-500 hover:text-green-600"
          )}
        >
          <Repeat2 className="h-4 w-4" />
          <span>{post.repost_count ?? post.reposts_count ?? 0}</span>
        </Button>

        <Button variant="ghost" size="sm" className="gap-2">
          <Share2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="mt-4 pt-4 border-t space-y-3">
          {/* Comment Input */}
          <div className="flex gap-2">
            <Textarea
              placeholder="Write a comment..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              rows={2}
              className="resize-none"
            />
            <Button
              onClick={handleComment}
              disabled={!commentText.trim() || commentMutation.isPending}
              size="icon"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>

          {/* Comments List */}
          {comments.map((comment: any) => (
            <div key={comment.id} className="flex gap-2 text-sm">
              <UserAvatar
                src={comment.author?.avatar_url}
                name={comment.author?.first_name}
                size="sm"
              />
              <div className="flex-1">
                <p className="font-semibold">{comment.author?.first_name} {comment.author?.last_name}</p>
                <p className="text-muted-foreground">{comment.content}</p>
                <span className="text-xs text-muted-foreground">{formatDate(comment.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Repost Dialog */}
      <Dialog open={showRepostDialog} onOpenChange={setShowRepostDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Repost</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Add a comment (optional)"
              value={repostComment}
              onChange={(e) => setRepostComment(e.target.value)}
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowRepostDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleRepost} disabled={repostMutation.isPending}>
                {repostMutation.isPending ? "Reposting..." : "Repost"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.article>
  );
};
