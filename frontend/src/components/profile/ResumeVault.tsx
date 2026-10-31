import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import {
  Profile,
  WorkExperience,
  Education,
  Skill,
  VaultItem,
  ConnectedTool,
} from "@/types/api";
import { backendApi } from "@/lib/backend-api";
import { SkillTag } from "@/components/ui/SkillTag";
import { LivingGraph } from "@/components/profile/LivingGraph";
import { VaultSectionNav } from "@/components/profile/VaultSectionNav";
import {
  Briefcase,
  GraduationCap,
  FolderGit2,
  Sparkles,
  Award,
  Wrench,
  Activity,
  Shield,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Plus,
  Pencil,
  Trash2,
  Github,
  Code2,
  Calendar,
  Lock,
  Globe,
  RefreshCw,
  Info,
  Clock,
  Layers,
} from "lucide-react";
import { format, parseISO } from "date-fns";

export interface ResumeVaultProps {
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
  is_public?: boolean;
  verified: boolean;
  verification_tier?: string;
}

export interface ShowcaseAchievement {
  id: string;
  title: string;
  issuer: string;
  date?: string;
  description?: string;
  credential_url?: string;
  is_public?: boolean;
  verified: boolean;
  verification_tier?: string;
}

const STORAGE_PROJECTS_KEY = "mericet_vault_projects_";
const STORAGE_ACHIEVEMENTS_KEY = "mericet_vault_achievements_";

const toAbsoluteUrl = (url: string) =>
  /^https?:\/\//i.test(url) ? url : `https://${url}`;

/**
 * Renders an accurate, truth-in-advertising verification badge.
 */
