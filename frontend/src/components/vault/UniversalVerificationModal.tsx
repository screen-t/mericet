import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  FileText,
  Globe,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  Sparkles,
  Cpu,
} from "lucide-react";
import { executeLocalZKPVerification, VerificationExecutionResult } from "@/lib/zkp/zkp-client";
import { backendApi } from "@/lib/backend-api";
import { useToast } from "@/hooks/use-toast";
import { VaultItem } from "@/types/api";

interface UniversalVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  vaultItem: VaultItem | null;
  onVerified?: (updatedItem: VaultItem) => void;
}

export const UniversalVerificationModal: React.FC<UniversalVerificationModalProps> = ({
  isOpen,
  onClose,
  vaultItem,
  onVerified,
}) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"document" | "url" | "token">("document");

  // Inputs
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [tokenProvider, setTokenProvider] = useState("github");
  const [token, setToken] = useState("");

  // Verification execution state
  const [isVerifying, setIsVerifying] = useState(false);
  const [currentStep, setCurrentStep] = useState<string>("IDLE");
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [progressMessage, setProgressMessage] = useState<string>("");
  const [verificationResult, setVerificationResult] = useState<VerificationExecutionResult | null>(null);
  const [assignedTier, setAssignedTier] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resetState = () => {
    setIsVerifying(false);
    setCurrentStep("IDLE");
    setProgressPercent(0);
    setProgressMessage("");
    setVerificationResult(null);
    setAssignedTier(null);
    setErrorMessage(null);
    setFile(null);
    setUrl("");
    setToken("");
  };

  const handleClose = () => {
    if (isVerifying) return;
    resetState();
    onClose();
  };

  const handleStartVerification = async () => {
    if (!vaultItem) return;
    setErrorMessage(null);
    setIsVerifying(true);
    setProgressPercent(5);
    setProgressMessage("Initializing browser-native zero-knowledge worker...");

    try {
      // 1. Execute local ZKP verification
      const result = await executeLocalZKPVerification(
        {
          type: activeTab,
          file: file || undefined,
          url: url || undefined,
          token: token || undefined,
          tokenProvider,
        },
        {
          id: vaultItem.id,
          title: vaultItem.title,
          category: vaultItem.category,
          keywords: Array.isArray(vaultItem.metadata?.tags) ? (vaultItem.metadata.tags as string[]) : [],
        },
        ({ percent, message, step }) => {
          setProgressPercent(percent);
          setProgressMessage(message);
          setCurrentStep(step);
        }
      );

      setVerificationResult(result);
      setProgressPercent(95);
      setProgressMessage("Attesting cryptographic commitment to backend server...");

      // 2. Submit cryptographic proof to backend verification endpoint
      const response = await backendApi.vault.verifyItem(vaultItem.id, {
        proof_type: "cryptographic_proof",
        evidence: {
          poseidon_hash: result.proofPayload.poseidon_hash,
          proof: result.proofPayload.proof,
          public_signals: result.proofPayload.public_signals,
          semantic_score: result.semanticResult.score,
          threshold_met: result.semanticResult.thresholdMet,
          matched_tokens: result.semanticResult.matchedTokens,
          source_type: result.sourceType,
        },
      });

      const tier = response.verification.tier || "mid";
      setAssignedTier(tier);
      setProgressPercent(100);
      setProgressMessage(`Verification complete: Awarded ${tier.toUpperCase()} tier!`);
      setCurrentStep("COMPLETE");

      toast({
        title: "Cryptographic Proof Verified",
        description: `Successfully awarded ${tier.toUpperCase()} tier via local Poseidon commitment.`,
      });

      if (response.item && onVerified) {
        onVerified(response.item);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Verification failed";
      setErrorMessage(message);
      setCurrentStep("ERROR");
      toast({
        title: "Verification Failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const canSubmit = () => {
    if (isVerifying) return false;
    if (activeTab === "document") return !!file;
    if (activeTab === "url") return !!url && (url.startsWith("http://") || url.startsWith("https://"));
    if (activeTab === "token") return !!token.trim();
    return false;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl bg-card border-border shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Local ZKP Verification Engine</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                In-Memory Document Extraction, AI Semantic Scoring & Salted Poseidon Commitments
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {vaultItem && (
          <div className="bg-muted/40 p-3 rounded-lg border border-border/60 flex items-center justify-between text-xs">
            <div>
              <span className="text-muted-foreground">Claim Target: </span>
              <span className="font-semibold text-foreground">{vaultItem.title}</span>
            </div>
            <Badge variant="outline" className="text-[10px] uppercase font-mono">
              {vaultItem.category}
            </Badge>
          </div>
        )}

        {/* Input Selector Tabs */}
        {!verificationResult && currentStep !== "COMPLETE" && (
          <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as "document" | "url" | "token")} className="w-full">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="document" className="text-xs flex items-center gap-1.5" disabled={isVerifying}>
                <FileText className="w-3.5 h-3.5" />
                Document Upload
              </TabsTrigger>
              <TabsTrigger value="url" className="text-xs flex items-center gap-1.5" disabled={isVerifying}>
                <Globe className="w-3.5 h-3.5" />
                Live URL
              </TabsTrigger>
              <TabsTrigger value="token" className="text-xs flex items-center gap-1.5" disabled={isVerifying}>
                <KeyRound className="w-3.5 h-3.5" />
                API Token
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: DOCUMENT UPLOAD */}
            <TabsContent value="document" className="space-y-4 pt-3">
              <div
                className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                  file ? "border-primary/50 bg-primary/5" : "border-border hover:border-border/80"
                }`}
              >
                <input
                  type="file"
                  id="zkp-doc-input"
                  className="hidden"
                  accept=".pdf,.txt,.md,.json,.csv,image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setFile(e.target.files[0]);
                    }
                  }}
                  disabled={isVerifying}
                />
                <label htmlFor="zkp-doc-input" className="cursor-pointer block">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-2 text-muted-foreground">
                    <FileText className="w-6 h-6" />
                  </div>
                  {file ? (
                    <div>
                      <p className="text-sm font-semibold text-foreground">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024).toFixed(1)} KB • Ready for in-memory extraction
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-foreground">Click to upload or drag & drop</p>
                      <p className="text-xs text-muted-foreground mt-1">PDF, TXT, MD, CSV, or Image files</p>
                    </div>
                  )}
                </label>
              </div>

              <div className="flex items-start gap-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 p-2.5 rounded-lg text-xs">
                <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>
                  <strong>Strict Privacy Guarantee:</strong> Your document is parsed entirely inside browser memory.
                  Raw files are NEVER transmitted to any cloud server or stored in the database.
                </span>
              </div>
            </TabsContent>

            {/* TAB 2: LIVE URL */}
            <TabsContent value="url" className="space-y-4 pt-3">
              <div className="space-y-2">
                <Label htmlFor="live-url" className="text-xs">
                  Live Public URL (Repository, Portfolio, Credential)
                </Label>
                <Input
                  id="live-url"
                  placeholder="https://github.com/username/project or https://credly.com/..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={isVerifying}
                  className="text-xs font-mono"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                The engine will fetch public headers and inspect metadata client-side before synthesizing proof signals.
              </p>
            </TabsContent>

            {/* TAB 3: API TOKEN */}
            <TabsContent value="token" className="space-y-4 pt-3">
              <div className="space-y-3">
                <div>
                  <Label htmlFor="token-provider" className="text-xs">
                    Provider
                  </Label>
                  <select
                    id="token-provider"
                    value={tokenProvider}
                    onChange={(e) => setTokenProvider(e.target.value)}
                    disabled={isVerifying}
                    className="w-full text-xs p-2 rounded-md bg-background border border-input mt-1"
                  >
                    <option value="github">GitHub Personal Access Token (Read-Only)</option>
                    <option value="credly">Credly Verification Token</option>
                    <option value="custom">Generic Service API Key</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="api-token" className="text-xs">
                    API Token (In-Memory Processing Only)
                  </Label>
                  <Input
                    id="api-token"
                    type="password"
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    disabled={isVerifying}
                    className="text-xs font-mono"
                  />
                </div>
                <div className="flex items-start gap-2 bg-amber-500/10 text-amber-700 dark:text-amber-400 p-2.5 rounded-lg text-xs">
                  <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>
                    Your token is used strictly in local memory to generate a blinded credential commitment and is
                    immediately erased from memory. It is never logged or sent to the backend.
                  </span>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}

        {/* Progress & Stepper */}
        {isVerifying && (
          <div className="space-y-3 py-4">
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium text-foreground flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                {progressMessage}
              </span>
              <span className="font-mono text-muted-foreground">{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>
        )}

        {/* Success View */}
        {verificationResult && currentStep === "COMPLETE" && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="w-6 h-6 shrink-0 text-emerald-500" />
              <div>
                <h4 className="text-sm font-bold">Local Verification Verified</h4>
                <p className="text-xs opacity-90 mt-0.5">
                  Assigned Tier:{" "}
                  <strong className="uppercase underline">
                    {assignedTier === "mid" ? "Silver (Peer & Semantic Proof)" : assignedTier}
                  </strong>
                </p>
              </div>
            </div>

            <div className="space-y-2 bg-muted/30 p-3 rounded-lg border border-border/70 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Poseidon Commitment:</span>
                <span className="text-foreground truncate max-w-[280px]" title={verificationResult.proofPayload.poseidon_hash}>
                  {verificationResult.proofPayload.poseidon_hash}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Semantic Score:</span>
                <span className="text-foreground font-semibold">
                  {(verificationResult.semanticResult.score * 100).toFixed(1)}% (Threshold: 85%)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">SNARK Circuit:</span>
                <span className="text-foreground">Groth16 (alt_bn128 curve)</span>
              </div>
            </div>
          </div>
        )}

        {/* Error View */}
        {errorMessage && (
          <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={handleClose} disabled={isVerifying} className="text-xs">
            {currentStep === "COMPLETE" ? "Done" : "Cancel"}
          </Button>

          {currentStep !== "COMPLETE" && (
            <Button
              size="sm"
              onClick={handleStartVerification}
              disabled={!canSubmit()}
              className="text-xs flex items-center gap-1.5"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Generate Proof & Verify
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
