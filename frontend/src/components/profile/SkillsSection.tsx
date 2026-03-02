import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Profile, Skill } from '@/types/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { backendApi } from "@/lib/backend-api";
import { Award, Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SkillsSectionProps {
  userId: string;
  isOwnProfile: boolean;
}

export const SkillsSection = ({ userId, isOwnProfile }: SkillsSectionProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newSkill, setNewSkill] = useState("");

  // Fetch skills
  const { data: skills = [], isLoading } = useQuery({
    queryKey: ['skills', userId],
    queryFn: async () => {
      const profile = isOwnProfile
        ? await backendApi.profile.getMyProfile()
        : await backendApi.profile.getProfile(userId);
      return (profile as any).skills || [];
    },
  });

  // Add skill
const addMutation = useMutation({
  mutationFn: (skillName: string) => {
    const skillData = { name: skillName };  // Create the skillData object
    const userId = "123"; // Or get the userId dynamically (e.g., from context, props, etc.)
    return backendApi.profile.addSkill(userId, skillData); // Pass both `userId` and `skillData`
  },
  onSuccess: () => {
    toast({ title: "Skill added!" });
    queryClient.invalidateQueries({ queryKey: ['skills', userId] });
    queryClient.invalidateQueries({ queryKey: ['profile', userId] });
    setNewSkill("");  // Clear the input field
    setIsAddModalOpen(false);  // Close the modal
  },
  onError: () => {
    toast({ title: "Failed to add skill", variant: "destructive" });
  },
});

  // Delete skill

const deleteMutation = useMutation({
  mutationFn: (skillId: string) => backendApi.profile.deleteSkill(userId, skillId),  // Pass both userId and skillId
  onSuccess: () => {
    toast({ title: "Skill removed" });
    queryClient.invalidateQueries({ queryKey: ['skills', userId] });
    queryClient.invalidateQueries({ queryKey: ['profile', userId] });
  },
  onError: () => {
    toast({ title: "Failed to remove skill", variant: "destructive" });
  },
});

  const handleAddSkill = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSkill.trim()) {
      addMutation.mutate(newSkill.trim());
    }
  };

  return (
    <>
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Award className="w-5 h-5" />
            Skills
          </h3>
          {isOwnProfile && (
            <Button size="sm" onClick={() => setIsAddModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : skills.length === 0 ? (
            <p className="text-sm text-muted-foreground">No skills added yet.</p>
          ) : (
            skills.map((skill: Skill) => (
              <Badge key={skill.id} variant="secondary" className="text-sm px-3 py-1">
                {skill.name}
                {isOwnProfile && (
                  <button
                    onClick={() => deleteMutation.mutate(skill.id)}
                    className="ml-2 hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </Badge>
            ))
          )}
        </div>
      </Card>

      {/* Add Skill Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Skill</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAddSkill} className="space-y-4">
            <div>
              <Label htmlFor="skill">Skill Name</Label>
              <Input
                id="skill"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                placeholder="e.g., JavaScript, Project Management"
                required
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={addMutation.isPending}>
                {addMutation.isPending ? "Adding..." : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};
