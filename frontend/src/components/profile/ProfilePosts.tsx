'use client';

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { backendApi } from "@/lib/backend-api";
import { PostCard } from "@/components/feed/PostCard";
import { Loader2 } from "lucide-react";
import { PostsResponse } from "@/types/api";
import { PostData } from "@/types/post";


/**
 * MUST match exactly what PostCard expects
 */



interface ProfilePostsProps {
  userId: string;
}


/**
 * Transform backend → frontend safe type
 */
const transformPost = (post: any): PostData => {
  return {
    id: post.id ?? "",

    content: post.content ?? "",

    createdAt:
      typeof post.createdAt === "string"
        ? post.createdAt
        : new Date(post.createdAt ?? Date.now()).toISOString(),

    likes: post.likes ?? 0,
    comments: post.comments ?? 0,
    shares: post.shares ?? 0,

    isLiked: post.isLiked ?? false,

    isSaved: post.isSaved ?? false,          // ✅ FIXED
    visibility: post.visibility ?? "public", // ✅ FIXED

    author: {
      id: post.author?.id ?? "",
      name: post.author?.name ?? "Unknown",
      avatar: post.author?.avatar ?? "",
    username: post.author?.usernam ?? "",
    headline: post.author?.headline ?? "",
    },
  };
};



export const ProfilePosts: React.FC<ProfilePostsProps> = ({ userId }) => {

  const {
    data: postsData,
    isLoading,
    error,
  } = useQuery<PostsResponse>({
    queryKey: ["userPosts", userId],

    queryFn: () =>
      backendApi.posts.getUserPosts(userId, 50, 0),

    enabled: !!userId,
  });


  /**
   * Always safe array
   */
  const posts: PostData[] =
    postsData?.posts?.map(transformPost) ?? [];



  /**
   * Loading
   */
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }


  /**
   * Error
   */
  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          Failed to load posts
        </p>
      </div>
    );
  }


  /**
   * Empty
   */
  if (posts.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          No posts yet
        </p>
      </div>
    );
  }


  /**
   * Success
   */
  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
        />
      ))}
    </div>
  );

};

export default ProfilePosts;