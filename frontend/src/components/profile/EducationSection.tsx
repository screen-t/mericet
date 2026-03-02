import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Profile, Education } from '@/types/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { backendApi } from "@/lib/backend-api";
import { GraduationCap, Plus, Pencil, Trash2, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface EducationSectionProps {
  userId: string;
  isOwnProfile: boolean;
}

export const EducationSection = ({ userId, isOwnProfile }: EducationSectionProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Education | null>(null);
  const [formData, setFormData] = useState({
    institution: "",
    degree: "",
    field_of_study: "",
    start_date: "",
    end_date: "",
    is_current: false,
    grade: "",
    description: "",
  });

  // Fetch education
  const { data: educations = [], isLoading } = useQuery({
    queryKey: ['education', userId],
    queryFn: async () => {
      const profile = isOwnProfile
        ? await backendApi.profile.getMyProfile()
        : await backendApi.profile.getProfile(userId);
      return (profile as any).education || [];
    },
  });

  // Add/Update education
  const saveMutation = useMutation({
    mutationFn: (data: any) => {
      if (editingItem) {
        return backendApi.profile.updateEducation(editingItem.id, data);
      }
      return backendApi.profile.addEducation(data);
    },
    onSuccess: () => {
      toast({ title: editingItem ? "Education updated!" : "Education added!" });
      queryClient.invalidateQueries({ queryKey: ['education', userId] });
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      closeModal();
    },
    onError: () => {
      toast({ title: "Failed to save", variant: "destructive" });
    },
  });

  // Delete education
  const deleteMutation = useMutation({
    mutationFn: (id: string) => backendApi.profile.deleteEducation(id),
    onSuccess: () => {
      toast({ title: "Education deleted" });
      queryClient.invalidateQueries({ queryKey: ['education', userId] });
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
    },
    onError: () => {
      toast({ title: "Failed to delete", variant: "destructive" });
    },
  });

  const openAddModal = () => {
    setEditingItem(null);
    setFormData({
      institution: "",
      degree: "",
      field_of_study: "",
      start_date: "",
      end_date: "",
      is_current: false,
      grade: "",
      description: "",
    });
    setIsAddModalOpen(true);
  };

  const openEditModal = (item: Education) => {
    setEditingItem(item);
    setFormData({
      institution: item.institution,
      degree: item.degree,
      field_of_study: item.field_of_study || "",
      start_date: item.start_date,
      end_date: item.end_date || "",
      is_current: item.is_current,
      grade: item.grade || "",
      description: item.description || "",
    });
    setIsAddModalOpen(true);
  };

  const closeModal = () => {
    setIsAddModalOpen(false);
    setEditingItem(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  return (
    <>
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <GraduationCap className="w-5 h-5" />
            Education
          </h3>
          {isOwnProfile && (
            <Button size="sm" onClick={openAddModal}>
              <Plus className="w-4 h-4 mr-2" />
              Add
            </Button>
          )}
        </div>

        <div className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : educations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No education added yet.</p>
          ) : (
            educations.map((edu: Education) => (
              <div key={edu.id} className="border-l-2 border-primary pl-4 py-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold">{edu.institution}</h4>
                    <p className="text-sm text-muted-foreground">
                      {edu.degree}
                      {edu.field_of_study && ` in ${edu.field_of_study}`}
                    </p>
                    {edu.grade && (
                      <p className="text-xs text-muted-foreground">Grade: {edu.grade}</p>
                    )}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <Calendar className="w-3 h-3" />
                      <span>
                        {format(new Date(edu.start_date), 'MMM yyyy')} -{" "}
                        {edu.is_current ? "Present" : format(new Date(edu.end_date!), 'MMM yyyy')}
                      </span>
                    </div>
                    {edu.description && (
                      <p className="text-sm mt-2 text-muted-foreground">{edu.description}</p>
                    )}
                  </div>
                  {isOwnProfile && (
                    <div className="flex gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openEditModal(edu)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(edu.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Add/Edit Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={closeModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Edit Education" : "Add Education"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="institution">School *</Label>
              <Input
                id="institution"
                value={formData.institution}
                onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="degree">Degree *</Label>
              <Input
                id="degree"
                value={formData.degree}
                onChange={(e) => setFormData({ ...formData, degree: e.target.value })}
                placeholder="e.g., Bachelor's, Master's, PhD"
                required
              />
            </div>

            <div>
              <Label htmlFor="field_of_study">Field of Study</Label>
              <Input
                id="field_of_study"
                value={formData.field_of_study}
                onChange={(e) => setFormData({ ...formData, field_of_study: e.target.value })}
                placeholder="e.g., Computer Science"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start_date">Start Date *</Label>
                <Input
                  id="start_date"
                  type="month"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="end_date">End Date</Label>
                <Input
                  id="end_date"
                  type="month"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  disabled={formData.is_current}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_current"
                checked={formData.is_current}
                onChange={(e) => setFormData({ ...formData, is_current: e.target.checked })}
              />
              <Label htmlFor="is_current">I currently study here</Label>
            </div>

            <div>
              <Label htmlFor="grade">Grade/GPA</Label>
              <Input
                id="grade"
                value={formData.grade}
                onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                placeholder="e.g., 3.8/4.0"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                placeholder="Activities, achievements, coursework..."
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeModal}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving..." : editingItem ? "Update" : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};
