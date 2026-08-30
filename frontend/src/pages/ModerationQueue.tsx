import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { Loader2, ShieldAlert, User, FileText, ExternalLink, Star } from "lucide-react";
import { backendApi, type Review } from "@/lib/backend-api";
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
  target_is_hidden?: boolean;
  target_is_suspended?: boolean;
}

const statusOptions: Array<ReportItem["status"]> = ["pending", "reviewed", "resolved", "dismissed"];
const reviewStatusOptions: Array<Review["status"]> = ["pending", "approved", "rejected"];

const ModerationQueue = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [queueKind, setQueueKind] = useState<"reports" | "reviews">("reports");
  const [activeStatus, setActiveStatus] = useState<ReportItem["status"]>("pending");
  const [activeReviewStatus, setActiveReviewStatus] = useState<Review["status"]>("pending");

  const { data: moderatorStatus, isLoading: loadingModerator } = useQuery({
    queryKey: ["moderatorStatus"],
    queryFn: () => backendApi.reports.moderatorStatus(),
  });

  const { data: queueData, isLoading } = useQuery({
    queryKey: ["reports", "queue", activeStatus],
    queryFn: () => backendApi.reports.getQueue(activeStatus, 50, 0),
    enabled: !!moderatorStatus?.can_moderate && queueKind === "reports",
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

  const hideReportedPostMutation = useMutation({
    mutationFn: ({ postId, reportId }: { postId: string; reportId: string }) =>
      backendApi.posts.moderatorHidePost(postId).then(() =>
        backendApi.reports.updateStatus(reportId, "resolved")
      ),
    onSuccess: () => {
      toast({ title: "Post hidden and report resolved" });
      queryClient.invalidateQueries({ queryKey: ["reports", "queue"] });
      queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
    onError: () => toast({ title: "Failed to hide post", variant: "destructive" }),
  });

  const unhideReportedPostMutation = useMutation({
    mutationFn: (postId: string) => backendApi.posts.moderatorUnhidePost(postId),
    onSuccess: () => {
      toast({ title: "Post restored" });
      queryClient.invalidateQueries({ queryKey: ["reports", "queue"] });
      queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
    onError: () => toast({ title: "Failed to restore post", variant: "destructive" }),
  });

  const suspendReportedUserMutation = useMutation({
    mutationFn: ({ userId, reportId, reason }: { userId: string; reportId: string; reason?: string }) =>
      backendApi.admin.suspendUser(userId, reason).then(() =>
        backendApi.reports.updateStatus(reportId, "resolved")
      ),
    onSuccess: () => {
      toast({ title: "Account suspended and report resolved" });
      queryClient.invalidateQueries({ queryKey: ["reports", "queue"] });
    },
    onError: () => toast({ title: "Failed to suspend account", variant: "destructive" }),
  });

  const unsuspendReportedUserMutation = useMutation({
    mutationFn: (userId: string) => backendApi.admin.unsuspendUser(userId),
    onSuccess: () => {
      toast({ title: "Account restored" });
      queryClient.invalidateQueries({ queryKey: ["reports", "queue"] });
    },
    onError: () => toast({ title: "Failed to restore account", variant: "destructive" }),
  });

  const { data: reviewQueueData, isLoading: loadingReviews } = useQuery({
    queryKey: ["reviews", "queue", activeReviewStatus],
    queryFn: () => backendApi.reviews.getQueue(activeReviewStatus, 50, 0),
    enabled: !!moderatorStatus?.can_moderate && queueKind === "reviews",
  });

  const updateReviewMutation = useMutation({
    mutationFn: ({ reviewId, data }: { reviewId: string; data: { status?: "approved" | "rejected"; is_featured?: boolean } }) =>
      backendApi.reviews.updateStatus(reviewId, data),
    onSuccess: (_, vars) => {
      const label = vars.data.status
        ? `Review ${vars.data.status}`
        : vars.data.is_featured
        ? "Featured on landing page"
        : "Removed from landing page";
      toast({ title: label });
      queryClient.invalidateQueries({ queryKey: ["reviews", "queue"] });
      queryClient.invalidateQueries({ queryKey: ["reviews", "public"] });
    },
    onError: () => toast({ title: "Failed to update review", variant: "destructive" }),
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
            <p className="text-muted-foreground mt-2">
              {queueKind === "reports"
                ? "Review user reports and update their status."
                : "Approve or reject submitted reviews, and choose which ones appear on the landing page."}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={queueKind === "reports" ? "default" : "outline"}
              size="sm"
              onClick={() => setQueueKind("reports")}
            >
              Reports
            </Button>
            <Button
              variant={queueKind === "reviews" ? "default" : "outline"}
              size="sm"
              onClick={() => setQueueKind("reviews")}
            >
              Reviews
            </Button>
          </div>
        </div>

        {queueKind === "reviews" ? (
          <Tabs value={activeReviewStatus} onValueChange={(value) => setActiveReviewStatus(value as Review["status"])}>
            <TabsList className="flex flex-wrap gap-2 h-auto w-fit">
              {reviewStatusOptions.map((status) => (
                <TabsTrigger key={status} value={status} className="capitalize">
                  {status}
                </TabsTrigger>
              ))}
            </TabsList>

            {reviewStatusOptions.map((status) => (
              <TabsContent key={status} value={status} className="mt-6">
                {loadingReviews ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : reviewQueueData && reviewQueueData.length > 0 ? (
                  <div className="space-y-4">
                    {reviewQueueData.map((review, index) => {
                      const author = review.user;
                      const authorName = author
                        ? `${author.first_name ?? ""} ${author.last_name ?? ""}`.trim() || author.username || "Unknown user"
                        : "Unknown user";
                      return (
                        <motion.div
                          key={review.id}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.04 }}
                        >
                          <Card className="p-5">
                            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                              <div className="space-y-3 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge variant="secondary" className="capitalize">{review.status}</Badge>
                                  {review.is_featured && <Badge variant="default">Featured</Badge>}
                                  <span className="text-sm text-muted-foreground">{new Date(review.created_at).toLocaleString()}</span>
                                </div>

                                <div className="flex items-center gap-3">
                                  <UserAvatar src={author?.avatar_url ?? undefined} name={authorName} size="sm" />
                                  <div>
                                    <Link
                                      to={`/profile/${author?.username || author?.id || ""}`}
                                      className="font-medium hover:underline inline-flex items-center gap-1"
                                    >
                                      {authorName}
                                      <ExternalLink className="h-3 w-3" />
                                    </Link>
                                    <div className="flex items-center gap-0.5">
                                      {[1, 2, 3, 4, 5].map((i) => (
                                        <Star
                                          key={i}
                                          className={`h-3.5 w-3.5 ${i <= review.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                </div>

                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{review.content}</p>
                              </div>

                              <div className="flex flex-wrap gap-2 md:justify-end md:flex-col">
                                {review.status !== "approved" && (
                                  <Button
                                    onClick={() => updateReviewMutation.mutate({ reviewId: review.id, data: { status: "approved" } })}
                                    disabled={updateReviewMutation.isPending}
                                  >
                                    Approve
                                  </Button>
                                )}
                                {review.status !== "rejected" && (
                                  <Button
                                    variant="outline"
                                    onClick={() => updateReviewMutation.mutate({ reviewId: review.id, data: { status: "rejected" } })}
                                    disabled={updateReviewMutation.isPending}
                                  >
                                    Reject
                                  </Button>
                                )}
                                {review.status === "approved" && (
                                  <Button
                                    variant={review.is_featured ? "secondary" : "outline"}
                                    onClick={() => updateReviewMutation.mutate({ reviewId: review.id, data: { is_featured: !review.is_featured } })}
                                    disabled={updateReviewMutation.isPending}
                                  >
                                    {review.is_featured ? "Remove from landing page" : "Feature on landing page"}
                                  </Button>
                                )}
                              </div>
                            </div>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  <Card className="p-8 text-center">
                    <ShieldAlert className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
                    <p className="font-semibold">No reviews in this bucket</p>
                    <p className="text-sm text-muted-foreground mt-1">You're all caught up.</p>
                  </Card>
                )}
              </TabsContent>
            ))}
          </Tabs>
        ) : (
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
                              {report.target_is_hidden && <Badge variant="destructive">Hidden</Badge>}
                              {report.target_is_suspended && <Badge variant="destructive">Suspended</Badge>}
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
                            {report.target_type === "post" && (
                              report.target_is_hidden ? (
                                <Button
                                  variant="outline"
                                  onClick={() => unhideReportedPostMutation.mutate(report.target_id)}
                                  disabled={unhideReportedPostMutation.isPending}
                                >
                                  Unhide post
                                </Button>
                              ) : (
                                <Button
                                  variant="destructive"
                                  onClick={() => hideReportedPostMutation.mutate({ postId: report.target_id, reportId: report.id })}
                                  disabled={hideReportedPostMutation.isPending}
                                >
                                  Hide post
                                </Button>
                              )
                            )}
                            {report.target_type === "user" && (
                              report.target_is_suspended ? (
                                <Button
                                  variant="outline"
                                  onClick={() => unsuspendReportedUserMutation.mutate(report.target_id)}
                                  disabled={unsuspendReportedUserMutation.isPending}
                                >
                                  Restore account
                                </Button>
                              ) : (
                                <Button
                                  variant="destructive"
                                  onClick={() => suspendReportedUserMutation.mutate({ userId: report.target_id, reportId: report.id, reason: report.reason })}
                                  disabled={suspendReportedUserMutation.isPending}
                                >
                                  Suspend account
                                </Button>
                              )
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
        )}
      </div>
    </AppLayout>
  );
};

export default ModerationQueue;
