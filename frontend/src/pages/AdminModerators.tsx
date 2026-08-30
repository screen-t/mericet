import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/ui/UserAvatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ShieldAlert, Search, UserCog, X } from "lucide-react";
import { backendApi, type AdminUser } from "@/lib/backend-api";
import { useToast } from "@/hooks/use-toast";

type Role = "user" | "moderator" | "admin";

const roleLabel: Record<Role, string> = {
  user: "User",
  moderator: "Moderator",
  admin: "Admin",
};

const roleBadgeVariant: Record<Role, "secondary" | "default"> = {
  user: "secondary",
  moderator: "default",
  admin: "default",
};

function displayName(person: { first_name?: string | null; last_name?: string | null; username?: string | null }) {
  const full = `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim();
  return full || person.username || "Unknown user";
}

const AdminModerators = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: adminStatus, isLoading: loadingStatus } = useQuery({
    queryKey: ["adminStatus"],
    queryFn: () => backendApi.admin.getStatus(),
  });

  const { data: moderators, isLoading: loadingModerators } = useQuery({
    queryKey: ["admin", "moderators"],
    queryFn: () => backendApi.admin.getModerators(),
    enabled: !!adminStatus?.is_admin,
  });

  const { data: searchResults, isFetching: searching } = useQuery({
    queryKey: ["admin", "userSearch", debouncedQuery],
    queryFn: () => backendApi.search.searchUsers(debouncedQuery, 8),
    enabled: !!adminStatus?.is_admin && debouncedQuery.length > 0,
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: Role }) =>
      backendApi.admin.updateRole(userId, role),
    onSuccess: (_, vars) => {
      toast({ title: vars.role === "user" ? "Access revoked" : `Promoted to ${roleLabel[vars.role].toLowerCase()}` });
      queryClient.invalidateQueries({ queryKey: ["admin", "moderators"] });
    },
    onError: (err: Error) =>
      toast({ title: "Couldn't update role", description: err.message, variant: "destructive" }),
  });

  const { data: suspended, isLoading: loadingSuspended } = useQuery({
    queryKey: ["admin", "suspended"],
    queryFn: () => backendApi.admin.getSuspended(),
    enabled: !!adminStatus?.is_admin,
  });

  const unsuspendMutation = useMutation({
    mutationFn: (userId: string) => backendApi.admin.unsuspendUser(userId),
    onSuccess: () => {
      toast({ title: "Account restored" });
      queryClient.invalidateQueries({ queryKey: ["admin", "suspended"] });
    },
    onError: () => toast({ title: "Couldn't restore account", variant: "destructive" }),
  });

  if (loadingStatus) {
    return (
      <AppLayout>
        <div className="flex min-h-[400px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!adminStatus?.is_admin) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-3xl px-4 py-10">
          <Card className="p-8 text-center">
            <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h1 className="text-2xl font-bold">Admin access required</h1>
            <p className="mt-2 text-muted-foreground">
              This area is reserved for account administrators.
            </p>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const searchedUsers = (searchResults?.users ?? []).filter(
    (u) => !(moderators ?? []).some((m) => m.id === u.id)
  );

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <UserCog className="h-7 w-7 text-primary" />
            Manage Moderators
          </h1>
          <p className="text-muted-foreground mt-2">
            Grant or revoke moderator and admin access without a redeploy.
          </p>
        </div>

        {/* Search + promote */}
        <Card className="p-5 space-y-3">
          <p className="font-medium text-sm">Find a user to promote</p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or username..."
              className="pl-9"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {debouncedQuery && (
            <div className="space-y-2">
              {searching ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : searchedUsers.length > 0 ? (
                searchedUsers.map((person) => (
                  <div key={person.id} className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-muted/50">
                    <div className="flex items-center gap-3 min-w-0">
                      <UserAvatar src={person.avatar_url} name={displayName(person)} size="sm" />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{displayName(person)}</p>
                        {person.username && (
                          <p className="text-xs text-muted-foreground truncate">@{person.username}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateRoleMutation.mutate({ userId: person.id, role: "moderator" })}
                        disabled={updateRoleMutation.isPending}
                      >
                        Make moderator
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => updateRoleMutation.mutate({ userId: person.id, role: "admin" })}
                        disabled={updateRoleMutation.isPending}
                      >
                        Make admin
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No matching users found.</p>
              )}
            </div>
          )}
        </Card>

        {/* Current moderators/admins */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Current moderators &amp; admins</h2>
          {loadingModerators ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : moderators && moderators.length > 0 ? (
            <div className="space-y-3">
              {moderators.map((person, index) => (
                <motion.div
                  key={person.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <Card className="p-4 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0">
                      <UserAvatar src={person.avatar_url} name={displayName(person)} size="md" />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{displayName(person)}</p>
                        {person.username && (
                          <p className="text-sm text-muted-foreground truncate">@{person.username}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={roleBadgeVariant[person.role ?? "user"]} className="capitalize">
                        {roleLabel[person.role ?? "user"]}
                      </Badge>
                      <Select
                        value={person.role ?? "user"}
                        onValueChange={(value) =>
                          updateRoleMutation.mutate({ userId: person.id, role: value as Role })
                        }
                      >
                        <SelectTrigger className="w-36 h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="moderator">Moderator</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="user">Revoke access</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center">
              <ShieldAlert className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
              <p className="font-semibold">No moderators yet</p>
              <p className="text-sm text-muted-foreground mt-1">Search above to promote someone.</p>
            </Card>
          )}
        </div>

        {/* Suspended accounts */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Suspended accounts</h2>
          {loadingSuspended ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : suspended && suspended.length > 0 ? (
            <div className="space-y-3">
              {suspended.map((person, index) => (
                <motion.div
                  key={person.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <Card className="p-4 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0">
                      <UserAvatar src={person.avatar_url} name={displayName(person)} size="md" />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{displayName(person)}</p>
                        {person.username && (
                          <p className="text-sm text-muted-foreground truncate">@{person.username}</p>
                        )}
                        {person.suspended_reason && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{person.suspended_reason}</p>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => unsuspendMutation.mutate(person.id)}
                      disabled={unsuspendMutation.isPending}
                    >
                      Restore account
                    </Button>
                  </Card>
                </motion.div>
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center">
              <ShieldAlert className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
              <p className="font-semibold">No suspended accounts</p>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default AdminModerators;
