import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
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
  FileText,
  ShieldAlert,
  Sun,
  Moon,
  ArrowLeftRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/lib/theme";

interface NavbarProps {
  isAuthenticated?: boolean;
}

export const Navbar = ({ isAuthenticated = false }: NavbarProps) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user, savedAccounts, switchAccount } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const queryClient = useQueryClient();

  const isLandingPage = location.pathname === "/" && !isAuthenticated;

  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isMobileMenuOpen]);

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

  const { data: searchSuggestions } = useQuery({
    queryKey: ['searchSuggestions', searchQuery],
    queryFn: () => backendApi.search.searchSuggestions(searchQuery, 6),
    enabled: isAuthenticated && searchQuery.trim().length > 0,
  });

  const { data: moderatorStatus } = useQuery({
    queryKey: ['moderatorStatus'],
    queryFn: () => backendApi.reports.moderatorStatus(),
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
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

  const handleSearchSubmit = () => {
    const q = searchQuery.trim();
    if (!q) return;
    navigate(`/search?q=${encodeURIComponent(q)}`);
    setIsMobileMenuOpen(false);
    setShowSearchSuggestions(false);
  };

  const handleSuggestionPick = (suggestion: { text: string; user_id?: string; post_id?: string; type?: string }) => {
    setSearchQuery(suggestion.text);
    if (suggestion.type === "user" && suggestion.user_id) {
      navigate(`/profile/${suggestion.user_id}`);
    } else if (suggestion.type === "company") {
      navigate(`/companies?q=${encodeURIComponent(suggestion.text)}`);
    } else if (suggestion.type === "post" && suggestion.post_id) {
      navigate(`/posts/${suggestion.post_id}`);
    } else {
      navigate(`/search?q=${encodeURIComponent(suggestion.text)}`);
    }
    setIsMobileMenuOpen(false);
    setShowSearchSuggestions(false);
  };

  return (
    <>
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
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setShowSearchSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSearchSuggestions(false), 150)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSearchSubmit();
                    }
                  }}
                />
                {showSearchSuggestions && (searchSuggestions?.suggestions?.length ?? 0) > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-card border rounded-lg shadow-lg overflow-hidden z-20">
                    {searchSuggestions?.suggestions?.map((s, index) => (
                      <button
                        key={`${s.type}-${s.user_id || s.username || s.text}-${index}`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleSuggestionPick(s)}
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
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                aria-label="Toggle theme"
              >
                {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
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
                <DropdownMenuContent align="end" sideOffset={8} alignOffset={-200} className="w-56">
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
                  {moderatorStatus?.can_moderate && (
                    <DropdownMenuItem asChild>
                      <Link to="/moderation" className="cursor-pointer">
                        <ShieldAlert className="mr-2 h-4 w-4" />
                        Moderation
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  {savedAccounts.filter(a => a.id !== user?.id).length > 0 && (
                    <>
                      <div className="px-2 py-1.5">
                        <p className="text-xs font-medium text-muted-foreground">Switch account</p>
                      </div>
                      {savedAccounts
                        .filter(a => a.id !== user?.id)
                        .map(account => (
                          <DropdownMenuItem
                            key={account.id}
                            className="cursor-pointer"
                            onClick={() => switchAccount(account)}
                          >
                            <UserAvatar
                              src={account.avatar_url}
                              name={`${account.first_name} ${account.last_name}`}
                              size="sm"
                              className="mr-2 h-5 w-5"
                            />
                            <span className="truncate">{account.first_name} {account.last_name}</span>
                          </DropdownMenuItem>
                        ))}
                    </>
                  )}
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => navigate('/login')}
                  >
                    <ArrowLeftRight className="mr-2 h-4 w-4" />
                    Add another account
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

    </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="md:hidden border-t border-border fixed inset-x-0 top-16 bottom-0 z-40 bg-background overflow-y-auto overscroll-contain"
          >
            <div className="container mx-auto px-4 py-4 space-y-4 pb-20">
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
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onFocus={() => setShowSearchSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowSearchSuggestions(false), 150)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleSearchSubmit();
                        }
                      }}
                    />
                    {showSearchSuggestions && (searchSuggestions?.suggestions?.length ?? 0) > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-card border rounded-lg shadow-lg overflow-hidden z-20">
                        {searchSuggestions?.suggestions?.map((s, index) => (
                          <button
                            key={`${s.type}-${s.user_id || s.username || s.text}-${index}`}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => handleSuggestionPick(s)}
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

                  {/* Primary nav links */}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { icon: Home, label: "Feed", href: "/feed" },
                      { icon: Users, label: "Network", href: "/network" },
                      { icon: Building2, label: "Companies", href: "/companies" },
                      { icon: Bookmark, label: "Saved", href: "/saved" },
                      { icon: Settings, label: "Settings", href: "/settings" },
                      { icon: User, label: "Profile", href: "/profile" },
                      ...(moderatorStatus?.can_moderate ? [{ icon: ShieldAlert, label: "Moderation", href: "/moderation" }] : []),
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
                    variant="outline"
                    className="w-full gap-2"
                    onClick={toggleTheme}
                  >
                    {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                    {theme === "dark" ? "Light Mode" : "Dark Mode"}
                  </Button>

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
    </>
  );
};
