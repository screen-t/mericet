import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { ReportDialog } from "@/components/modals/ReportDialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { backendApi } from "@/lib/backend-api";

import { WorkExperienceSection } from "@/components/profile/WorkExperienceSection";
import { EducationSection } from "@/components/profile/EducationSection";
import { SkillsSection } from "@/components/profile/SkillsSection";
import { ProfilePosts } from "@/components/profile/ProfilePosts";
import { Profile } from '@/types/api';
import {
  MapPin,
  Link as LinkIcon,
  Calendar,
  Users,
  Briefcase,
  Edit3,
  MessageSquare,
  UserPlus,
  UserCheck,
  Loader2,
  Mail,
  Globe,
  Check,
  X,
  Camera,
  MoreVertical,
  Linkedin,
  Twitter,
  Instagram,
  Github,
  StickyNote,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const ProfilePage = () => {
  const { userId } = useParams<{ userId?: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteEditing, setNoteEditing] = useState(false);

  const toAbsoluteUrl = (url: string) =>
    /^https?:\/\//i.test(url) ? url : `https://${url}`;

  const uploadAvatarMutation = useMutation({
    mutationFn: (file: File) => backendApi.profile.uploadAvatar(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', profileUserId] });
      toast({ title: "Profile photo updated!" });
    },
    onError: () => toast({ title: "Failed to upload photo", variant: "destructive" }),
  });

  const uploadCoverMutation = useMutation({
    mutationFn: (file: File) => backendApi.profile.uploadCover(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', profileUserId] });
      toast({ title: "Cover image updated!" });
    },
    onError: () => toast({ title: "Failed to upload cover", variant: "destructive" }),
  });

  // Determine which user profile to show
  const profileUserId = userId || user?.id;
  const isOwnProfile = !userId || userId === user?.id;

  const { data: muteStatus } = useQuery({
    queryKey: ['muteStatus', profileUserId],
    queryFn: () => backendApi.notifications.getMuteStatus(profileUserId!),
    enabled: !isOwnProfile && !!profileUserId,
  });

  const muteMutation = useMutation({
    mutationFn: () =>
      muteStatus?.is_muted
        ? backendApi.notifications.unmuteUser(profileUserId!)
        : backendApi.notifications.muteUser(profileUserId!),
    onSuccess: () => {
      toast({ title: muteStatus?.is_muted ? "User unmuted" : "User muted" });
      queryClient.invalidateQueries({ queryKey: ['muteStatus', profileUserId] });
    },
    onError: () => toast({ title: "Failed to update mute status", variant: "destructive" }),
  });

  const { data: noteData } = useQuery({
    queryKey: ['connectionNote', profileUserId],
    queryFn: () => backendApi.connections.getConnectionNote(profileUserId!),
    enabled: !isOwnProfile && !!profileUserId,
  });

  useEffect(() => {
    if (noteData?.note !== undefined) setNoteText(noteData.note || "");
  }, [noteData]);

  const saveNoteMutation = useMutation({
    mutationFn: (note: string) => backendApi.connections.saveConnectionNote(profileUserId!, note),
    onSuccess: () => {
      toast({ title: noteText.trim() ? "Note saved" : "Note removed" });
      setNoteEditing(false);
      queryClient.invalidateQueries({ queryKey: ['connectionNote', profileUserId] });
    },
    onError: () => toast({ title: "Failed to save note", variant: "destructive" }),
  });

  // Fetch profile data
  const { data: profile, isLoading, error } = useQuery<Profile>({
    queryKey: ['profile', profileUserId],
    queryFn: async () => {
      if (isOwnProfile) {
        return backendApi.profile.getMyProfile() as Promise<Profile>;
      }
      return backendApi.profile.getProfile(profileUserId!) as Promise<Profile>;
    },
    enabled: !!profileUserId,
  });

  // Fetch connection status if viewing another user's profile
  const { data: connectionStatus } = useQuery({
    queryKey: ['connectionStatus', profileUserId],
    queryFn: () => backendApi.connections.getConnectionStatus(profileUserId!),
    enabled: !isOwnProfile && !!profileUserId,
  });

  const { data: followStatus } = useQuery({
    queryKey: ['followStatus', profileUserId],
    queryFn: () => backendApi.follows.status(profileUserId!),
    enabled: !isOwnProfile && !!profileUserId,
  });

  // Connection actions
  const sendConnectionRequest = useMutation({
    mutationFn: () => backendApi.connections.sendRequest(profileUserId!),
    onSuccess: () => {
      toast({ title: "Connection request sent!" });
      queryClient.invalidateQueries({ queryKey: ['connectionStatus', profileUserId] });
    },
    onError: () => {
      toast({ title: "Failed to send request", variant: "destructive" });
    },
  });

  const removeConnection = useMutation({
    mutationFn: () => backendApi.connections.removeConnection(connectionStatus?.connection_id || profileUserId!),
    onSuccess: () => {
      toast({ title: "Connection removed" });
      queryClient.invalidateQueries({ queryKey: ['connectionStatus', profileUserId] });
    },
    onError: () => {
      toast({ title: "Failed to remove connection", variant: "destructive" });
    },
  });

  const respondToRequest = useMutation({
    mutationFn: (accept: boolean) =>
      backendApi.connections.respondToRequest(connectionStatus?.connection_id ?? "", accept),
    onSuccess: (_, accept) => {
      toast({ title: accept ? "Connection accepted!" : "Request declined" });
      queryClient.invalidateQueries({ queryKey: ['connectionStatus', profileUserId] });
      queryClient.invalidateQueries({ queryKey: ['connections'] });
    },
    onError: () => {
      toast({ title: "Failed to respond to request", variant: "destructive" });
    },
  });

  const followMutation = useMutation({
    mutationFn: () => backendApi.follows.follow(profileUserId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followStatus', profileUserId] });
      queryClient.invalidateQueries({ queryKey: ['profile', profileUserId] });
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: () => backendApi.follows.unfollow(profileUserId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followStatus', profileUserId] });
      queryClient.invalidateQueries({ queryKey: ['profile', profileUserId] });
    },
  });

  const blockMutation = useMutation({
    mutationFn: () => backendApi.connections.blockUser(profileUserId!),
    onSuccess: () => {
      toast({ title: "User blocked" });
      queryClient.invalidateQueries({ queryKey: ['connectionStatus', profileUserId] });
      queryClient.invalidateQueries({ queryKey: ['profile', profileUserId] });
      queryClient.invalidateQueries({ queryKey: ['connections'] });
    },
    onError: () => toast({ title: "Failed to block user", variant: "destructive" }),
  });

  const unblockMutation = useMutation({
    mutationFn: () => backendApi.connections.unblockUser(profileUserId!),
    onSuccess: () => {
      toast({ title: "User unblocked" });
      queryClient.invalidateQueries({ queryKey: ['connectionStatus', profileUserId] });
      queryClient.invalidateQueries({ queryKey: ['profile', profileUserId] });
      queryClient.invalidateQueries({ queryKey: ['connections'] });
    },
    onError: () => toast({ title: "Failed to unblock user", variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (error || !profile) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <p className="text-lg text-muted-foreground">Profile not found</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Cover Image Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative h-48 bg-gradient-to-r from-primary/20 to-primary/10 rounded-lg overflow-hidden group"
        >
          {profile.cover_url && (
            <img
              src={profile.cover_url}
              alt="Cover"
              className="w-full h-full object-cover"
            />
          )}
          {isOwnProfile && (
            <>
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
                className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                {uploadCoverMutation.isPending ? (
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                ) : (
                  <div className="flex items-center gap-2 text-white">
                    <Camera className="w-6 h-6" />
                    <span className="text-sm font-medium">Change Cover</span>
                  </div>
                )}
              </button>
            </>
          )}
        </motion.div>

        {/* Profile Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="p-6 -mt-20 relative">
            <div className="flex flex-col md:flex-row gap-6">
              {/* Avatar */}
              <div className="flex-shrink-0 relative group/avatar">
                <UserAvatar
                  src={profile.avatar_url}
                  name={`${profile.first_name} ${profile.last_name}`}
                  size="xl"
                  className="border-4 border-background"
                />
                {isOwnProfile && (
                  <>
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
                      className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover/avatar:opacity-100 transition-opacity cursor-pointer"
                    >
                      {uploadAvatarMutation.isPending ? (
                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                      ) : (
                        <Camera className="w-6 h-6 text-white" />
                      )}
                    </button>
                  </>
                )}
              </div>

              {/* Profile Info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold">
                      {profile.first_name} {profile.last_name}
                    </h1>
                    {profile.pronouns && (
                      <p className="text-sm text-muted-foreground">({profile.pronouns})</p>
                    )}
                    {profile.headline && (
                      <p className="text-lg text-muted-foreground mt-1">{profile.headline}</p>
                    )}
                    
                    {/* Location & Website */}
                    <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
                      {profile.location && (
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          <span>{profile.location}</span>
                        </div>
                      )}
                      {profile.website && (
                        <a
                          href={toAbsoluteUrl(profile.website)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 hover:text-primary"
                        >
                          <LinkIcon className="w-4 h-4" />
                          <span>Website</span>
                        </a>
                      )}
                      {profile.email_visible && profile.email && (
                        <div className="flex items-center gap-1">
                          <Mail className="w-4 h-4" />
                          <span>{profile.email}</span>
                        </div>
                      )}
                    </div>

                    {/* Social Media Links */}
                    {(profile.linkedin_url || profile.twitter_url || profile.instagram_url || profile.github_url) && (
                      <div className="flex flex-wrap gap-3 mt-2">
                        {profile.linkedin_url && (
                          <a href={toAbsoluteUrl(profile.linkedin_url)} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                            <Linkedin className="w-5 h-5" />
                          </a>
                        )}
                        {profile.twitter_url && (
                          <a href={toAbsoluteUrl(profile.twitter_url)} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                            <Twitter className="w-5 h-5" />
                          </a>
                        )}
                        {profile.instagram_url && (
                          <a href={toAbsoluteUrl(profile.instagram_url)} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                            <Instagram className="w-5 h-5" />
                          </a>
                        )}
                        {profile.github_url && (
                          <a href={toAbsoluteUrl(profile.github_url)} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                            <Github className="w-5 h-5" />
                          </a>
                        )}
                      </div>
                    )}

                    {/* Activity Status */}
                    {!isOwnProfile && profile.last_active_at && (
                      <div className="mt-2">
                        {(() => {
                          const lastActive = new Date(profile.last_active_at);
                          const now = new Date();
                          const diffMs = now.getTime() - lastActive.getTime();
                          const diffMin = Math.floor(diffMs / 60000);
                          const isOnline = diffMin < 5;
                          if (isOnline) {
                            return (
                              <span className="inline-flex items-center gap-1.5 text-xs text-green-600">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                Active now
                              </span>
                            );
                          }
                          let timeAgo: string;
                          if (diffMin < 60) timeAgo = `${diffMin}m ago`;
                          else if (diffMin < 1440) timeAgo = `${Math.floor(diffMin / 60)}h ago`;
                          else timeAgo = `${Math.floor(diffMin / 1440)}d ago`;
                          return (
                            <span className="text-xs text-muted-foreground">
                              Last seen {timeAgo}
                            </span>
                          );
                        })()}
                      </div>
                    )}

                    {/* Stats */}
                    {(isOwnProfile || profile.connections_visible) && (
                      <div className="flex gap-6 mt-4 text-sm">
                        {isOwnProfile ? (
                          <Link to="/network?tab=connections" className="hover:text-primary transition-colors">
                            <span className="font-semibold">{profile.connections_count || 0}</span>{" "}
                            <span className="text-muted-foreground">Connections</span>
                          </Link>
                        ) : (
                          <div>
                            <span className="font-semibold">{profile.connections_count || 0}</span>{" "}
                            <span className="text-muted-foreground">Connections</span>
                          </div>
                        )}
                        {isOwnProfile ? (
                          <Link to="/network?tab=followers" className="hover:text-primary transition-colors">
                            <span className="font-semibold">{profile.followers_count || 0}</span>{" "}
                            <span className="text-muted-foreground">Followers</span>
                          </Link>
                        ) : (
                          <div>
                            <span className="font-semibold">{profile.followers_count || 0}</span>{" "}
                            <span className="text-muted-foreground">Followers</span>
                          </div>
                        )}
                      </div>
                    )}
                    {!isOwnProfile && followStatus?.is_following && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        You follow this user
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2 md:justify-end">
                    {isOwnProfile ? (
                      <Button variant="outline" asChild className="w-full sm:w-auto">
                        <Link to="/settings">
                          <Edit3 className="w-4 h-4 mr-2" />
                          Edit Profile
                        </Link>
                      </Button>
                    ) : (
                      <>
                        {connectionStatus?.status === 'accepted' ? (
                          <>
                            <Button
                              variant="default"
                              onClick={() => navigate(`/messages/${profileUserId}`)}
                              className="w-full sm:w-auto"
                            >
                              <MessageSquare className="w-4 h-4 mr-2" />
                              Message
                            </Button>
                            {followStatus?.is_following ? (
                              <Button
                                variant="outline"
                                onClick={() => unfollowMutation.mutate()}
                                disabled={unfollowMutation.isPending}
                                className="w-full sm:w-auto"
                              >
                                Following
                              </Button>
                            ) : (
                              <Button
                                onClick={() => followMutation.mutate()}
                                disabled={followMutation.isPending}
                                className="w-full sm:w-auto"
                              >
                                Follow
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              onClick={() => removeConnection.mutate()}
                              className="w-full sm:w-auto"
                            >
                              <UserCheck className="w-4 h-4 mr-2" />
                              Connected
                            </Button>
                          </>
                        ) : connectionStatus?.status === 'pending_from_them' ? (
                          <>
                            <Button
                              onClick={() => respondToRequest.mutate(true)}
                              disabled={respondToRequest.isPending}
                              className="w-full sm:w-auto"
                            >
                              <Check className="w-4 h-4 mr-2" />
                              Accept Request
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => respondToRequest.mutate(false)}
                              disabled={respondToRequest.isPending}
                              className="w-full sm:w-auto"
                            >
                              <X className="w-4 h-4 mr-2" />
                              Decline
                            </Button>
                          </>
                        ) : connectionStatus?.status === 'pending' ? (
                          <Button variant="outline" disabled className="w-full sm:w-auto">
                            Request Pending
                          </Button>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {followStatus?.is_following ? (
                              <Button
                                variant="outline"
                                onClick={() => unfollowMutation.mutate()}
                                disabled={unfollowMutation.isPending}
                                className="w-full sm:w-auto"
                              >
                                Following
                              </Button>
                            ) : (
                              <Button
                                onClick={() => followMutation.mutate()}
                                disabled={followMutation.isPending}
                                className="w-full sm:w-auto"
                              >
                                Follow
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              onClick={() => sendConnectionRequest.mutate()}
                              disabled={sendConnectionRequest.isPending}
                              className="w-full sm:w-auto"
                            >
                              <UserPlus className="w-4 h-4 mr-2" />
                              Connect
                            </Button>
                          </div>
                        )}
                        {!isOwnProfile && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon"
                                className="w-10 h-10"
                                disabled={blockMutation.isPending || unblockMutation.isPending}
                              >
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {connectionStatus?.status === 'blocked' ? (
                                connectionStatus.is_requester ? (
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => unblockMutation.mutate()}
                                    disabled={unblockMutation.isPending}
                                  >
                                    Unblock
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem disabled>
                                    Blocked
                                  </DropdownMenuItem>
                                )
                              ) : (
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => blockMutation.mutate()}
                                  disabled={blockMutation.isPending}
                                >
                                  Block
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => muteMutation.mutate()}
                                disabled={muteMutation.isPending}
                              >
                                {muteStatus?.is_muted ? "Unmute notifications" : "Mute notifications"}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setShowReportDialog(true)}>
                                Report user
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Bio */}
                {profile.bio && (
                  <p className="mt-4 text-sm text-muted-foreground whitespace-pre-wrap">
                    {profile.bio}
                  </p>
                )}
              </div>
            </div>
          </Card>
        </motion.div>

        <ReportDialog
          open={showReportDialog}
          onOpenChange={setShowReportDialog}
          targetType="user"
          targetId={profileUserId!}
          targetLabel="user"
        />

        {/* Profile Tabs */}
        <Tabs defaultValue="about" className="w-full">
          <TabsList className="grid w-full grid-cols-4 h-auto gap-0">
            <TabsTrigger value="about" className="text-xs md:text-sm py-2 md:py-3 px-1 md:px-4">About</TabsTrigger>
            <TabsTrigger value="posts" className="text-xs md:text-sm py-2 md:py-3 px-1 md:px-4">Posts</TabsTrigger>
            <TabsTrigger value="experience" className="text-xs md:text-sm py-2 md:py-3 px-1 md:px-4">Experience</TabsTrigger>
            <TabsTrigger value="education" className="text-xs md:text-sm py-2 md:py-3 px-1 md:px-4">Education</TabsTrigger>
          </TabsList>

          <TabsContent value="about" className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {/* Private Note (only on other profiles) */}
              {!isOwnProfile && connectionStatus?.status === 'accepted' && (
                <Card className="p-4 mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <StickyNote className="w-4 h-4" />
                      Private Note
                    </h3>
                    {!noteEditing && (
                      <Button variant="ghost" size="sm" onClick={() => setNoteEditing(true)}>
                        {noteText ? "Edit" : "Add note"}
                      </Button>
                    )}
                  </div>
                  {noteEditing ? (
                    <div className="space-y-2">
                      <Textarea
                        placeholder="e.g. Met at conference, interested in AI..."
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        rows={3}
                        maxLength={500}
                      />
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">{noteText.length}/500</span>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => {
                            setNoteText(noteData?.note || "");
                            setNoteEditing(false);
                          }}>
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => saveNoteMutation.mutate(noteText)}
                            disabled={saveNoteMutation.isPending}
                          >
                            {saveNoteMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : noteText ? (
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{noteText}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Only you can see this note.</p>
                  )}
                </Card>
              )}

              <SkillsSection userId={profileUserId!} isOwnProfile={isOwnProfile} />
              
              {(isOwnProfile || profile.work_history_visible) && profile.current_position && (
                <Card className="p-6 mt-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Briefcase className="w-5 h-5" />
                    Current Position
                  </h3>
                  <div>
                    <p className="font-medium">{profile.current_position}</p>
                    {profile.current_company && (
                      <p className="text-sm text-muted-foreground">{profile.current_company}</p>
                    )}
                  </div>
                </Card>
              )}
            </motion.div>
          </TabsContent>

          <TabsContent value="posts">
            <ProfilePosts username={profile.username} />
          </TabsContent>

          <TabsContent value="experience">
            <WorkExperienceSection userId={profileUserId!} isOwnProfile={isOwnProfile} />
          </TabsContent>

          <TabsContent value="education">
            <EducationSection userId={profileUserId!} isOwnProfile={isOwnProfile} />
          </TabsContent>
        </Tabs>
      </div>


    </AppLayout>
  );
};

export default ProfilePage;
