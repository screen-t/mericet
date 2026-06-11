import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ShieldAlert, User, FileText, ExternalLink } from "lucide-react";
import { backendApi } from "@/lib/backend-api";
import { useToast } from "@/hooks/use-toast";

interface ReportItem {
  id: string;
  reporter_id: string;
  target_type: "post" | "user";
  target_id: string;
  reason: string;
  details?: string | null;
  status: "pending" | "reviewed" | "resolved" | "dismissed";
  created_at: string;
  updated_at: string;
}

const statusOptions: Array<ReportItem["status"]> = ["pending", "reviewed", "resolved", "dismissed"];

const ModerationQueue = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeStatus, setActiveStatus] = useState<ReportItem["status"]>("pending");

  const { data: moderatorStatus, isLoading: loadingModerator } = useQuery({
    queryKey: ["moderatorStatus"],
    queryFn: () => backendApi.reports.moderatorStatus(),
  });

  const { data: queueData, isLoading } = useQuery({
    queryKey: ["reports", "queue", activeStatus],
    queryFn: () => backendApi.reports.getQueue(activeStatus, 50, 0),
    enabled: !!moderatorStatus?.can_moderate,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ reportId, status }: { reportId: string; status: ReportItem["status"] }) =>
      backendApi.reports.updateStatus(reportId, status),
    onSuccess: (_, vars) => {
      toast({ title: `Report marked ${vars.status}` });
      queryClient.invalidateQueries({ queryKey: ["reports", "queue"] });
    },
    onError: () => toast({ title: "Failed to update report", variant: "destructive" }),
  });

  if (loadingModerator) {
    return (
      <AppLayout>
        <div className="flex min-h-[400px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!moderatorStatus?.can_moderate) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-3xl px-4 py-10">
          <Card className="p-8 text-center">
            <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h1 className="text-2xl font-bold">Moderation access required</h1>
            <p className="mt-2 text-muted-foreground">
              This area is reserved for configured moderators.
            </p>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold">Moderation Queue</h1>
            <p className="text-muted-foreground mt-2">Review user reports and update their status.</p>
          </div>
        </div>

        <Tabs value={activeStatus} onValueChange={(value) => setActiveStatus(value as ReportItem["status"])}>
          <TabsList className="flex flex-wrap gap-2 h-auto w-fit">
            {statusOptions.map((status) => (
              <TabsTrigger key={status} value={status} className="capitalize">
                {status}
              </TabsTrigger>
            ))}
          </TabsList>

          {statusOptions.map((status) => (
            <TabsContent key={status} value={status} className="mt-6">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : queueData && queueData.length > 0 ? (
                <div className="space-y-4">
                  {queueData.map((report: ReportItem, index: number) => (
                    <motion.div
                      key={report.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.04 }}
                    >
                      <Card className="p-5">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="secondary" className="capitalize">{report.status}</Badge>
                              <Badge variant="outline" className="capitalize">{report.target_type}</Badge>
                              <span className="text-sm text-muted-foreground">{new Date(report.created_at).toLocaleString()}</span>
                            </div>

                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              {report.target_type === "user" ? <User className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                              <span>Target ID: {report.target_id}</span>
                              <Link to={report.target_type === "user" ? `/profile/${report.target_id}` : `/posts/${report.target_id}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                                Open
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Link>
                            </div>

                            <div>
                              <p className="font-medium">Reason</p>
                              <p className="text-sm text-muted-foreground">{report.reason}</p>
                            </div>

                            {report.details && (
                              <div>
                                <p className="font-medium">Details</p>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{report.details}</p>
                              </div>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-2 md:justify-end">
                            {report.status !== "reviewed" && (
                              <Button variant="outline" onClick={() => updateStatusMutation.mutate({ reportId: report.id, status: "reviewed" })} disabled={updateStatusMutation.isPending}>
                                Mark reviewed
                              </Button>
                            )}
                            {report.status !== "resolved" && (
                              <Button onClick={() => updateStatusMutation.mutate({ reportId: report.id, status: "resolved" })} disabled={updateStatusMutation.isPending}>
                                Resolve
                              </Button>
                            )}
                            {report.status !== "dismissed" && (
                              <Button variant="ghost" onClick={() => updateStatusMutation.mutate({ reportId: report.id, status: "dismissed" })} disabled={updateStatusMutation.isPending}>
                                Dismiss
                              </Button>
                            )}
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <Card className="p-8 text-center">
                  <ShieldAlert className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
                  <p className="font-semibold">No reports in this bucket</p>
                  <p className="text-sm text-muted-foreground mt-1">You're all caught up.</p>
                </Card>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default ModerationQueue;
