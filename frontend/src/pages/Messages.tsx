import { useState } from "react";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  Send,
  Paperclip,
  MoreVertical,
  Phone,
  Video,
  Smile,
  Image,
  Check,
  CheckCheck,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Conversation { 
  id: string;
  user: {
    name: string;
    avatar: string;
    isOnline: boolean;
  };
  lastMessage: string;
  timestamp: string;
  unread: number;
}

interface Message {
  id: string;
  content: string;
  sender: "me" | "other";
  timestamp: string;
  isRead?: boolean;
}

const conversations: Conversation[] = [
  {
    id: "1",
    user: {
      name: "Sarah Chen",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100",
      isOnline: true,
    },
    lastMessage: "That sounds great! Let's schedule a call.",
    timestamp: "2m ago",
    unread: 2,
  },
  {
    id: "2",
    user: {
      name: "Marcus Johnson",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100",
      isOnline: false,
    },
    lastMessage: "Thanks for the introduction!",
    timestamp: "1h ago",
    unread: 0,
  },
  {
    id: "3",
    user: {
      name: "Emily Rodriguez",
      avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100",
      isOnline: true,
    },
    lastMessage: "The proposal looks good to me.",
    timestamp: "3h ago",
    unread: 0,
  },
  {
    id: "4",
    user: {
      name: "Alex Kim",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100",
      isOnline: false,
    },
    lastMessage: "Let me check with my team.",
    timestamp: "1d ago",
    unread: 0,
  },
];

const messages: Message[] = [
  {
    id: "1",
    content: "Hi Sarah! I saw your post about the Series B funding. Congratulations!",
    sender: "me",
    timestamp: "10:30 AM",
    isRead: true,
  },
  {
    id: "2",
    content: "Thank you so much! It's been an incredible journey. We're really excited about what's next.",
    sender: "other",
    timestamp: "10:32 AM",
    isRead: true,
  },
  {
    id: "3",
    content: "I'd love to learn more about your expansion plans. Would you have time for a quick call this week?",
    sender: "me",
    timestamp: "10:35 AM",
    isRead: true,
  },
  {
    id: "4",
    content: "That sounds great! Let's schedule a call. How about Thursday at 2pm?",
    sender: "other",
    timestamp: "10:38 AM",
    isRead: false,
  },
];

const Messages = () => {
  const [selectedConversation, setSelectedConversation] = useState(conversations[0]);
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showChat, setShowChat] = useState(false); // mobile: toggle list/chat

  const handleSelectConversation = (conv: Conversation) => {
    setSelectedConversation(conv);
    setShowChat(true);
  };

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    // Handle send message
    setNewMessage("");
  };

  return (
    <AppLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-xl border border-border overflow-hidden h-[calc(100vh-10rem)]"
      >
        <div className="flex h-full">
          {/* Conversation List — always visible on desktop; hidden on mobile when chat is open */}
          <div className={cn(
            "border-r border-border flex flex-col",
            "w-full md:w-80 md:flex",
            showChat ? "hidden md:flex" : "flex"
          )}>
            <div className="p-4 border-b border-border">
              <h2 className="font-semibold text-lg mb-3">Messages</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search messages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2">
                {conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv)}
                    className={cn(
                      "w-full flex items-start gap-3 p-3 rounded-lg transition-colors text-left",
                      selectedConversation.id === conv.id
                        ? "bg-primary/10"
                        : "hover:bg-secondary"
                    )}
                  >
                    <UserAvatar
                      name={conv.user.name}
                      src={conv.user.avatar}
                      size="md"
                      showStatus
                      isOnline={conv.user.isOnline}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium truncate">{conv.user.name}</p>
                        <span className="text-xs text-muted-foreground">
                          {conv.timestamp}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {conv.lastMessage}
                      </p>
                    </div>
                    {conv.unread > 0 && (
                      <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                        {conv.unread}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Chat Area — always visible on desktop; shown on mobile only when a conversation is selected */}
          <div className={cn(
            "flex-1 flex flex-col",
            showChat ? "flex" : "hidden md:flex"
          )}>
            {/* Chat Header */}
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Back button — mobile only */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden -ml-1"
                  onClick={() => setShowChat(false)}
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <UserAvatar
                  name={selectedConversation.user.name}
                  src={selectedConversation.user.avatar}
                  size="md"
                  showStatus
                  isOnline={selectedConversation.user.isOnline}
                />
                <div>
                  <p className="font-semibold">{selectedConversation.user.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedConversation.user.isOnline ? "Online" : "Offline"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="hidden sm:inline-flex">
                  <Phone className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="hidden sm:inline-flex">
                  <Video className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex",
                      message.sender === "me" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[70%] rounded-2xl px-4 py-2",
                        message.sender === "me"
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-secondary text-secondary-foreground rounded-bl-sm"
                      )}
                    >
                      <p>{message.content}</p>
                      <div className="flex items-center gap-2 justify-end mt-1">
                        <p
                          className={cn(
                            "text-xs",
                            message.sender === "me"
                              ? "text-primary-foreground/70"
                              : "text-muted-foreground"
                          )}
                        >
                          {message.timestamp}
                        </p>
                        {message.sender === "me" && (
                          <span title={message.isRead ? "Read" : "Delivered"}>
                            {message.isRead ? (
                              <CheckCheck className="h-3 w-3 text-primary-foreground/70" />
                            ) : (
                              <Check className="h-3 w-3 text-primary-foreground/70" />
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t border-border">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon">
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon">
                  <Image className="h-4 w-4" />
                </Button>
                <Input
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSendMessage();
                  }}
                  className="flex-1"
                />
                <Button variant="ghost" size="icon">
                  <Smile className="h-4 w-4" />
                </Button>
                <Button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                  size="icon"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AppLayout>
  );
};

export default Messages;
