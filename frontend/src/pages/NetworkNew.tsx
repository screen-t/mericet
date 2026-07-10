import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Link, useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { backendApi } from "@/lib/backend-api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Connection, ConnectionsResponse, SuggestionsResponse, User } from '@/types/api';
import {
  Search,
  UserPlus,
  UserCheck,
  Users,
  Clock,
  X,
  Check,
  Loader2,
  MessageSquare,
  Heart,
} from "lucide-react";

const NetworkNew = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "connections";
  const setActiveTab = (tab: string) => setSearchParams({ tab });

  // Fetch connections
  const { data: connectionsData, isLoading: loadingConnections } = useQuery<ConnectionsResponse>({
    queryKey: ['connections', 'accepted'],
    queryFn: () => backendApi.connections.getConnections('accepted', 100, 0),
  });

  // Fetch pending requests
  const { data: requestsData, isLoading: loadingRequests } = useQuery<ConnectionsResponse>({
    queryKey: ['connections', 'pending'],
    queryFn: () => backendApi.connections.getConnections('pending', 100, 0),
  });

  // Fetch suggestions
  const { data: suggestionsData, isLoading: loadingSuggestions } = useQuery<SuggestionsResponse>({
    queryKey: ['connectionSuggestions'],
    queryFn: () => backendApi.connections.getSuggestions(20),
  });

  // Fetch followers & following
  const { data: followersData, isLoading: loadingFollowers } = useQuery<User[]>({
    queryKey: ['followers'],
    queryFn: () => backendApi.follows.listFollowers(100, 0),
  });

  const { data: followingData, isLoading: loadingFollowing } = useQuery<User[]>({
    queryKey: ['following'],
    queryFn: () => backendApi.follows.listFollowing(100, 0),
  });

  const followers = Array.isArray(followersData) ? followersData : [];
  const following = Array.isArray(followingData) ? followingData : [];

  const connections = connectionsData?.connections || [];
  const allPendingRequests = requestsData?.connections || [];

  // Split pending requests into received (others sent to me) and sent (I sent to others)
  const receivedRequests = allPendingRequests.filter(
    (r: Connection) => r.receiver_id === currentUser?.id
  );
  const sentRequests = allPendingRequests.filter(
    (r: Connection) => r.requester_id === currentUser?.id
  );

  const suggestions = suggestionsData?.suggestions || [];

  // Respond to connection request
  const respondMutation = useMutation({
    mutationFn: ({ requestId, accept }: { requestId: string; accept: boolean }) =>
      backendApi.connections.respondToRequest(requestId, accept),
    onSuccess: (_, variables) => {
      toast({
        title: variables.accept ? "Connection accepted!" : "Request declined",
      });
      queryClient.invalidateQueries({ queryKey: ['connections'] });
    },
    onError: () => {
      toast({ title: "Failed to respond", variant: "destructive" });
    },
  });

  // Send connection request
  const sendRequestMutation = useMutation({
    mutationFn: (userId: string) => backendApi.connections.sendRequest(userId),
    onSuccess: () => {
      toast({ title: "Connection request sent!" });
      queryClient.invalidateQueries({ queryKey: ['connectionSuggestions'] });
    },
    onError: () => {
      toast({ title: "Failed to send request", variant: "destructive" });
    },
  });

  // Remove connection
  const removeMutation = useMutation({
    mutationFn: (userId: string) => backendApi.connections.removeConnection(userId),
    onSuccess: () => {
      toast({ title: "Connection removed" });
      queryClient.invalidateQueries({ queryKey: ['connections'] });
    },
    onError: () => {
      toast({ title: "Failed to remove connection", variant: "destructive" });
    },
  });

  // Filter connections based on search
  const filteredConnections = connections.filter((conn) =>
    `${conn.user?.first_name} ${conn.user?.last_name} ${conn.user?.username}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl font-bold">My Network</h1>
          <p className="text-muted-foreground mt-1">
            Manage your professional connections
          </p>
        </motion.div>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search connections..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </motion.div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-3xl grid-cols-5">
            <TabsTrigger value="connections" className="flex items-center gap-1 text-xs sm:text-sm px-1 sm:px-3">
              <UserCheck className="w-4 h-4 hidden sm:block" />
              Connections ({connections.length})
            </TabsTrigger>
            <TabsTrigger value="followers" className="flex items-center gap-1 text-xs sm:text-sm px-1 sm:px-3">
              <Heart className="w-4 h-4 hidden sm:block" />
              Followers ({followers.length})
            </TabsTrigger>
            <TabsTrigger value="following" className="flex items-center gap-1 text-xs sm:text-sm px-1 sm:px-3">
              <Users className="w-4 h-4 hidden sm:block" />
              Following ({following.length})
            </TabsTrigger>
            <TabsTrigger value="requests" className="flex items-center gap-1 text-xs sm:text-sm px-1 sm:px-3">
              <Clock className="w-4 h-4 hidden sm:block" />
              Requests ({allPendingRequests.length})
            </TabsTrigger>
            <TabsTrigger value="suggestions" className="flex items-center gap-1 text-xs sm:text-sm px-1 sm:px-3">
              <UserPlus className="w-4 h-4 hidden sm:block" />
              Suggestions
            </TabsTrigger>
          </TabsList>

          {/* Connections Tab */}
          <TabsContent value="connections" className="mt-6">
            {loadingConnections ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredConnections.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-semibold">No connections yet</p>
                <p className="text-muted-foreground mt-2">
                  Start building your network by connecting with others!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredConnections.map((connection, index: number) => (
                  <motion.div
                    key={connection.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="p-4">
                      <div className="flex items-start gap-3">
                        <Link to={`/profile/${connection.user?.id}`}>
                          <UserAvatar
                            src={connection.user?.avatar_url}
                            name={`${connection.user?.first_name} ${connection.user?.last_name}`}
                            size="md"
                          />
                        </Link>
                        <div className="flex-1 min-w-0">
                          <Link to={`/profile/${connection.user?.id}`}>
                            <h4 className="font-semibold hover:text-primary truncate">
                              {connection.user?.first_name} {connection.user?.last_name}
                            </h4>
                          </Link>
                          {connection.user?.username && (
                            <p className="text-sm text-muted-foreground">
                              @{connection.user.username}
                            </p>
                          )}
                          {connection.user?.headline && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {connection.user.headline}
                            </p>
                          )}
                          <div className="flex gap-2 mt-3">
                            <Link to={`/messages/${connection.user?.id}`}>
                              <Button size="sm" variant="outline">
                                <MessageSquare className="w-4 h-4 mr-2" />
                                Message
                              </Button>
                            </Link>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeMutation.mutate(connection.id)}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Followers Tab */}
          <TabsContent value="followers" className="mt-6">
            {loadingFollowers ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : followers.length === 0 ? (
              <div className="text-center py-12">
                <Heart className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-semibold">No followers yet</p>
                <p className="text-muted-foreground mt-2">
                  When people follow you, they'll appear here
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {followers.map((follower, index) => (
                  <motion.div
                    key={follower.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="p-4">
                      <div className="flex items-start gap-3">
                        <Link to={`/profile/${follower.id}`}>
                          <UserAvatar
                            src={follower.avatar_url}
                            name={`${follower.first_name} ${follower.last_name}`}
                            size="md"
                          />
                        </Link>
                        <div className="flex-1 min-w-0">
                          <Link to={`/profile/${follower.id}`}>
                            <h4 className="font-semibold hover:text-primary truncate">
                              {follower.first_name} {follower.last_name}
                            </h4>
                          </Link>
                          {follower.username && (
                            <p className="text-sm text-muted-foreground">@{follower.username}</p>
                          )}
                          {follower.headline && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {follower.headline}
                            </p>
                          )}
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Following Tab */}
          <TabsContent value="following" className="mt-6">
            {loadingFollowing ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : following.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-semibold">Not following anyone</p>
                <p className="text-muted-foreground mt-2">
                  Follow people to see their content in your feed
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {following.map((person, index) => (
                  <motion.div
                    key={person.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="p-4">
                      <div className="flex items-start gap-3">
                        <Link to={`/profile/${person.id}`}>
                          <UserAvatar
                            src={person.avatar_url}
                            name={`${person.first_name} ${person.last_name}`}
                            size="md"
                          />
                        </Link>
                        <div className="flex-1 min-w-0">
                          <Link to={`/profile/${person.id}`}>
                            <h4 className="font-semibold hover:text-primary truncate">
                              {person.first_name} {person.last_name}
                            </h4>
                          </Link>
                          {person.username && (
                            <p className="text-sm text-muted-foreground">@{person.username}</p>
                          )}
                          {person.headline && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {person.headline}
                            </p>
                          )}
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Requests Tab */}
          <TabsContent value="requests" className="mt-6">
            {loadingRequests ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : allPendingRequests.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-semibold">No pending requests</p>
                <p className="text-muted-foreground mt-2">
                  You'll see connection requests here
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Received requests */}
                {receivedRequests.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                      Received ({receivedRequests.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {receivedRequests.map((request, index: number) => (
                        <motion.div
                          key={request.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                        >
                          <Card className="p-4">
                            <div className="flex items-start gap-3">
                              <Link to={`/profile/${request.user?.id}`}>
                                <UserAvatar
                                  src={request.user?.avatar_url}
                                  name={`${request.user?.first_name} ${request.user?.last_name}`}
                                  size="md"
                                />
                              </Link>
                              <div className="flex-1 min-w-0">
                                <Link to={`/profile/${request.user?.id}`}>
                                  <h4 className="font-semibold hover:text-primary truncate">
                                    {request.user?.first_name} {request.user?.last_name}
                                  </h4>
                                </Link>
                                {request.user?.username && (
                                  <p className="text-sm text-muted-foreground">
                                    @{request.user.username}
                                  </p>
                                )}
                                {request.user?.headline && (
                                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                    {request.user.headline}
                                  </p>
                                )}
                                <div className="flex gap-2 mt-3">
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      respondMutation.mutate({ requestId: request.id, accept: true })
                                    }
                                    disabled={respondMutation.isPending}
                                  >
                                    <Check className="w-4 h-4 mr-2" />
                                    Accept
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      respondMutation.mutate({ requestId: request.id, accept: false })
                                    }
                                    disabled={respondMutation.isPending}
                                  >
                                    <X className="w-4 h-4 mr-2" />
                                    Decline
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </Card>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sent requests */}
                {sentRequests.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                      Sent ({sentRequests.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {sentRequests.map((request, index: number) => (
                        <motion.div
                          key={request.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                        >
                          <Card className="p-4">
                            <div className="flex items-start gap-3">
                              <Link to={`/profile/${request.user?.id}`}>
                                <UserAvatar
                                  src={request.user?.avatar_url}
                                  name={`${request.user?.first_name} ${request.user?.last_name}`}
                                  size="md"
                                />
                              </Link>
                              <div className="flex-1 min-w-0">
                                <Link to={`/profile/${request.user?.id}`}>
                                  <h4 className="font-semibold hover:text-primary truncate">
                                    {request.user?.first_name} {request.user?.last_name}
                                  </h4>
                                </Link>
                                {request.user?.username && (
                                  <p className="text-sm text-muted-foreground">
                                    @{request.user.username}
                                  </p>
                                )}
                                {request.user?.headline && (
                                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                    {request.user.headline}
                                  </p>
                                )}
                                <div className="flex gap-2 mt-3">
                                  <span className="text-xs text-muted-foreground flex items-center gap-1 mr-2">
                                    <Clock className="w-3 h-3" />
                                    Pending
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => removeMutation.mutate(request.id)}
                                    disabled={removeMutation.isPending}
                                  >
                                    <X className="w-4 h-4 mr-2" />
                                    Withdraw
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </Card>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* Suggestions Tab */}
          <TabsContent value="suggestions" className="mt-6">
            {loadingSuggestions ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : suggestions.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-semibold">No suggestions available</p>
                <p className="text-muted-foreground mt-2">
                  Check back later for connection suggestions
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {suggestions.map((suggestion, index: number) => (
                  <motion.div
                    key={suggestion.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="p-4">
                      <div className="flex items-start gap-3">
                        <Link to={`/profile/${suggestion.id}`}>
                          <UserAvatar
                            src={suggestion.avatar_url}
                            name={`${suggestion.first_name} ${suggestion.last_name}`}
                            size="md"
                          />
                        </Link>
                        <div className="flex-1 min-w-0">
                          <Link to={`/profile/${suggestion.id}`}>
                            <h4 className="font-semibold hover:text-primary truncate">
                              {suggestion.first_name} {suggestion.last_name}
                            </h4>
                          </Link>
                          {suggestion.username && (
                            <p className="text-sm text-muted-foreground">
                              @{suggestion.username}
                            </p>
                          )}
                          {suggestion.headline && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {suggestion.headline}
                            </p>
                          )}
                          <Button
                            size="sm"
                            className="mt-3"
                            onClick={() => sendRequestMutation.mutate(suggestion.id)}
                            disabled={sendRequestMutation.isPending}
                          >
                            <UserPlus className="w-4 h-4 mr-2" />
                            Connect
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default NetworkNew;
