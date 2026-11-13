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
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ShieldCheck,
  Users,
  Building2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  UserCheck,
} from "lucide-react";
import { backendApi } from "@/lib/backend-api";
import { useToast } from "@/hooks/use-toast";
import { WorkExperience, CoworkerProfile } from "@/types/api";

interface WorkExperienceVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  experience: WorkExperience | null;
  onUpdated?: () => void;
}

export const WorkExperienceVerificationModal: React.FC<WorkExperienceVerificationModalProps> = ({
  isOpen,
  onClose,
  experience,
  onUpdated,
}) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"p2p" | "admin" | "auto">("p2p");

  // Option B (P2P) state
  const [coworkers, setCoworkers] = useState<CoworkerProfile[]>([]);
  const [isLoadingCoworkers, setIsLoadingCoworkers] = useState(false);
  const [selectedPeerIds, setSelectedPeerIds] = useState<string[]>([]);

  // Option A (Admin) state
  const [adminIdentifier, setAdminIdentifier] = useState("");

  // AI-First Auto state
  const [evidenceText, setEvidenceText] = useState("");

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load coworkers when opening P2P tab or modal
  React.useEffect(() => {
    if (isOpen && experience?.company) {
      setIsLoadingCoworkers(true);
      backendApi.workVerification
        .searchCoworkers(experience.company)
        .then((list) => {
          setCoworkers(list);
        })
        .catch(() => {
          setCoworkers([]);
        })
        .finally(() => {
          setIsLoadingCoworkers(false);
        });
    }
  }, [isOpen, experience?.company]);

  const resetState = () => {
    setIsSubmitting(false);
    setStatusMessage(null);
    setErrorMessage(null);
    setSelectedPeerIds([]);
    setAdminIdentifier("");
    setEvidenceText("");
  };

  const handleClose = () => {
    if (isSubmitting) return;
    resetState();
    onClose();
  };

  const togglePeerSelection = (peerId: string) => {
    setSelectedPeerIds((prev) => {
      if (prev.includes(peerId)) {
        return prev.filter((id) => id !== peerId);
      }
      if (prev.length >= 3) {
        toast({
          title: "Selection Limit Reached",
          description: "Exactly 3 coworkers are required for anonymous consensus.",
        });
        return prev;
      }
      return [...prev, peerId];
    });
  };

  // Submit P2P Request
  const handleSubmitP2P = async () => {
    if (!experience || selectedPeerIds.length !== 3) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await backendApi.workVerification.requestP2P(experience.id, selectedPeerIds);
      setStatusMessage("P2P verification requests dispatched to 3 coworkers!");
      toast({
        title: "P2P Verification Dispatched",
        description: "Sent anonymous approval requests to 3 verified coworkers.",
      });
      if (onUpdated) onUpdated();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to dispatch P2P requests";
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Admin Request
  const handleSubmitAdmin = async () => {
    if (!experience || !adminIdentifier.trim()) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await backendApi.workVerification.requestAdmin(experience.id, {
        admin_identifier: adminIdentifier.trim(),
      });
      setStatusMessage("Verification request routed to company administrator.");
      toast({
        title: "Admin Request Sent",
        description: "Awaiting single administrator confirmation.",
      });
      if (onUpdated) onUpdated();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to submit admin request";
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit AI Auto Check
  const handleSubmitAuto = async () => {
    if (!experience || !evidenceText.trim()) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const updated = await backendApi.workVerification.verifyAuto(experience.id, {
        evidence_text: evidenceText.trim(),
      });
      const st = updated.verification_status || "AI_EVIDENCE_CHECKED";
      setStatusMessage(`AI evidence checked: Status set to ${st}`);
      toast({
        title: "AI Evidence Analyzed",
        description: `Status updated to ${st}`,
      });
      if (onUpdated) onUpdated();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to execute AI evidence check";
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl bg-card border-border shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Verify Work Experience</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Anonymous Coworker P2P Consensus or Official Company Admin Sign-Off
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {experience && (
          <div className="bg-muted/40 p-3 rounded-lg border border-border/60 flex items-center justify-between text-xs">
            <div>
              <div className="font-semibold text-foreground flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-primary" />
                {experience.title} at {experience.company}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {experience.employment_type || "Full-time"} • Current Status:{" "}
                <span className="font-mono uppercase font-medium text-foreground">
                  {experience.verification_status || "PENDING"}
                </span>
              </p>
            </div>
          </div>
        )}

        {statusMessage ? (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-700 dark:text-emerald-300 space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <h4 className="text-sm font-bold">Request Dispatched</h4>
            </div>
            <p className="text-xs">{statusMessage}</p>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as "p2p" | "admin" | "auto")} className="w-full">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="p2p" className="text-xs flex items-center gap-1.5" disabled={isSubmitting}>
                <Users className="w-3.5 h-3.5" />
                Option B: P2P (3 Peers)
              </TabsTrigger>
              <TabsTrigger value="admin" className="text-xs flex items-center gap-1.5" disabled={isSubmitting}>
                <UserCheck className="w-3.5 h-3.5" />
                Option A: Admin
              </TabsTrigger>
              <TabsTrigger value="auto" className="text-xs flex items-center gap-1.5" disabled={isSubmitting}>
                <Sparkles className="w-3.5 h-3.5" />
                AI Evidence Check
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: OPTION B (P2P ANONYMOUS) */}
            <TabsContent value="p2p" className="space-y-4 pt-3">
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-medium text-foreground">
                    Select 3 Coworkers at {experience?.company}:
                  </span>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {selectedPeerIds.length} / 3 Selected
                  </Badge>
                </div>

                <div className="border border-border/70 rounded-lg max-h-48 overflow-y-auto divide-y divide-border/40 p-1">
                  {isLoadingCoworkers ? (
                    <div className="p-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Searching verified coworkers...
                    </div>
                  ) : coworkers.length === 0 ? (
                    <div className="p-4 text-center text-xs text-muted-foreground">
                      No other profiles found for &ldquo;{experience?.company}&rdquo;. Try Option A (Admin) or AI Evidence Check.
                    </div>
                  ) : (
                    coworkers.map((cw) => {
                      const isSelected = selectedPeerIds.includes(cw.id);
                      return (
                        <div
                          key={cw.id}
                          onClick={() => togglePeerSelection(cw.id)}
                          className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors text-xs ${
                            isSelected ? "bg-primary/10" : "hover:bg-muted/50"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Checkbox checked={isSelected} onCheckedChange={() => togglePeerSelection(cw.id)} />
                            <div>
                              <p className="font-medium text-foreground">
                                {cw.first_name || cw.last_name
                                  ? `${cw.first_name || ""} ${cw.last_name || ""}`.trim()
                                  : `@${cw.username || "coworker"}`}
                              </p>
                              {cw.title && <p className="text-[11px] text-muted-foreground">{cw.title}</p>}
                            </div>
                          </div>
                          <Badge variant="secondary" className="text-[10px]">
                            {cw.company}
                          </Badge>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="flex items-start gap-2 bg-primary/5 border border-primary/20 p-2.5 rounded-lg text-xs text-muted-foreground">
                <Lock className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                <span>
                  <strong>Ring Signature Guarantee:</strong> When all 3 coworkers approve, their signatures are merged into an
                  anonymous threshold proof. Individual coworker identities are strictly never recorded in the final verified record.
                </span>
              </div>
            </TabsContent>

            {/* TAB 2: OPTION A (ADMIN APPROVAL) */}
            <TabsContent value="admin" className="space-y-4 pt-3">
              <div className="space-y-2">
                <Label htmlFor="admin-id" className="text-xs">
                  Company Admin / Manager Username or ID
                </Label>
                <Input
                  id="admin-id"
                  placeholder="e.g. acme_hr or manager_username"
                  value={adminIdentifier}
                  onChange={(e) => setAdminIdentifier(e.target.value)}
                  disabled={isSubmitting}
                  className="text-xs"
                />
                <p className="text-[11px] text-muted-foreground">
                  A single approval from an authorized company administrator will verify this work experience.
                </p>
              </div>
            </TabsContent>

            {/* TAB 3: AI EVIDENCE CHECK */}
            <TabsContent value="auto" className="space-y-4 pt-3">
              <div className="space-y-2">
                <Label htmlFor="evidence-text" className="text-xs">
                  Employment Evidence Text (Offer letter excerpt, pay statement summary, work sample)
                </Label>
                <Textarea
                  id="evidence-text"
                  placeholder="Paste work experience documentation text for in-memory AI alignment analysis..."
                  rows={4}
                  value={evidenceText}
                  onChange={(e) => setEvidenceText(e.target.value)}
                  disabled={isSubmitting}
                  className="text-xs"
                />
                <p className="text-[11px] text-muted-foreground">
                  Analyzes company and title keywords to advance status to AI_EVIDENCE_CHECKED or SOURCE_VERIFIED.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        )}

        {errorMessage && (
          <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={handleClose} disabled={isSubmitting} className="text-xs">
            {statusMessage ? "Close" : "Cancel"}
          </Button>

          {!statusMessage && (
            <>
              {activeTab === "p2p" && (
                <Button
                  size="sm"
                  onClick={handleSubmitP2P}
                  disabled={isSubmitting || selectedPeerIds.length !== 3}
                  className="text-xs flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Dispatching...
                    </>
                  ) : (
                    <>
                      <Users className="w-3.5 h-3.5" />
                      Request 3 Coworkers
                    </>
                  )}
                </Button>
              )}

              {activeTab === "admin" && (
                <Button
                  size="sm"
                  onClick={handleSubmitAdmin}
                  disabled={isSubmitting || !adminIdentifier.trim()}
                  className="text-xs flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Routing...
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-3.5 h-3.5" />
                      Send to Admin
                    </>
                  )}
                </Button>
              )}

              {activeTab === "auto" && (
                <Button
                  size="sm"
                  onClick={handleSubmitAuto}
                  disabled={isSubmitting || !evidenceText.trim()}
                  className="text-xs flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      Run AI Evidence Check
                    </>
                  )}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
