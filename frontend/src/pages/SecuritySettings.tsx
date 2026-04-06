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
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [loginAlerts, setLoginAlerts] = useState(true);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

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
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <div className="relative">
                    <Input
                      id="current-password"
                      type={showCurrentPassword ? "text" : "password"}
                      placeholder="Enter current password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showCurrentPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
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
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showNewPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Must be at least 8 characters with letters, numbers, and symbols
                  </p>
                </div>

                <Button>Update Password</Button>
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
