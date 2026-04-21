import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { backendApi } from "@/lib/backend-api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { formatDistanceToNow } from "date-fns";
import { ConversationsResponse, MessagesResponse, User, MessageReaction } from '@/types/api';
import {
  Search,
  Send,
  Paperclip,
  Loader2,
  MessageSquare,
  ArrowLeft,
  MoreVertical,
  Check,
  X,
  Smile,
  Pin,
  PinOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

const EDIT_WINDOW_MINUTES = 15;
const MAX_MESSAGE_EDITS = 3;

type ConfirmAction =
  | { type: "delete-message"; messageId: string }
  | { type: "delete-conversation" }
  | null;

const MessagesNew = () => {
  const { userId } = useParams<{ userId?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [messageText, setMessageText] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [reactionPickerMessageId, setReactionPickerMessageId] = useState<string | null>(null);
  const [pickerCategory, setPickerCategory] = useState("Quick");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);

  const QUICK_EMOJIS = ["👍", "❤️", "😂", "😢", "😮", "🔥"];

  const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
    { label: "Quick", emojis: ["👍", "❤️", "😂", "😢", "😮", "🔥", "🎉", "👏"] },
    { label: "Smileys", emojis: ["😀", "😃", "😄", "😁", "😅", "😆", "🤣", "😊", "😇", "🥰", "😍", "🤩", "😘", "😗", "😚", "🤭", "😋", "😛", "😜", "🤪", "🤔", "😐", "😑", "😶", "😏", "😒", "🙄", "😬", "🤥", "😌", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕", "🤢", "🤮", "🤧", "🥵", "🥶", "🥴", "😵", "🤯", "🤠", "🤸", "😎", "🤓", "🧐", "😕", "😟", "🙁", "☹️", "😮", "😯", "😲", "😳", "🥺", "😦", "😧", "😨", "😰", "😥", "😢", "😭", "😱", "😖", "😣", "😞", "😓", "😩", "😫", "😤", "😡", "😠", "🤬", "😈", "👿"] },
    { label: "Gestures", emojis: ["👍", "👎", "👌", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "☝️", "👆", "👇", "✋", "🖐️", "👋", "🤚", "👏", "🙌", "🫲", "🤲", "🙏", "💪", "🦵", "✍️"] },
    { label: "Hearts", emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❤️‍🔥", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟"] },
    { label: "Fun", emojis: ["🔥", "💯", "✨", "🎉", "🎊", "🎁", "🎈", "💡", "💎", "👑", "🏆", "🥇", "🎯", "🚀", "💫", "⚡", "💥", "👀", "🤭", "💀", "👻", "👽", "🐲", "🦄", "🌈", "🪄", "🛡️", "💣", "🎸", "🎶", "📸", "⚽", "🎲", "🥊"] },
  ];

  const groupReactions = (reactions: MessageReaction[]) => {
    const groups: Record<string, { count: number; hasReacted: boolean }> = {};
    for (const r of reactions) {
      if (!groups[r.emoji]) groups[r.emoji] = { count: 0, hasReacted: false };
      groups[r.emoji].count++;
      if (r.user_id === user?.id) groups[r.emoji].hasReacted = true;
    }
    return Object.entries(groups).map(([emoji, data]) => ({ emoji, ...data }));
  };

  const getConversationUserId = (conversation: {
    user?: { id?: string };
    participants?: Array<{ id?: string }>;
  }): string | null => {
    if (conversation.user?.id) return conversation.user.id;
    const fromParticipants = conversation.participants?.find((p) => p.id && p.id !== user?.id)?.id;
    return fromParticipants || null;
  };

  const getConversationDisplayUser = (conversation: {
    user?: {
      id?: string;
      first_name?: string;
      last_name?: string;
      avatar_url?: string;
      headline?: string;
    };
    participants?: Array<{
      id?: string;
      first_name?: string;
      last_name?: string;
      avatar_url?: string;
      headline?: string;
    }>;
  }) => {
    if (conversation.user?.id) return conversation.user;
    return conversation.participants?.find((p) => p.id && p.id !== user?.id) || null;
  };

  // Fetch conversations list
  const { data: conversationsData, isLoading: loadingConversations } = useQuery<ConversationsResponse>({
    queryKey: ['conversations'],
    queryFn: () => backendApi.messages.getConversations(100, 0),
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  const conversations = conversationsData?.conversations || [];

  // Fetch messages for selected conversation
  const selectedConversation = conversations.find((conv) => getConversationUserId(conv) === userId);
  const selectedConversationId = selectedConversation?.id;

  const { data: messagesData, isLoading: loadingMessages } = useQuery<MessagesResponse>({
    queryKey: ['messages', userId],
    queryFn: () => backendApi.messages.getMessagesByConversationId(selectedConversationId!, 100, 0),
    enabled: !!selectedConversationId,
    refetchInterval: 5000, // Poll for new messages every 5 seconds
  });

  // Fetch unread count
  const { data: unreadData } = useQuery({
    queryKey: ['unreadMessages'],
    queryFn: () => backendApi.messages.getUnreadCount(),
    refetchInterval: 15000,
  });

  // Backend returns messages newest-first; reverse so oldest is at top
  const messages = [...(messagesData?.messages || [])].reverse();

  const conversationUserIdFor = (conversation: { user?: { id?: string }; participants?: Array<{ id?: string }> }) =>
    getConversationUserId(conversation);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: ({ recipientId, content }: { recipientId: string; content: string; tempId?: string }) =>
      backendApi.messages.sendMessage(recipientId, content),
    onMutate: async ({ recipientId, content, tempId }) => {
      await queryClient.cancelQueries({ queryKey: ['messages', recipientId] });
      await queryClient.cancelQueries({ queryKey: ['conversations'] });

      const optimisticId = tempId || `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const optimisticMessage = {
        id: optimisticId,
        sender_id: user?.id || '',
        content,
        is_read: false,
        created_at: new Date().toISOString(),
        edited_at: null,
        edit_count: 0,
        sender: user,
      };

      queryClient.setQueryData<MessagesResponse>(['messages', recipientId], (old) => ({
        messages: [optimisticMessage, ...((old?.messages || []))],
      }));

      queryClient.setQueryData<ConversationsResponse>(['conversations'], (old) => {
        if (!old?.conversations) return old;
        const updated = old.conversations.map((conv) => {
          if (conversationUserIdFor(conv) !== recipientId) return conv;
          return {
            ...conv,
            last_message: {
              ...(conv.last_message || {}),
              id: conv.last_message?.id || optimisticId,
              sender_id: conv.last_message?.sender_id || user?.id || "",
              content,
              is_read: false,
              created_at: optimisticMessage.created_at,
            } as import('@/types/api').Message,
          };
        });
        return { conversations: updated };
      });

      return { recipientId, tempId: optimisticId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', userId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      scrollToBottom();
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.recipientId && ctx?.tempId) {
        queryClient.setQueryData<MessagesResponse>(['messages', ctx.recipientId], (old) => {
          if (!old?.messages) return old;
          return { messages: old.messages.filter((m) => m.id !== ctx.tempId) };
        });
      }
      toast({ title: "Failed to send message", variant: "destructive" });
    },
  });

  const editMessageMutation = useMutation({
    mutationFn: ({ messageId, content }: { messageId: string; content: string }) =>
      backendApi.messages.editMessage(messageId, content),
    onMutate: async ({ messageId, content }) => {
      if (!userId) return {};
      await queryClient.cancelQueries({ queryKey: ['messages', userId] });

      const previousMessages = queryClient.getQueryData<MessagesResponse>(['messages', userId]);

      queryClient.setQueryData<MessagesResponse>(['messages', userId], (old) => {
        if (!old?.messages) return old;
        return {
          messages: old.messages.map((m) =>
            m.id === messageId
              ? { ...m, content, edited_at: new Date().toISOString(), edit_count: (m.edit_count || 0) + 1 }
              : m,
          ),
        };
      });

      return { previousMessages };
    },
    onSuccess: () => {
      setEditingMessageId(null);
      setEditText("");
      queryClient.invalidateQueries({ queryKey: ['messages', userId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previousMessages && userId) {
        queryClient.setQueryData(['messages', userId], ctx.previousMessages);
      }
      toast({ title: "Failed to edit message", variant: "destructive" });
    },
  });

  const DELETE_WINDOW_MINUTES = 15;

  const normTs = (ts: string) =>
    ts.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(ts) ? ts : `${ts}Z`;

  const canDeleteForEveryone = (message: { sender_id: string; created_at: string; is_deleted?: boolean }) => {
    if (message.sender_id !== user?.id) return false;
    if (message.is_deleted) return false;
    const elapsed = (Date.now() - new Date(normTs(message.created_at)).getTime()) / 1000;
    return elapsed <= DELETE_WINDOW_MINUTES * 60;
  };

  const canDeleteMessage = (message: { sender_id: string; created_at: string; is_deleted?: boolean }) =>
    message.sender_id === user?.id && !message.is_deleted;

  const deleteMessageMutation = useMutation({
    mutationFn: (messageId: string) => backendApi.messages.deleteMessage(messageId),
    onMutate: async (messageId: string) => {
      if (!userId) return {};
      await queryClient.cancelQueries({ queryKey: ['messages', userId] });
      const previousMessages = queryClient.getQueryData<MessagesResponse>(['messages', userId]);
      queryClient.setQueryData<MessagesResponse>(['messages', userId], (old) => {
        if (!old?.messages) return old;
        return {
          messages: old.messages.map((m) =>
            m.id === messageId ? { ...m, is_deleted: true, content: "" } : m
          ),
        };
      });
      return { previousMessages };
    },
    onSuccess: () => {
      setConfirmAction(null);
      setDeleteTargetId(null);
      queryClient.invalidateQueries({ queryKey: ['messages', userId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (err: unknown, _vars, ctx) => {
      if (ctx?.previousMessages && userId) {
        queryClient.setQueryData(['messages', userId], ctx.previousMessages);
      }
      const detail = (err as { message?: string })?.message || "";
      if (detail.includes("15 minutes")) {
        toast({ title: "Cannot delete", description: "Messages can only be deleted within 15 minutes of sending.", variant: "destructive" });
      } else {
        toast({ title: "Failed to delete message", variant: "destructive" });
      }
    },
  });

  const deleteConversationMutation = useMutation({
    mutationFn: (otherUserId: string) => backendApi.messages.deleteConversation(otherUserId),
    onSuccess: () => {
      setConfirmAction(null);
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['messages', userId] });
      queryClient.invalidateQueries({ queryKey: ['unreadMessages'] });
      navigate('/messages');
    },
    onError: () => {
      toast({ title: "Failed to delete conversation", variant: "destructive" });
    },
  });

  const pinMutation = useMutation({
    mutationFn: (conversationId: string) => backendApi.messages.togglePin(conversationId),
    onMutate: async (conversationId) => {
      await queryClient.cancelQueries({ queryKey: ['conversations'] });
      queryClient.setQueryData<ConversationsResponse>(['conversations'], (old) => {
        if (!old?.conversations) return old;
        return {
          conversations: old.conversations
            .map((c) => c.id === conversationId ? { ...c, is_pinned: !c.is_pinned } : c)
            .sort((a, b) => {
              if (a.is_pinned === b.is_pinned) return 0;
              return a.is_pinned ? -1 : 1;
            }),
        };
      });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast({ title: "Failed to update pin", variant: "destructive" });
    },
  });

  const reactionMutation = useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      backendApi.messages.toggleReaction(messageId, emoji),
    onMutate: async ({ messageId, emoji }) => {
      if (!userId) return;
      await queryClient.cancelQueries({ queryKey: ['messages', userId] });
      queryClient.setQueryData<MessagesResponse>(['messages', userId], (old) => {
        if (!old?.messages) return old;
        return {
          messages: old.messages.map((m) => {
            if (m.id !== messageId) return m;
            const existing = (m.reactions || []).find(
              (r) => r.user_id === user?.id && r.emoji === emoji
            );
            const updatedReactions = existing
              ? (m.reactions || []).filter((r) => !(r.user_id === user?.id && r.emoji === emoji))
              : [...(m.reactions || []), { id: `temp-${Date.now()}`, message_id: messageId, user_id: user?.id || "", emoji, created_at: new Date().toISOString() }];
            return { ...m, reactions: updatedReactions };
          }),
        };
      });
      setReactionPickerMessageId(null);
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', userId] });
      toast({ title: "Failed to react", variant: "destructive" });
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
      backendApi.messages.markConversationAsRead(userId).catch(() => {
        // Read-marking is best-effort and should not interrupt chat flow.
      });
    }
  }, [userId, messagesData?.messages?.length]);

  // Guard against malformed URLs like /messages/undefined
  useEffect(() => {
    if (userId === "undefined" || userId === "null") {
      navigate("/messages", { replace: true });
      toast({ title: "Conversation link was invalid", variant: "destructive" });
    }
  }, [userId, navigate, toast]);

  // Auto-scroll to bottom only when new messages arrive (not reaction/edit patches)
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (messages.length > prevMessageCountRef.current) {
      scrollToBottom();
    }
    prevMessageCountRef.current = messages.length;
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const content = messageText.trim();
    if (content && userId) {
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setMessageText("");
      sendMessageMutation.mutate({
        recipientId: userId,
        content,
        tempId,
      });
    }
  };

  const handleSelectConversation = (convUserId?: string | null) => {
    if (!convUserId) {
      toast({ title: "Could not open this conversation", variant: "destructive" });
      return;
    }
    navigate(`/messages/${convUserId}`);
  };

  const startEditingMessage = (messageId: string, content: string) => {
    setEditingMessageId(messageId);
    setEditText(content);
  };

  const saveEditedMessage = () => {
    if (!editingMessageId || !editText.trim()) return;
    editMessageMutation.mutate({ messageId: editingMessageId, content: editText.trim() });
  };

  const handleDeleteForMe = (messageId: string) => {
    if (!userId) return;
    setDeleteTargetId(null);
    queryClient.setQueryData<MessagesResponse>(['messages', userId], (old) => {
      if (!old?.messages) return old;
      return { messages: old.messages.filter((m) => m.id !== messageId) };
    });
  };

  const handleDeleteMessage = (messageId: string) => {
    // Optimistic messages use temporary ids and are not persisted yet.
    // Remove them locally instead of calling backend delete.
    if (messageId.startsWith("temp-")) {
      if (!userId) return;
      queryClient.setQueryData<MessagesResponse>(['messages', userId], (old) => {
        if (!old?.messages) return old;
        return { messages: old.messages.filter((m) => m.id !== messageId) };
      });
      return;
    }
    setDeleteTargetId(messageId);
  };

  const handleDeleteConversation = () => {
    if (!userId) return;
    setConfirmAction({ type: "delete-conversation" });
  };

  const handleConfirmAction = () => {
    if (!confirmAction) return;
    if (confirmAction.type === "delete-message") {
      deleteMessageMutation.mutate(confirmAction.messageId);
      return;
    }
    if (confirmAction.type === "delete-conversation" && userId) {
      deleteConversationMutation.mutate(userId);
    }
  };

  const parseTimestampToMs = (timestamp: string) => {
    const ts = timestamp.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(timestamp)
      ? timestamp
      : `${timestamp}Z`;
    return new Date(ts).getTime();
  };

  const canEditMessage = (message: { sender_id: string; created_at: string; edit_count?: number }, index: number) => {
    if (message.sender_id !== user?.id) return false;

    const createdAtMs = parseTimestampToMs(message.created_at);
    if (Number.isNaN(createdAtMs)) return false;

    const ageMs = Date.now() - createdAtMs;
    if (ageMs > EDIT_WINDOW_MINUTES * 60 * 1000) return false;

    const editCount = message.edit_count || 0;
    if (editCount >= MAX_MESSAGE_EDITS) return false;

    const recipientRepliedAfter = messages
      .slice(index + 1)
      .some((m) => m.sender_id !== user?.id);
    if (recipientRepliedAfter) return false;

    return true;
  };

  const isConfirmOpen = confirmAction !== null;
  const confirmTitle =
    confirmAction?.type === "delete-conversation"
      ? "Delete this conversation?"
      : "Delete this message?";
  const confirmDescription =
    confirmAction?.type === "delete-conversation"
      ? "This will remove this conversation from your inbox."
      : "This action cannot be undone.";
  const confirmLoading =
    deleteMessageMutation.isPending || deleteConversationMutation.isPending;

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
  const filteredConversations = conversations.filter((conv) => {
    const displayUser = getConversationDisplayUser(conv);
    const fullName = `${displayUser?.first_name || ""} ${displayUser?.last_name || ""}`.trim();
    const name = fullName || (displayUser as { username?: string })?.username || "";
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Get current conversation user details
  const currentConversation = selectedConversation;
  const otherUserFromConversations = currentConversation ? getConversationDisplayUser(currentConversation) : null;

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
        {/* Conversations List — full screen on mobile when no chat open, fixed sidebar on desktop */}
        <div className={cn(
          "border-r bg-card flex flex-col",
          "w-full md:w-80",
          userId ? "hidden md:flex" : "flex"
        )}>
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
                {filteredConversations.map((conversation) => (
                  (() => {
                    const conversationUserId = getConversationUserId(conversation);
                    const conversationUser = getConversationDisplayUser(conversation);
                    const conversationUserName = (
                      `${conversationUser?.first_name || ""} ${conversationUser?.last_name || ""}`.trim() ||
                      (conversationUser as { username?: string })?.username ||
                      (conversationUser?.id ? `User ${conversationUser.id.slice(0, 8)}` : "Unknown User")
                    );
                    return (
                  <motion.button
                    key={conversation.id}
                    onClick={() => handleSelectConversation(conversationUserId)}
                    disabled={!conversationUserId}
                    className={cn(
                      "w-full p-4 border-b hover:bg-muted/50 transition-colors text-left group/conv",
                      userId === conversationUserId && "bg-muted",
                      conversation.is_pinned && "bg-primary/5 border-l-2 border-l-primary",
                      !conversationUserId && "opacity-60 cursor-not-allowed"
                    )}
                    whileHover={{ x: 4 }}
                  >
                    <div className="flex items-start gap-3">
                      <UserAvatar
                        src={conversationUser?.avatar_url}
                        name={conversationUserName}
                        size="md"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {conversation.is_pinned && (
                              <Pin className="w-3 h-3 text-primary shrink-0" />
                            )}
                            <h4 className="font-semibold truncate">
                              {conversationUserName}
                            </h4>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={(e) => {
                                e.stopPropagation();
                                pinMutation.mutate(conversation.id);
                              }}
                              onKeyDown={(e) => e.key === "Enter" && pinMutation.mutate(conversation.id)}
                              className="opacity-50 sm:opacity-0 group-hover/conv:opacity-100 transition-opacity p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                              title={conversation.is_pinned ? "Unpin" : "Pin conversation"}
                            >
                              {conversation.is_pinned
                                ? <PinOff className="w-3.5 h-3.5" />
                                : <Pin className="w-3.5 h-3.5" />}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {conversation.last_message?.created_at
                                ? formatTimestamp(conversation.last_message.created_at)
                                : ""}
                            </span>
                          </div>
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
                    );
                  })()
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Messages Thread — full screen on mobile when chat open, flex-1 on desktop */}
        <div className={cn(
          "flex flex-col",
          "flex-1",
          userId ? "flex" : "hidden md:flex"
        )}>
          {userId && otherUser ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b bg-card flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Back button — mobile only */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden -ml-2"
                    onClick={() => navigate("/messages")}
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" title="Conversation actions">
                      <MoreVertical className="w-5 h-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={handleDeleteConversation}
                      disabled={deleteConversationMutation.isPending}
                      className="text-destructive"
                    >
                      Delete conversation
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                {loadingMessages || (userId && loadingConversations && !selectedConversationId) ? (
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
                    {messages.map((message, index: number) => {
                      const isMyMessage = message.sender_id === user?.id;
                      const isOptimisticMessage = message.id.startsWith("temp-");
                      const canEdit = canEditMessage(message, index);
                      const showAvatar =
                        index === 0 ||
                        messages[index - 1].sender_id !== message.sender_id;

                      const reactionGroups = groupReactions(message.reactions || []);

                      return (
                        <motion.div
                          key={message.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.02 }}
                          className={cn(
                            "flex gap-2 group",
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
                          {/* Emoji picker trigger — shown on hover */}
                          {isMyMessage && (
                            <div className="self-end mb-1 opacity-0 group-hover:opacity-100 transition-opacity relative">
                              <Button
                                type="button" size="icon" variant="ghost"
                                className="h-7 w-7 text-muted-foreground"
                                onClick={() => {
                                  setReactionPickerMessageId(reactionPickerMessageId === message.id ? null : message.id);
                                  setPickerCategory("Quick");
                                }}
                              >
                                <Smile className="w-4 h-4" />
                              </Button>
                              {reactionPickerMessageId === message.id && (
                                <div className="fixed sm:absolute bottom-20 sm:bottom-9 left-3 right-3 sm:left-auto sm:right-0 sm:w-64 z-50 bg-card border shadow-xl rounded-xl">
                                  <div className="flex border-b text-xs">
                                    {EMOJI_CATEGORIES.map((cat) => (
                                      <button
                                        key={cat.label}
                                        onClick={() => setPickerCategory(cat.label)}
                                        className={cn("flex-1 py-1.5 font-medium transition-colors", pickerCategory === cat.label ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground")}
                                      >{cat.label}</button>
                                    ))}
                                  </div>
                                  <div className="grid grid-cols-8 gap-0.5 p-2 max-h-36 overflow-y-auto">
                                    {(EMOJI_CATEGORIES.find(c => c.label === pickerCategory)?.emojis || []).map((emoji) => (
                                      <button
                                        key={emoji}
                                        onClick={() => reactionMutation.mutate({ messageId: message.id, emoji })}
                                        className="text-xl hover:scale-125 transition-transform p-0.5 leading-none"
                                      >{emoji}</button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="flex flex-col">
                          <div
                            className={cn(
                              "max-w-md p-3 rounded-lg",
                              isMyMessage
                                ? "bg-gradient-primary text-white"
                                : "bg-muted"
                            )}
                          >
                            {editingMessageId === message.id ? (
                              <div className="space-y-2">
                                <Input
                                  value={editText}
                                  onChange={(e) => setEditText(e.target.value)}
                                  className={cn(
                                    "h-8 text-sm",
                                    isMyMessage
                                      ? "bg-white/20 border-white/30 text-white placeholder:text-white/70"
                                      : "bg-background"
                                  )}
                                />
                                <div className="flex justify-end gap-1">
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7"
                                    onClick={saveEditedMessage}
                                    disabled={!editText.trim() || editMessageMutation.isPending}
                                  >
                                    <Check className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7"
                                    onClick={() => {
                                      setEditingMessageId(null);
                                      setEditText("");
                                    }}
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            ) : message.is_deleted ? (
                              <p className={cn("text-sm italic", isMyMessage ? "text-white/60" : "text-muted-foreground")}>
                                🚫 This message was deleted
                              </p>
                            ) : (
                              <p className="text-sm">{message.content}</p>
                            )}
                            <p
                              className={cn(
                                "text-xs mt-1",
                                isMyMessage
                                  ? "text-white/70"
                                  : "text-muted-foreground"
                              )}
                            >
                              {formatTimestamp(message.created_at)}
                              {message.edited_at && !message.is_deleted ? " • edited" : ""}
                            </p>
                            {isMyMessage && editingMessageId !== message.id && !message.is_deleted &&
                              (canEdit || canDeleteMessage(message)) && (
                              <div className="mt-1 flex justify-end">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7 text-white/80 hover:text-white"
                                      title="Message actions"
                                    >
                                      <MoreVertical className="w-3.5 h-3.5" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" side="top">
                                    {canEdit && !isOptimisticMessage && !message.is_deleted && (
                                      <DropdownMenuItem onClick={() => startEditingMessage(message.id, message.content)}>
                                        Edit message
                                      </DropdownMenuItem>
                                    )}
                                    {canDeleteMessage(message) && !isOptimisticMessage && (
                                      <DropdownMenuItem
                                        onClick={() => setDeleteTargetId(message.id)}
                                        className="text-destructive"
                                      >
                                        Delete message
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            )}
                          </div>

                          {/* Reaction pills */}
                          {reactionGroups.length > 0 && (
                            <div className={cn("flex flex-wrap gap-1 mt-1", isMyMessage ? "justify-end" : "justify-start")}>
                              {reactionGroups.map(({ emoji, count, hasReacted }) => (
                                <button
                                  key={emoji}
                                  onClick={() => reactionMutation.mutate({ messageId: message.id, emoji })}
                                  className={cn(
                                    "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors",
                                    hasReacted
                                      ? "bg-primary/20 border-primary/50 text-primary"
                                      : "bg-muted border-border hover:border-primary/30"
                                  )}
                                >
                                  <span>{emoji}</span>
                                  <span className="font-medium">{count}</span>
                                </button>
                              ))}
                            </div>
                          )}
                          </div>

                          {/* Emoji picker trigger for received messages */}
                          {!isMyMessage && (
                            <div className="self-end mb-1 opacity-0 group-hover:opacity-100 transition-opacity relative">
                              <Button
                                type="button" size="icon" variant="ghost"
                                className="h-7 w-7 text-muted-foreground"
                                onClick={() => {
                                  setReactionPickerMessageId(reactionPickerMessageId === message.id ? null : message.id);
                                  setPickerCategory("Quick");
                                }}
                              >
                                <Smile className="w-4 h-4" />
                              </Button>
                              {reactionPickerMessageId === message.id && (
                                <div className="fixed sm:absolute bottom-20 sm:bottom-9 left-3 right-3 sm:right-auto sm:left-0 sm:w-64 z-50 bg-card border shadow-xl rounded-xl">
                                  <div className="flex border-b text-xs">
                                    {EMOJI_CATEGORIES.map((cat) => (
                                      <button
                                        key={cat.label}
                                        onClick={() => setPickerCategory(cat.label)}
                                        className={cn("flex-1 py-1.5 font-medium transition-colors", pickerCategory === cat.label ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground")}
                                      >{cat.label}</button>
                                    ))}
                                  </div>
                                  <div className="grid grid-cols-8 gap-0.5 p-2 max-h-36 overflow-y-auto">
                                    {(EMOJI_CATEGORIES.find(c => c.label === pickerCategory)?.emojis || []).map((emoji) => (
                                      <button
                                        key={emoji}
                                        onClick={() => reactionMutation.mutate({ messageId: message.id, emoji })}
                                        className="text-xl hover:scale-125 transition-transform p-0.5 leading-none"
                                      >{emoji}</button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
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
                    disabled={!messageText.trim()}
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
      {/* Conversation delete confirm */}
      <ConfirmDialog
        open={confirmAction?.type === "delete-conversation"}
        onOpenChange={(open) => { if (!open) setConfirmAction(null); }}
        title="Delete this conversation?"
        description="This will remove this conversation from your inbox."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmVariant="destructive"
        onConfirm={handleConfirmAction}
        isLoading={deleteConversationMutation.isPending}
      />

      {/* Message delete dialog — Delete for me / Delete for everyone */}
      {(() => {
        const targetMsg = messages.find((m) => m.id === deleteTargetId);
        const canForEveryone = targetMsg ? canDeleteForEveryone(targetMsg) : false;
        const minutesLeft = targetMsg
          ? Math.max(0, Math.ceil(DELETE_WINDOW_MINUTES - (Date.now() - new Date(normTs(targetMsg.created_at)).getTime()) / 60000))
          : 0;
        return (
          <Dialog open={deleteTargetId !== null} onOpenChange={(open) => { if (!open) setDeleteTargetId(null); }}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Delete message?</DialogTitle>
                <DialogDescription>Choose how you want to delete this message.</DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex-col gap-2 sm:flex-col">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => deleteTargetId && handleDeleteForMe(deleteTargetId)}
                >
                  Delete for me
                </Button>
                <Button
                  variant="destructive"
                  className="w-full"
                  disabled={!canForEveryone || deleteMessageMutation.isPending}
                  onClick={() => deleteTargetId && deleteMessageMutation.mutate(deleteTargetId)}
                  title={!canForEveryone ? "Only available within 15 minutes of sending" : undefined}
                >
                  {canForEveryone
                    ? `Delete for everyone (${minutesLeft}m left)`
                    : "Delete for everyone (expired)"}
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => setDeleteTargetId(null)}>
                  Cancel
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })()}
    </AppLayout>
  );
};

export default MessagesNew;
