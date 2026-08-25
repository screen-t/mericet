import React, { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { backendApi } from "@/lib/backend-api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { Post, Comment } from '@/types/api';
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
  Image,
  Loader2,
  BarChart3,
  Play,
  Volume2,
  VolumeX,
  Maximize,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { SaveToFolderModal } from "@/components/feed/SaveToFolderModal";
import { SharePostModal } from "@/components/feed/SharePostModal";
import { ReportDialog } from "@/components/modals/ReportDialog";

function formatDate(dateString: string) {
  try {
    const hasOffset = dateString.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(dateString);
    const normalized = hasOffset ? dateString : dateString + "Z";
    return formatDistanceToNow(new Date(normalized), { addSuffix: true });
  } catch {
    return "recently";
  }
}

interface PostCardNewProps {
  post: Post;
  highlightCommentId?: string;
}

interface CommentItemProps {
  comment: Comment;
  currentUserId?: string;
  postAuthorId?: string;
  postId: string;
  onChanged: () => void;
  isHighlighted?: boolean;
}

function CommentItem({ comment, currentUserId, postAuthorId, postId, onChanged, isHighlighted }: CommentItemProps) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.content ?? "");
  const [highlighted, setHighlighted] = useState(isHighlighted ?? false);
  const commentRef = useRef<HTMLDivElement>(null);
  const isCommentAuthor = comment.author?.id === currentUserId;
  const isPostOwner = postAuthorId === currentUserId;
  const canDelete = isCommentAuthor || isPostOwner;
  const canEdit = isCommentAuthor;

  useEffect(() => {
    if (isHighlighted && commentRef.current) {
      commentRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      const timer = setTimeout(() => setHighlighted(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isHighlighted]);

  const updateMutation = useMutation({
    mutationFn: (content: string) => backendApi.posts.updateComment(comment.id, content),
    onSuccess: () => {
      setEditing(false);
      onChanged();
    },
    onError: () => toast({ title: "Failed to update comment", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => backendApi.posts.deleteComment(comment.id),
    onSuccess: onChanged,
    onError: () => toast({ title: "Failed to delete comment", variant: "destructive" }),
  });

  return (
    <div
      ref={commentRef}
      className={cn(
        "flex gap-2 text-sm rounded-md p-1 -mx-1 transition-colors duration-700",
        highlighted ? "bg-primary/15" : ""
      )}
    >
      <UserAvatar src={comment.author?.avatar_url} name={comment.author?.first_name} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-1">
          <p className="font-semibold">{comment.author?.first_name} {comment.author?.last_name}</p>
          {(canDelete || canEdit) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 -mt-0.5">
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canEdit && (
                  <DropdownMenuItem onClick={() => { setEditText(comment.content ?? ""); setEditing(true); }}>
                    Edit
                  </DropdownMenuItem>
                )}
                {canEdit && canDelete && <DropdownMenuSeparator />}
                {canDelete && (
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => deleteMutation.mutate()}
                    disabled={deleteMutation.isPending}
                  >
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {editing ? (
          <div className="mt-1 space-y-1">
            <Textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={2}
              className="resize-none text-sm"
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => updateMutation.mutate(editText.trim())}
                disabled={!editText.trim() || updateMutation.isPending}
              >
                {updateMutation.isPending ? "Saving..." : "Save"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground">{comment.content}</p>
        )}

        <span className="text-xs text-muted-foreground">{formatDate(comment.created_at)}</span>
      </div>
    </div>
  );
}

const visibilityIcons = {
  public: Globe,
  connections: Users,
  private: Lock,
};

// Tracks whether the user has ever manually unmuted a video this session.
// Once they have, subsequent videos autoplay unmuted — matching YouTube/Instagram behaviour.
// Module-level so it's shared across all VideoPlayer instances; resets on page refresh.
let sessionUnmuted = false;

// Autoplay-on-scroll video player with mute toggle, fullscreen, and click-to-pause.
// Browsers block autoplay with sound, so the first video always starts muted.
// React's `muted` prop doesn't update after mount (known React bug), so we
// control it via the DOM ref directly.
const VideoPlayer = ({ src }: { src: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(!sessionUnmuted);
  const [isPaused, setIsPaused] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !sessionUnmuted;
    setIsMuted(!sessionUnmuted);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Honour the session unmute preference on each new autoplay
          video.muted = !sessionUnmuted;
          setIsMuted(!sessionUnmuted);
          video.play().catch(() => {});
          setIsPaused(false);
        } else {
          video.pause();
          setIsPaused(true);
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [src]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
      setIsPaused(false);
    } else {
      video.pause();
      setIsPaused(true);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
    // Record that the user has chosen to hear audio — future videos start unmuted
    if (!video.muted) sessionUnmuted = true;
  };

  const openFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    videoRef.current?.requestFullscreen?.();
  };

  return (
    <div
      className="relative rounded-lg overflow-hidden bg-black cursor-pointer"
      onClick={togglePlay}
    >
      <video
        ref={videoRef}
        src={src}
        preload="metadata"
        playsInline
        loop
        className="w-full max-h-96 object-cover"
      />
      {isPaused && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <div className="bg-black/60 rounded-full p-3">
            <Play className="w-8 h-8 text-white fill-white" />
          </div>
        </div>
      )}
      <div className="absolute bottom-2 right-2 flex items-center gap-1">
        <button
          onClick={toggleMute}
          className="bg-black/60 text-white rounded-full p-1.5 hover:bg-black/80 transition-colors"
          aria-label={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
        <button
          onClick={openFullscreen}
          className="bg-black/60 text-white rounded-full p-1.5 hover:bg-black/80 transition-colors"
          aria-label="Full screen"
        >
          <Maximize className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export const PostCardNew = ({ post, highlightCommentId }: PostCardNewProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showComments, setShowComments] = useState(!!highlightCommentId);
  const [commentText, setCommentText] = useState("");
  const [showRepostDialog, setShowRepostDialog] = useState(false);
  const [showUndoRepostDialog, setShowUndoRepostDialog] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [repostComment, setRepostComment] = useState("");
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [showLikers, setShowLikers] = useState(false);
  const [isVoting, setIsVoting] = useState(false);

  const PAGE_SIZE_LIKERS = 20;
  const likersSentinelRef = useRef<HTMLDivElement>(null);

  const {
    data: likersPages,
    isLoading: likersLoading,
    isFetchingNextPage: likersFetchingMore,
    hasNextPage: likersHasMore,
    fetchNextPage: likersFetchNext,
  } = useInfiniteQuery({
    queryKey: ['likers', post.id],
    queryFn: ({ pageParam = 0 }) =>
      backendApi.posts.getLikers(post.id, PAGE_SIZE_LIKERS, pageParam as number),
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((s, p) => s + p.likers.length, 0);
      return lastPage.likers.length === PAGE_SIZE_LIKERS ? loaded : undefined;
    },
    initialPageParam: 0,
    enabled: showLikers,
    staleTime: 30_000,
  });

  const likers = likersPages?.pages.flatMap((p) => p.likers) ?? [];

  useEffect(() => {
    if (!likersHasMore || likersFetchingMore) return;
    const sentinel = likersSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) likersFetchNext(); },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [likersHasMore, likersFetchingMore, likersFetchNext]);
  const [optimisticLiked, setOptimisticLiked] = useState(post.is_liked ?? false);
  const [optimisticLikeCount, setOptimisticLikeCount] = useState(post.like_count ?? post.likes_count ?? 0);
  const [editContent, setEditContent] = useState(post.content || "");
  const [editMediaUrls, setEditMediaUrls] = useState<string[]>(() => {
    const fromMedia = ((post as { media?: Array<{ url: string }> }).media || []).map((m) => m.url);
    return fromMedia.length > 0 ? fromMedia : (post.media_urls || []);
  });
  const [isUploadingEditMedia, setIsUploadingEditMedia] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const VisibilityIcon = visibilityIcons[post.visibility as keyof typeof visibilityIcons] || Globe;
  const postOwnerId = post.author_id || post.user_id || post.author?.id;
  const isOwner = Boolean(user?.id && postOwnerId && user.id === postOwnerId);

  useEffect(() => {
    // Reinitialize optimistic state only when this card points to a different post.
    // This avoids stale prop refreshes overwriting the local toggle state mid-interaction.
    setOptimisticLiked(post.is_liked ?? false);
    setOptimisticLikeCount(post.like_count ?? post.likes_count ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id]);

  // Like mutation — currentlyLiked is passed explicitly at click time to avoid stale closure bugs
  const likeMutation = useMutation({
    mutationFn: (currentlyLiked: boolean) =>
      currentlyLiked
        ? backendApi.posts.unlikePost(post.id)
        : backendApi.posts.likePost(post.id),
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    onMutate: async (currentlyLiked: boolean) => {
      // Cancel any in-flight feed refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ['feed'] });

      const nextLikeCount = currentlyLiked
        ? Math.max(optimisticLikeCount - 1, 0)
        : optimisticLikeCount + 1;
      setOptimisticLiked(!currentlyLiked);
      setOptimisticLikeCount(nextLikeCount);

      // Snapshot all current feed cache entries for rollback
      const previousQueries = queryClient.getQueriesData<Post[]>({ queryKey: ['feed'] });

      // Directly patch every feed cache entry that contains this post
      queryClient.setQueriesData<Post[]>({ queryKey: ['feed'] }, (old) => {
        if (!Array.isArray(old)) return old;
        return old.map((p) =>
          p.id === post.id
            ? (() => {
                const currentCount = p.like_count ?? p.likes_count ?? 0;
                const updatedCount = currentlyLiked
                  ? Math.max(currentCount - 1, 0)
                  : currentCount + 1;
                return {
                  ...p,
                  is_liked: !currentlyLiked,
                  like_count: updatedCount,
                  likes_count: updatedCount,
                };
              })()
            : p
        );
      });

      // Return snapshot so onError can roll back
      return {
        previousQueries,
        previousLiked: currentlyLiked,
        previousLikeCount: optimisticLikeCount,
      };
    },
    onError: (_err, _vars, context) => {
      // Roll back cache to snapshot
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (typeof context?.previousLiked === 'boolean') {
        setOptimisticLiked(context.previousLiked);
      }
      if (typeof context?.previousLikeCount === 'number') {
        setOptimisticLikeCount(context.previousLikeCount);
      }
      toast({ title: "Failed to update like", variant: "destructive" });
    },
    onSettled: (_data) => {
      // If the server returned a confirmed like_count, sync local state and cache directly.
      // We do NOT call invalidateQueries here because that triggers an immediate background
      // refetch which races against the local optimistic state and can revert the count.
      // The feed's own refetchInterval (5 min) handles background sync.
      const serverCount: number | null | undefined = (_data as { like_count?: number })?.like_count;
      if (typeof serverCount === 'number') {
        setOptimisticLikeCount(serverCount);
        queryClient.setQueriesData<Post[]>({ queryKey: ['feed'] }, (old) => {
          if (!Array.isArray(old)) return old;
          return old.map((p) =>
            p.id === post.id ? { ...p, like_count: serverCount, likes_count: serverCount } : p
          );
        });
      }
    },
  });

  const displayLiked = optimisticLiked;
  const displayLikeCount = optimisticLikeCount;

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

  const [showSaveModal, setShowSaveModal] = useState(false);

  // Unsave mutation (save is handled by SaveToFolderModal)
  const unsaveMutation = useMutation({
    mutationFn: () => backendApi.saves.unsavePost(post.id),
    onSuccess: () => {
      toast({ title: "Post unsaved" });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['savedPosts'] });
      queryClient.invalidateQueries({ queryKey: ['allSaved'] });
    },
    onError: () => {
      toast({ title: "Failed to unsave post", variant: "destructive" });
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

  const PAGE_SIZE = 10;

  const {
    data: commentsPages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['comments', post.id],
    queryFn: ({ pageParam }) =>
      backendApi.posts.getComments(post.id, PAGE_SIZE, pageParam as number),
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((s, p) => s + p.comments.length, 0);
      return loaded < lastPage.total ? loaded : undefined;
    },
    initialPageParam: 0,
    enabled: showComments,
  });

  const comments = commentsPages?.pages.flatMap(p => p.comments) ?? [];
  const commentTotal = commentsPages?.pages[0]?.total ?? 0;

  const getPostMediaUrls = (currentPost: Post): string[] => {
    const fromMedia = ((currentPost as { media?: Array<{ url: string }> }).media || []).map((m) => m.url);
    if (fromMedia.length > 0) return fromMedia;
    return currentPost.media_urls || [];
  };

  const updatePostMutation = useMutation({
    mutationFn: (data: {
      content?: string;
      media?: Array<{ url: string; media_type: "image" | "video" | "link"; thumbnail_url?: string | null }>;
    }) => backendApi.posts.updatePost(post.id, data),
    onSuccess: () => {
      toast({ title: "Post updated" });
      setShowEditDialog(false);
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['userPosts'] });
      queryClient.invalidateQueries({ queryKey: ['post', post.id] });
    },
    onError: () => {
      toast({ title: "Failed to update post", variant: "destructive" });
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: () => backendApi.posts.deletePost(post.id),
    onSuccess: () => {
      toast({ title: "Post deleted" });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['userPosts'] });
    },
    onError: () => {
      toast({ title: "Failed to delete post", variant: "destructive" });
    },
  });

  // Handle actions
  const handleLike = () => {
    if (!user) { setShowAuthGate(true); return; }
    if (likeMutation.isPending) return;
    likeMutation.mutate(displayLiked);
  };

  const handleComment = () => {
    if (!user) { setShowAuthGate(true); return; }
    if (commentText.trim()) {
      commentMutation.mutate(commentText);
    }
  };

  const handleRepost = () => {
    if (!user) { setShowAuthGate(true); return; }
    repostMutation.mutate();
  };

  const handleVote = (optionIndex: number) => {
    const optionId = (post as { poll?: { options?: Array<{ id: string }> } }).poll?.options?.[optionIndex]?.id;
    if (!optionId || isVoting) return;
    setIsVoting(true);
    backendApi.posts.votePoll(post.id, optionId)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['feed'] });
        queryClient.invalidateQueries({ queryKey: ['post', post.id] });
      })
      .catch((err: Error) => {
        toast({ title: err.message || "Failed to vote", variant: "destructive" });
      })
      .finally(() => setIsVoting(false));
  };

  const handleCopyLink = async () => {
    const postUrl = `${window.location.origin}/posts/${post.id}`;
    try {
      await navigator.clipboard.writeText(postUrl);
      toast({ title: "Post link copied" });
    } catch {
      toast({ title: "Could not copy link", variant: "destructive" });
    }
  };

  const handleExternalShare = async () => {
    const postUrl = `${window.location.origin}/posts/${post.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Post on Mericet",
          text: post.content?.slice(0, 100) ?? "",
          url: postUrl,
        });
      } catch {
        // User cancelled or share failed — do nothing
      }
    } else {
      try {
        await navigator.clipboard.writeText(postUrl);
        toast({ title: "Link copied to clipboard" });
      } catch {
        toast({ title: "Could not copy link", variant: "destructive" });
      }
    }
  };

  const handleDeletePost = () => {
    const ok = window.confirm("Delete this post? This action cannot be undone.");
    if (!ok) return;
    deletePostMutation.mutate();
  };

  const handleSaveEdit = () => {
    const next = editContent.trim();
    if (!next && editMediaUrls.length === 0) {
      toast({ title: "Post must include text or media", variant: "destructive" });
      return;
    }

    const originalText = (post.content || "").trim();
    const originalMediaUrls = getPostMediaUrls(post);
    const mediaChanged =
      originalMediaUrls.length !== editMediaUrls.length
      || originalMediaUrls.some((url, idx) => url !== editMediaUrls[idx]);

    const payload: {
      content?: string;
      media?: Array<{ url: string; media_type: "image" | "video" | "link"; thumbnail_url?: string | null }>;
    } = {};

    if (next !== originalText) {
      payload.content = next;
    }

    if (mediaChanged) {
      payload.media = editMediaUrls.map((url) => ({
        url,
        media_type: url.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i) ? "image" : "video",
        thumbnail_url: null,
      }));
    }

    if (!payload.content && !payload.media) {
      toast({ title: "No changes to save" });
      return;
    }

    updatePostMutation.mutate(payload);
  };

  const handleEditFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target as HTMLInputElement;
    const files = Array.from(input.files || []) as File[];
    if (!files.length) return;

    setIsUploadingEditMedia(true);
    try {
      const uploaded: string[] = [];
      for (const file of files) {
        const result = await backendApi.media.upload(file);
        uploaded.push(result.url);
      }

      setEditMediaUrls((prev) => [...prev, ...uploaded]);
      toast({ title: `${uploaded.length} file(s) uploaded` });
    } catch (err: unknown) {
      toast({
        title: "Upload failed",
        description: (err as Error).message ?? "Could not upload file",
        variant: "destructive",
      });
    } finally {
      setIsUploadingEditMedia(false);
      if (editFileInputRef.current) editFileInputRef.current.value = "";
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
          <Link to={`/profile/${post.author?.username || post.author?.id}`}>
            <UserAvatar
              src={post.author?.avatar_url}
              name={`${post.author?.first_name} ${post.author?.last_name}`}
              size="md"
            />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <Link to={`/profile/${post.author?.username || post.author?.id}`}>
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
            <DropdownMenuItem onClick={handleCopyLink}>Copy link</DropdownMenuItem>
            {isOwner ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => {
                  setEditContent(post.content || "");
                  setEditMediaUrls(getPostMediaUrls(post));
                  setShowEditDialog(true);
                }}>
                  Edit post
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleDeletePost}
                  className="text-destructive focus:text-destructive"
                >
                  Delete post
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuItem onClick={() => setShowReportDialog(true)}>Report</DropdownMenuItem>
                <DropdownMenuItem>Hide</DropdownMenuItem>
              </>
            )}
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
          (post.media?.length
            ? post.media
            : (post.media_urls ?? []).map((u: string) => ({ url: u })));
        if (!mediaItems.length) return null;
        return (
          <div className="mb-4 space-y-2">
            {mediaItems.map((item, idx) => (
              item.media_type === "video" ? (
                <VideoPlayer key={idx} src={item.url} />
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
        const pollObj = post.poll as { id?: string; question?: string; options?: Array<{ id: string; option_text: string; vote_count: number; display_order: number }>; user_vote?: string | null } | undefined;
        const legacyOptions = post.poll_options;

        if (pollObj?.options?.length) {
          const totalVotes = pollObj.options.reduce((sum, o) => sum + (o.vote_count || 0), 0);
          const hasVoted = !!pollObj.user_vote;
          const endsAt = (pollObj as { ends_at?: string }).ends_at;
          const isExpired = endsAt ? new Date(endsAt.includes('Z') || endsAt.includes('+') ? endsAt : endsAt + 'Z') < new Date() : false;
          const locked = hasVoted || isExpired || isVoting;
          return (
            <div className="mb-4 space-y-2">
              {pollObj.options.map((option, index) => {
                const percentage = totalVotes > 0 ? (option.vote_count / totalVotes) * 100 : 0;
                const isSelected = pollObj.user_vote === option.id;
                return (
                  <button
                    key={option.id}
                    onClick={() => !locked && handleVote(index)}
                    disabled={locked}
                    className={cn(
                      "w-full p-3 rounded-lg border text-left relative overflow-hidden transition-colors",
                      locked ? "cursor-not-allowed opacity-90" : "hover:border-primary",
                      isSelected && "border-primary bg-primary/5"
                    )}
                  >
                    <div className="absolute inset-0 bg-primary/10" style={{ width: `${(hasVoted || isExpired) ? percentage : 0}%` }} />
                    <div className="relative flex items-center justify-between">
                      <span className="font-medium">{option.option_text}</span>
                      {(hasVoted || isExpired) && <span className="text-sm text-muted-foreground">{percentage.toFixed(0)}%</span>}
                    </div>
                  </button>
                );
              })}
              <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                <span>{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</span>
                {endsAt && (
                  <span>{isExpired ? 'Poll ended' : `Ends ${formatDistanceToNow(new Date(endsAt.includes('Z') || endsAt.includes('+') ? endsAt : endsAt + 'Z'), { addSuffix: true })}`}</span>
                )}
              </div>
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
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLike}
            className={cn(
              "gap-1 transition-colors pr-1",
              displayLiked && "text-red-500 hover:text-red-600"
            )}
          >
            <Heart className={cn("h-4 w-4 transition-all", displayLiked && "fill-current scale-110")} />
          </Button>
          <button
            onClick={() => { if (displayLikeCount > 0) setShowLikers(true); }}
            className={cn(
              "text-sm px-1 rounded hover:bg-muted transition-colors",
              displayLikeCount > 0 ? "cursor-pointer hover:underline" : "cursor-default"
            )}
          >
            {displayLikeCount}
          </button>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => { if (!user) { setShowAuthGate(true); return; } setShowComments(!showComments); }}
          className="gap-2"
        >
          <MessageCircle className="h-4 w-4" />
          <span>{post.comment_count ?? post.comments_count ?? 0}</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (!user) { setShowAuthGate(true); return; }
            if (post.is_reposted) {
              setShowUndoRepostDialog(true);
            } else {
              setShowRepostDialog(true);
            }
          }}
          className={cn(
            "gap-2",
            post.is_reposted && "text-green-500 hover:text-green-600"
          )}
        >
          <Repeat2 className="h-4 w-4" />
          <span>{post.repost_count ?? post.reposts_count ?? 0}</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <Share2 className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleCopyLink}>Copy link</DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              if (!user) { setShowAuthGate(true); return; }
              setShowShareModal(true);
            }}>
              Send in message
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExternalShare}>
              Share externally
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (!user) { setShowAuthGate(true); return; }
            if (post.is_saved) {
              if (!unsaveMutation.isPending) unsaveMutation.mutate();
            } else {
              setShowSaveModal(true);
            }
          }}
          className={cn("gap-2 transition-colors", post.is_saved && "text-primary")}
        >
          <Bookmark className={cn("h-4 w-4 transition-all", post.is_saved && "fill-current")} />
        </Button>
      </div>

      <SharePostModal
        postId={post.id}
        post={post}
        open={showShareModal}
        onOpenChange={setShowShareModal}
      />

      <SaveToFolderModal
        postId={post.id}
        open={showSaveModal}
        onOpenChange={setShowSaveModal}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ['feed'] });
          queryClient.invalidateQueries({ queryKey: ['savedPosts'] });
        }}
      />
      <ReportDialog
        open={showReportDialog}
        onOpenChange={setShowReportDialog}
        targetType="post"
        targetId={post.id}
        targetLabel="post"
      />

      <Dialog open={showAuthGate} onOpenChange={setShowAuthGate}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle>Join to interact</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-4">
            Sign in or create a free account to like, comment, and save posts.
          </p>
          <div className="flex flex-col gap-2">
            <a href="/login" className="w-full">
              <Button className="w-full">Log in</Button>
            </a>
            <a href="/signup" className="w-full">
              <Button variant="outline" className="w-full">Sign up</Button>
            </a>
          </div>
        </DialogContent>
      </Dialog>

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
          {commentTotal > 0 && (
            <p className="text-xs text-muted-foreground">
              {comments.length} of {commentTotal} comment{commentTotal !== 1 ? 's' : ''}
            </p>
          )}
          {comments.map((comment: Comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUserId={user?.id}
              postAuthorId={post.author?.id ?? post.author_id}
              postId={post.id}
              onChanged={() => queryClient.invalidateQueries({ queryKey: ['comments', post.id] })}
              isHighlighted={comment.id === highlightCommentId}
            />
          ))}
          {hasNextPage && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground text-xs"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage
                ? "Loading..."
                : `View ${commentTotal - comments.length} more comment${commentTotal - comments.length !== 1 ? 's' : ''}`}
            </Button>
          )}
        </div>
      )}

      {/* Likers Dialog */}
      <Dialog open={showLikers} onOpenChange={setShowLikers}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Liked by</DialogTitle>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto -mx-1 space-y-0.5">
            {likersLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : likers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No likes yet.</p>
            ) : (
              <>
                {likers.map((liker) => (
                  <Link
                    key={liker.id}
                    to={`/profile/${liker.username || liker.id}`}
                    onClick={() => setShowLikers(false)}
                    className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-muted/60 transition-colors"
                  >
                    <UserAvatar src={liker.avatar_url} name={`${liker.first_name} ${liker.last_name}`} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{liker.first_name} {liker.last_name}</p>
                      {liker.username && (
                        <p className="text-xs text-muted-foreground">@{liker.username}</p>
                      )}
                    </div>
                  </Link>
                ))}
                {/* Sentinel — triggers next page load when scrolled into view */}
                <div ref={likersSentinelRef} className="py-1 flex justify-center">
                  {likersFetchingMore && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

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

      {/* Undo Repost Dialog */}
      <Dialog open={showUndoRepostDialog} onOpenChange={setShowUndoRepostDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove repost?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will remove your repost of this post.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowUndoRepostDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setShowUndoRepostDialog(false);
                handleRepost();
              }}
              disabled={repostMutation.isPending}
            >
              {repostMutation.isPending ? "Removing..." : "Remove repost"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Post Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit post</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={5}
              placeholder="Update your post"
            />

            <input
              ref={editFileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={handleEditFileSelect}
            />
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => editFileInputRef.current?.click()}
                disabled={isUploadingEditMedia}
              >
                {isUploadingEditMedia ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...
                  </>
                ) : (
                  <>
                    <Image className="w-4 h-4 mr-2" /> Add media
                  </>
                )}
              </Button>
              <span className="text-xs text-muted-foreground">{editMediaUrls.length} media item(s)</span>
            </div>

            {editMediaUrls.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {editMediaUrls.map((url, idx) => (
                  <div key={`${url}-${idx}`} className="relative rounded-md overflow-hidden border">
                    <img src={url} alt="Post media" className="w-full h-20 object-cover" />
                    <button
                      type="button"
                      onClick={() => setEditMediaUrls((prev) => prev.filter((_, i) => i !== idx))}
                      className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-1"
                      aria-label="Remove media"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={updatePostMutation.isPending || isUploadingEditMedia}
              >
                {updatePostMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.article>
  );
};
