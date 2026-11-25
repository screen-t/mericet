import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { backendApi } from "@/lib/backend-api";
import { VaultItem, ConnectedTool, VaultCategory } from "@/types/api";
import { AddVaultItemModal } from "./AddVaultItemModal";
import { VerifyProofModal } from "./VerifyProofModal";
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  Lock,
  Plus,
  Trash2,
  RefreshCw,
  FolderGit2,
  Award,
  Briefcase,
  GraduationCap,
  Wrench,
  Sparkles,
  Github,
  Code2,
  ExternalLink,
  Loader2,
} from "lucide-react";

interface VaultSectionProps {
  userId: string;
  isOwnProfile: boolean;
}

export const VaultSection = ({ userId, isOwnProfile }: VaultSectionProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [verifyingItem, setVerifyingItem] = useState<VaultItem | null>(null);

  // Connected Tool state
  const [toolProvider, setToolProvider] = useState<string>("github");
  const [toolHandle, setToolHandle] = useState<string>("");

  // Queries
  const { data: vaultItems = [], isLoading: isLoadingVault } = useQuery<VaultItem[]>({
    queryKey: ["vault", userId, selectedCategory],
    queryFn: () => {
      const cat = selectedCategory === "all" ? undefined : selectedCategory;
      return isOwnProfile
        ? backendApi.vault.getMyItems(cat)
        : backendApi.vault.getUserItems(userId, cat);
    },
  });

  const { data: connectedTools = [], isLoading: isLoadingTools } = useQuery<ConnectedTool[]>({
    queryKey: ["vault-tools", userId],
    queryFn: () => (isOwnProfile ? backendApi.vault.getConnectedTools() : Promise.resolve([])),
    enabled: isOwnProfile,
  });

  // Mutations
  const deleteMutation = useMutation({
    mutationFn: (itemId: string) => backendApi.vault.deleteItem(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vault"] });
      toast({ title: "Vault item deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });

  const connectToolMutation = useMutation({
    mutationFn: () => backendApi.vault.connectTool(toolProvider, toolHandle),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vault-tools"] });
      setToolHandle("");
      toast({ title: "Connected tool successfully!" });
    },
    onError: (err: Error) => {
      toast({ title: "Connection failed", description: err.message, variant: "destructive" });
    },
  });

  const disconnectToolMutation = useMutation({
    mutationFn: (toolId: string) => backendApi.vault.disconnectTool(toolId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vault-tools"] });
      toast({ title: "Tool disconnected" });
    },
  });

  const syncLivingGraphMutation = useMutation({
    mutationFn: () => backendApi.vault.syncLivingGraph(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["vault"] });
      queryClient.invalidateQueries({ queryKey: ["vault-tools"] });
      const count = data?.result?.highlights_created || 0;
      toast({
        title: "Living Graph Synchronized",
        description: `Synced tools and generated ${count} verified vault highlights.`,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Sync failed", description: err.message, variant: "destructive" });
    },
  });


  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "project":
        return <FolderGit2 className="w-4 h-4 text-primary" />;
      case "achievement":
        return <Award className="w-4 h-4 text-amber-500" />;
      case "work":
        return <Briefcase className="w-4 h-4 text-blue-500" />;
      case "education":
        return <GraduationCap className="w-4 h-4 text-purple-500" />;
      case "skill":
        return <Sparkles className="w-4 h-4 text-emerald-500" />;
      default:
        return <Wrench className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const renderTierBadge = (tier: string) => {
    switch (tier) {
      case "strong":
        return (
          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            Verified (Strong)
          </Badge>
        );
      case "mid":
        return (
          <Badge className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Verified (Mid)
          </Badge>
        );
      case "weak":
        return (
          <Badge variant="outline" className="text-amber-600 border-amber-500/40 bg-amber-500/10 flex items-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5" />
            Commitment (Weak)
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground">
            Unverified
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Vault Header & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={selectedCategory === "all" ? "default" : "outline"}
            onClick={() => setSelectedCategory("all")}
          >
            All
          </Button>
          <Button
            size="sm"
            variant={selectedCategory === "project" ? "default" : "outline"}
            onClick={() => setSelectedCategory("project")}
          >
            Projects
          </Button>
          <Button
            size="sm"
            variant={selectedCategory === "achievement" ? "default" : "outline"}
            onClick={() => setSelectedCategory("achievement")}
          >
            Achievements
          </Button>
          <Button
            size="sm"
            variant={selectedCategory === "skill" ? "default" : "outline"}
            onClick={() => setSelectedCategory("skill")}
          >
            Skills
          </Button>
          <Button
            size="sm"
            variant={selectedCategory === "work" ? "default" : "outline"}
            onClick={() => setSelectedCategory("work")}
          >
            Work
          </Button>
          <Button
            size="sm"
            variant={selectedCategory === "education" ? "default" : "outline"}
            onClick={() => setSelectedCategory("education")}
          >
            Education
          </Button>
        </div>

        {isOwnProfile && (
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setShowAddModal(true)}>
              <Plus className="w-4 h-4 mr-1.5" />
              Add Vault Item
            </Button>
          </div>
        )}
      </div>

      {/* Living Graph Connected Services (Profile Owner Only) */}
      {isOwnProfile && (
        <Card className="p-4 bg-muted/20 border-border/80">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b">
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-primary" />
                Living Graph Engine
              </h3>
              <p className="text-xs text-muted-foreground">
                Connect external developer and credential accounts to automatically curate verified portfolio highlights.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => syncLivingGraphMutation.mutate()}
              disabled={syncLivingGraphMutation.isPending || connectedTools.length === 0}
            >
              {syncLivingGraphMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              )}
              Sync Living Graph
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3">
            {connectedTools.map((tool) => (
              <div key={tool.id} className="p-2.5 rounded-lg border bg-background flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  {tool.provider === "github" && <Github className="w-4 h-4" />}
                  {tool.provider === "leetcode" && <Code2 className="w-4 h-4 text-amber-500" />}
                  {tool.provider === "credly" && <Award className="w-4 h-4 text-emerald-500" />}
                  <div>
                    <span className="font-semibold capitalize">{tool.provider}: </span>
                    <span className="text-muted-foreground">{tool.handle}</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={() => disconnectToolMutation.mutate(tool.id)}
                  disabled={disconnectToolMutation.isPending}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}

            <div className="flex items-center gap-2">
              <Select value={toolProvider} onValueChange={setToolProvider}>
                <SelectTrigger className="h-8 text-xs w-[110px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="github">GitHub</SelectItem>
                  <SelectItem value="leetcode">LeetCode</SelectItem>
                  <SelectItem value="credly">Credly</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="Username / Handle"
                className="h-8 text-xs flex-1"
                value={toolHandle}
                onChange={(e) => setToolHandle(e.target.value)}
              />
              <Button
                size="sm"
                className="h-8 text-xs"
                onClick={() => connectToolMutation.mutate()}
                disabled={!toolHandle.trim() || connectToolMutation.isPending}
              >
                Connect
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Vault Items Grid */}
      {isLoadingVault ? (
        <div className="py-12 text-center text-muted-foreground flex justify-center items-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading Vault portfolio...
        </div>
      ) : vaultItems.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          <Lock className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="font-medium">No Vault records found in this category.</p>
          <p className="text-xs mt-1">
            {isOwnProfile
              ? "Add verified projects, work, or skills to build your verifiable resume."
              : "This user has not published public vault items in this category."}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {vaultItems.map((item) => (
            <Card key={item.id} className="p-4 flex flex-col justify-between hover:border-primary/50 transition-colors">
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {getCategoryIcon(item.category)}
                    <h4 className="font-semibold text-base leading-tight">{item.title}</h4>
                  </div>
                  {renderTierBadge(item.verification_tier)}
                </div>

                {item.description && (
                  <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                    {item.description}
                  </p>
                )}

                {item.poseidon_hash && (
                  <div className="text-[11px] font-mono bg-muted/50 p-1.5 rounded text-muted-foreground flex items-center justify-between">
                    <span className="truncate max-w-[260px]">Commitment: {item.poseidon_hash}</span>
                    <ShieldCheck className="w-3.5 h-3.5 text-green-500 shrink-0" />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 mt-2 border-t text-xs text-muted-foreground">
                <span className="capitalize">{item.category}</span>
                <div className="flex items-center gap-2">
                  {isOwnProfile && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => setVerifyingItem(item)}
                      >
                        <ShieldCheck className="w-3.5 h-3.5 mr-1 text-primary" />
                        Verify Claim
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteMutation.mutate(item.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modals */}
      <AddVaultItemModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        defaultCategory={selectedCategory === "all" ? "project" : (selectedCategory as VaultCategory)}
      />

      <VerifyProofModal
        item={verifyingItem}
        open={verifyingItem !== null}
        onOpenChange={(open) => {
          if (!open) setVerifyingItem(null);
        }}
      />
    </div>
  );
};
