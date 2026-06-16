import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Navbar } from "@/components/layout/Navbar";
import { backendApi } from "@/lib/backend-api";
import { PostCardNew } from "@/components/feed/PostCardNew";
import { useAuth } from "@/lib/auth";
import { Loader2 } from "lucide-react";

const PostDetail = () => {
  const { postId } = useParams<{ postId: string }>();
  const { user, loading: authLoading } = useAuth();

  const { data: post, isLoading } = useQuery({
    queryKey: ["post", postId],
    queryFn: () => backendApi.posts.getPost(postId || ""),
    enabled: !!postId,
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const content = (
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
  );

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar isAuthenticated={false} />
        {content}
      </div>
    );
  }

  return <AppLayout>{content}</AppLayout>;
};

export default PostDetail;
