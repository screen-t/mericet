import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { CreatePostBox } from "@/components/feed/CreatePostBox";
import { CreatePostModalNew } from "@/components/feed/CreatePostModalNew";
import { PostCardNew } from "@/components/feed/PostCardNew";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { Sparkles, Users, Loader2, RefreshCw } from "lucide-react";
import { backendApi } from "@/lib/backend-api";
import { Button } from "@/components/ui/button";
import { Post } from '@/types/api';

const FeedNew = () => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"for_you" | "following">("for_you");
  const queryClient = useQueryClient();

  // Fetch feed based on active tab
  const { data: feedData, isLoading, isFetching, error, refetch } = useQuery<Post[]>({
    queryKey: ['feed', activeTab],
    queryFn: async () => {
      const result = await backendApi.posts.getFeed(activeTab as 'for_you' | 'following', 20, 0);
      return result as Post[];
    },
    staleTime: 1000 * 60 * 2,      // 2 min — feed-specific override
    refetchInterval: 1000 * 60 * 5, // Refetch every 5 minutes (was every 60 seconds)
  });

  const posts: Post[] = feedData || [];

  const handleTabChange = (value: string) => {
    setActiveTab(value as "for_you" | "following");
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Create Post */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <CreatePostBox onOpenModal={() => setIsCreateModalOpen(true)} />
        </motion.div>

        {/* Feed Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <div className="flex items-center justify-between">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="for_you" className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                For You
              </TabsTrigger>
              <TabsTrigger value="following" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Following
              </TabsTrigger>
            </TabsList>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`w-4 h-4 transition-transform ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {/* For You Feed */}
          <TabsContent value="for_you" className="mt-6 space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Failed to load feed</p>
                <Button onClick={() => refetch()} variant="outline" className="mt-4">
                  Try Again
                </Button>
              </div>
            ) : posts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-lg font-semibold">No posts yet</p>
                <p className="text-muted-foreground mt-2">
                  Be the first to create a post or connect with others!
                </p>
              </div>
            ) : (
              posts.map((post, index) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.03, 0.15) }}
                >
                  <PostCardNew post={post} />
                </motion.div>
              ))
            )}
          </TabsContent>

          {/* Following Feed */}
          <TabsContent value="following" className="mt-6 space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Failed to load feed</p>
                <Button onClick={() => refetch()} variant="outline" className="mt-4">
                  Try Again
                </Button>
              </div>
            ) : posts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-lg font-semibold">Your feed is empty</p>
                <p className="text-muted-foreground mt-2">
                  Start following people to see their posts here!
                </p>
              </div>
            ) : (
              posts.map((post, index) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.03, 0.15) }}
                >
                  <PostCardNew post={post} />
                </motion.div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Create Post Modal */}
      <CreatePostModalNew
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onPostCreated={() => queryClient.invalidateQueries({ queryKey: ['feed'] })}
      />
    </AppLayout>
  );
};

export default FeedNew;
