import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { useAuth } from "@/lib/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { backendApi } from "@/lib/backend-api";
import { CreatePostModalNew } from "@/components/feed/CreatePostModalNew";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Bell,
  MessageSquare,
  Plus,
  Settings,
  LogOut,
  User,
  Menu,
  X,
  Home,
  Users,
  Building2,
  Bookmark,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface NavbarProps {
  isAuthenticated?: boolean;
}

export const Navbar = ({ isAuthenticated = false }: NavbarProps) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const location = useLocation();
  const { logout, user } = useAuth();
  const queryClient = useQueryClient();

  const isLandingPage = location.pathname === "/" && !isAuthenticated;

  // Fetch unread counts
  const { data: messageCount } = useQuery({
    queryKey: ['unreadMessages'],
    queryFn: () => backendApi.messages.getUnreadCount(),
    enabled: isAuthenticated,
    refetchInterval: 60000, // Reduce from 30s to 60s to avoid socket pressure on Windows
  });

  const { data: notificationCount } = useQuery({
    queryKey: ['unreadNotifications'],
    queryFn: () => backendApi.notifications.getUnreadCount(),
    enabled: isAuthenticated,
    refetchInterval: 60000, // Reduce from 30s to 60s to avoid socket pressure on Windows
  });

  const unreadMessages = messageCount?.count || 0;
  const unreadNotifications = notificationCount?.count || 0;

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <nav className="sticky top-0 z-50 glass-strong">
      <div className="max-w-screen-xl mx-auto px-3 sm:px-4">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo */}
          <Link to={isAuthenticated ? "/feed" : "/"} className="flex items-center gap-2">
            <img src="/logo.png" alt="Mericet" className="h-8" />
            <span className="font-bold text-base sm:text-lg leading-none tracking-tight">Mericet</span>
          </Link>

          {/* Search Bar - Desktop */}
          {isAuthenticated && (
            <div className="hidden md:flex flex-1 max-w-md mx-4">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search people, companies, posts..."
                  className="pl-10 bg-secondary/50 border-0 focus-visible:ring-primary"
                />
              </div>
            </div>
          )}

          {/* Desktop Actions */}
          {isAuthenticated ? (
            <div className="hidden md:flex items-center gap-2">
              <Button variant="ghost" size="icon" className="relative" asChild>
                <Link to="/messages">
                  <MessageSquare className="h-5 w-5" />
                  {unreadMessages > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center">
                      {unreadMessages}
                    </span>
                  )}
                </Link>
              </Button>
              <Button variant="ghost" size="icon" className="relative" asChild>
                <Link to="/notifications">
                  <Bell className="h-5 w-5" />
                  {unreadNotifications > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center">
                      {unreadNotifications}
                    </span>
                  )}
                </Link>
              </Button>
              <Button 
                variant="default" 
                size="sm" 
                className="gap-2"
                onClick={() => setIsCreatePostOpen(true)}
              >
                <Plus className="!h-7 !w-7" />
                Create Post
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="focus:outline-none">
                    <UserAvatar
                      name={`${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.email || "User"}
                      src={user?.avatar_url}
                      size="sm"
                    />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="font-semibold">{user?.first_name} {user?.last_name}</p>
                    <p className="text-sm text-muted-foreground">{user?.email}</p>
                    <p className="text-xs text-muted-foreground">@{user?.username}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="cursor-pointer">
                      <User className="mr-2 h-4 w-4" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/settings" className="cursor-pointer">
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    className="text-destructive cursor-pointer"
                    onClick={handleLogout}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-3">
              <Button variant="ghost" asChild>
                <Link to="/login">Sign In</Link>
              </Button>
              <Button variant="hero" asChild>
                <Link to="/signup">Get Started</Link>
              </Button>
            </div>
          )}

          {/* Mobile Actions */}
          <div className="flex items-center md:hidden">
            {isAuthenticated && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsCreatePostOpen(true)}
                aria-label="Create post"
              >
                <Plus className="h-6 w-6 text-primary" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-border"
          >
            <div className="container mx-auto px-4 py-4 space-y-4">
              {isAuthenticated ? (
                <>
                  {/* User info */}
                  <div className="flex items-center gap-3 pb-2 border-b border-border">
                    <UserAvatar
                      name={`${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.email || "User"}
                      src={user?.avatar_url}
                      size="sm"
                    />
                    <div>
                      <p className="font-semibold text-sm">{user?.first_name} {user?.last_name}</p>
                      <p className="text-xs text-muted-foreground">{user?.email}</p>
                      <p className="text-xs text-muted-foreground">@{user?.username}</p>
                    </div>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search..."
                      className="pl-10 bg-secondary/50 border-0"
                    />
                  </div>

                  {/* Primary nav links */}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { icon: Home, label: "Feed", href: "/feed" },
                      { icon: Users, label: "Network", href: "/network" },
                      { icon: Building2, label: "Companies", href: "/companies" },
                      { icon: Bookmark, label: "Saved", href: "/saved" },
                      { icon: Settings, label: "Settings", href: "/settings" },
                      { icon: User, label: "Profile", href: "/profile" },
                    ].map(({ icon: Icon, label, href }) => (
                      <Button
                        key={href}
                        variant="outline"
                        className="gap-2 justify-start"
                        asChild
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <Link to={href}>
                          <Icon className="h-4 w-4" />
                          {label}
                        </Link>
                      </Button>
                    ))}
                  </div>

                  {/* Notifications & Messages quick access */}
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" className="gap-2" asChild onClick={() => setIsMobileMenuOpen(false)}>
                      <Link to="/messages">
                        <MessageSquare className="h-4 w-4" />
                        Messages {unreadMessages > 0 && `(${unreadMessages})`}
                      </Link>
                    </Button>
                    <Button variant="outline" className="gap-2" asChild onClick={() => setIsMobileMenuOpen(false)}>
                      <Link to="/notifications">
                        <Bell className="h-4 w-4" />
                        Alerts {unreadNotifications > 0 && `(${unreadNotifications})`}
                      </Link>
                    </Button>
                  </div>

                  <Button 
                    variant="default" 
                    className="w-full gap-2"
                    onClick={() => { setIsCreatePostOpen(true); setIsMobileMenuOpen(false); }}
                  >
                    <Plus className="h-5 w-5" />
                    Create Post
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={() => { setIsMobileMenuOpen(false); handleLogout(); }}
                  >
                    <LogOut className="h-4 w-4" />
                    Log out
                  </Button>
                </>
              ) : (
                <div className="flex flex-col gap-2">
                  <Button variant="outline" asChild className="w-full">
                    <Link to="/login">Sign In</Link>
                  </Button>
                  <Button variant="hero" asChild className="w-full">
                    <Link to="/signup">Get Started</Link>
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Post Modal */}
      <CreatePostModalNew
        isOpen={isCreatePostOpen}
        onClose={() => setIsCreatePostOpen(false)}
        onPostCreated={() => {
          queryClient.invalidateQueries({ queryKey: ['posts'] });
          setIsCreatePostOpen(false);
        }}
      />
    </nav>
  );
};
