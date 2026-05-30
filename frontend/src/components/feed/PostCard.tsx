import { useState } from "react";
import { motion } from "framer-motion";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { Button } from "@/components/ui/button";
import { SkillTag } from "@/components/ui/SkillTag";
import { ReportDialog } from "@/components/modals/ReportDialog";
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  MoreHorizontal,
  Image,
  Globe,
  Users,
  Lock,
  Repeat2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface PostData {
  id: string;
  author: {
    name: string;
    username: string;
    avatar?: string;
    headline: string;
  };
  content: string;
  image?: string;
  tags?: string[];
  likes: number;
  comments: number;
  shares: number;
  isLiked: boolean;
  isSaved: boolean;
  visibility: "public" | "connections" | "private";
  createdAt: string;
}

interface PostCardProps {
  post: PostData;
  onLike?: (id: string) => void;
  onComment?: (id: string) => void;
  onShare?: (id: string) => void;
  onSave?: (id: string) => void;
}

const visibilityIcons = {
  public: Globe,
  connections: Users,
  private: Lock,
};

export const PostCard = ({
  post,
  onLike,
  onComment,
  onShare,
  onSave,
}: PostCardProps) => {
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [isLiked, setIsLiked] = useState(post.isLiked);
  const [isSaved, setIsSaved] = useState(post.isSaved);
  const [likes, setLikes] = useState(post.likes);
  const [isReposted, setIsReposted] = useState(false);
  const [repostCount, setRepostCount] = useState(post.shares || 0);

  const VisibilityIcon = visibilityIcons[post.visibility];

  const handleLike = () => {
    setIsLiked(!isLiked);
    setLikes(isLiked ? likes - 1 : likes + 1);
    onLike?.(post.id);
  };

  const handleSave = () => {
    setIsSaved(!isSaved);
    onSave?.(post.id);
  };

  const handleRepost = () => {
    setIsReposted(!isReposted);
    setRepostCount(isReposted ? repostCount - 1 : repostCount + 1);
    // In production, this would call the repost API
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-xl border border-border p-3 sm:p-5 shadow-sm hover:shadow-md transition-shadow w-full min-w-0"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4 min-w-0">
        <div className="flex items-start gap-2 sm:gap-3 min-w-0 flex-1">
          <UserAvatar
            name={post.author.name}
            src={post.author.avatar}
            size="md"
            showStatus
            isOnline
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
              <h4 className="font-semibold hover:text-primary cursor-pointer transition-colors truncate max-w-[120px] sm:max-w-none">
                {post.author.name}
              </h4>
              <span className="text-muted-foreground text-sm truncate hidden sm:inline">
                @{post.author.username}
              </span>
            </div>
            <p className="text-sm text-muted-foreground truncate">{post.author.headline}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-muted-foreground">{post.createdAt}</span>
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
            <DropdownMenuItem onClick={() => setShowReportDialog(true)}>Report</DropdownMenuItem>
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

      {/* Tags */}
      {post.tags && post.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {post.tags.map((tag) => (
            <SkillTag key={tag} skill={tag} variant="primary" size="sm" />
          ))}
        </div>
      )}

      {/* Image */}
      {post.image && (
        <div className="mb-4 rounded-lg overflow-hidden border border-border">
          <img
            src={post.image}
            alt="Post attachment"
            className="w-full h-auto object-cover max-h-96"
          />
        </div>
      )}

      <ReportDialog
        open={showReportDialog}
        onOpenChange={setShowReportDialog}
        targetType="post"
        targetId={post.id}
        targetLabel="post"
      />

      {/* Actions */}
      <div className="flex items-center justify-between pt-3 border-t border-border">
        <div className="flex items-center gap-0 sm:gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLike}
            className={cn(
              "gap-1.5 text-muted-foreground hover:text-primary px-2 sm:px-3",
              isLiked && "text-primary"
            )}
          >
            <Heart
              className={cn("h-4 w-4", isLiked && "fill-current")}
            />
            <span className="text-xs">{likes}</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onComment?.(post.id)}
            className="gap-1.5 text-muted-foreground hover:text-primary px-2 sm:px-3"
          >
            <MessageCircle className="h-4 w-4" />
            <span className="text-xs">{post.comments}</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRepost}
            className={cn(
              "gap-1.5 text-muted-foreground hover:text-green-600 px-2 sm:px-3",
              isReposted && "text-green-600"
            )}
            title="Repost"
          >
            <Repeat2 className="h-4 w-4" />
            <span className="text-xs hidden sm:inline">{repostCount}</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onShare?.(post.id)}
            className="gap-1.5 text-muted-foreground hover:text-primary px-2 sm:px-3"
            title="Share"
          >
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSave}
          className={cn(
            "text-muted-foreground hover:text-primary h-8 w-8",
            isSaved && "text-primary"
          )}
          title="Save post"
        >
          <Bookmark className={cn("h-4 w-4", isSaved && "fill-current")} />
        </Button>
      </div>
    </motion.article>
  );
};
