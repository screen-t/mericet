import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { backendApi } from "@/lib/backend-api";
import { PostCardNew } from "@/components/feed/PostCardNew";
import { Loader2 } from "lucide-react";

const PostDetail = () => {
  const { postId } = useParams<{ postId: string }>();

  const { data: post, isLoading } = useQuery({
    queryKey: ["post", postId],
    queryFn: () => backendApi.posts.getPost(postId || ""),
    enabled: !!postId,
  });

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : post ? (
          <PostCardNew post={post} />
        ) : (
          <div className="text-center py-12 text-muted-foreground">Post not found</div>
        )}
      </div>
    </AppLayout>
  );
};

export default PostDetail;