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
import { Post, Comment} from "@/types/api";
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


interface Author {
  id: number;
  first_name: string;
  last_name: string;
  avatar_url?: string;
}


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

  // Like mutation
  const likeMutation = useMutation({
    mutationFn: () =>
      post.is_liked
        ? backendApi.posts.unlikePost(post.id)
        : backendApi.posts.likePost(post.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['post', post.id] });
    },
    onError: () => {
      toast({ title: "Failed to update like", variant: "destructive" });
    },
  });

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
  // const { data: commentsData } = useQuery<Comment[]>({
  //   queryKey: ['comments', post.id],
  //   queryFn: () => backendApi.posts.getComments(post.id, 10, 0),
  //   enabled: showComments,
  // });
const { data: commentsData } = useQuery<{ comments: Comment[] }>({
  queryKey: ['comments', post.id],
  queryFn: async () => {
    const res = await backendApi.posts.getComments(post.id, 10, 0);
    return {
      comments: res.comments as Comment[], // cast to match your type
    };
  },
  enabled: showComments,
});

const comments = commentsData?.comments ?? [];

  // Handle actions
  const handleLike = () => likeMutation.mutate();

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
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
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
      {post.media_urls && post.media_urls.length > 0 && (
        <div className="mb-4 rounded-lg overflow-hidden">
          <img
            src={post.media_urls[0]}
            alt="Post media"
            className="w-full object-cover max-h-96"
            onError={(e) => {
              e.currentTarget.src = "https://via.placeholder.com/800x400?text=Image+Not+Found";
            }}
          />
        </div>
      )}

      {/* Poll */}
      {post.poll_options && post.poll_options.length > 0 && (
        <div className="mb-4 space-y-2">
          {post.poll_options.map((option: string, index: number) => {
            const pollVote = post.poll_votes?.find(pv => pv.option_index === index);
            const totalVotes = post.total_votes || 0;
            const votes = Number(pollVote?.votes_count || 0);
            const percentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
            const hasVoted = post.user_vote !== undefined && post.user_vote !== null;
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
                <div
                  className="absolute inset-0 bg-primary/10"
                  style={{ width: `${percentage}%` }}
                />
                <div className="relative flex items-center justify-between">
                  <span className="font-medium">{option}</span>
                  {hasVoted && <span className="text-sm text-muted-foreground">{percentage.toFixed(0)}%</span>}
                </div>
              </button>
            );
          })}
          {post.total_votes > 0 && (
            <p className="text-xs text-muted-foreground text-center">
              {post.total_votes} vote{post.total_votes !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-3 border-t">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLike}
          className={cn(
            "gap-2",
            post.is_liked && "text-red-500 hover:text-red-600"
          )}
        >
          <Heart className={cn("h-4 w-4", post.is_liked && "fill-current")} />
          <span>{post.likes_count || 0}</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowComments(!showComments)}
          className="gap-2"
        >
          <MessageCircle className="h-4 w-4" />
          <span>{post.comments_count || 0}</span>
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
          <span>{post.reposts_count || 0}</span>
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


          {/* Loading state */}
          {commentMutation.isPending && (
            <p className="text-xs text-muted-foreground">
              Posting comment...
            </p>
          )}


          {/* Empty state */}
          {!commentMutation.isPending && comments?.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No comments yet
            </p>
          )}


          {/* Comments List */}
          {comments?.map((comment) => (
            <div
              key={comment.id}
              className="flex gap-2 text-sm"
            >
              <UserAvatar
                src={comment.author?.avatar_url || ""}
                name={comment.author?.first_name || "User"}
                size="sm"
              />

              <div className="flex-1">

                <p className="font-semibold">
                  {comment.author?.first_name || "Unknown"}{" "}
                  {comment.author?.last_name || ""}
                </p>

                <p className="text-muted-foreground break-words">
                  {comment.content}
                </p>

                <span className="text-xs text-muted-foreground">
                  {formatDate(comment.created_at)}
                </span>

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
