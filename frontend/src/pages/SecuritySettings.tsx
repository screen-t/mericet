import { useState } from "react";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Shield,
  Lock,
  Eye,
  EyeOff,
  Smartphone,
  Mail,
  Key,
  Monitor,
  MapPin,
  AlertTriangle,
  CheckCircle,
  Chrome,
  Activity,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { authApi } from "@/lib/api";
import { PasswordStrength } from "@/components/ui/PasswordStrength";
import { useToast } from "@/hooks/use-toast";

const loginHistory = [
  {
    id: "1",
    device: "Chrome on Windows",
    location: "San Francisco, CA, USA",
    ip: "192.168.1.1",
    timestamp: "2 hours ago",
    status: "success",
    icon: Chrome,
  },
  {
    id: "2",
    device: "iPhone 14 Pro",
    location: "San Francisco, CA, USA",
    ip: "192.168.1.5",
    timestamp: "1 day ago",
    status: "success",
    icon: Smartphone,
  },
  {
    id: "3",
    device: "Chrome on macOS",
    location: "New York, NY, USA",
    ip: "10.0.0.45",
    timestamp: "3 days ago",
    status: "success",
    icon: Monitor,
  },
  {
    id: "4",
    device: "Unknown Device",
    location: "Unknown Location",
    ip: "45.123.45.67",
    timestamp: "1 week ago",
    status: "failed",
    icon: AlertTriangle,
  },
];

const connectedAccounts = [
  { id: "1", provider: "Email", value: "john.doe@example.com", verified: true },
  { id: "2", provider: "Phone", value: "+1 (555) 123-4567", verified: true },
  { id: "3", provider: "Google", value: "john.doe@gmail.com", verified: true },
  { id: "4", provider: "GitHub", value: "johndoe", verified: false },
];

const SecuritySettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [loginAlerts, setLoginAlerts] = useState(true);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }
    if (!user?.email) {
      setPasswordError("Could not determine your account email. Please log in again.");
      return;
    }

    setPasswordLoading(true);
    try {
      // Step 1: verify current password by re-authenticating
      let freshToken: string;
      try {
        const loginRes = await authApi.login({ email: user.email, password: currentPassword });
        freshToken = loginRes.session.access_token;
      } catch {
        setPasswordError("Current password is incorrect.");
        return;
      }

      // Step 2: update to the new password using the fresh token
      await authApi.resetPassword({ access_token: freshToken, new_password: newPassword });

      toast({ title: "Password updated successfully" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setPasswordError("Failed to update password. Please try again.");
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Security & Login</h1>
            <p className="text-muted-foreground">
              Manage your account security and login settings
            </p>
          </div>
        </div>

        <Tabs defaultValue="security" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="activity">Login Activity</TabsTrigger>
            <TabsTrigger value="connected">Connected Accounts</TabsTrigger>
          </TabsList>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-6 mt-6">
            {/* Change Password */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Change Password
                </CardTitle>
                <CardDescription>
                  Update your password to keep your account secure
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleChangePassword} className="space-y-4">
                  {passwordError && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                      <span>{passwordError}</span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="current-password">Current Password</Label>
                    <div className="relative">
                      <Input
                        id="current-password"
                        type={showCurrentPassword ? "text" : "password"}
                        placeholder="Enter current password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showNewPassword ? "text" : "password"}
                        placeholder="Enter new password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {newPassword && <PasswordStrength password={newPassword} />}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm New Password</Label>
                    <div className="relative">
                      <Input
                        id="confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Confirm new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={confirmPassword ? (confirmPassword === newPassword ? "border-green-300" : "border-red-300") : ""}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {confirmPassword && confirmPassword !== newPassword && (
                      <p className="text-sm text-red-600">Passwords do not match</p>
                    )}
                    {confirmPassword && confirmPassword === newPassword && (
                      <p className="text-sm text-green-600 flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Passwords match
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    disabled={passwordLoading || !currentPassword || newPassword.length < 8 || newPassword !== confirmPassword}
                  >
                    {passwordLoading ? "Updating..." : "Update Password"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Two-Factor Authentication */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Two-Factor Authentication
                </CardTitle>
                <CardDescription>
                  Add an extra layer of security to your account
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <Label>Enable 2FA</Label>
                    <p className="text-sm text-muted-foreground">
                      Require a verification code in addition to your password
                    </p>
                  </div>
                  <Switch
                    checked={twoFactorEnabled}
                    onCheckedChange={setTwoFactorEnabled}
                  />
                </div>

                {twoFactorEnabled && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="space-y-3 p-4 bg-muted/50 rounded-lg"
                  >
                    <p className="text-sm font-medium">
                      Choose your verification method:
                    </p>
                    <div className="space-y-2">
                      <Button variant="outline" className="w-full justify-start gap-2">
                        <Smartphone className="h-4 w-4" />
                        SMS to +1 (555) 123-4567
                      </Button>
                      <Button variant="outline" className="w-full justify-start gap-2">
                        <Mail className="h-4 w-4" />
                        Email to john.doe@example.com
                      </Button>
                      <Button variant="outline" className="w-full justify-start gap-2">
                        <Key className="h-4 w-4" />
                        Authenticator App
                      </Button>
                    </div>
                  </motion.div>
                )}
              </CardContent>
            </Card>

            {/* Login Alerts */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Login Alerts
                </CardTitle>
                <CardDescription>
                  Get notified of suspicious account activity
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <Label>Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive email alerts for new logins
                    </p>
                  </div>
                  <Switch
                    checked={emailNotifications}
                    onCheckedChange={setEmailNotifications}
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <Label>Unrecognized Device Alerts</Label>
                    <p className="text-sm text-muted-foreground">
                      Alert me when logging in from a new device
                    </p>
                  </div>
                  <Switch
                    checked={loginAlerts}
                    onCheckedChange={setLoginAlerts}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Login Activity Tab */}
          <TabsContent value="activity" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Recent Login Activity
                </CardTitle>
                <CardDescription>
                  Review your recent login history and manage active sessions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Device</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loginHistory.map((login) => {
                      const Icon = login.icon;
                      return (
                        <TableRow key={login.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{login.device}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              {login.location}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {login.ip}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {login.timestamp}
                          </TableCell>
                          <TableCell>
                            {login.status === "success" ? (
                              <div className="flex items-center gap-1 text-green-600">
                                <CheckCircle className="h-4 w-4" />
                                <span className="text-sm">Success</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-destructive">
                                <AlertTriangle className="h-4 w-4" />
                                <span className="text-sm">Failed</span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {login.id === "1" ? (
                              <span className="text-sm text-muted-foreground">
                                Current
                              </span>
                            ) : (
                              <Button variant="ghost" size="sm" className="text-destructive">
                                Revoke
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Connected Accounts Tab */}
          <TabsContent value="connected" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Connected Accounts</CardTitle>
                <CardDescription>
                  Manage how you can sign in to your mericet account
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {connectedAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Label>{account.provider}</Label>
                        {account.verified && (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{account.value}</p>
                    </div>
                    <div className="flex gap-2">
                      {!account.verified && (
                        <Button variant="outline" size="sm">
                          Verify
                        </Button>
                      )}
                      {account.id !== "1" && (
                        <Button variant="ghost" size="sm" className="text-destructive">
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                ))}

                <Button variant="outline" className="w-full gap-2">
                  <Mail className="h-4 w-4" />
                  Add Another Login Method
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default SecuritySettings;
