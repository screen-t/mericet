import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { CreatePostBox } from "@/components/feed/CreatePostBox";
import { CreatePostModal } from "@/components/feed/CreatePostModal";
import { PostCard, PostData } from "@/components/feed/PostCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { Sparkles, Users, Loader2 } from "lucide-react";
import { backendApi } from "@/lib/backend-api";

// Helper function to format time ago
function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

const samplePosts: PostData[] = [
  {
    id: "1",
    author: {
      name: "Sarah Chen",
      username: "sarahchen",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100",
      headline: "CEO at TechVentures | Building the future of AI",
    },
    content:
      "Excited to announce that TechVentures just closed our Series B!\n\nThis journey wouldn't be possible without our amazing team and investors who believed in our vision.\n\nWe're hiring across all departments - DM me if you want to be part of something special!",
    image:
      "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800",
    tags: ["#Funding", "#Startup", "#Hiring"],
    likes: 248,
    comments: 42,
    shares: 18,
    isLiked: false,
    isSaved: false,
    visibility: "public",
    createdAt: "2h ago",
  },
  {
    id: "2",
    author: {
      name: "Marcus Johnson",
      username: "marcusj",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100",
      headline: "Founder at StartupLab | Angel Investor",
    },
    content:
      "Hot take: The best products don't feel like enterprise products.\n\nThey feel like consumer apps that happen to solve business problems.\n\nSimplicity wins. Every time.\n\nWhat's your take?",
    tags: ["#ProductManagement", "#Enterprise", "#Startups"],
    likes: 512,
    comments: 89,
    shares: 34,
    isLiked: true,
    isSaved: true,
    visibility: "public",
    createdAt: "4h ago",
  },
  {
    id: "3",
    author: {
      name: "Emily Rodriguez",
      username: "emilyrod",
      avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100",
      headline: "VP Sales at CloudScale | Revenue Growth Expert",
    },
    content:
      "5 things I learned from scaling sales from $1M to $50M ARR:\n\n1. Process beats talent without process\n2. Hire for curiosity, not just experience\n3. Your best customers will teach you how to sell\n4. Demo less, listen more\n5. Celebrate losses that teach you something\n\nWhat would you add to this list?",
    likes: 892,
    comments: 156,
    shares: 67,
    isLiked: false,
    isSaved: false,
    visibility: "connections",
    createdAt: "6h ago",
  },
  {
    id: "4",
    author: {
      name: "Alex Kim",
      username: "alexkim",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100",
      headline: "Engineering Lead at DataFlow | Open Source Contributor",
    },
    content:
      "Just published a deep dive into how we handle 10M+ events per second at DataFlow.\n\nThe secret? It's not about the technology - it's about understanding your data patterns first.\n\nLink in comments",
    image:
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800",
    tags: ["#Engineering", "#DataEngineering", "#Architecture"],
    likes: 324,
    comments: 48,
    shares: 29,
    isLiked: false,
    isSaved: true,
    visibility: "public",
    createdAt: "8h ago",
  },
];

const Feed = () => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("for-you");

  // Fetch posts from backend
  const { data: postsData, isLoading, isError, refetch } = useQuery({
    queryKey: ["posts", "feed", activeTab],
    queryFn: () => backendApi.posts.getFeed(activeTab === "for-you" ? "for_you" : "following", 50, 0),
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const handleCreatePost = (data: {
    content: string;
    visibility: string;
    image?: string;
  }) => {
    // Close modal and refetch posts
    setIsCreateModalOpen(false);
    refetch();
  };

  // Map backend posts to PostData format
  const posts: PostData[] = postsData?.map((post) => {
    const firstName = post.author?.first_name || '';
    const lastName = post.author?.last_name || '';
    const fullName = [firstName, lastName].filter(Boolean).join(' ');
    
    return {
      id: post.id,
      author: {
        name: fullName || post.author?.username || "Unknown User",
        username: post.author?.username || "user",
        avatar: post.author?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${post.author?.username || 'user'}`,
        headline: post.author?.headline || "",
      },
      content: post.content,
      image: post.media?.[0]?.url,
      tags: post.hashtags?.map((tag: string) => `#${tag}`) || [],
      likes: post.like_count || 0,
      comments: post.comment_count || 0,
      shares: post.share_count || 0,
      isLiked: post.is_liked || false,
      isSaved: post.is_saved || false,
      visibility: post.visibility as "public" | "connections" | "private",
      createdAt: formatTimeAgo(new Date(post.created_at)),
    };
  }) || [];


  // Filter posts based on tab
  const displayedPosts = activeTab === "for-you" 
    ? posts
    : posts.filter(post => post.visibility === "connections");

  return (
    <AppLayout>
      <div className="space-y-6">
        <CreatePostBox onOpenModal={() => setIsCreateModalOpen(true)} />

        {/* Feed Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-auto">
            <TabsTrigger value="for-you" className="gap-2 py-3">
              <Sparkles className="h-4 w-4" />
              <span className="font-semibold">For You</span>
            </TabsTrigger>
            <TabsTrigger value="following" className="gap-2 py-3">
              <Users className="h-4 w-4" />
              <span className="font-semibold">Following</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="for-you" className="mt-6">
            {isLoading ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : isError ? (
              <div className="text-center py-12 text-destructive">
                <p>Failed to load posts. Please try again.</p>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4"
              >
                {posts.length > 0 ? (
                  posts.map((post, index) => (
                    <motion.div
                      key={post.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <PostCard post={post} />
                    </motion.div>
                  ))
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <p className="text-lg font-semibold mb-2">No posts yet</p>
                    <p>Be the first to create a post or connect with others!</p>
                  </div>
                )}
              </motion.div>
            )}
          </TabsContent>

          <TabsContent value="following" className="mt-6">
            {isLoading ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : isError ? (
              <div className="text-center py-12 text-destructive">
                <p>Failed to load posts. Please try again.</p>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4"
              >
                {displayedPosts.length > 0 ? (
                  displayedPosts.map((post, index) => (
                    <motion.div
                      key={post.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <PostCard post={post} />
                    </motion.div>
                  ))
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <p className="text-lg font-semibold mb-2">No posts yet</p>
                    <p>Be the first to create a post or connect with others!</p>
                  </div>
                )}
              </motion.div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <CreatePostModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreatePost}
      />
    </AppLayout>
  );
};

export default Feed;
