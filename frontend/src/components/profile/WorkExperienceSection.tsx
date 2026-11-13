import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { WorkExperience, Profile, EmploymentType } from '@/types/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { backendApi } from "@/lib/backend-api";
import { Briefcase, Plus, Pencil, Trash2, Calendar, ShieldCheck, Users, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { WorkExperienceVerificationModal } from "./WorkExperienceVerificationModal";

interface WorkExperienceSectionProps {
  userId: string;
  isOwnProfile: boolean;
}

export const WorkExperienceSection = ({ userId, isOwnProfile }: WorkExperienceSectionProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WorkExperience | null>(null);
  const [verifyingItem, setVerifyingItem] = useState<WorkExperience | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    company: "",
    location: "",
    employment_type: "Full-time" as EmploymentType,
    start_date: "",
    end_date: "",
    is_current: false,
    description: "",
  });

  // Fetch work experience
  const { data: experiences = [], isLoading } = useQuery({
    queryKey: ['workExperience', userId],
    queryFn: async () => {
      const profile = isOwnProfile
        ? await backendApi.profile.getMyProfile()
        : await backendApi.profile.getProfile(userId);
      return (profile as Profile).work_experience || [];
    },
  });

  // Add/Update work experience
  const saveMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => {
      if (editingItem) {
        return backendApi.profile.updateWorkExperience(editingItem.id, data);
      }
      return backendApi.profile.addWorkExperience(data);
    },
    onSuccess: () => {
      toast({ title: editingItem ? "Work experience updated!" : "Work experience added!" });
      queryClient.invalidateQueries({ queryKey: ['workExperience', userId] });
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      closeModal();
    },
    onError: () => {
      toast({ title: "Failed to save", variant: "destructive" });
    },
  });

  // Delete work experience
  const deleteMutation = useMutation({
    mutationFn: (id: string) => backendApi.profile.deleteWorkExperience(id),
    onSuccess: () => {
      toast({ title: "Work experience deleted" });
      queryClient.invalidateQueries({ queryKey: ['workExperience', userId] });
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
    },
    onError: () => {
      toast({ title: "Failed to delete", variant: "destructive" });
    },
  });

  const openAddModal = () => {
    setEditingItem(null);
    setFormData({
      title: "",
      company: "",
      location: "",
      employment_type: "Full-time",
      start_date: "",
      end_date: "",
      is_current: false,
      description: "",
    });
    setIsAddModalOpen(true);
  };

  const openEditModal = (item: WorkExperience) => {
    setEditingItem(item);
    setFormData({
      title: item.title,
      company: item.company,
      location: item.location || "",
      employment_type: (item.employment_type as EmploymentType) || "Full-time",
      start_date: item.start_date ? item.start_date.slice(0, 7) : "",
      end_date: item.end_date ? item.end_date.slice(0, 7) : "",
      is_current: item.is_current,
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
    if (!formData.is_current && formData.end_date && formData.start_date) {
      if (formData.end_date < formData.start_date) {
        toast({ title: "End date must be after start date", variant: "destructive" });
        return;
      }
    }
    const toFullDate = (val: string) => val ? `${val}-01` : val;
    const payload = {
      ...formData,
      start_date: toFullDate(formData.start_date),
      end_date: formData.is_current || !formData.end_date ? null : toFullDate(formData.end_date),
    };
    saveMutation.mutate(payload);
  };

  const renderStatusBadge = (exp: WorkExperience) => {
    const status = exp.verification_status || "PENDING";
    if (status === "VERIFIED") {
      return (
        <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-medium py-0 px-1.5 flex items-center gap-1">
          <ShieldCheck className="w-2.5 h-2.5 text-emerald-500" />
          Verified Work Experience
        </Badge>
      );
    }
    if (status === "P2P_PENDING") {
      const received = Number((exp.verification_metadata as Record<string, unknown>)?.approvals_received || 0);
      return (
        <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] py-0 px-1.5 flex items-center gap-1">
          <Users className="w-2.5 h-2.5 text-amber-500" />
          P2P Pending ({received}/3)
        </Badge>
      );
    }
    if (status === "SOURCE_VERIFIED" || status === "AI_EVIDENCE_CHECKED") {
      return (
        <Badge variant="outline" className="text-blue-600 dark:text-blue-400 border-blue-500/30 text-[10px] py-0 px-1.5 flex items-center gap-1">
          <Sparkles className="w-2.5 h-2.5 text-blue-500" />
          Evidence Checked
        </Badge>
      );
    }
    return null;
  };

  return (
    <>
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Briefcase className="w-5 h-5" />
            Work Experience
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
          ) : experiences.length === 0 ? (
            <p className="text-sm text-muted-foreground">No work experience added yet.</p>
          ) : (
            experiences.map((exp: WorkExperience) => (
              <div key={exp.id} className="border-l-2 border-primary pl-4 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-foreground">{exp.title}</h4>
                      {renderStatusBadge(exp)}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {exp.company}
                      {exp.employment_type && ` • ${exp.employment_type}`}
                      {exp.location && ` • ${exp.location}`}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <Calendar className="w-3 h-3" />
                      <span>
                        {format(parseISO(exp.start_date), 'MMM yyyy')} -{" "}
                        {exp.is_current ? "Present" : exp.end_date ? format(parseISO(exp.end_date), 'MMM yyyy') : "Present"}
                      </span>
                    </div>
                    {exp.description && (
                      <p className="text-sm mt-2 text-muted-foreground">{exp.description}</p>
                    )}
                  </div>

                  {isOwnProfile && (
                    <div className="flex items-center gap-1">
                      {exp.verification_status !== "VERIFIED" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setVerifyingItem(exp)}
                          className="h-8 text-xs flex items-center gap-1 text-primary border-primary/30 hover:bg-primary/10"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Verify
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => openEditModal(exp)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteMutation.mutate(exp.id)}
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
              {editingItem ? "Edit Work Experience" : "Add Work Experience"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="title">Job Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="company">Company *</Label>
                <Input
                  id="company"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="employment_type">Employment Type</Label>
                <select
                  id="employment_type"
                  value={formData.employment_type}
                  onChange={(e) => setFormData({ ...formData, employment_type: e.target.value as EmploymentType })}
                  className="w-full text-xs p-2.5 rounded-md bg-background border border-input mt-1"
                >
                  <option value="Full-time">Full-time</option>
                  <option value="Part-time">Part-time</option>
                  <option value="Contract">Contract</option>
                  <option value="Internship">Internship</option>
                  <option value="Freelance">Freelance</option>
                </select>
              </div>
            </div>

            <div>
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g., New York, NY"
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
                className="rounded border-gray-300"
              />
              <Label htmlFor="is_current">I currently work here</Label>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={closeModal}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving..." : (editingItem ? "Update" : "Add")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Work Experience Verification Modal */}
      <WorkExperienceVerificationModal
        isOpen={!!verifyingItem}
        onClose={() => setVerifyingItem(null)}
        experience={verifyingItem}
        onUpdated={() => {
          queryClient.invalidateQueries({ queryKey: ['workExperience', userId] });
          queryClient.invalidateQueries({ queryKey: ['profile', userId] });
        }}
      />
    </>
  );
};