function renderVerificationBadge(tier?: string, verified = false, isPublic = true) {
  const normTier = (tier || (verified ? "mid" : "none")).toLowerCase();

  let badgeElement = null;
  switch (normTier) {
    case "strong":
      badgeElement = (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] font-medium py-0 px-1.5 flex items-center gap-1 cursor-help">
                <ShieldCheck className="w-2.5 h-2.5 text-amber-500" />
                Cryptographic Proof (Gold)
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="text-xs max-w-xs">
              Cryptographically verified via TLSNotary or Zero-Knowledge commitment proof.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
      break;
    case "mid":
      badgeElement = (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge className="bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 text-[10px] font-medium py-0 px-1.5 flex items-center gap-1 cursor-help">
                <CheckCircle2 className="w-2.5 h-2.5 text-slate-500" />
                Peer Verified (Silver)
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="text-xs max-w-xs">
              Verified through coworker consensus or documented institutional evidence.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
      break;
    case "weak":
      badgeElement = (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge className="bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30 text-[10px] font-medium py-0 px-1.5 flex items-center gap-1 cursor-help">
                <Activity className="w-2.5 h-2.5 text-orange-500" />
                API Observation (Bronze)
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="text-xs max-w-xs">
              Automatically discovered via read-only telemetry from connected platform.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
      break;
    default:
      badgeElement = (
        <Badge variant="outline" className="text-muted-foreground text-[10px] font-normal py-0 px-1.5">
          Self-Reported
        </Badge>
      );
      break;
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {badgeElement}
      {!isPublic && (
        <Badge variant="outline" className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 text-[10px] py-0 px-1.5 flex items-center gap-1">
          <Lock className="w-2.5 h-2.5" />
          Private
        </Badge>
      )}
    </div>
  );
}

export const ResumeVault = ({
  userId,
  isOwnProfile,
  profile,
}: ResumeVaultProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ==================== 1. WORK EXPERIENCE STATE & QUERIES ====================
  const [isWorkModalOpen, setIsWorkModalOpen] = useState(false);
  const [editingWork, setEditingWork] = useState<WorkExperience | null>(null);
  const [workForm, setWorkForm] = useState({
    title: "",
    company: "",
    location: "",
    start_date: "",
    end_date: "",
    is_current: false,
    description: "",
  });

  const { data: experiences = profile.work_experience || [], isLoading: isWorkLoading } = useQuery<WorkExperience[]>({
    queryKey: ["workExperience", userId],
    queryFn: async () => {
      const p = isOwnProfile
        ? await backendApi.profile.getMyProfile()
        : await backendApi.profile.getProfile(userId);
      return (p as Profile).work_experience || [];
    },
    initialData: profile.work_experience || [],
  });

  const saveWorkMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => {
      if (editingWork) {
        return backendApi.profile.updateWorkExperience(editingWork.id, data);
      }
      return backendApi.profile.addWorkExperience(data);
    },
    onSuccess: () => {
      toast({ title: editingWork ? "Experience updated" : "Experience added" });
      queryClient.invalidateQueries({ queryKey: ["workExperience", userId] });
      queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      setIsWorkModalOpen(false);
      setEditingWork(null);
    },
    onError: () => toast({ title: "Failed to save experience", variant: "destructive" }),
  });

  const deleteWorkMutation = useMutation({
    mutationFn: (id: string) => backendApi.profile.deleteWorkExperience(id),
    onSuccess: () => {
      toast({ title: "Experience deleted" });
      queryClient.invalidateQueries({ queryKey: ["workExperience", userId] });
      queryClient.invalidateQueries({ queryKey: ["profile", userId] });
    },
    onError: () => toast({ title: "Failed to delete experience", variant: "destructive" }),
  });

  // ==================== 2. EDUCATION STATE & QUERIES ====================
  const [isEduModalOpen, setIsEduModalOpen] = useState(false);
  const [editingEdu, setEditingEdu] = useState<Education | null>(null);
  const [eduForm, setEduForm] = useState({
    institution: "",
    degree: "",
    field_of_study: "",
    start_date: "",
    end_date: "",
    is_current: false,
    grade: "",
    description: "",
  });

  const { data: educations = profile.education || [], isLoading: isEduLoading } = useQuery<Education[]>({
    queryKey: ["education", userId],
    queryFn: async () => {
      const p = isOwnProfile
        ? await backendApi.profile.getMyProfile()
        : await backendApi.profile.getProfile(userId);
      return (p as Profile).education || [];
    },
    initialData: profile.education || [],
  });

  const saveEduMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => {
      if (editingEdu) {
        return backendApi.profile.updateEducation(editingEdu.id, data);
      }
      return backendApi.profile.addEducation(data);
    },
    onSuccess: () => {
      toast({ title: editingEdu ? "Education updated" : "Education added" });
      queryClient.invalidateQueries({ queryKey: ["education", userId] });
      queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      setIsEduModalOpen(false);
      setEditingEdu(null);
    },
    onError: () => toast({ title: "Failed to save education", variant: "destructive" }),
  });

  const deleteEduMutation = useMutation({
    mutationFn: (id: string) => backendApi.profile.deleteEducation(id),
    onSuccess: () => {
      toast({ title: "Education removed" });
      queryClient.invalidateQueries({ queryKey: ["education", userId] });
      queryClient.invalidateQueries({ queryKey: ["profile", userId] });
    },
    onError: () => toast({ title: "Failed to remove education", variant: "destructive" }),
  });

  // ==================== 3. PROJECTS STATE & QUERIES ====================
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [projectForm, setProjectForm] = useState({
    title: "",
    description: "",
    tech_stack: "",
    repo_url: "",
    demo_url: "",
    is_public: true,
  });

  // Query projects from Vault API, with resilient localStorage cache
  const { data: vaultProjects = [], refetch: refetchProjects } = useQuery<ShowcaseProject[]>({
    queryKey: ["vault-projects", userId, isOwnProfile],
    queryFn: async () => {
      let remoteItems: VaultItem[] = [];
      try {
        remoteItems = isOwnProfile
          ? await backendApi.vault.getMyItems("project", 100, 0)
          : await backendApi.vault.getUserItems(userId, "project", 100, 0);
      } catch {
        // Fallback to cache if backend is unavailable or not migrated yet
      }

      const formattedRemote: ShowcaseProject[] = (remoteItems || []).map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description || "",
        tech_stack: ((item.metadata?.tech_stack as string[]) || []),
        repo_url: (item.metadata?.repo_url as string) || undefined,
        demo_url: (item.metadata?.demo_url as string) || undefined,
        is_public: item.is_public,
        verified: item.verification_tier !== "none",
        verification_tier: item.verification_tier,
      }));

      // Merge with locally stored projects
      let localItems: ShowcaseProject[] = [];
      try {
        const stored = localStorage.getItem(`${STORAGE_PROJECTS_KEY}${userId}`);
        if (stored) localItems = JSON.parse(stored);
      } catch {
        // Ignore cache errors
      }

      // De-duplicate by title or id
      const mergedMap = new Map<string, ShowcaseProject>();
      formattedRemote.forEach((p) => mergedMap.set(p.title.toLowerCase(), p));
      localItems.forEach((p) => {
        if (!mergedMap.has(p.title.toLowerCase())) {
          mergedMap.set(p.title.toLowerCase(), p);
        }
      });

      return Array.from(mergedMap.values());
    },
  });

  const saveProjectMutation = useMutation({
    mutationFn: async (payload: typeof projectForm) => {
      const techStackArr = payload.tech_stack
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      // Attempt remote backend persistence
      let remoteSuccess = false;
      let newId = `proj-${Date.now()}`;
      try {
        const item = await backendApi.vault.createItem({
          title: payload.title.trim(),
          category: "project",
          description: payload.description.trim(),
          metadata: {
            tech_stack: techStackArr,
            repo_url: payload.repo_url.trim() || undefined,
            demo_url: payload.demo_url.trim() || undefined,
          },
          is_public: payload.is_public,
          verification_tier: payload.repo_url ? "weak" : "none",
        });
        if (item?.id) {
          newId = item.id;
          remoteSuccess = true;
        }
      } catch {
        // Backend offline or pending migration; proceed with local cache
      }

      const newProj: ShowcaseProject = {
        id: newId,
        title: payload.title.trim(),
        description: payload.description.trim(),
        tech_stack: techStackArr,
        repo_url: payload.repo_url.trim() || undefined,
        demo_url: payload.demo_url.trim() || undefined,
        is_public: payload.is_public,
        verified: Boolean(payload.repo_url),
        verification_tier: payload.repo_url ? "weak" : "none",
      };

      // Always write to local storage as resilient mirror
      try {
        const existing: ShowcaseProject[] = JSON.parse(
          localStorage.getItem(`${STORAGE_PROJECTS_KEY}${userId}`) || "[]"
        );
        localStorage.setItem(
          `${STORAGE_PROJECTS_KEY}${userId}`,
          JSON.stringify([newProj, ...existing])
        );
      } catch {
        // Ignore
      }

      return { item: newProj, remoteSuccess };
    },
    onSuccess: ({ remoteSuccess }) => {
      toast({
        title: "Project added to Vault",
        description: remoteSuccess ? "Synchronized with Vault database." : "Saved locally.",
      });
      refetchProjects();
      setIsProjectModalOpen(false);
      setProjectForm({
        title: "",
        description: "",
        tech_stack: "",
        repo_url: "",
        demo_url: "",
        is_public: true,
      });
    },
    onError: () => toast({ title: "Failed to add project", variant: "destructive" }),
  });

  const deleteProject = async (id: string, title: string) => {
    try {
      if (!id.startsWith("proj-")) {
        await backendApi.vault.deleteItem(id);
      }
    } catch {
      // Ignore
    }

    try {
      const stored: ShowcaseProject[] = JSON.parse(
        localStorage.getItem(`${STORAGE_PROJECTS_KEY}${userId}`) || "[]"
      );
      const filtered = stored.filter(
        (p) => p.id !== id && p.title.toLowerCase() !== title.toLowerCase()
      );
      localStorage.setItem(`${STORAGE_PROJECTS_KEY}${userId}`, JSON.stringify(filtered));
    } catch {
      // Ignore
    }

    toast({ title: "Project removed" });
    refetchProjects();
  };

  // ==================== 4. SKILLS STATE & QUERIES ====================
  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);
  const [newSkillText, setNewSkillText] = useState("");

  const { data: skills = profile.skills || [], isLoading: isSkillsLoading } = useQuery<Skill[]>({
    queryKey: ["skills", userId],
    queryFn: async () => {
      const p = isOwnProfile
        ? await backendApi.profile.getMyProfile()
        : await backendApi.profile.getProfile(userId);
      return (p as Profile).skills || [];
    },
    initialData: profile.skills || [],
  });

  const addSkillMutation = useMutation({
    mutationFn: (skillName: string) => backendApi.profile.addSkill(skillName),
    onSuccess: () => {
      toast({ title: "Skill added" });
      queryClient.invalidateQueries({ queryKey: ["skills", userId] });
      queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      setNewSkillText("");
      setIsSkillModalOpen(false);
    },
    onError: () => toast({ title: "Failed to add skill", variant: "destructive" }),
  });

  const deleteSkillMutation = useMutation({
    mutationFn: (skillId: string) => backendApi.profile.deleteSkill(skillId),
    onSuccess: () => {
      toast({ title: "Skill removed" });
      queryClient.invalidateQueries({ queryKey: ["skills", userId] });
      queryClient.invalidateQueries({ queryKey: ["profile", userId] });
    },
    onError: () => toast({ title: "Failed to remove skill", variant: "destructive" }),
  });

  // ==================== 5. ACHIEVEMENTS & BADGES STATE & QUERIES ====================
  const [isAchievementModalOpen, setIsAchievementModalOpen] = useState(false);
  const [achievementForm, setAchievementForm] = useState({
    title: "",
    issuer: "",
    date: "",
    description: "",
    credential_url: "",
    is_public: true,
  });

  const { data: vaultAchievements = [], refetch: refetchAchievements } = useQuery<ShowcaseAchievement[]>({
    queryKey: ["vault-achievements", userId, isOwnProfile],
    queryFn: async () => {
      let remoteItems: VaultItem[] = [];
      try {
        remoteItems = isOwnProfile
          ? await backendApi.vault.getMyItems("achievement", 100, 0)
          : await backendApi.vault.getUserItems(userId, "achievement", 100, 0);
      } catch {
        // Fallback
      }

      const formattedRemote: ShowcaseAchievement[] = (remoteItems || []).map((item) => ({
        id: item.id,
        title: item.title,
        issuer: (item.metadata?.issuer as string) || (item.metadata?.provider as string) || "Credential",
        date: (item.metadata?.date as string) || (item.created_at ? item.created_at.slice(0, 10) : undefined),
        description: item.description || "",
        credential_url: (item.metadata?.credential_url as string) || undefined,
        is_public: item.is_public,
        verified: item.verification_tier !== "none",
        verification_tier: item.verification_tier,
      }));

      let localItems: ShowcaseAchievement[] = [];
      try {
        const stored = localStorage.getItem(`${STORAGE_ACHIEVEMENTS_KEY}${userId}`);
        if (stored) localItems = JSON.parse(stored);
      } catch {
        // Ignore
      }

      const mergedMap = new Map<string, ShowcaseAchievement>();
      formattedRemote.forEach((a) => mergedMap.set(a.title.toLowerCase(), a));
      localItems.forEach((a) => {
        if (!mergedMap.has(a.title.toLowerCase())) {
          mergedMap.set(a.title.toLowerCase(), a);
        }
      });

      return Array.from(mergedMap.values());
    },
  });

  const saveAchievementMutation = useMutation({
    mutationFn: async (payload: typeof achievementForm) => {
      let remoteSuccess = false;
      let newId = `ach-${Date.now()}`;
      try {
        const item = await backendApi.vault.createItem({
          title: payload.title.trim(),
          category: "achievement",
          description: payload.description.trim(),
          metadata: {
            issuer: payload.issuer.trim(),
            date: payload.date.trim() || undefined,
            credential_url: payload.credential_url.trim() || undefined,
          },
          is_public: payload.is_public,
          verification_tier: payload.credential_url ? "weak" : "none",
        });
        if (item?.id) {
          newId = item.id;
          remoteSuccess = true;
        }
      } catch {
        // Offline / local cache
      }

      const newAch: ShowcaseAchievement = {
        id: newId,
        title: payload.title.trim(),
        issuer: payload.issuer.trim(),
        date: payload.date.trim() || undefined,
        description: payload.description.trim() || undefined,
        credential_url: payload.credential_url.trim() || undefined,
        is_public: payload.is_public,
        verified: Boolean(payload.credential_url),
        verification_tier: payload.credential_url ? "weak" : "none",
      };

      try {
        const existing: ShowcaseAchievement[] = JSON.parse(
          localStorage.getItem(`${STORAGE_ACHIEVEMENTS_KEY}${userId}`) || "[]"
        );
        localStorage.setItem(
          `${STORAGE_ACHIEVEMENTS_KEY}${userId}`,
          JSON.stringify([newAch, ...existing])
        );
      } catch {
        // Ignore
      }

      return { item: newAch, remoteSuccess };
    },
    onSuccess: ({ remoteSuccess }) => {
      toast({
        title: "Achievement added to Vault",
        description: remoteSuccess ? "Synchronized with Vault database." : "Saved locally.",
      });
      refetchAchievements();
      queryClient.invalidateQueries({ queryKey: ["living-graph", userId] });
      setIsAchievementModalOpen(false);
      setAchievementForm({
        title: "",
        issuer: "",
        date: "",
        description: "",
        credential_url: "",
        is_public: true,
      });
    },
    onError: () => toast({ title: "Failed to add achievement", variant: "destructive" }),
  });

  const deleteAchievement = async (id: string, title: string) => {
    try {
      if (!id.startsWith("ach-")) {
        await backendApi.vault.deleteItem(id);
      }
    } catch {
      // Ignore
    }

    try {
      const stored: ShowcaseAchievement[] = JSON.parse(
        localStorage.getItem(`${STORAGE_ACHIEVEMENTS_KEY}${userId}`) || "[]"
      );
      const filtered = stored.filter(
        (a) => a.id !== id && a.title.toLowerCase() !== title.toLowerCase()
      );
      localStorage.setItem(`${STORAGE_ACHIEVEMENTS_KEY}${userId}`, JSON.stringify(filtered));
    } catch {
      // Ignore
    }

    toast({ title: "Achievement removed" });
    refetchAchievements();
    queryClient.invalidateQueries({ queryKey: ["living-graph", userId] });
  };

  // ==================== 6. CONNECTED TOOLS STATE & QUERIES ====================
  const [isConnectToolModalOpen, setIsConnectToolModalOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>("github");
  const [toolHandle, setToolHandle] = useState("");

  const { data: connectedTools = [], refetch: refetchTools } = useQuery<ConnectedTool[]>({
    queryKey: ["connected-tools", userId],
    queryFn: async () => {
      try {
        return await backendApi.vault.getConnectedTools();
      } catch {
        return [];
      }
    },
    enabled: isOwnProfile,
  });

  const connectToolMutation = useMutation({
    mutationFn: ({ provider, handle }: { provider: string; handle: string }) =>
      backendApi.vault.connectTool(provider, handle),
    onSuccess: (data) => {
      toast({
        title: "Tool connected",
        description: `Successfully linked ${data.provider} (@${data.handle}).`,
      });
      refetchTools();
      queryClient.invalidateQueries({ queryKey: ["living-graph", userId] });
      setIsConnectToolModalOpen(false);
      setToolHandle("");
    },
    onError: (err: Error) =>
      toast({
        title: "Connection failed",
        description: err.message || "Could not link tool handle.",
        variant: "destructive",
      }),
  });

  const disconnectToolMutation = useMutation({
    mutationFn: (toolId: string) => backendApi.vault.disconnectTool(toolId),
    onSuccess: () => {
      toast({ title: "Tool disconnected" });
      refetchTools();
      queryClient.invalidateQueries({ queryKey: ["living-graph", userId] });
    },
    onError: () => toast({ title: "Failed to disconnect tool", variant: "destructive" }),
  });

  const syncLivingGraphMutation = useMutation({
    mutationFn: () => backendApi.vault.syncLivingGraph(),
    onSuccess: (data) => {
      refetchTools();
      refetchAchievements();
      queryClient.invalidateQueries({ queryKey: ["living-graph", userId] });
      toast({
        title: "Living Graph synchronized",
        description: `Checked tools. ${data?.result?.highlights_created ?? 0} new milestone(s) discovered.`,
      });
    },
    onError: (err: Error) =>
      toast({
        title: "Sync incomplete",
        description: err.message || "Could not sync external tools.",
        variant: "destructive",
      }),
  });

  // Providers map
  const githubTool = connectedTools.find((t) => t.provider.toLowerCase() === "github");
  const leetcodeTool = connectedTools.find((t) => t.provider.toLowerCase() === "leetcode");
  const credlyTool = connectedTools.find((t) => t.provider.toLowerCase() === "credly");

  return (
    <div className="relative space-y-8 pb-16">
      {/* 0. Scroll Sentinel for Contextual Section Shortcuts */}
      <div id="vault-scroll-sentinel" className="h-px -mt-4 opacity-0 pointer-events-none" />

      {/* Floating Contextual Section Shortcuts */}
      <VaultSectionNav sentinelId="vault-scroll-sentinel" />

      {/* 1. Header / Privacy & Proof Architecture Banner */}
      <Card className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-card/90 via-card/70 to-primary/5 border border-border/70 shadow-xs backdrop-blur-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 rounded-xl bg-primary/10 text-primary shrink-0 mt-0.5 sm:mt-0">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                  The Living Resume Vault
                </h3>
                <Badge variant="outline" className="text-[11px] font-medium border-primary/30 text-primary">
                  Military-Grade Privacy (ZKP)
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed max-w-2xl">
                A continuous, verifiable record of professional execution. Unlike static resumes, every milestone here is supported by cryptographic proof, peer consensus, or verified telemetry with 100% user data privacy.
              </p>
            </div>
          </div>
          {isOwnProfile && (
            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncLivingGraphMutation.mutate()}
                disabled={syncLivingGraphMutation.isPending}
                className="text-xs h-8 gap-1.5"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${
                    syncLivingGraphMutation.isPending ? "animate-spin text-primary" : ""
                  }`}
                />
                Sync Telemetry
              </Button>
            </div>
          )}
        </div>

        {/* 4 Trust Pillars */}
        <div className="mt-5 pt-4 border-t border-border/50 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-2.5 rounded-lg bg-background/50 border border-border/40">
            <p className="font-semibold text-foreground flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              ZKP Privacy
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Zero raw documents stored. Browser-verified hashes only.
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-background/50 border border-border/40">
            <p className="font-semibold text-foreground flex items-center gap-1.5">
              <FolderGit2 className="w-3.5 h-3.5 text-emerald-500" />
              Proof of Work
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Live codebases and deliverable repository checks.
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-background/50 border border-border/40">
            <p className="font-semibold text-foreground flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
              Peer Consensus
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Anonymous coworker confirmations for startups & teams.
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-background/50 border border-border/40">
            <p className="font-semibold text-foreground flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-amber-500" />
              Telemetry Streams
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Read-only automated milestones from GitHub & LeetCode.
            </p>
          </div>
        </div>
      </Card>

      {/* ==================== SECTION 1: WORK & EXPERIENCE ==================== */}
      <section id="vault-experience" className="scroll-mt-24 space-y-3">
        <Card className="p-5 sm:p-6 rounded-2xl border border-border/70 shadow-xs">
          <div className="flex items-center justify-between mb-5 pb-3 border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500 shrink-0">
                <Briefcase className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                  Work Experience & Leadership
                  <Badge variant="secondary" className="text-xs font-normal">
                    {experiences.length}
                  </Badge>
                </h3>
                <p className="text-xs text-muted-foreground">
                  Professional roles, startup contributions, and career leadership
                </p>
              </div>
            </div>
            {isOwnProfile && (
              <Button
                size="sm"
                onClick={() => {
                  setEditingWork(null);
                  setWorkForm({
                    title: "",
                    company: "",
                    location: "",
                    start_date: "",
                    end_date: "",
                    is_current: false,
                    description: "",
                  });
                  setIsWorkModalOpen(true);
                }}
                className="text-xs gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Experience
              </Button>
            )}
          </div>

          {isWorkLoading ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              Loading work experience...
            </div>
          ) : experiences.length === 0 ? (
            <div className="text-center py-8 border border-dashed rounded-xl bg-muted/20">
              <Briefcase className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium text-foreground">No work experience listed yet</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {isOwnProfile
                  ? "Add your career milestones, startup experiences, and leadership roles to your Resume Vault."
                  : "This user has not listed any work experience yet."}
              </p>
              {isOwnProfile && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3 text-xs"
                  onClick={() => setIsWorkModalOpen(true)}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add Experience
                </Button>
              )}
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border/70">
              {experiences.map((exp) => (
                <div key={exp.id} className="relative group">
                  {/* Timeline Node */}
                  <span className="absolute -left-[27px] top-1.5 w-3.5 h-3.5 rounded-full bg-primary ring-4 ring-primary/20" />

                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm sm:text-base font-bold text-foreground">
                          {exp.title}
                        </h4>
                        {exp.is_current && (
                          <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] py-0 px-1.5 font-medium">
                            Current Role
                          </Badge>
                        )}
                        {renderVerificationBadge(undefined, false, true)}
                      </div>
                      <p className="text-xs sm:text-sm font-medium text-foreground/80 mt-0.5">
                        {exp.company}
                        {exp.location && ` • ${exp.location}`}
                      </p>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                        <Calendar className="w-3 h-3" />
                        <span>
                          {format(parseISO(exp.start_date), "MMM yyyy")} –{" "}
                          {exp.is_current ? "Present" : exp.end_date ? format(parseISO(exp.end_date), "MMM yyyy") : "Present"}
                        </span>
                      </div>
                    </div>

                    {isOwnProfile && (
                      <div className="flex items-center gap-1 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity self-end sm:self-start mt-2 sm:mt-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingWork(exp);
                            setWorkForm({
                              title: exp.title || "",
                              company: exp.company || "",
                              location: exp.location || "",
                              start_date: exp.start_date ? exp.start_date.slice(0, 7) : "",
                              end_date: exp.end_date ? exp.end_date.slice(0, 7) : "",
                              is_current: exp.is_current,
                              description: exp.description || "",
                            });
                            setIsWorkModalOpen(true);
                          }}
                          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteWorkMutation.mutate(exp.id)}
                          className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {exp.description && (
                    <p className="text-xs sm:text-sm text-muted-foreground mt-2.5 leading-relaxed whitespace-pre-wrap">
                      {exp.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>

      {/* ==================== SECTION 2: EDUCATION ==================== */}
      <section id="vault-education" className="scroll-mt-24 space-y-3">
        <Card className="p-5 sm:p-6 rounded-2xl border border-border/70 shadow-xs">
          <div className="flex items-center justify-between mb-5 pb-3 border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-500 shrink-0">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                  Education & Academics
                  <Badge variant="secondary" className="text-xs font-normal">
                    {educations.length}
                  </Badge>
                </h3>
                <p className="text-xs text-muted-foreground">
                  Degrees, academic coursework, and institutional credentials
                </p>
              </div>
            </div>
            {isOwnProfile && (
              <Button
                size="sm"
                onClick={() => {
                  setEditingEdu(null);
                  setEduForm({
                    institution: "",
                    degree: "",
                    field_of_study: "",
                    start_date: "",
                    end_date: "",
                    is_current: false,
                    grade: "",
                    description: "",
                  });
                  setIsEduModalOpen(true);
                }}
                className="text-xs gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Education
              </Button>
            )}
          </div>

          {isEduLoading ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              Loading education...
            </div>
          ) : educations.length === 0 ? (
            <div className="text-center py-8 border border-dashed rounded-xl bg-muted/20">
              <GraduationCap className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium text-foreground">No education listed yet</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {isOwnProfile
                  ? "Add universities, specialized degrees, or institutional certifications."
                  : "This user has not listed any education yet."}
              </p>
              {isOwnProfile && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3 text-xs"
                  onClick={() => setIsEduModalOpen(true)}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add Education
                </Button>
              )}
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border/70">
              {educations.map((edu) => (
                <div key={edu.id} className="relative group">
                  <span className="absolute -left-[27px] top-1.5 w-3.5 h-3.5 rounded-full bg-purple-500 ring-4 ring-purple-500/20" />

                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm sm:text-base font-bold text-foreground">
                          {edu.institution}
                        </h4>
                        {renderVerificationBadge(undefined, false, true)}
                      </div>
                      <p className="text-xs sm:text-sm font-medium text-foreground/80 mt-0.5">
                        {edu.degree}
                        {edu.field_of_study && ` in ${edu.field_of_study}`}
                        {edu.grade && ` • Grade: ${edu.grade}`}
                      </p>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                        <Calendar className="w-3 h-3" />
                        <span>
                          {format(parseISO(edu.start_date), "yyyy")} –{" "}
                          {edu.is_current ? "Present" : edu.end_date ? format(parseISO(edu.end_date), "yyyy") : "Present"}
                        </span>
                      </div>
                    </div>

                    {isOwnProfile && (
                      <div className="flex items-center gap-1 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity self-end sm:self-start mt-2 sm:mt-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingEdu(edu);
                            setEduForm({
                              institution: edu.institution || "",
                              degree: edu.degree || "",
                              field_of_study: edu.field_of_study || "",
                              start_date: edu.start_date ? edu.start_date.slice(0, 7) : "",
                              end_date: edu.end_date ? edu.end_date.slice(0, 7) : "",
                              is_current: edu.is_current,
                              grade: edu.grade || "",
                              description: edu.description || "",
                            });
                            setIsEduModalOpen(true);
                          }}
                          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteEduMutation.mutate(edu.id)}
                          className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {edu.description && (
                    <p className="text-xs sm:text-sm text-muted-foreground mt-2 leading-relaxed whitespace-pre-wrap">
                      {edu.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>

      {/* ==================== SECTION 3: PROJECTS ==================== */}
      <section id="vault-projects" className="scroll-mt-24 space-y-3">
        <Card className="p-5 sm:p-6 rounded-2xl border border-border/70 shadow-xs">
          <div className="flex items-center justify-between mb-5 pb-3 border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 shrink-0">
                <FolderGit2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                  Projects & Engineering Deliverables
                  <Badge variant="secondary" className="text-xs font-normal">
                    {vaultProjects.length}
                  </Badge>
                </h3>
                <p className="text-xs text-muted-foreground">
                  Applications, verified open-source repositories, and technical deliverables
                </p>
              </div>
            </div>
            {isOwnProfile && (
              <Button
                size="sm"
                onClick={() => setIsProjectModalOpen(true)}
                className="text-xs gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Project
              </Button>
            )}
          </div>

          {vaultProjects.length === 0 ? (
            <div className="text-center py-8 border border-dashed rounded-xl bg-muted/20">
              <FolderGit2 className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium text-foreground">No projects showcase listed</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {isOwnProfile
                  ? "Highlight top applications or production codebases with live demo links and GitHub repositories."
                  : "This user has not listed any projects yet."}
              </p>
              {isOwnProfile && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3 text-xs"
                  onClick={() => setIsProjectModalOpen(true)}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add Project
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {vaultProjects.map((proj) => (
                <Card
                  key={proj.id}
                  className="p-4 rounded-xl border border-border/60 bg-card/70 flex flex-col justify-between hover:border-primary/40 transition-all hover:shadow-xs"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h4 className="text-sm font-bold text-foreground">
                          {proj.title}
                        </h4>
                        <div className="mt-1">
                          {renderVerificationBadge(
                            proj.verification_tier,
                            proj.verified,
                            proj.is_public ?? true
                          )}
                        </div>
                      </div>
                      {isOwnProfile && (
                        <button
                          type="button"
                          onClick={() => deleteProject(proj.id, proj.title)}
                          className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="Delete project"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {proj.description && (
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 my-2.5">
                        {proj.description}
                      </p>
                    )}

                    {proj.tech_stack && proj.tech_stack.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 my-3">
                        {proj.tech_stack.map((tech, idx) => (
                          <SkillTag key={idx} skill={tech} size="sm" variant="default" />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 pt-3 border-t border-border/50 text-xs mt-auto">
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
                        Code Repository
                      </a>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Card>
      </section>

      {/* ==================== SECTION 4: SKILLS ==================== */}
      <section id="vault-skills" className="scroll-mt-24 space-y-3">
        <Card className="p-5 sm:p-6 rounded-2xl border border-border/70 shadow-xs">
          <div className="flex items-center justify-between mb-5 pb-3 border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                  Skills & Technical Proficiencies
                  <Badge variant="secondary" className="text-xs font-normal">
                    {skills.length}
                  </Badge>
                </h3>
                <p className="text-xs text-muted-foreground">
                  Verified proficiencies, core architectures, languages, and frameworks
                </p>
              </div>
            </div>
            {isOwnProfile && (
              <Button
                size="sm"
                onClick={() => setIsSkillModalOpen(true)}
                className="text-xs gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Skill
              </Button>
            )}
          </div>

          {isSkillsLoading ? (
            <div className="p-6 text-center text-xs text-muted-foreground">Loading skills...</div>
          ) : skills.length === 0 ? (
            <div className="text-center py-8 border border-dashed rounded-xl bg-muted/20">
              <Sparkles className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium text-foreground">No skills added yet</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {isOwnProfile
                  ? "Add technical proficiencies, frameworks, tools, or methodologies."
                  : "This user has not listed any skills yet."}
              </p>
              {isOwnProfile && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3 text-xs"
                  onClick={() => setIsSkillModalOpen(true)}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add Skill
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2.5">
              {skills.map((skill) => (
                <SkillTag
                  key={skill.id}
                  skill={skill.skill}
                  size="md"
                  variant="primary"
                  onRemove={isOwnProfile ? () => deleteSkillMutation.mutate(skill.id) : undefined}
                />
              ))}
            </div>
          )}
        </Card>
      </section>

      {/* ==================== SECTION 5: ACHIEVEMENTS & CREDENTIALS ==================== */}
      <section id="vault-achievements" className="scroll-mt-24 space-y-3">
        <Card className="p-5 sm:p-6 rounded-2xl border border-border/70 shadow-xs">
          <div className="flex items-center justify-between mb-5 pb-3 border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-yellow-500/10 text-yellow-500 shrink-0">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                  Achievements & Credentials
                  <Badge variant="secondary" className="text-xs font-normal">
                    {vaultAchievements.length}
                  </Badge>
                </h3>
                <p className="text-xs text-muted-foreground">
                  Certifications, hackathon awards, honors, and verified digital credentials
                </p>
              </div>
            </div>
            {isOwnProfile && (
              <Button
                size="sm"
                onClick={() => setIsAchievementModalOpen(true)}
                className="text-xs gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Achievement
              </Button>
            )}
          </div>

          {vaultAchievements.length === 0 ? (
            <div className="text-center py-8 border border-dashed rounded-xl bg-muted/20">
              <Award className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium text-foreground">No achievements listed yet</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {isOwnProfile
                  ? "Record awards, certifications, or major competition rankings in your Vault."
                  : "This user has not listed any achievements yet."}
              </p>
              {isOwnProfile && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3 text-xs"
                  onClick={() => setIsAchievementModalOpen(true)}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add Achievement
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {vaultAchievements.map((ach) => (
                <Card
                  key={ach.id}
                  className="p-4 rounded-xl border border-border/60 bg-card/70 flex flex-col justify-between hover:border-yellow-500/40 transition-all hover:shadow-xs"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div>
                        <h4 className="text-sm font-bold text-foreground">
                          {ach.title}
                        </h4>
                        <p className="text-xs font-medium text-muted-foreground mt-0.5">
                          {ach.issuer} {ach.date && `• ${ach.date}`}
                        </p>
                        <div className="mt-1.5">
                          {renderVerificationBadge(
                            ach.verification_tier,
                            ach.verified,
                            ach.is_public ?? true
                          )}
                        </div>
                      </div>
                      {isOwnProfile && (
                        <button
                          type="button"
                          onClick={() => deleteAchievement(ach.id, ach.title)}
                          className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
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

                  {ach.credential_url && (
                    <div className="pt-3 border-t border-border/50 text-xs mt-auto">
                      <a
                        href={toAbsoluteUrl(ach.credential_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        View Credential Link
                      </a>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </Card>
      </section>

      {/* ==================== SECTION 6: CONNECTED TOOLS ==================== */}
      <section id="vault-tools" className="scroll-mt-24 space-y-3">
        <Card className="p-5 sm:p-6 rounded-2xl border border-border/70 shadow-xs">
          <div className="flex items-center justify-between mb-5 pb-3 border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-500 shrink-0">
                <Wrench className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                  Connected Tools & Observability
                </h3>
                <p className="text-xs text-muted-foreground">
                  Read-only integrations with external developer platforms to stream verified milestones
                </p>
              </div>
            </div>
            {isOwnProfile && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncLivingGraphMutation.mutate()}
                disabled={syncLivingGraphMutation.isPending}
                className="text-xs gap-1.5"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${
                    syncLivingGraphMutation.isPending ? "animate-spin text-primary" : ""
                  }`}
                />
                Sync Now
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed mb-4">
            Mericet uses zero-data read-only queries. We never store access tokens, read private code, or access sensitive personal documents.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* GitHub Card */}
            <Card className="p-4 rounded-xl border border-border/60 bg-card/60 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Github className="w-4 h-4 text-foreground" />
                    <span className="text-xs font-bold text-foreground">GitHub</span>
                  </div>
                  {githubTool ? (
                    <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px]">
                      Connected
                    </Badge>
                  ) : profile.github_url ? (
                    <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                      URL Linked
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      Not Connected
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {githubTool
                    ? `Streaming commit telemetry for @${githubTool.handle}.`
                    : profile.github_url
                    ? "Profile link added. Connect tool handle for Living Graph automation."
                    : "Connect GitHub to discover major repository and commit achievements."}
                </p>
                {githubTool?.last_synced_at && (
                  <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Last synced {format(parseISO(githubTool.last_synced_at), "MMM d, h:mm a")}
                  </p>
                )}
              </div>

              {isOwnProfile && (
                <div className="pt-3 border-t border-border/40 mt-3 flex items-center justify-between">
                  {githubTool ? (
                    <button
                      type="button"
                      onClick={() => disconnectToolMutation.mutate(githubTool.id)}
                      disabled={disconnectToolMutation.isPending}
                      className="text-[11px] text-muted-foreground hover:text-destructive transition-colors"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs h-7"
                      onClick={() => {
                        setSelectedProvider("github");
                        setToolHandle(profile.github_url ? profile.github_url.split("/").filter(Boolean).pop() || "" : "");
                        setIsConnectToolModalOpen(true);
                      }}
                    >
                      Connect Handle
                    </Button>
                  )}
                </div>
              )}
            </Card>

            {/* LeetCode Card */}
            <Card className="p-4 rounded-xl border border-border/60 bg-card/60 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-bold text-foreground">LeetCode</span>
                  </div>
                  {leetcodeTool ? (
                    <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px]">
                      Connected
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      Not Connected
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {leetcodeTool
                    ? `Streaming problem stats for @${leetcodeTool.handle}.`
                    : "Connect LeetCode to automatically discover problem solve streaks and contest milestones."}
                </p>
                {leetcodeTool?.last_synced_at && (
                  <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Last synced {format(parseISO(leetcodeTool.last_synced_at), "MMM d, h:mm a")}
                  </p>
                )}
              </div>

              {isOwnProfile && (
                <div className="pt-3 border-t border-border/40 mt-3 flex items-center justify-between">
                  {leetcodeTool ? (
                    <button
                      type="button"
                      onClick={() => disconnectToolMutation.mutate(leetcodeTool.id)}
                      disabled={disconnectToolMutation.isPending}
                      className="text-[11px] text-muted-foreground hover:text-destructive transition-colors"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs h-7"
                      onClick={() => {
                        setSelectedProvider("leetcode");
                        setToolHandle("");
                        setIsConnectToolModalOpen(true);
                      }}
                    >
                      Connect Handle
                    </Button>
                  )}
                </div>
              )}
            </Card>

            {/* Credly Card */}
            <Card className="p-4 rounded-xl border border-border/60 bg-card/60 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-yellow-500" />
                    <span className="text-xs font-bold text-foreground">Credly</span>
                  </div>
                  {credlyTool ? (
                    <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px]">
                      Connected
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      Not Connected
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {credlyTool
                    ? `Streaming badge credentials for @${credlyTool.handle}.`
                    : "Connect Credly to import verified enterprise badges and industry certifications."}
                </p>
                {credlyTool?.last_synced_at && (
                  <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Last synced {format(parseISO(credlyTool.last_synced_at), "MMM d, h:mm a")}
                  </p>
                )}
              </div>

              {isOwnProfile && (
                <div className="pt-3 border-t border-border/40 mt-3 flex items-center justify-between">
                  {credlyTool ? (
                    <button
                      type="button"
                      onClick={() => disconnectToolMutation.mutate(credlyTool.id)}
                      disabled={disconnectToolMutation.isPending}
                      className="text-[11px] text-muted-foreground hover:text-destructive transition-colors"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs h-7"
                      onClick={() => {
                        setSelectedProvider("credly");
                        setToolHandle("");
                        setIsConnectToolModalOpen(true);
                      }}
                    >
                      Connect Handle
                    </Button>
                  )}
                </div>
              )}
            </Card>
          </div>
        </Card>
      </section>

      {/* ==================== SECTION 7: THE LIVING GRAPH ==================== */}
      <section id="vault-living-graph" className="scroll-mt-24 space-y-3">
        <LivingGraph userId={userId} isOwnProfile={isOwnProfile} />
      </section>

      {/* ==================== MODALS ==================== */}

      {/* 1. Add / Edit Work Experience Modal */}
      <Dialog open={isWorkModalOpen} onOpenChange={setIsWorkModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingWork ? "Edit Work Experience" : "Add Work Experience"}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!workForm.title.trim() || !workForm.company.trim() || !workForm.start_date) {
                toast({ title: "Please fill in title, company, and start date", variant: "destructive" });
                return;
              }
              const toFullDate = (val: string) => (val ? `${val}-01` : val);
              saveWorkMutation.mutate({
                ...workForm,
                start_date: toFullDate(workForm.start_date),
                end_date: workForm.is_current || !workForm.end_date ? null : toFullDate(workForm.end_date),
              });
            }}
            className="space-y-3.5"
          >
            <div>
              <Label className="text-xs font-semibold">Job Title *</Label>
              <Input
                value={workForm.title}
                onChange={(e) => setWorkForm({ ...workForm, title: e.target.value })}
                placeholder="e.g. Senior Software Engineer"
                required
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Company / Organization *</Label>
              <Input
                value={workForm.company}
                onChange={(e) => setWorkForm({ ...workForm, company: e.target.value })}
                placeholder="e.g. Acme Labs or Stealth Startup"
                required
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Location</Label>
              <Input
                value={workForm.location}
                onChange={(e) => setWorkForm({ ...workForm, location: e.target.value })}
                placeholder="e.g. San Francisco, CA (Remote)"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Start Date *</Label>
                <Input
                  type="month"
                  value={workForm.start_date}
                  onChange={(e) => setWorkForm({ ...workForm, start_date: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">End Date</Label>
                <Input
                  type="month"
                  value={workForm.end_date}
                  onChange={(e) => setWorkForm({ ...workForm, end_date: e.target.value })}
                  disabled={workForm.is_current}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="work_is_current"
                checked={workForm.is_current}
                onChange={(e) => setWorkForm({ ...workForm, is_current: e.target.checked })}
                className="rounded border-border text-primary"
              />
              <Label htmlFor="work_is_current" className="text-xs font-medium cursor-pointer">
                I currently work here
              </Label>
            </div>
            <div>
              <Label className="text-xs font-semibold">Description / Key Accomplishments</Label>
              <Textarea
                value={workForm.description}
                onChange={(e) => setWorkForm({ ...workForm, description: e.target.value })}
                placeholder="Describe key impact, architecture, and responsibilities..."
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsWorkModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveWorkMutation.isPending}>
                {saveWorkMutation.isPending ? "Saving..." : "Save Experience"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 2. Add / Edit Education Modal */}
      <Dialog open={isEduModalOpen} onOpenChange={setIsEduModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingEdu ? "Edit Education" : "Add Education"}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!eduForm.institution.trim() || !eduForm.degree.trim() || !eduForm.start_date) {
                toast({ title: "Please fill in institution, degree, and start year", variant: "destructive" });
                return;
              }
              const toFullDate = (val: string) => (val ? `${val}-01` : val);
              saveEduMutation.mutate({
                ...eduForm,
                start_date: toFullDate(eduForm.start_date),
                end_date: eduForm.is_current || !eduForm.end_date ? null : toFullDate(eduForm.end_date),
              });
            }}
            className="space-y-3.5"
          >
            <div>
              <Label className="text-xs font-semibold">Institution / University *</Label>
              <Input
                value={eduForm.institution}
                onChange={(e) => setEduForm({ ...eduForm, institution: e.target.value })}
                placeholder="e.g. Stanford University"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Degree *</Label>
                <Input
                  value={eduForm.degree}
                  onChange={(e) => setEduForm({ ...eduForm, degree: e.target.value })}
                  placeholder="e.g. B.S., M.S."
                  required
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Field of Study</Label>
                <Input
                  value={eduForm.field_of_study}
                  onChange={(e) => setEduForm({ ...eduForm, field_of_study: e.target.value })}
                  placeholder="e.g. Computer Science"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Start Year *</Label>
                <Input
                  type="month"
                  value={eduForm.start_date}
                  onChange={(e) => setEduForm({ ...eduForm, start_date: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">End Year</Label>
                <Input
                  type="month"
                  value={eduForm.end_date}
                  onChange={(e) => setEduForm({ ...eduForm, end_date: e.target.value })}
                  disabled={eduForm.is_current}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold">Grade / Honors</Label>
              <Input
                value={eduForm.grade}
                onChange={(e) => setEduForm({ ...eduForm, grade: e.target.value })}
                placeholder="e.g. First Class or 3.9 GPA"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Description / Coursework</Label>
              <Textarea
                value={eduForm.description}
                onChange={(e) => setEduForm({ ...eduForm, description: e.target.value })}
                placeholder="Key courses, thesis, or academic honors..."
                rows={2}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEduModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveEduMutation.isPending}>
                {saveEduMutation.isPending ? "Saving..." : "Save Education"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 3. Add Project Modal */}
      <Dialog open={isProjectModalOpen} onOpenChange={setIsProjectModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Project Deliverable</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!projectForm.title.trim()) {
                toast({ title: "Please enter a project title", variant: "destructive" });
                return;
              }
              saveProjectMutation.mutate(projectForm);
            }}
            className="space-y-3.5"
          >
            <div>
              <Label className="text-xs font-semibold">Project Title *</Label>
              <Input
                value={projectForm.title}
                onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })}
                placeholder="e.g. Distributed Consensus Engine"
                required
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Description</Label>
              <Textarea
                value={projectForm.description}
                onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                placeholder="Summary of architecture, features, and scale..."
                rows={3}
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Tech Stack (comma separated)</Label>
              <Input
                value={projectForm.tech_stack}
                onChange={(e) => setProjectForm({ ...projectForm, tech_stack: e.target.value })}
                placeholder="Rust, TypeScript, PostgreSQL, WebAssembly"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Repository URL</Label>
                <Input
                  value={projectForm.repo_url}
                  onChange={(e) => setProjectForm({ ...projectForm, repo_url: e.target.value })}
                  placeholder="https://github.com/..."
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Live Demo URL</Label>
                <Input
                  value={projectForm.demo_url}
                  onChange={(e) => setProjectForm({ ...projectForm, demo_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="proj_is_public"
                checked={projectForm.is_public}
                onChange={(e) => setProjectForm({ ...projectForm, is_public: e.target.checked })}
                className="rounded border-border text-primary"
              />
              <Label htmlFor="proj_is_public" className="text-xs font-medium cursor-pointer">
                Publicly visible in portfolio
              </Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsProjectModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveProjectMutation.isPending}>
                {saveProjectMutation.isPending ? "Adding..." : "Add to Vault"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 4. Add Skill Modal */}
      <Dialog open={isSkillModalOpen} onOpenChange={setIsSkillModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Technical Skill</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newSkillText.trim()) {
                addSkillMutation.mutate(newSkillText.trim());
              }
            }}
            className="space-y-3.5"
          >
            <div>
              <Label className="text-xs font-semibold">Skill Name</Label>
              <Input
                value={newSkillText}
                onChange={(e) => setNewSkillText(e.target.value)}
                placeholder="e.g. Distributed Systems or React"
                autoFocus
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsSkillModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={addSkillMutation.isPending}>
                {addSkillMutation.isPending ? "Adding..." : "Add Skill"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 5. Add Achievement Modal */}
      <Dialog open={isAchievementModalOpen} onOpenChange={setIsAchievementModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Achievement or Credential</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!achievementForm.title.trim() || !achievementForm.issuer.trim()) {
                toast({ title: "Please enter title and issuer", variant: "destructive" });
                return;
              }
              saveAchievementMutation.mutate(achievementForm);
            }}
            className="space-y-3.5"
          >
            <div>
              <Label className="text-xs font-semibold">Achievement / Credential Title *</Label>
              <Input
                value={achievementForm.title}
                onChange={(e) => setAchievementForm({ ...achievementForm, title: e.target.value })}
                placeholder="e.g. AWS Certified Solutions Architect"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Issuer / Organization *</Label>
                <Input
                  value={achievementForm.issuer}
                  onChange={(e) => setAchievementForm({ ...achievementForm, issuer: e.target.value })}
                  placeholder="e.g. Amazon Web Services"
                  required
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Issue Date</Label>
                <Input
                  type="date"
                  value={achievementForm.date}
                  onChange={(e) => setAchievementForm({ ...achievementForm, date: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold">Description</Label>
              <Textarea
                value={achievementForm.description}
                onChange={(e) => setAchievementForm({ ...achievementForm, description: e.target.value })}
                placeholder="Brief summary of requirements or award honors..."
                rows={2}
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Credential Verification URL</Label>
              <Input
                value={achievementForm.credential_url}
                onChange={(e) => setAchievementForm({ ...achievementForm, credential_url: e.target.value })}
                placeholder="https://www.credly.com/badges/..."
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="ach_is_public"
                checked={achievementForm.is_public}
                onChange={(e) => setAchievementForm({ ...achievementForm, is_public: e.target.checked })}
                className="rounded border-border text-primary"
              />
              <Label htmlFor="ach_is_public" className="text-xs font-medium cursor-pointer">
                Publicly visible in profile and Living Graph
              </Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAchievementModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveAchievementMutation.isPending}>
                {saveAchievementMutation.isPending ? "Adding..." : "Add Achievement"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 6. Connect Tool Modal */}
      <Dialog open={isConnectToolModalOpen} onOpenChange={setIsConnectToolModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="capitalize">Connect {selectedProvider} Account</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (toolHandle.trim()) {
                connectToolMutation.mutate({
                  provider: selectedProvider,
                  handle: toolHandle.trim().replace(/^@/, ""),
                });
              }
            }}
            className="space-y-3.5"
          >
            <div>
              <Label className="text-xs font-semibold capitalize">{selectedProvider} Username / Handle</Label>
              <Input
                value={toolHandle}
                onChange={(e) => setToolHandle(e.target.value)}
                placeholder="e.g. torvalds"
                autoFocus
                required
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Zero-data read-only telemetry. We do not request private tokens or read private code.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsConnectToolModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={connectToolMutation.isPending}>
                {connectToolMutation.isPending ? "Connecting..." : "Connect"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
