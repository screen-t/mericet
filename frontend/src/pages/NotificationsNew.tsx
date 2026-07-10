import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { backendApi } from "@/lib/backend-api";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { Notification, NotificationsResponse } from '@/types/api';
import {
  Heart,
  MessageCircle,
  UserPlus,
  Share2,
  Bell,
  Check,
  Loader2,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const notificationIcons = {
  like: Heart,
  comment: MessageCircle,
  connection_request: UserPlus,
  connection_accepted: UserPlus,
  repost: Share2,
  mention: Bell,
  follow: UserPlus,
};

const NotificationsNew = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("all");

  // Fetch notifications
  const { data: notificationsData, isLoading } = useQuery<NotificationsResponse>({
    queryKey: ['notifications', activeTab === 'unread'],
    queryFn: () => backendApi.notifications.getNotifications(100, 0, activeTab === 'unread'),
    refetchInterval: 15000, // Refetch every 15 seconds
  });

  // Fetch unread count
  const { data: unreadData } = useQuery({
    queryKey: ['unreadNotifications'],
    queryFn: () => backendApi.notifications.getUnreadCount(),
    refetchInterval: 15000,
  });

  const notifications = notificationsData?.notifications || [];
  const unreadCount = unreadData?.count || 0;

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: (notificationId: string) =>
      backendApi.notifications.markAsRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unreadNotifications'] });
    },
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: () => backendApi.notifications.markAllAsRead(),
    onSuccess: () => {
      toast({ title: "All notifications marked as read" });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unreadNotifications'] });
    },
    onError: () => {
      toast({ title: "Failed to mark all as read", variant: "destructive" });
    },
  });

  // Delete notification mutation
  const deleteMutation = useMutation({
    mutationFn: (notificationId: string) =>
      backendApi.notifications.deleteNotification(notificationId),
    onSuccess: () => {
      toast({ title: "Notification deleted" });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: () => {
      toast({ title: "Failed to delete", variant: "destructive" });
    },
  });

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      markAsReadMutation.mutate(notification.id);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const ts =
        timestamp.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(timestamp)
          ? timestamp
          : timestamp + 'Z';
      return formatDistanceToNow(new Date(ts), { addSuffix: true });
    } catch {
      return 'recently';
    }
  };

  const getNotificationLink = (notification: Notification) => {
    switch (notification.type) {
      case 'like':
      case 'comment':
      case 'repost':
      case 'mention':
        return notification.post_id ? `/post/${notification.post_id}` : '#';
      case 'connection_request':
      case 'connection_accepted':
      case 'follow':
        return notification.actor_id ? `/profile/${notification.actor_id}` : '#';
      default:
        return notification.link || '#';
    }
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-3xl font-bold">Notifications</h1>
            {unreadCount > 0 && (
              <p className="text-muted-foreground mt-1">
                {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              onClick={() => markAllAsReadMutation.mutate()}
              disabled={markAllAsReadMutation.isPending}
              variant="outline"
            >
              <Check className="w-4 h-4 mr-2" />
              Mark all as read
            </Button>
          )}
        </motion.div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="all" className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              All
            </TabsTrigger>
            <TabsTrigger value="unread" className="flex items-center gap-2">
              <Bell className="w-4 h-4 fill-current" />
              Unread ({unreadCount})
            </TabsTrigger>
          </TabsList>

          {/* Notifications List */}
          <TabsContent value={activeTab} className="mt-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-12">
                <Bell className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-semibold">No notifications</p>
                <p className="text-muted-foreground mt-2">
                  {activeTab === 'unread'
                    ? "You're all caught up!"
                    : "New notifications will appear here"}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {notifications.map((notification, index: number) => {
                  const Icon = notificationIcons[notification.type as keyof typeof notificationIcons] || Bell;
                  
                  return (
                    <motion.div
                      key={notification.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Link
                        to={getNotificationLink(notification)}
                        onClick={() => handleNotificationClick(notification)}
                        className={cn(
                          "block p-4 rounded-lg border transition-colors group",
                          !notification.is_read
                            ? "bg-primary/5 border-primary/20 hover:bg-primary/10"
                            : "hover:bg-muted"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className="relative">
                            <UserAvatar
                              src={notification.actor?.avatar_url}
                              name={`${notification.actor?.first_name} ${notification.actor?.last_name}`}
                              size="md"
                            />
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-background rounded-full flex items-center justify-center">
                              <Icon className="w-3 h-3 text-primary" />
                            </div>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <p className="text-sm">
                                  <span className="font-semibold">
                                    {notification.actor?.first_name}{" "}
                                    {notification.actor?.last_name}
                                  </span>{" "}
                                  <span className="text-muted-foreground">
                                    {notification.message}
                                  </span>
                                </p>
                                {notification.post_preview && (
                                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                    "{notification.post_preview}"
                                  </p>
                                )}
                                <p className="text-xs text-muted-foreground mt-1">
                                  {formatTimestamp(notification.created_at)}
                                </p>
                              </div>

                              <div className="flex items-center gap-2">
                                {!notification.is_read && (
                                  <div className="w-2 h-2 bg-primary rounded-full" />
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    deleteMutation.mutate(notification.id);
                                  }}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default NotificationsNew;
