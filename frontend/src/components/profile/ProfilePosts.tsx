import { useQuery } from "@tanstack/react-query";
import { backendApi } from "@/lib/backend-api";
import { PostCard } from "@/components/feed/PostCard";
import { Loader2 } from "lucide-react";
import { PostsResponse } from '@/types/api';

interface ProfilePostsProps {
  userId: string;
}

export const ProfilePosts = ({ userId }: ProfilePostsProps) => {
  const { data: postsData, isLoading, error } = useQuery<PostsResponse>({
    queryKey: ['userPosts', userId],
    queryFn: () => backendApi.posts.getUserPosts(userId, 50, 0),
  });

  const posts = postsData?.posts || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Failed to load posts</p>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No posts yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post: any) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
};
