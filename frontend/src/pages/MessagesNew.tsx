import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { backendApi } from "@/lib/backend-api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { formatDistanceToNow } from "date-fns";
import { ConversationsResponse, MessagesResponse, User } from '@/types/api';
import {
  Search,
  Send,
  Paperclip,
  MoreVertical,
  Loader2,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MessagesNew = () => {
  const { userId } = useParams<{ userId?: string }>();
  const navigate = useNavigate();   
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [messageText, setMessageText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch conversations list
  const { data: conversationsData, isLoading: loadingConversations } = useQuery<ConversationsResponse>({
    queryKey: ['conversations'],
    queryFn: () => backendApi.messages.getConversations(100, 0),
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  // Fetch messages for selected conversation
  const { data: messagesData, isLoading: loadingMessages } = useQuery<MessagesResponse>({
    queryKey: ['messages', userId],
    queryFn: () => backendApi.messages.getMessages(userId!, 100, 0),
    enabled: !!userId,
    refetchInterval: 5000, // Poll for new messages every 5 seconds
  });

  // Fetch unread count
  const { data: unreadData } = useQuery({
    queryKey: ['unreadMessages'],
    queryFn: () => backendApi.messages.getUnreadCount(),
    refetchInterval: 15000,
  });

  const conversations = conversationsData?.conversations || [];
  // Backend returns messages newest-first; reverse so oldest is at top
  const messages = [...(messagesData?.messages || [])].reverse();

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: ({ recipientId, content }: { recipientId: string; content: string }) =>
      backendApi.messages.sendMessage(recipientId, content),
    onSuccess: () => {
      setMessageText("");
      queryClient.invalidateQueries({ queryKey: ['messages', userId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      scrollToBottom();
    },
    onError: () => {
      toast({ title: "Failed to send message", variant: "destructive" });
    },
  });

  // Mark as read mutation — use per-message endpoint
  const markAsReadMutation = useMutation({
    mutationFn: (messageId: string) => backendApi.messages.markAsRead(messageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unreadMessages'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  // Also mark the whole conversation as read when opening it
  useEffect(() => {
    if (userId && messagesData?.messages?.length) {
      backendApi.messages.markConversationAsRead(userId);
    }
  }, [userId, messagesData?.messages?.length]);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageText.trim() && userId) {
      sendMessageMutation.mutate({
        recipientId: userId,
        content: messageText.trim(),
      });
    }
  };

  const handleSelectConversation = (convUserId: string) => {
    navigate(`/messages/${convUserId}`);
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      // Append Z so JS treats it as UTC, not local time
      const ts =
        timestamp.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(timestamp)
          ? timestamp
          : timestamp + "Z";
      return formatDistanceToNow(new Date(ts), { addSuffix: true });
    } catch {
      return "recently";
    }
  };

  // Filter conversations by search
  const filteredConversations = conversations.filter((conv: any) =>
    `${conv.user?.first_name} ${conv.user?.last_name}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  // Get current conversation user details
  const currentConversation = conversations.find((conv: any) => conv.user?.id === userId);
  const otherUserFromConversations = currentConversation?.user;

  // If userId is set but not in conversations yet (new conversation), fetch their profile
  const { data: newConvProfile } = useQuery<User>({
    queryKey: ['profile', userId],
    queryFn: () => backendApi.profile.getProfile(userId!) as Promise<User>,
    enabled: !!userId && !otherUserFromConversations,
  });

  const otherUser = otherUserFromConversations || newConvProfile;

  return (
    <AppLayout>
      <div className="h-[calc(100vh-4rem)] flex">
        {/* Conversations List */}
        <div className="w-80 border-r bg-card flex flex-col">
          {/* Header */}
          <div className="p-4 border-b">
            <h2 className="text-xl font-bold mb-3">Messages</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Conversations */}
          <ScrollArea className="flex-1">
            {loadingConversations ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="text-center py-12 px-4">
                <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">
                  No conversations yet
                </p>
              </div>
            ) : (
              <div>
                {filteredConversations.map((conversation: any) => (
                  <motion.button
                    key={conversation.id}
                    onClick={() => handleSelectConversation(conversation.user?.id)}
                    className={cn(
                      "w-full p-4 border-b hover:bg-muted/50 transition-colors text-left",
                      userId === conversation.user?.id && "bg-muted"
                    )}
                    whileHover={{ x: 4 }}
                  >
                    <div className="flex items-start gap-3">
                      <UserAvatar
                        src={conversation.user?.avatar_url}
                        name={`${conversation.user?.first_name} ${conversation.user?.last_name}`}
                        size="md"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-semibold truncate">
                            {conversation.user?.first_name}{" "}
                            {conversation.user?.last_name}
                          </h4>
                          <span className="text-xs text-muted-foreground">
                            {conversation.last_message?.created_at
                              ? formatTimestamp(conversation.last_message.created_at)
                              : ""}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {conversation.last_message?.content || "No messages yet"}
                        </p>
                        {conversation.unread_count > 0 && (
                          <div className="mt-1">
                            <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-white bg-primary rounded-full">
                              {conversation.unread_count}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Messages Thread */}
        <div className="flex-1 flex flex-col">
          {userId && otherUser ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b bg-card flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <UserAvatar
                    src={otherUser.avatar_url}
                    name={`${otherUser.first_name} ${otherUser.last_name}`}
                    size="md"
                  />
                  <div>
                    <h3 className="font-semibold">
                      {otherUser.first_name} {otherUser.last_name}
                    </h3>
                    {otherUser.headline && (
                      <p className="text-sm text-muted-foreground">
                        {otherUser.headline}
                      </p>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="w-5 h-5" />
                </Button>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                {loadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No messages yet</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Start a conversation!
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message: any, index: number) => {
                      const isMyMessage = message.sender_id === user?.id;
                      const showAvatar =
                        index === 0 ||
                        messages[index - 1].sender_id !== message.sender_id;

                      return (
                        <motion.div
                          key={message.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.02 }}
                          className={cn(
                            "flex gap-2",
                            isMyMessage ? "justify-end" : "justify-start"
                          )}
                        >
                          {!isMyMessage && (
                            <div className="w-8">
                              {showAvatar && (
                                <UserAvatar
                                  src={otherUser.avatar_url}
                                  name={otherUser.first_name}
                                  size="sm"
                                />
                              )}
                            </div>
                          )}
                          <div
                            className={cn(
                              "max-w-md p-3 rounded-lg",
                              isMyMessage
                                ? "bg-gradient-primary text-white"
                                : "bg-muted"
                            )}
                          >
                            <p className="text-sm">{message.content}</p>
                            <p
                              className={cn(
                                "text-xs mt-1",
                                isMyMessage
                                  ? "text-white/70"
                                  : "text-muted-foreground"
                              )}
                            >
                              {formatTimestamp(message.created_at)}
                            </p>
                          </div>
                        </motion.div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              {/* Message Input */}
              <div className="p-4 border-t bg-card">
                <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                  <Button type="button" variant="ghost" size="icon">
                    <Paperclip className="w-5 h-5" />
                  </Button>
                  <Input
                    placeholder="Type a message..."
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    type="submit"
                    disabled={!messageText.trim() || sendMessageMutation.isPending}
                  >
                    <Send className="w-5 h-5" />
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <MessageSquare className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-semibold">Select a conversation</p>
                <p className="text-muted-foreground mt-2">
                  Choose from your existing conversations or start a new one
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default MessagesNew;
