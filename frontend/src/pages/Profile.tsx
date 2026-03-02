import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { Button } from "@/components/ui/button";
import { SkillTag } from "@/components/ui/SkillTag";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PostCard, PostData } from "@/components/feed/PostCard";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  MapPin,
  Link as LinkIcon,
  Calendar,
  Users,
  Briefcase,
  Edit3,
  MessageSquare,
  UserPlus,
  Loader2,
} from "lucide-react";

interface ProfileData {
  id: string;
  username: string;
  email: string;
  avatar_url?: string;
  full_name?: string;
  headline?: string;
  bio?: string;
  location?: string;
  website?: string;
  connections_count?: number;
  followers_count?: number;
  following_count?: number;
  skills?: string[];
  experience?: {
    title: string;
    company: string;
    duration: string;
    description?: string;
  }[];
}

export const Profile = () => {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [userPosts, setUserPosts] = useState<PostData[]>([]);
  const [workExperience, setWorkExperience] = useState<WorkExperience[]>([]);
  const [userSkills, setUserSkills] = useState<UserSkill[]>([]);

  // Fetch profile data
  useEffect(() => {
    if (!user) return;
    
    fetchProfileData();
    fetchUserPosts();
    fetchWorkExperience();
    fetchUserSkills();
  }, [user]);

  const fetchProfileData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);
      
      // Get user profile data from the users table
      const { data: profile, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error && error.code === 'PGRST116') {
        // User doesn't exist in users table, create one
        const newProfile: Partial<ProfileData> = {
          id: user.id,
          email: user.email || '',
          username: user.user_metadata?.username || user.email?.split('@')[0] || 'user',
          first_name: user.user_metadata?.first_name || user.user_metadata?.full_name?.split(' ')[0] || '',
          last_name: user.user_metadata?.last_name || user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || '',
          avatar_url: user.user_metadata?.avatar_url || '',
          created_at: new Date().toISOString()
        };

        const { data: insertedProfile, error: insertError } = await supabase
          .from('users')
          .insert(newProfile)
          .select()
          .single();

        if (insertError) {
          console.error('Error creating profile:', insertError);
          // Fallback to user metadata
          setProfileData(newProfile as ProfileData);
        } else {
          setProfileData(insertedProfile);
        }
      } else if (profile) {
        setProfileData(profile);
      } else if (error) {
        console.error('Error fetching profile:', error);
        setError('Failed to load profile');
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      setError('Failed to load profile');
      // Fallback to user metadata if profile fetch fails
      if (user) {
        setProfileData({
          id: user.id,
          email: user.email || '',
          username: user.user_metadata?.username || user.email?.split('@')[0] || 'user',
          first_name: user.user_metadata?.first_name || user.user_metadata?.full_name?.split(' ')[0] || '',
          last_name: user.user_metadata?.last_name || user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || '',
          avatar_url: user.user_metadata?.avatar_url || '',
          created_at: user.created_at || new Date().toISOString()
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchUserPosts = async () => {
    if (!user) return;

    try {
      const { data: posts, error } = await supabase
        .from('posts')
        .select(`
          *,
          users!posts_author_id_fkey (
            username,
            first_name,
            last_name,
            avatar_url
          )
        `)
        .eq('author_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching posts:', error);
        return;
      }

      const formattedPosts: PostData[] = posts?.map(post => ({
        id: post.id,
        content: post.content,
        author: {
          name: `${post.users?.first_name || ''} ${post.users?.last_name || ''}`.trim() || post.users?.username || 'Unknown',
          username: post.users?.username || 'unknown',
          avatar: post.users?.avatar_url || '',
          headline: ''
        },
        image: post.image_url,
        tags: post.tags,
        likes: post.likes_count || 0,
        comments: post.comments_count || 0,
        shares: post.reposts_count || 0,
        isLiked: false, // TODO: Check if current user liked this post
        isSaved: false, // TODO: Check if current user saved this post
        visibility: post.visibility || 'public',
        createdAt: new Date(post.created_at).toLocaleString()
      })) || [];

      setUserPosts(formattedPosts);
    } catch (error) {
      console.error('Error fetching user posts:', error);
    }
  };

  const fetchWorkExperience = async () => {
    if (!user) return;

    try {
      const { data: experience, error } = await supabase
        .from('work_experience')
        .select('*')
        .eq('user_id', user.id)
        .order('start_date', { ascending: false });

      if (error) {
        console.error('Error fetching work experience:', error);
        return;
      }

      setWorkExperience(experience || []);
    } catch (error) {
      console.error('Error fetching work experience:', error);
    }
  };

  const fetchUserSkills = async () => {
    if (!user) return;

    try {
      const { data: skills, error } = await supabase
        .from('user_skills')
        .select('*')
        .eq('user_id', user.id)
        .order('endorsement_count', { ascending: false });

      if (error) {
        console.error('Error fetching user skills:', error);
        return;
      }

      setUserSkills(skills || []);
    } catch (error) {
      console.error('Error fetching user skills:', error);
    }
  };

  if (!user) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Please log in to view your profile</p>
        </div>
      </AppLayout>
    );
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin" />
          <span className="ml-2 text-muted-foreground">Loading profile...</span>
        </div>
      </AppLayout>
    );
  }

  if (!profileData) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Unable to load profile data</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Profile Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-xl border border-border overflow-hidden"
        >
          {/* Banner */}
          <div className="h-32 md:h-48 bg-gradient-primary relative">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yIDItNCAyLTRzMiAyIDIgNC0yIDQtMiA0LTItMi0yLTR6bTAtMTJjMC0yIDItNCAyLTRzMiAyIDIgNC0yIDQtMiA0LTItMi0yLTR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
          </div>

          {/* Profile Info */}
          <div className="px-4 md:px-6 pb-6">
            <div className="relative -mt-16 mb-4">
              <UserAvatar
                name={`${profileData.first_name || ''} ${profileData.last_name || ''}`.trim() || profileData.username || 'User'}
                src={profileData.avatar_url || ''}
                size="xl"
                className="ring-4 ring-card"
              />
            </div>

            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold">
                  {`${profileData.first_name || ''} ${profileData.last_name || ''}`.trim() || profileData.username || 'User'}
                </h1>
                <p className="text-muted-foreground">@{profileData.username || 'user'}</p>
                {profileData.headline && (
                  <p className="text-foreground mt-2">{profileData.headline}</p>
                )}

                <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-muted-foreground">
                  {profileData.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {profileData.location}
                    </span>
                  )}
                  {profileData.website && (
                    <span className="flex items-center gap-1">
                      <LinkIcon className="h-4 w-4" />
                      <a
                        href={`https://${profileData.website}`}
                        className="text-primary hover:underline"
                      >
                        {profileData.website}
                      </a>
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Joined {new Date(profileData.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </span>
                </div>

                <div className="flex items-center gap-4 mt-4">
                  <span className="text-sm text-muted-foreground">
                    {profileData.current_position && profileData.current_company && 
                      `${profileData.current_position} at ${profileData.current_company}`
                    }
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {true ? (
                  <Button variant="outline" className="gap-2" onClick={() => setIsEditing(true)}>
                    <Edit3 className="h-4 w-4" />
                    Edit Profile
                  </Button>
                ) : (
                  <>
                    <Button className="gap-2">
                      <UserPlus className="h-4 w-4" />
                      Connect
                    </Button>
                    <Button variant="outline" className="gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Message
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <Tabs defaultValue="posts" className="space-y-6">
          <TabsList className="bg-card border border-border w-full overflow-x-auto flex">
            <TabsTrigger value="posts" className="flex-1 min-w-[70px]">Posts</TabsTrigger>
            <TabsTrigger value="about" className="flex-1 min-w-[70px]">About</TabsTrigger>
            <TabsTrigger value="skills" className="flex-1 min-w-[70px]">Skills</TabsTrigger>
            <TabsTrigger value="connections" className="flex-1 min-w-[90px]">Connections</TabsTrigger>
          </TabsList>

          <TabsContent value="posts" className="space-y-4">
            {userPosts.length > 0 ? (
              userPosts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))
            ) : (
              <div className="bg-card rounded-xl border border-border p-8 text-center">
                <p className="text-muted-foreground">No posts yet</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="about">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card rounded-xl border border-border p-6 space-y-6"
            >
              {profileData.bio && (
                <div>
                  <h3 className="font-semibold mb-3">About</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {profileData.bio}
                  </p>
                </div>
              )}

              {workExperience && workExperience.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    Experience
                  </h3>
                  <div className="space-y-4">
                    {workExperience.map((exp, index) => (
                      <div key={exp.id} className="flex items-start gap-4">
                        <div className="h-12 w-12 rounded-lg bg-gradient-primary flex items-center justify-center text-primary-foreground font-bold">
                          {exp.company.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium">{exp.position}</p>
                          <p className="text-muted-foreground">{exp.company}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(exp.start_date).getFullYear()} - {exp.end_date ? new Date(exp.end_date).getFullYear() : 'Present'}
                          </p>
                          {exp.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {exp.description}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </TabsContent>

          <TabsContent value="skills">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card rounded-xl border border-border p-6"
            >
              <h3 className="font-semibold mb-4">Skills & Expertise</h3>
              <div className="flex flex-wrap gap-2">
                {userSkills && userSkills.length > 0 ? (
                  userSkills.map((skillItem) => (
                    <SkillTag key={skillItem.id} skill={skillItem.skill} variant="primary" />
                  ))
                ) : (
                  <p className="text-muted-foreground">No skills added yet</p>
                )}
              </div>
            </motion.div>
          </TabsContent>

          <TabsContent value="connections">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card rounded-xl border border-border p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Connections
                </h3>
                <Button variant="ghost" size="sm">
                  See all
                </Button>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50"
                  >
                    <UserAvatar
                      name={`User ${i}`}
                      src={`https://i.pravatar.cc/100?img=${i + 20}`}
                      size="md"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">Connection {i}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        Role at Company
                      </p>
                    </div>
                    <Button variant="outline" size="sm">
                      Message
                    </Button>
                  </div>
                ))}
              </div>
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Profile;
