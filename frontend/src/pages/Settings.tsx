import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { useAuth } from "@/lib/auth";
import { backendApi } from "@/lib/backend-api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  User,
  Bell,
  Shield,
  Palette,
  LogOut,
  Camera,
  Save,
  Loader2,
  CheckCircle2,
  XCircle,
  Sun,
  Moon,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/lib/theme";

const Settings = () => {
  const { toast } = useToast();
  const { logout, refreshUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();

  // Fetch profile data
  const { data: profileData, isLoading } = useQuery({
    queryKey: ['profile', 'me'],
    queryFn: () => backendApi.profile.getMyProfile(),
  });

  const [profile, setProfile] = useState({
    firstName: "",
    lastName: "",
    email: "",
    username: "",
    headline: "",
  });
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [usernameError, setUsernameError] = useState("");

  // Update local state when profile data loads
  useEffect(() => {
    if (profileData) {
      setProfile({
        firstName: profileData.first_name || "",
        lastName: profileData.last_name || "",
        email: profileData.email || "",
        username: profileData.username || "",
        headline: profileData.headline || "",
      });
      setPrivacy({
        profileVisibility: profileData.connections_visible === false ? "private" : "public",
        showEmail: !!profileData.email_visible,
        showConnections: !!profileData.connections_visible,
        allowMessages: true,
        showWorkHistory: !!profileData.work_history_visible,
        showActivityStatus: !!profileData.activity_status_visible,
      });
    }
  }, [profileData]);

  const currentUsername = (profileData?.username || "").toLowerCase();
  const normalizedUsername = profile.username.trim().toLowerCase();
  const usernameChanged = normalizedUsername !== currentUsername;

  useEffect(() => {
    setUsernameError("");

    if (!normalizedUsername || normalizedUsername.length < 3 || !usernameChanged) {
      setUsernameStatus("idle");
      return;
    }

    setUsernameStatus("checking");
    const timeoutId = window.setTimeout(async () => {
      try {
        const { available } = await backendApi.auth.checkUsername(normalizedUsername);
        setUsernameStatus(available ? "available" : "taken");
      } catch {
        setUsernameStatus("idle");
      }
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [normalizedUsername, usernameChanged]);

  const [notifications, setNotifications] = useState({
    emailDigest: true,
    pushNotifications: true,
    connectionRequests: true,
    mentions: true,
    newFollowers: true,
    postEngagement: false,
  });

  const [privacy, setPrivacy] = useState({
    profileVisibility: "public",
    showEmail: false,
    showConnections: true,
    allowMessages: true,
    showWorkHistory: true,
    showActivityStatus: true,
  });

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const uploadAvatarMutation = useMutation({
    mutationFn: (file: File) => backendApi.profile.uploadAvatar(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
      toast({ title: "Profile photo updated!" });
    },
    onError: () => toast({ title: "Failed to upload photo", variant: "destructive" }),
  });

  const uploadCoverMutation = useMutation({
    mutationFn: (file: File) => backendApi.profile.uploadCover(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
      toast({ title: "Cover image updated!" });
    },
    onError: () => toast({ title: "Failed to upload cover", variant: "destructive" }),
  });

  // Mutation to update profile
  const updateProfileMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => backendApi.profile.updateProfile(data),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
      await refreshUser();
      toast({
        title: "Profile updated",
        description: "Your profile has been saved successfully.",
      });
    },
    onError: (error: Error) => {
      const message = error?.message || "Failed to update profile.";
      if (message.toLowerCase().includes("username") && message.toLowerCase().includes("taken")) {
        setUsernameError("Username is already being used");
        setUsernameStatus("taken");
      }
      if (message.toLowerCase().includes("email") && message.toLowerCase().includes("use")) {
        toast({
          title: "Email unavailable",
          description: "That email is already in use by another account.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    },
  });

  const updatePrivacyMutation = useMutation({
    mutationFn: (data: {
      email_visible?: boolean;
      connections_visible?: boolean;
      work_history_visible?: boolean;
      activity_status_visible?: boolean;
    }) => backendApi.profile.updatePrivacy(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Privacy update failed",
        description: error?.message || "Unable to save privacy settings.",
        variant: "destructive",
      });
    },
  });

  const handleSaveProfile = () => {
    const usernamePattern = /^[a-z0-9_-]+$/;

    if (!normalizedUsername || normalizedUsername.length < 3) {
      setUsernameError("Username must be at least 3 characters");
      return;
    }

    if (!usernamePattern.test(normalizedUsername)) {
      setUsernameError("Username can only use lowercase letters, numbers, underscores, and hyphens");
      return;
    }

    if (usernameChanged && usernameStatus === "checking") {
      setUsernameError("Please wait, checking username availability");
      return;
    }

    if (usernameChanged && usernameStatus === "taken") {
      setUsernameError("Username is already being used");
      return;
    }

    if (usernameChanged && usernameStatus !== "available") {
      setUsernameError("Please verify username availability before saving");
      return;
    }

    setUsernameError("");
    updateProfileMutation.mutate({
      email: profile.email.trim().toLowerCase(),
      first_name: profile.firstName,
      last_name: profile.lastName,
      username: normalizedUsername,
      headline: profile.headline,
    });

    updatePrivacyMutation.mutate({
      email_visible: privacy.showEmail,
      connections_visible: privacy.showConnections,
      work_history_visible: privacy.showWorkHistory,
      activity_status_visible: privacy.showActivityStatus,
    });
  };
  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: "Signed Out",
        description: "You have been signed out successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive",
      });
    }
  };
  return (
    <AppLayout>
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account settings and preferences
          </p>
        </div>

        <Tabs defaultValue="account" className="space-y-6">
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="account" className="gap-2">
              <User className="h-4 w-4" />
              Account
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="privacy" className="gap-2">
              <Shield className="h-4 w-4" />
              Privacy
            </TabsTrigger>
            <TabsTrigger value="appearance" className="gap-2">
              <Palette className="h-4 w-4" />
              Appearance
            </TabsTrigger>
          </TabsList>

          {/* Account Tab */}
          <TabsContent value="account">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card rounded-xl border border-border p-6 space-y-6"
            >
              {/* Avatar */}
              <div className="flex items-center gap-6">
                <div className="relative">
                  <UserAvatar
                    name={`${profile.firstName} ${profile.lastName}`}
                    src={profileData?.avatar_url}
                    size="xl"
                  />
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadAvatarMutation.mutate(file);
                      e.target.value = "";
                    }}
                  />
                  <button
                    onClick={() => avatarInputRef.current?.click()}
                    className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:bg-primary/90 transition-colors"
                  >
                    {uploadAvatarMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <div>
                  <h3 className="font-semibold">Profile Photo</h3>
                  <p className="text-sm text-muted-foreground">
                    JPG, PNG or GIF. Max 5MB.
                  </p>
                </div>
              </div>

              {/* Cover Image */}
              <div className="space-y-2">
                <h3 className="font-semibold">Cover Image</h3>
                <div className="relative h-28 rounded-lg overflow-hidden bg-gradient-to-r from-primary/20 to-primary/10">
                  {profileData?.cover_url && (
                    <img src={profileData.cover_url} alt="Cover" className="w-full h-full object-cover" />
                  )}
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadCoverMutation.mutate(file);
                      e.target.value = "";
                    }}
                  />
                  <button
                    onClick={() => coverInputRef.current?.click()}
                    className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/50 transition-colors cursor-pointer"
                  >
                    {uploadCoverMutation.isPending ? (
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                    ) : (
                      <div className="flex items-center gap-2 text-white">
                        <Camera className="w-5 h-5" />
                        <span className="text-sm font-medium">Change Cover</span>
                      </div>
                    )}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">JPG, PNG or GIF. Max 5MB. Recommended: 1500×500px</p>
              </div>

              <Separator />

              {/* Profile Form */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={profile.firstName}
                    onChange={(e) =>
                      setProfile({ ...profile, firstName: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={profile.lastName}
                    onChange={(e) =>
                      setProfile({ ...profile, lastName: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profile.email}
                    onChange={(e) =>
                      setProfile({ ...profile, email: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      @
                    </span>
                    <Input
                      id="username"
                      value={profile.username}
                      onChange={(e) => {
                        const cleaned = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "");
                        setProfile({ ...profile, username: cleaned });
                      }}
                      className="pl-8"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {usernameChanged && usernameStatus === "checking" && (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                      {usernameChanged && usernameStatus === "available" && (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      )}
                      {usernameChanged && usernameStatus === "taken" && (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                    </div>
                  </div>
                  {usernameChanged && usernameStatus === "available" && (
                    <p className="text-xs text-green-600 mt-1">Username is available</p>
                  )}
                  {usernameChanged && usernameStatus === "taken" && (
                    <p className="text-xs text-destructive mt-1">Username is already being used</p>
                  )}
                  {usernameError && (
                    <p className="text-xs text-destructive mt-1">{usernameError}</p>
                  )}
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="headline">Headline</Label>
                  <Input
                    id="headline"
                    value={profile.headline}
                    onChange={(e) =>
                      setProfile({ ...profile, headline: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button 
                  onClick={handleSaveProfile} 
                  className="gap-2"
                  disabled={updateProfileMutation.isPending || (usernameChanged && usernameStatus === "checking")}
                >
                  {updateProfileMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save Changes
                </Button>
              </div>

              <Separator />

              {/* Danger Zone */}
              <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5">
                <h3 className="font-semibold text-destructive mb-2">
                  Danger Zone
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Once you delete your account, there is no going back.
                </p>
                <Button variant="destructive" size="sm">
                  Delete Account
                </Button>
              </div>
            </motion.div>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card rounded-xl border border-border p-6 space-y-6"
            >
              <div>
                <h3 className="font-semibold mb-4">Email Notifications</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Email Digest</p>
                      <p className="text-sm text-muted-foreground">
                        Receive a weekly summary of your activity
                      </p>
                    </div>
                    <Switch
                      checked={notifications.emailDigest}
                      onCheckedChange={(checked) =>
                        setNotifications({ ...notifications, emailDigest: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Push Notifications</p>
                      <p className="text-sm text-muted-foreground">
                        Receive push notifications on your devices
                      </p>
                    </div>
                    <Switch
                      checked={notifications.pushNotifications}
                      onCheckedChange={(checked) =>
                        setNotifications({
                          ...notifications,
                          pushNotifications: checked,
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold mb-4">Activity Notifications</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Connection Requests</p>
                      <p className="text-sm text-muted-foreground">
                        When someone sends you a connection request
                      </p>
                    </div>
                    <Switch
                      checked={notifications.connectionRequests}
                      onCheckedChange={(checked) =>
                        setNotifications({
                          ...notifications,
                          connectionRequests: checked,
                        })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Mentions</p>
                      <p className="text-sm text-muted-foreground">
                        When someone mentions you in a post or comment
                      </p>
                    </div>
                    <Switch
                      checked={notifications.mentions}
                      onCheckedChange={(checked) =>
                        setNotifications({ ...notifications, mentions: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">New Followers</p>
                      <p className="text-sm text-muted-foreground">
                        When someone follows your profile
                      </p>
                    </div>
                    <Switch
                      checked={notifications.newFollowers}
                      onCheckedChange={(checked) =>
                        setNotifications({ ...notifications, newFollowers: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Post Engagement</p>
                      <p className="text-sm text-muted-foreground">
                        Likes and comments on your posts
                      </p>
                    </div>
                    <Switch
                      checked={notifications.postEngagement}
                      onCheckedChange={(checked) =>
                        setNotifications({
                          ...notifications,
                          postEngagement: checked,
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          </TabsContent>

          {/* Privacy Tab */}
          <TabsContent value="privacy">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card rounded-xl border border-border p-6 space-y-6"
            >
              <div>
                <h3 className="font-semibold mb-4">Profile Visibility</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Show Email</p>
                      <p className="text-sm text-muted-foreground">
                        Display your email on your profile
                      </p>
                    </div>
                    <Switch
                      checked={privacy.showEmail}
                      onCheckedChange={(checked) =>
                        setPrivacy({ ...privacy, showEmail: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Show Connections</p>
                      <p className="text-sm text-muted-foreground">
                        Let others see your connections
                      </p>
                    </div>
                    <Switch
                      checked={privacy.showConnections}
                      onCheckedChange={(checked) =>
                        setPrivacy({ ...privacy, showConnections: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Allow Messages</p>
                      <p className="text-sm text-muted-foreground">
                        Receive messages from anyone
                      </p>
                    </div>
                    <Switch
                      checked={privacy.allowMessages}
                      onCheckedChange={(checked) =>
                        setPrivacy({ ...privacy, allowMessages: checked })
                      }
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold mb-4">Session</h3>
                <Button 
                  variant="outline" 
                  className="gap-2 text-destructive hover:text-destructive"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </Button>
              </div>
            </motion.div>
          </TabsContent>
          {/* Appearance Tab */}
          <TabsContent value="appearance">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card rounded-xl border border-border p-6 space-y-6"
            >
              <div>
                <h3 className="font-semibold mb-1">Theme</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Choose how Mericet looks for you.
                </p>

                <div className="grid grid-cols-2 gap-4 max-w-sm">
                  {/* Light option */}
                  <button
                    onClick={() => setTheme("light")}
                    className={`relative rounded-xl border-2 p-4 flex flex-col items-center gap-3 transition-all ${
                      theme === "light"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div className="h-14 w-14 rounded-full bg-[#F8FAFC] border border-border flex items-center justify-center shadow-sm">
                      <Sun className="h-6 w-6 text-[#1A66FF]" />
                    </div>
                    <span className="text-sm font-medium">Light</span>
                    {theme === "light" && (
                      <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary" />
                    )}
                  </button>

                  {/* Dark option */}
                  <button
                    onClick={() => setTheme("dark")}
                    className={`relative rounded-xl border-2 p-4 flex flex-col items-center gap-3 transition-all ${
                      theme === "dark"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div className="h-14 w-14 rounded-full bg-[#060D1A] border border-border flex items-center justify-center shadow-sm">
                      <Moon className="h-6 w-6 text-[#4D8AFF]" />
                    </div>
                    <span className="text-sm font-medium">Dark</span>
                    {theme === "dark" && (
                      <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary" />
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
      )}
    </AppLayout>
  );
};

export default Settings;
