import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { backendApi } from "@/lib/backend-api";

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetType: "post" | "user";
  targetId: string;
  targetLabel: string;
}

const REPORT_REASONS = [
  "Spam or scam",
  "Harassment or abuse",
  "False information",
  "Hate speech",
  "Nudity or sexual content",
  "Inappropriate content",
  "Other",
];

export const ReportDialog = ({ open, onOpenChange, targetType, targetId, targetLabel }: ReportDialogProps) => {
  const { toast } = useToast();
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState("");

  const reportMutation = useMutation({
    mutationFn: () =>
      backendApi.reports.createReport({
        target_type: targetType,
        target_id: targetId,
        reason,
        details: details.trim() || undefined,
      }),
    onSuccess: () => {
      toast({ title: `${targetLabel} reported` });
      setReason(REPORT_REASONS[0]);
      setDetails("");
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Failed to report";
      toast({ title: message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report {targetLabel}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Reason</label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a reason" />
              </SelectTrigger>
              <SelectContent>
                {REPORT_REASONS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Additional details</label>
            <Textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Add context for the moderation team"
              rows={4}
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={reportMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={() => reportMutation.mutate()} disabled={reportMutation.isPending || !reason.trim()}>
              Report
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReportDialog;
