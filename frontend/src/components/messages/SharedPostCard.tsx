import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { backendApi } from "@/lib/backend-api";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface SharedPostCardProps {
  postId: string;
  isMyMessage: boolean;
  snippet?: string;
  metadata?: {
    post_content?: string;
    post_image?: string;
    author_name?: string;
    author_avatar?: string;
  };
}

export const SharedPostCard = ({ postId, isMyMessage, snippet, metadata }: SharedPostCardProps) => {
  const navigate = useNavigate();

  const hasMetaImage = !!metadata?.post_image;
  const hasMetaContent = !!metadata?.post_content?.trim();
  const needsFetch = !hasMetaImage && !hasMetaContent && !snippet;

  const { data: post } = useQuery({
    queryKey: ['sharedPost', postId],
    queryFn: () => backendApi.posts.getPost(postId),
    enabled: !hasMetaImage,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  const imageUrl = metadata?.post_image
    || (post?.media?.[0]?.url)
    || (post?.media_urls?.[0])
    || null;
  const contentText = metadata?.post_content || snippet || post?.content || "";
  const authorName = metadata?.author_name
    || (post?.author ? `${post.author.first_name} ${post.author.last_name}` : "");
  const authorAvatar = metadata?.author_avatar || post?.author?.avatar_url || null;

  return (
    <div
      onClick={() => navigate(`/posts/${postId}`)}
      className={cn(
        "rounded-lg overflow-hidden border max-w-xs cursor-pointer transition-opacity hover:opacity-80",
        isMyMessage ? "border-white/20" : "border-border"
      )}
    >
      {imageUrl && (
        <img
          src={imageUrl}
          alt=""
          className="w-full h-32 object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      )}
      <div className="p-2.5 space-y-1.5">
        <p className={cn(
          "text-[10px] uppercase font-semibold tracking-wide",
          isMyMessage ? "text-white/50" : "text-muted-foreground/70"
        )}>
          Shared post
        </p>
        {authorName && (
          <div className="flex items-center gap-1.5">
            {authorAvatar && (
              <img src={authorAvatar} alt="" className="w-4 h-4 rounded-full" />
            )}
            <span className={cn(
              "text-xs font-medium",
              isMyMessage ? "text-white/80" : "text-foreground"
            )}>
              {authorName}
            </span>
          </div>
        )}
        {contentText ? (
          <p className={cn(
            "text-xs line-clamp-3",
            isMyMessage ? "text-white/70" : "text-muted-foreground"
          )}>
            {contentText.slice(0, 150)}
          </p>
        ) : needsFetch && !post ? (
          <Loader2 className={cn("w-3 h-3 animate-spin", isMyMessage ? "text-white/50" : "text-muted-foreground")} />
        ) : (
          <p className={cn(
            "text-xs",
            isMyMessage ? "text-white/50" : "text-muted-foreground"
          )}>
            Tap to view post
          </p>
        )}
      </div>
    </div>
  );
};
