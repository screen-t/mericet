import { useState, useEffect } from "react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Profile } from "@/types/api";
import { SkillsSection } from "@/components/profile/SkillsSection";
import { WorkExperienceSection } from "@/components/profile/WorkExperienceSection";
import { EducationSection } from "@/components/profile/EducationSection";
import {
  Sparkles,
  Briefcase,
  GraduationCap,
  FolderGit2,
  Award,
  Wrench,
  Shield,
  CheckCircle2,
  ExternalLink,
  Plus,
  Trash2,
  Github,
  Linkedin,
  Twitter,
  Clock,
  Info,
} from "lucide-react";

interface VaultAccordionProps {
  userId: string;
  isOwnProfile: boolean;
  profile: Profile;
}

export interface ShowcaseProject {
  id: string;
  title: string;
  description: string;
  tech_stack: string[];
  repo_url?: string;
  demo_url?: string;
  verified: boolean;
}

export interface ShowcaseAchievement {
  id: string;
  title: string;
  issuer: string;
  date?: string;
  description?: string;
  credential_url?: string;
  verified: boolean;
}

const STORAGE_PROJECTS_KEY = "mericet_vault_projects_";
const STORAGE_ACHIEVEMENTS_KEY = "mericet_vault_achievements_";

export const VaultAccordion = ({
  userId,
  isOwnProfile,
  profile,
}: VaultAccordionProps) => {
  const { toast } = useToast();

  // Projects state: Initialize empty; preserve genuine user-entered data if stored
  const [projects, setProjects] = useState<ShowcaseProject[]>([]);
  const [isAddProjectOpen, setIsAddProjectOpen] = useState(false);
  const [projectForm, setProjectForm] = useState({
    title: "",
    description: "",
    tech_stack: "",
    repo_url: "",
    demo_url: "",
  });

  // Achievements state: Initialize empty; preserve genuine user-entered data if stored
  const [achievements, setAchievements] = useState<ShowcaseAchievement[]>([]);
  const [isAddAchievementOpen, setIsAddAchievementOpen] = useState(false);
  const [achievementForm, setAchievementForm] = useState({
    title: "",
    issuer: "",
    date: "",
    description: "",
    credential_url: "",
  });

  // Load user-entered projects and achievements from localStorage scoped to userId
  useEffect(() => {
    try {
      const storedProjects = localStorage.getItem(`${STORAGE_PROJECTS_KEY}${userId}`);
      if (storedProjects) {
        setProjects(JSON.parse(storedProjects));
      } else {
        setProjects([]);
      }

      const storedAchievements = localStorage.getItem(`${STORAGE_ACHIEVEMENTS_KEY}${userId}`);
      if (storedAchievements) {
        setAchievements(JSON.parse(storedAchievements));
      } else {
        setAchievements([]);
      }
    } catch {
      setProjects([]);
      setAchievements([]);
    }
  }, [userId]);

  const handleSaveProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectForm.title.trim()) return;

    // Self-reported entries default to verified: false until verified by a trusted backend pipeline
    const newProject: ShowcaseProject = {
      id: `proj-${Date.now()}`,
      title: projectForm.title.trim(),
      description: projectForm.description.trim(),
      tech_stack: projectForm.tech_stack
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      repo_url: projectForm.repo_url.trim() || undefined,
      demo_url: projectForm.demo_url.trim() || undefined,
      verified: false,
    };

    const updated = [newProject, ...projects];
    setProjects(updated);
    try {
      localStorage.setItem(`${STORAGE_PROJECTS_KEY}${userId}`, JSON.stringify(updated));
    } catch {
      // Ignore storage errors
    }

    toast({ title: "Project added", description: "Project added to your Resume Vault." });
    setProjectForm({ title: "", description: "", tech_stack: "", repo_url: "", demo_url: "" });
    setIsAddProjectOpen(false);
  };

  const handleDeleteProject = (projectId: string) => {
    const updated = projects.filter((p) => p.id !== projectId);
    setProjects(updated);
    try {
      localStorage.setItem(`${STORAGE_PROJECTS_KEY}${userId}`, JSON.stringify(updated));
    } catch {
      // Ignore storage errors
    }
    toast({ title: "Project removed" });
  };

  const handleSaveAchievement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!achievementForm.title.trim()) return;

    // Self-reported entries default to verified: false until verified by a trusted backend pipeline
    const newAchievement: ShowcaseAchievement = {
      id: `ach-${Date.now()}`,
      title: achievementForm.title.trim(),
      issuer: achievementForm.issuer.trim(),
      date: achievementForm.date.trim() || undefined,
      description: achievementForm.description.trim() || undefined,
      credential_url: achievementForm.credential_url.trim() || undefined,
      verified: false,
    };

    const updated = [newAchievement, ...achievements];
    setAchievements(updated);
    try {
      localStorage.setItem(`${STORAGE_ACHIEVEMENTS_KEY}${userId}`, JSON.stringify(updated));
    } catch {
      // Ignore storage errors
    }

    toast({ title: "Achievement added", description: "Achievement added to your Resume Vault." });
    setAchievementForm({
      title: "",
      issuer: "",
      date: "",
      description: "",
      credential_url: "",
    });
    setIsAddAchievementOpen(false);
  };

  const handleDeleteAchievement = (achievementId: string) => {
    const updated = achievements.filter((a) => a.id !== achievementId);
    setAchievements(updated);
    try {
      localStorage.setItem(`${STORAGE_ACHIEVEMENTS_KEY}${userId}`, JSON.stringify(updated));
    } catch {
      // Ignore storage errors
    }
    toast({ title: "Achievement removed" });
  };

  const toAbsoluteUrl = (url: string) =>
    /^https?:\/\//i.test(url) ? url : `https://${url}`;

  // Check configured social profile links accurately
  const hasGithub = Boolean(profile.github_url);
  const hasLinkedin = Boolean(profile.linkedin_url);
  const hasTwitter = Boolean(profile.twitter_url);

  return (
    <div className="space-y-6">
      {/* Privacy Architecture Notice */}
      <Card className="p-4 sm:p-5 bg-muted/40 border-border rounded-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0 mt-0.5 sm:mt-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold flex items-center gap-2">
                Privacy-First Profile Architecture
                <Badge variant="outline" className="text-[10px] font-medium border-muted-foreground/30 text-muted-foreground">
                  ZKP in Development
                </Badge>
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Mericet is built with strict privacy controls. Zero-Knowledge Proof (ZKP) cryptographic
                verification pipelines and Living Graph automated streams are currently in active development.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0 self-end sm:self-auto">
            <Info className="w-3.5 h-3.5" />
            <span>Vault Protected</span>
          </div>
        </div>
      </Card>

      {/* Accordion for the 6 Sections */}
      <Accordion
        type="multiple"
        defaultValue={["skills", "work"]}
        className="w-full space-y-3"
      >
        {/* SECTION 1: Skills */}
        <AccordionItem
          value="skills"
          className="border rounded-xl bg-card px-4 sm:px-6 shadow-sm overflow-hidden"
        >
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center justify-between w-full pr-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500 shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div className="text-sm sm:text-base font-semibold text-foreground flex items-center gap-2">
                    Skills
                    <Badge variant="secondary" className="text-xs font-normal">
                      Technical & Core
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground hidden sm:block">
                    Technical proficiencies, frameworks, and methodologies
                  </p>
                </div>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-5 border-t border-border/40">
            <div className="mt-3">
              <SkillsSection userId={userId} isOwnProfile={isOwnProfile} />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* SECTION 2: Work & Experience */}
        <AccordionItem
          value="work"
          className="border rounded-xl bg-card px-4 sm:px-6 shadow-sm overflow-hidden"
        >
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center justify-between w-full pr-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 shrink-0">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div className="text-sm sm:text-base font-semibold text-foreground flex items-center gap-2">
                    Work & Experience
                    <Badge variant="secondary" className="text-xs font-normal">
                      Career
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground hidden sm:block">
                    Professional employment, leadership roles, and company affiliations
                  </p>
                </div>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-5 border-t border-border/40">
            <div className="mt-3">
              <WorkExperienceSection userId={userId} isOwnProfile={isOwnProfile} />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* SECTION 3: Education */}
        <AccordionItem
          value="education"
          className="border rounded-xl bg-card px-4 sm:px-6 shadow-sm overflow-hidden"
        >
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center justify-between w-full pr-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500 shrink-0">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div className="text-sm sm:text-base font-semibold text-foreground flex items-center gap-2">
                    Education
                    <Badge variant="secondary" className="text-xs font-normal">
                      Academic
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground hidden sm:block">
                    Degrees, universities, specialized certificates, and coursework
                  </p>
                </div>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-5 border-t border-border/40">
            <div className="mt-3">
              <EducationSection userId={userId} isOwnProfile={isOwnProfile} />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* SECTION 4: Projects */}
        <AccordionItem
          value="projects"
          className="border rounded-xl bg-card px-4 sm:px-6 shadow-sm overflow-hidden"
        >
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center justify-between w-full pr-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 shrink-0">
                  <FolderGit2 className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div className="text-sm sm:text-base font-semibold text-foreground flex items-center gap-2">
                    Projects
                    <Badge variant="secondary" className="text-xs font-normal">
                      {projects.length}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground hidden sm:block">
                    Applications, repositories, and engineering deliverables
                  </p>
                </div>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-5 border-t border-border/40">
            <div className="mt-3 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Showcase projects, portfolio codebases, and live product demos.
                </p>
                {isOwnProfile && (
                  <Button size="sm" onClick={() => setIsAddProjectOpen(true)}>
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    Add Project
                  </Button>
                )}
              </div>

              {projects.length === 0 ? (
                <div className="text-center py-8 border border-dashed rounded-xl bg-muted/20">
                  <FolderGit2 className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-60" />
                  <p className="text-sm font-medium text-foreground">No projects added yet</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                    {isOwnProfile
                      ? "Add your top repositories or deployed apps to showcase your work."
                      : "This user has not listed any projects yet."}
                  </p>
                  {isOwnProfile && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3"
                      onClick={() => setIsAddProjectOpen(true)}
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Add Project
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {projects.map((proj) => (
                    <Card key={proj.id} className="p-4 flex flex-col justify-between hover:border-primary/40 transition-colors">
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                            {proj.title}
                            {proj.verified ? (
                              <Badge className="bg-emerald-600/10 text-emerald-600 border-emerald-500/30 text-[10px] font-medium py-0 px-1.5">
                                <CheckCircle2 className="w-2.5 h-2.5 mr-1" />
                                Verified
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground text-[10px] font-normal py-0 px-1.5">
                                Self-Reported
                              </Badge>
                            )}
                          </h4>
                          {isOwnProfile && (
                            <button
                              onClick={() => handleDeleteProject(proj.id)}
                              className="text-muted-foreground hover:text-destructive p-1 transition-colors"
                              title="Delete project"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        {proj.description && (
                          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 mb-3">
                            {proj.description}
                          </p>
                        )}
                        {proj.tech_stack && proj.tech_stack.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {proj.tech_stack.map((tech, idx) => (
                              <Badge key={idx} variant="outline" className="text-[11px] px-2 py-0 font-normal">
                                {tech}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 pt-3 border-t border-border/50 text-xs">
                        {proj.demo_url && (
                          <a
                            href={toAbsoluteUrl(proj.demo_url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Live Demo
                          </a>
                        )}
                        {proj.repo_url && (
                          <a
                            href={toAbsoluteUrl(proj.repo_url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground font-medium ml-auto"
                          >
                            <Github className="w-3.5 h-3.5" />
                            Code
                          </a>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* SECTION 5: Achievements (Badges) */}
        <AccordionItem
          value="achievements"
          className="border rounded-xl bg-card px-4 sm:px-6 shadow-sm overflow-hidden"
        >
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center justify-between w-full pr-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-500/10 text-yellow-500 shrink-0">
                  <Award className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div className="text-sm sm:text-base font-semibold text-foreground flex items-center gap-2">
                    Achievements (Badges)
                    <Badge variant="secondary" className="text-xs font-normal">
                      {achievements.length}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground hidden sm:block">
                    Certifications, hackathon awards, honors, and credentials
                  </p>
                </div>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-5 border-t border-border/40">
            <div className="mt-3 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Credentials, certifications, and awards.
                </p>
                {isOwnProfile && (
                  <Button size="sm" onClick={() => setIsAddAchievementOpen(true)}>
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    Add Achievement
                  </Button>
                )}
              </div>

              {achievements.length === 0 ? (
                <div className="text-center py-8 border border-dashed rounded-xl bg-muted/20">
                  <Award className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-60" />
                  <p className="text-sm font-medium text-foreground">No achievements listed yet</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                    {isOwnProfile
                      ? "Add certificates, honors, or competition recognitions to your Resume Vault."
                      : "This user has not listed any achievements yet."}
                  </p>
                  {isOwnProfile && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3"
                      onClick={() => setIsAddAchievementOpen(true)}
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Add Achievement
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {achievements.map((ach) => (
                    <Card key={ach.id} className="p-4 flex flex-col justify-between hover:border-yellow-500/30 transition-colors">
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div>
                            <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                              {ach.title}
                            </h4>
                            <p className="text-xs font-medium text-muted-foreground">
                              {ach.issuer} {ach.date && `• ${ach.date}`}
                            </p>
                          </div>
                          {isOwnProfile && (
                            <button
                              onClick={() => handleDeleteAchievement(ach.id)}
                              className="text-muted-foreground hover:text-destructive p-1 transition-colors"
                              title="Delete achievement"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {ach.description && (
                          <p className="text-xs text-muted-foreground leading-relaxed my-2 line-clamp-3">
                            {ach.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-border/50 text-xs">
                        {ach.verified ? (
                          <Badge className="bg-emerald-600/10 text-emerald-600 border-emerald-500/30 text-[10px] font-medium">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Verified Credential
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground text-[10px] font-normal">
                            Self-Reported
                          </Badge>
                        )}

                        {ach.credential_url && (
                          <a
                            href={toAbsoluteUrl(ach.credential_url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline text-xs font-medium ml-auto"
                          >
                            <ExternalLink className="w-3 h-3" />
                            View Link
                          </a>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* SECTION 6: Connected Tools' Updates */}
        <AccordionItem
          value="tools"
          className="border rounded-xl bg-card px-4 sm:px-6 shadow-sm overflow-hidden"
        >
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center justify-between w-full pr-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-500 shrink-0">
                  <Wrench className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div className="text-sm sm:text-base font-semibold text-foreground flex items-center gap-2">
                    Connected Tools' Updates
                  </div>
                  <p className="text-xs text-muted-foreground hidden sm:block">
                    Configured platforms and upcoming automated Living Graph integrations
                  </p>
                </div>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-5 border-t border-border/40">
            <div className="mt-3 space-y-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Connect your professional platforms to stream automated verification into the Living Graph once backend integrations are deployed.
              </p>

              {/* Real Platform Status Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* GitHub */}
                <Card className="p-3.5 border bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Github className="w-4 h-4" />
                      <span className="text-xs font-semibold">GitHub</span>
                    </div>
                    {hasGithub ? (
                      <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                        Link Added
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        Not Connected
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {hasGithub
                      ? "Profile URL configured. Live activity sync is in development."
                      : "Add your GitHub URL in profile settings to prepare for integration."}
                  </p>
                  {hasGithub && profile.github_url && (
                    <a
                      href={toAbsoluteUrl(profile.github_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline mt-2 font-medium"
                    >
                      <ExternalLink className="w-3 h-3" />
                      View Profile Link
                    </a>
                  )}
                </Card>

                {/* LinkedIn */}
                <Card className="p-3.5 border bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Linkedin className="w-4 h-4" />
                      <span className="text-xs font-semibold">LinkedIn</span>
                    </div>
                    {hasLinkedin ? (
                      <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                        Link Added
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        Not Connected
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {hasLinkedin
                      ? "Profile URL configured. Network sync is in development."
                      : "Add your LinkedIn URL in profile settings to prepare for integration."}
                  </p>
                  {hasLinkedin && profile.linkedin_url && (
                    <a
                      href={toAbsoluteUrl(profile.linkedin_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline mt-2 font-medium"
                    >
                      <ExternalLink className="w-3 h-3" />
                      View Profile Link
                    </a>
                  )}
                </Card>

                {/* Twitter / X */}
                <Card className="p-3.5 border bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Twitter className="w-4 h-4" />
                      <span className="text-xs font-semibold">Twitter / X</span>
                    </div>
                    {hasTwitter ? (
                      <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                        Link Added
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        Not Connected
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {hasTwitter
                      ? "Profile URL configured. Thoughts feed integration in development."
                      : "Add your Twitter/X handle in profile settings."}
                  </p>
                  {hasTwitter && profile.twitter_url && (
                    <a
                      href={toAbsoluteUrl(profile.twitter_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline mt-2 font-medium"
                    >
                      <ExternalLink className="w-3 h-3" />
                      View Profile Link
                    </a>
                  )}
                </Card>
              </div>

              {/* Status Note on Living Graph */}
              <div className="p-3 rounded-lg border border-dashed bg-muted/20 flex items-start gap-2.5 text-xs text-muted-foreground">
                <Clock className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <p>
                  Automated Living Graph stream and read-only developer tokens are planned for upcoming releases (Tasks #59 & #60). No automated data polling is performed on this branch.
                </p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Add Project Modal */}
      <Dialog open={isAddProjectOpen} onOpenChange={setIsAddProjectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FolderGit2 className="w-5 h-5 text-emerald-500" />
              Add Project
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveProject} className="space-y-4 py-2">
            <div>
              <Label htmlFor="proj-title" className="text-xs font-medium">Project Name *</Label>
              <Input
                id="proj-title"
                value={projectForm.title}
                onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })}
                placeholder="e.g. Distributed Task Engine"
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="proj-desc" className="text-xs font-medium">Description</Label>
              <Textarea
                id="proj-desc"
                value={projectForm.description}
                onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                placeholder="Key problem solved, system architecture, performance achievements..."
                rows={3}
                className="mt-1 text-xs"
              />
            </div>
            <div>
              <Label htmlFor="proj-tech" className="text-xs font-medium">Tech Stack (comma-separated)</Label>
              <Input
                id="proj-tech"
                value={projectForm.tech_stack}
                onChange={(e) => setProjectForm({ ...projectForm, tech_stack: e.target.value })}
                placeholder="e.g. Python, FastAPI, Docker, Redis"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="proj-repo" className="text-xs font-medium">Repository URL</Label>
                <Input
                  id="proj-repo"
                  value={projectForm.repo_url}
                  onChange={(e) => setProjectForm({ ...projectForm, repo_url: e.target.value })}
                  placeholder="https://github.com/..."
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="proj-demo" className="text-xs font-medium">Live Demo URL</Label>
                <Input
                  id="proj-demo"
                  value={projectForm.demo_url}
                  onChange={(e) => setProjectForm({ ...projectForm, demo_url: e.target.value })}
                  placeholder="https://demo.app/..."
                  className="mt-1"
                />
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsAddProjectOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm">
                Save Project
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Achievement Modal */}
      <Dialog open={isAddAchievementOpen} onOpenChange={setIsAddAchievementOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Award className="w-5 h-5 text-yellow-500" />
              Add Achievement / Award
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveAchievement} className="space-y-4 py-2">
            <div>
              <Label htmlFor="ach-title" className="text-xs font-medium">Title *</Label>
              <Input
                id="ach-title"
                value={achievementForm.title}
                onChange={(e) => setAchievementForm({ ...achievementForm, title: e.target.value })}
                placeholder="e.g. Hackathon Winner or AWS Certified"
                required
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="ach-issuer" className="text-xs font-medium">Issuing Organization *</Label>
                <Input
                  id="ach-issuer"
                  value={achievementForm.issuer}
                  onChange={(e) => setAchievementForm({ ...achievementForm, issuer: e.target.value })}
                  placeholder="e.g. Major League Hacking"
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="ach-date" className="text-xs font-medium">Issue Date / Year</Label>
                <Input
                  id="ach-date"
                  value={achievementForm.date}
                  onChange={(e) => setAchievementForm({ ...achievementForm, date: e.target.value })}
                  placeholder="e.g. 2026"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="ach-url" className="text-xs font-medium">Credential / Verification URL</Label>
              <Input
                id="ach-url"
                value={achievementForm.credential_url}
                onChange={(e) => setAchievementForm({ ...achievementForm, credential_url: e.target.value })}
                placeholder="https://..."
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="ach-desc" className="text-xs font-medium">Description</Label>
              <Textarea
                id="ach-desc"
                value={achievementForm.description}
                onChange={(e) => setAchievementForm({ ...achievementForm, description: e.target.value })}
                placeholder="Key accomplishments or score..."
                rows={2}
                className="mt-1 text-xs"
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsAddAchievementOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm">
                Save Achievement
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
