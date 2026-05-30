import { useState, useEffect } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { PostCardNew } from "@/components/feed/PostCardNew";
import { backendApi } from "@/lib/backend-api";
import { SearchResponse, User, Post, MessageSearchResult, SearchSuggestion } from '@/types/api';
import {
  Search as SearchIcon,
  Users,
  FileText,
  Loader2,
  UserPlus,
  Building2,
} from "lucide-react";

const SearchPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);
  const [activeTab, setActiveTab] = useState("all");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const navigate = useNavigate();

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      if (searchQuery) {
        setSearchParams({ q: searchQuery });
      } else {
        setSearchParams({});
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, setSearchParams]);

  useEffect(() => {
    setShowSuggestions(searchQuery.length > 0);
  }, [searchQuery]);

  // Search all
  const { data: allResults, isLoading: loadingAll } = useQuery<SearchResponse>({
    queryKey: ['search', 'all', debouncedQuery],
    queryFn: () => backendApi.search.searchAll(debouncedQuery, 20),
    enabled: !!debouncedQuery && activeTab === 'all',
  });

  // Search users
  const { data: usersResults, isLoading: loadingUsers } = useQuery<SearchResponse>({
    queryKey: ['search', 'users', debouncedQuery],
    queryFn: () => backendApi.search.searchUsers(debouncedQuery, 50, 0),
    enabled: !!debouncedQuery && activeTab === 'users',
  });

  // Search posts
  const { data: postsResults, isLoading: loadingPosts } = useQuery<SearchResponse>({
    queryKey: ['search', 'posts', debouncedQuery],
    queryFn: () => backendApi.search.searchPosts(debouncedQuery, 50, 0),
    enabled: !!debouncedQuery && activeTab === 'posts',
  });

  // Search messages
  const { data: messagesResults, isLoading: loadingMessages } = useQuery<SearchResponse>({
    queryKey: ['search', 'messages', debouncedQuery],
    queryFn: () => backendApi.search.searchMessages(debouncedQuery, 50),
    enabled: !!debouncedQuery && activeTab === 'messages',
  });

  // Search saved
  const { data: savedResults, isLoading: loadingSaved } = useQuery<SearchResponse>({
    queryKey: ['search', 'saved', debouncedQuery],
    queryFn: () => backendApi.search.searchSaved(debouncedQuery, 50),
    enabled: !!debouncedQuery && activeTab === 'saved',
  });

  // Suggestions
  const { data: suggestionsData } = useQuery<{ suggestions?: SearchSuggestion[] }>({
    queryKey: ['search', 'suggestions', searchQuery],
    queryFn: () => backendApi.search.searchSuggestions(searchQuery, 6),
    enabled: searchQuery.length > 0,
  });

  const isLoading = loadingAll || loadingUsers || loadingPosts || loadingMessages || loadingSaved;

  const renderUserCard = (user: User) => (
    <Card key={user.id} className="p-4">
      <div className="flex items-start gap-3">
        <Link to={`/profile/${user.id}`}>
          <UserAvatar
            src={user.avatar_url}
            name={`${user.first_name} ${user.last_name}`}
            size="md"
          />
        </Link>
        <div className="flex-1 min-w-0">
          <Link to={`/profile/${user.id}`}>
            <h4 className="font-semibold hover:text-primary truncate">
              {user.first_name} {user.last_name}
            </h4>
          </Link>
          {user.username && (
            <p className="text-sm text-muted-foreground">@{user.username}</p>
          )}
          {user.headline && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {user.headline}
            </p>
          )}
          <Link to={`/profile/${user.id}`}>
            <Button size="sm" variant="outline" className="mt-3">
              <UserPlus className="w-4 h-4 mr-2" />
              View Profile
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );

  const renderEmptyState = (message: string) => (
    <div className="text-center py-12">
      <SearchIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
      <p className="text-lg font-semibold">No results found</p>
      <p className="text-muted-foreground mt-2">{message}</p>
    </div>
  );

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Header & Search */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <h1 className="text-3xl font-bold">Search</h1>
          
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search for people, posts, and more..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 text-lg h-12"
              autoFocus
            />
            {showSuggestions && (suggestionsData?.suggestions?.length ?? 0) > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-card border rounded-lg shadow-lg overflow-hidden z-20">
                {suggestionsData?.suggestions?.map((s, index) => (
                  <button
                    key={`${s.type}-${s.user_id || s.username || s.text}-${index}`}
                    onClick={() => {
                      if (s.type === "user" && s.user_id) {
                        navigate(`/profile/${s.user_id}`);
                      } else if (s.type === "company") {
                        navigate(`/companies?q=${encodeURIComponent(s.text)}`);
                      } else if (s.type === "post" && s.post_id) {
                        navigate(`/posts/${s.post_id}`);
                      } else {
                        setSearchQuery(s.text);
                      }
                      setShowSuggestions(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-muted text-sm flex items-center gap-2"
                  >
                    {s.type === "user" ? (
                      <UserAvatar src={s.avatar_url} name={s.text} size="sm" />
                    ) : s.type === "company" ? (
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                    ) : (
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <span>{s.text}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* Results */}
        {!debouncedQuery ? (
          <div className="text-center py-12">
            <SearchIcon className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-semibold">Start searching</p>
            <p className="text-muted-foreground mt-2">
              Enter a keyword to find people and posts
            </p>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="flex w-full max-w-3xl flex-wrap gap-2">
              <TabsTrigger value="all" className="flex items-center gap-2 whitespace-nowrap">
                <SearchIcon className="w-4 h-4" />
                All
              </TabsTrigger>
              <TabsTrigger value="users" className="flex items-center gap-2 whitespace-nowrap">
                <Users className="w-4 h-4" />
                People
              </TabsTrigger>
              <TabsTrigger value="posts" className="flex items-center gap-2 whitespace-nowrap">
                <FileText className="w-4 h-4" />
                Posts
              </TabsTrigger>
              <TabsTrigger value="messages" className="flex items-center gap-2 whitespace-nowrap">
                <FileText className="w-4 h-4" />
                Messages
              </TabsTrigger>
              <TabsTrigger value="saved" className="flex items-center gap-2 whitespace-nowrap">
                <FileText className="w-4 h-4" />
                Saved
              </TabsTrigger>
            </TabsList>

            {/* All Results */}
            <TabsContent value="all" className="mt-6 space-y-6">
              {loadingAll ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  {/* Users Section */}
                  {allResults?.users && allResults.users.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-semibold flex items-center gap-2">
                          <Users className="w-5 h-5" />
                          People
                        </h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setActiveTab('users')}
                        >
                          See all
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {allResults.users.slice(0, 4).map((user: User) => renderUserCard(user))}
                      </div>
                    </div>
                  )}

                  {/* Posts Section */}
                  {allResults?.posts && allResults.posts.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-semibold flex items-center gap-2">
                          <FileText className="w-5 h-5" />
                          Posts
                        </h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setActiveTab('posts')}
                        >
                          See all
                        </Button>
                      </div>
                      <div className="space-y-4">
                        {allResults.posts.slice(0, 3).map((post: Post) => (
                          <PostCardNew key={post.id} post={post} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Messages Section */}
                  {allResults?.messages && allResults.messages.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-semibold flex items-center gap-2">
                          <FileText className="w-5 h-5" />
                          Messages
                        </h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setActiveTab('messages')}
                        >
                          See all
                        </Button>
                      </div>
                      <div className="space-y-3">
                        {allResults.messages.slice(0, 4).map((m: MessageSearchResult) => (
                          <Card key={m.id} className="p-3">
                            <Link to={`/messages/${m.other_user?.id ?? ''}`}>
                              <div className="flex items-center gap-3">
                                <UserAvatar
                                  src={m.other_user?.avatar_url}
                                  name={`${m.other_user?.first_name || ''} ${m.other_user?.last_name || ''}`.trim()}
                                  size="sm"
                                />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">
                                    {m.other_user?.first_name} {m.other_user?.last_name}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {m.content}
                                  </p>
                                </div>
                              </div>
                            </Link>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Saved Section */}
                  {allResults?.saved && allResults.saved.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-semibold flex items-center gap-2">
                          <FileText className="w-5 h-5" />
                          Saved
                        </h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setActiveTab('saved')}
                        >
                          See all
                        </Button>
                      </div>
                      <div className="space-y-4">
                        {allResults.saved.slice(0, 3).map((post: Post) => (
                          <PostCardNew key={post.id} post={post} />
                        ))}
                      </div>
                    </div>
                  )}

                  {(!allResults?.users?.length && !allResults?.posts?.length && !allResults?.messages?.length && !allResults?.saved?.length) &&
                    renderEmptyState('Try searching with different keywords')
                  }
                </>
              )}
            </TabsContent>

            {/* Users Results */}
            <TabsContent value="users" className="mt-6">
              {loadingUsers ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : usersResults?.users && usersResults.users.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {usersResults.users.map((user: User, index: number) => (
                    <motion.div
                      key={user.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      {renderUserCard(user)}
                    </motion.div>
                  ))}
                </div>
              ) : (
                renderEmptyState('No people found matching your search')
              )}
            </TabsContent>

            {/* Posts Results */}
            <TabsContent value="posts" className="mt-6">
              {loadingPosts ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : postsResults?.posts && postsResults.posts.length > 0 ? (
                <div className="space-y-4">
                  {postsResults.posts.map((post: Post, index: number) => (
                    <motion.div
                      key={post.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <PostCardNew post={post} />
                    </motion.div>
                  ))}
                </div>
              ) : (
                renderEmptyState('No posts found matching your search')
              )}
            </TabsContent>

            {/* Messages Results */}
            <TabsContent value="messages" className="mt-6">
              {loadingMessages ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : messagesResults?.messages && messagesResults.messages.length > 0 ? (
                <div className="space-y-3">
                  {messagesResults.messages.map((m: MessageSearchResult, index: number) => (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card className="p-3">
                        <Link to={`/messages/${m.other_user?.id ?? ''}`}>
                          <div className="flex items-center gap-3">
                            <UserAvatar
                              src={m.other_user?.avatar_url}
                              name={`${m.other_user?.first_name || ''} ${m.other_user?.last_name || ''}`.trim()}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">
                                {m.other_user?.first_name} {m.other_user?.last_name}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">{m.content}</p>
                            </div>
                          </div>
                        </Link>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              ) : (
                renderEmptyState('No messages found matching your search')
              )}
            </TabsContent>

            {/* Saved Results */}
            <TabsContent value="saved" className="mt-6">
              {loadingSaved ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : savedResults?.saved && savedResults.saved.length > 0 ? (
                <div className="space-y-4">
                  {savedResults.saved.map((post: Post, index: number) => (
                    <motion.div
                      key={post.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <PostCardNew post={post} />
                    </motion.div>
                  ))}
                </div>
              ) : (
                renderEmptyState('No saved posts found matching your search')
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
};

export default SearchPage;
