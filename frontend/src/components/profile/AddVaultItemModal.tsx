import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { backendApi } from "@/lib/backend-api";
import { VaultCategory } from "@/types/api";
import { generateDocumentCommitment } from "@/lib/zkp/poseidon";
import { ShieldCheck, Loader2, Lock, Plus } from "lucide-react";

interface AddVaultItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCategory?: VaultCategory;
}

export const AddVaultItemModal = ({ open, onOpenChange, defaultCategory = "project" }: AddVaultItemModalProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<VaultCategory>(defaultCategory);
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [poseidonHash, setPoseidonHash] = useState("");
  const [localProcessing, setLocalProcessing] = useState(false);

  const createMutation = useMutation({
    mutationFn: () =>
      backendApi.vault.createItem({
        title,
        category,
        description,
        is_public: isPublic,
        poseidon_hash: poseidonHash ? poseidonHash : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vault"] });
      toast({ title: "Vault item created successfully!" });
      setTitle("");
      setDescription("");
      setPoseidonHash("");
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({
        title: "Failed to create vault item",
        description: err.message || "An error occurred.",
        variant: "destructive",
      });
    },
  });

  const handleDocumentCommitment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLocalProcessing(true);
      const res = await generateDocumentCommitment(file);
      setPoseidonHash(res.poseidonHash);
      toast({
        title: "Poseidon Commitment Computed",
        description: "Document hashed in-memory. Only the cryptographic commitment will be stored.",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not process document.";
      toast({
        title: "Hashing Error",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setLocalProcessing(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />
            Add to Resume Vault
          </DialogTitle>
          <DialogDescription>
            Record verified projects, achievements, skills, work, or education in your tamper-evident vault.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="item-category">Category</Label>
            <Select value={category} onValueChange={(val) => setCategory(val as VaultCategory)}>
              <SelectTrigger id="item-category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="project">Project</SelectItem>
                <SelectItem value="achievement">Achievement / Credential</SelectItem>
                <SelectItem value="skill">Verified Skill</SelectItem>
                <SelectItem value="work">Work Experience</SelectItem>
                <SelectItem value="education">Education</SelectItem>
                <SelectItem value="tool">Connected Tool</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="item-title">Title / Name *</Label>
            <Input
              id="item-title"
              placeholder="e.g. Distributed Consensus Engine, AWS Architect..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="item-desc">Description (Optional)</Label>
            <Textarea
              id="item-desc"
              placeholder="Key responsibilities, tools used, metrics, or architecture..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2 bg-muted/40 p-3 rounded-lg border">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                Optional In-Memory Poseidon Commitment
              </Label>
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Lock className="w-3 h-3" /> No file upload
              </span>
            </div>
            <Input
              type="file"
              onChange={handleDocumentCommitment}
              disabled={localProcessing}
              className="text-xs cursor-pointer"
            />
            {poseidonHash && (
              <p className="text-[11px] font-mono break-all text-green-600 bg-background p-1.5 rounded border">
                Hash: {poseidonHash.slice(0, 32)}...
              </p>
            )}
          </div>

          <div className="flex items-center justify-between pt-1">
            <Label htmlFor="item-public" className="cursor-pointer">
              Publicly Visible on Profile
            </Label>
            <Switch id="item-public" checked={isPublic} onCheckedChange={setIsPublic} />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => createMutation.mutate()} disabled={!title.trim() || createMutation.isPending || localProcessing}>
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Save to Vault"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
