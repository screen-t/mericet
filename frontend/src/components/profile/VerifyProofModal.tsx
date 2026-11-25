import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { backendApi } from "@/lib/backend-api";
import { VaultItem } from "@/types/api";
import { generateDocumentCommitment } from "@/lib/zkp/poseidon";
import { evaluateSemanticRelevance } from "@/lib/zkp/semantic-matcher";
import { ShieldCheck, Loader2, Upload, FileCheck2, AlertCircle } from "lucide-react";

interface VerifyProofModalProps {
  item: VaultItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const VerifyProofModal = ({ item, open, onOpenChange }: VerifyProofModalProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [proofType, setProofType] = useState<string>("issuer_credential");
  const [credentialUrl, setCredentialUrl] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [commitHash, setCommitHash] = useState("");
  const [liveUrl, setLiveUrl] = useState("");
  const [authorHandle, setAuthorHandle] = useState("");

  // Local in-memory document state
  const [localProcessing, setLocalProcessing] = useState(false);
  const [computedPoseidon, setComputedPoseidon] = useState<string | null>(null);
  const [semanticScore, setSemanticScore] = useState<number | null>(null);

  const verifyMutation = useMutation({
    mutationFn: async () => {
      if (!item) return;
      let evidence: Record<string, unknown> = {};

      if (proofType === "issuer_credential") {
        evidence = { credential_url: credentialUrl, issuer: "Credly" };
      } else if (proofType === "proof_of_work") {
        evidence = { repo_url: repoUrl, commit_hash: commitHash, live_url: liveUrl, author: authorHandle };
      } else if (proofType === "cryptographic_proof") {
        evidence = {
          poseidon_hash: computedPoseidon || item.poseidon_hash,
        };
      }

      return backendApi.vault.verifyItem(item.id, { proof_type: proofType, evidence });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["vault"] });
      const tier = data?.verification?.tier || "none";
      const message = data?.verification?.message || "Verification evaluated.";
      
      if (tier === "strong" || tier === "mid" || tier === "weak") {
        toast({
          title: `Verification Succeeded: Tier [${tier.toUpperCase()}]`,
          description: message,
        });
      } else {
        toast({
          title: "Verification Inconclusive",
          description: message,
          variant: "destructive",
        });
      }
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({
        title: "Verification Failed",
        description: err.message || "Could not complete verification.",
        variant: "destructive",
      });
    },
  });

  const handleFileUploadLocal = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLocalProcessing(true);
      // 1. In-memory Poseidon commitment (zero raw doc upload)
      const commitment = await generateDocumentCommitment(file);
      setComputedPoseidon(commitment.poseidonHash);

      // 2. In-memory text / semantic check if text file
      if (file.type.includes("text") || file.name.endsWith(".txt") || file.name.endsWith(".md")) {
        const text = await file.text();
        const sem = evaluateSemanticRelevance(text, item?.title || "", [item?.category || ""]);
        setSemanticScore(sem.score);
      }

      toast({
        title: "Local Poseidon Hash Computed",
        description: "Document processed entirely in browser memory. Raw document is not uploaded.",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to process document locally.";
      toast({
        title: "Local Processing Error",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setLocalProcessing(false);
    }
  };


  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Verify Vault Claim: {item.title}
          </DialogTitle>
          <DialogDescription>
            Submit verifiable evidence or local cryptographic proof. Raw documents are never uploaded to the server.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Verification Pathway</Label>
            <Select value={proofType} onValueChange={setProofType}>
              <SelectTrigger>
                <SelectValue placeholder="Select pathway" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="issuer_credential">Official Issuer Credential (Credly / Accredited)</SelectItem>
                <SelectItem value="proof_of_work">Proof of Work (GitHub Repo + Commit + Live Site)</SelectItem>
                <SelectItem value="cryptographic_proof">Local Cryptographic Proof / Poseidon ZKP</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {proofType === "issuer_credential" && (
            <div className="space-y-3 bg-muted/40 p-3 rounded-lg border">
              <Label>Credential or Badge URL</Label>
              <Input
                placeholder="https://www.credly.com/badges/your-badge-id"
                value={credentialUrl}
                onChange={(e) => setCredentialUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Supported platforms: Credly, accredited university (.edu) and cloud verification domains.
              </p>
            </div>
          )}

          {proofType === "proof_of_work" && (
            <div className="space-y-3 bg-muted/40 p-3 rounded-lg border">
              <div>
                <Label>GitHub Repository URL</Label>
                <Input
                  placeholder="https://github.com/owner/repository"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Commit Hash (40-char SHA)</Label>
                  <Input
                    placeholder="e.g. a1b2c3d4e5..."
                    value={commitHash}
                    onChange={(e) => setCommitHash(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Author Handle</Label>
                  <Input
                    placeholder="e.g. your-github-username"
                    value={authorHandle}
                    onChange={(e) => setAuthorHandle(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label>Live Deployment URL (Optional)</Label>
                <Input
                  placeholder="https://your-app.vercel.app"
                  value={liveUrl}
                  onChange={(e) => setLiveUrl(e.target.value)}
                />
              </div>
            </div>
          )}

          {proofType === "cryptographic_proof" && (
            <div className="space-y-3 bg-muted/40 p-3 rounded-lg border">
              <div className="flex items-center justify-between">
                <Label>In-Memory Document Commitment</Label>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
                  Zero-Knowledge local parsing
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  onChange={handleFileUploadLocal}
                  disabled={localProcessing}
                  className="cursor-pointer"
                />
              </div>
              {computedPoseidon && (
                <div className="p-2.5 bg-background rounded border text-xs space-y-1">
                  <div className="flex items-center justify-between text-green-600 font-medium">
                    <span className="flex items-center gap-1">
                      <FileCheck2 className="w-3.5 h-3.5" /> Poseidon Hash Computed:
                    </span>
                  </div>
                  <p className="font-mono break-all text-muted-foreground">{computedPoseidon}</p>
                  {semanticScore !== null && (
                    <p className="text-muted-foreground pt-1">
                      Semantic Claim Match: <span className="font-semibold text-foreground">{(semanticScore * 100).toFixed(0)}%</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => verifyMutation.mutate()} disabled={verifyMutation.isPending || localProcessing}>
            {verifyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
            Evaluate Proof
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
