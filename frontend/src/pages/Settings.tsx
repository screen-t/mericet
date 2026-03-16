import { useState, useEffect } from "react";
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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Settings = () => {
  const { toast } = useToast();
  const { logout, refreshUser } = useAuth();
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
  });

  // Mutation to update profile
  const updateProfileMutation = useMutation({
    mutationFn: (data: any) => backendApi.profile.updateProfile(data),
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
                  <button className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:bg-primary/90 transition-colors">
                    <Camera className="h-4 w-4" />
                  </button>
                </div>
                <div>
                  <h3 className="font-semibold">Profile Photo</h3>
                  <p className="text-sm text-muted-foreground">
                    JPG, PNG or GIF. Max 5MB.
                  </p>
                </div>
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
        </Tabs>
      </div>
      )}
    </AppLayout>
  );
};

export default Settings;
