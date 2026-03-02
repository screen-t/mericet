import { useState } from "react";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { Switch } from "@/components/ui/switch";
import {
  User,
  Briefcase,
  MapPin,
  Phone,
  Mail,
  Link as LinkIcon,
  Calendar,
  GraduationCap,
  Building2,
  Shield,
  Camera,
  X,
  Plus,
} from "lucide-react";

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profileData?: any;
}

export const EditProfileModal = ({
  isOpen,
  onClose,
  profileData,
}: EditProfileModalProps) => {
  const [activeTab, setActiveTab] = useState("basic");
  const [accountType, setAccountType] = useState("professional");
  const [workHistory, setWorkHistory] = useState([
    { id: 1, company: "", role: "", startDate: "", endDate: "", current: false },
  ]);

  const addWorkHistory = () => {
    setWorkHistory([
      ...workHistory,
      { id: Date.now(), company: "", role: "", startDate: "", endDate: "", current: false },
    ]);
  };

  const removeWorkHistory = (id: number) => {
    setWorkHistory(workHistory.filter((item) => item.id !== id));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">Basic</TabsTrigger>
            <TabsTrigger value="professional">Professional</TabsTrigger>
            <TabsTrigger value="contact">Contact</TabsTrigger>
            <TabsTrigger value="privacy">Privacy</TabsTrigger>
          </TabsList>

          {/* Basic Info Tab */}
          <TabsContent value="basic" className="space-y-6 mt-6">
            {/* Profile Photo */}
            <div className="flex items-center gap-4">
              <UserAvatar
                name={profileData?.name || "User"}
                src={profileData?.avatar}
                size="xl"
              />
              <div className="flex flex-col gap-2">
                <Button variant="outline" size="sm" className="gap-2">
                  <Camera className="h-4 w-4" />
                  Change Photo
                </Button>
                <p className="text-xs text-muted-foreground">
                  JPG, PNG or GIF. Max size 2MB
                </p>
              </div>
            </div>

            {/* Full Name */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input id="firstName" placeholder="John" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" placeholder="Doe" />
              </div>
            </div>

            {/* Additional Name */}
            <div className="space-y-2">
              <Label htmlFor="additionalName">
                Additional Name (Optional)
                <span className="text-xs text-muted-foreground ml-2">
                  Maiden name, nickname, etc.
                </span>
              </Label>
              <Input id="additionalName" placeholder="Enter additional name" />
            </div>

            {/* Pronouns */}
            <div className="space-y-2">
              <Label htmlFor="pronouns">Pronouns</Label>
              <Select>
                <SelectTrigger id="pronouns">
                  <SelectValue placeholder="Select your pronouns" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="he/him">He/Him</SelectItem>
                  <SelectItem value="she/her">She/Her</SelectItem>
                  <SelectItem value="they/them">They/Them</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                  <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Headline */}
            <div className="space-y-2">
              <Label htmlFor="headline">
                Headline
                <span className="text-xs text-muted-foreground ml-2">
                  Professional tagline shown on your profile
                </span>
              </Label>
              <Input
                id="headline"
                placeholder="e.g., CEO at TechCorp | Building the future"
                maxLength={120}
              />
              <p className="text-xs text-muted-foreground text-right">
                120 characters max
              </p>
            </div>

            {/* About/Bio */}
            <div className="space-y-2">
              <Label htmlFor="bio">
                About
                <span className="text-xs text-muted-foreground ml-2">
                  Tell your story
                </span>
              </Label>
              <Textarea
                id="bio"
                placeholder="Share your background, expertise, and what drives you..."
                rows={6}
                maxLength={2000}
              />
              <p className="text-xs text-muted-foreground text-right">
                2000 characters max
              </p>
            </div>

            {/* Birth Date */}
            <div className="space-y-2">
              <Label htmlFor="birthdate">Birth Date (Optional)</Label>
              <Input id="birthdate" type="date" />
              <p className="text-xs text-muted-foreground">
                Only month & day will be shown publicly
              </p>
            </div>
          </TabsContent>

          {/* Professional Info Tab */}
          <TabsContent value="professional" className="space-y-6 mt-6">
            {/* Account Type Switch */}
            <div className="p-4 border rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Account Type</Label>
                  <p className="text-sm text-muted-foreground">
                    Switch between professional and business account
                  </p>
                </div>
                <Select value={accountType} onValueChange={setAccountType}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Professional
                      </div>
                    </SelectItem>
                    <SelectItem value="business">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Business
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Current Position */}
            <div className="space-y-2">
              <Label htmlFor="currentPosition">Current Position</Label>
              <Input
                id="currentPosition"
                placeholder="e.g., Senior Product Manager"
              />
            </div>

            {/* Company */}
            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input id="company" placeholder="e.g., Google" />
            </div>

            {/* Industry */}
            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Select>
                <SelectTrigger id="industry">
                  <SelectValue placeholder="Select your industry" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="technology">Technology</SelectItem>
                  <SelectItem value="finance">Finance</SelectItem>
                  <SelectItem value="healthcare">Healthcare</SelectItem>
                  <SelectItem value="education">Education</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="consulting">Consulting</SelectItem>
                  <SelectItem value="manufacturing">Manufacturing</SelectItem>
                  <SelectItem value="retail">Retail</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Education */}
            <div className="space-y-2">
              <Label htmlFor="education">Education</Label>
              <Input
                id="education"
                placeholder="e.g., MBA, Stanford University"
              />
            </div>

            {/* Work History */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Work History</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addWorkHistory}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Position
                </Button>
              </div>

              {workHistory.map((work, index) => (
                <motion.div
                  key={work.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 border rounded-lg space-y-4 relative"
                >
                  {workHistory.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 h-6 w-6"
                      onClick={() => removeWorkHistory(work.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Company</Label>
                      <Input placeholder="Company name" />
                    </div>
                    <div className="space-y-2">
                      <Label>Role</Label>
                      <Input placeholder="Job title" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Start Date</Label>
                      <Input type="month" />
                    </div>
                    <div className="space-y-2">
                      <Label>End Date</Label>
                      <Input type="month" disabled={work.current} />
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id={`current-${work.id}`}
                      checked={work.current}
                      onCheckedChange={(checked) => {
                        const updated = [...workHistory];
                        updated[index].current = checked;
                        setWorkHistory(updated);
                      }}
                    />
                    <Label htmlFor={`current-${work.id}`}>
                      I currently work here
                    </Label>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Skills - Free text entry */}
            <div className="space-y-2">
              <Label htmlFor="skills">
                Skills
                <span className="text-xs text-muted-foreground ml-2">
                  Add your professional skills (comma-separated)
                </span>
              </Label>
              <Textarea
                id="skills"
                placeholder="e.g., Product Management, Strategy, Leadership, Data Analysis"
                rows={3}
              />
            </div>
          </TabsContent>

          {/* Contact Info Tab */}
          <TabsContent value="contact" className="space-y-6 mt-6">
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your.email@example.com"
              />
            </div>

            {/* Phone Number */}
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" type="tel" placeholder="+1 (555) 000-0000" />
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                placeholder="e.g., San Francisco, CA"
              />
            </div>

            {/* Postal Code */}
            <div className="space-y-2">
              <Label htmlFor="postalCode">Postal Code</Label>
              <Input id="postalCode" placeholder="94102" />
            </div>

            {/* Address */}
            <div className="space-y-2">
              <Label htmlFor="address">Address (Optional)</Label>
              <Textarea
                id="address"
                placeholder="Street address"
                rows={2}
              />
            </div>

            {/* Website */}
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                placeholder="https://yourwebsite.com"
              />
            </div>

            {/* Additional Links */}
            <div className="space-y-2">
              <Label>Additional Links</Label>
              <div className="space-y-2">
                <Input placeholder="LinkedIn profile" />
                <Input placeholder="Twitter/X profile" />
                <Input placeholder="GitHub profile" />
              </div>
            </div>
          </TabsContent>

          {/* Privacy Settings Tab */}
          <TabsContent value="privacy" className="space-y-6 mt-6">
            <div className="space-y-4">
              {/* Profile Visibility */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <Label>Profile Type</Label>
                  <p className="text-sm text-muted-foreground">
                    Control who can see your profile
                  </p>
                </div>
                <Select defaultValue="public">
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                    <SelectItem value="connections">Connections Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Show Email */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <Label>Show Email</Label>
                  <p className="text-sm text-muted-foreground">
                    Display email on public profile
                  </p>
                </div>
                <Switch />
              </div>

              {/* Show Phone */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <Label>Show Phone Number</Label>
                  <p className="text-sm text-muted-foreground">
                    Display phone on public profile
                  </p>
                </div>
                <Switch />
              </div>

              {/* Show Birth Date */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <Label>Show Birthday</Label>
                  <p className="text-sm text-muted-foreground">
                    Show month & day on profile
                  </p>
                </div>
                <Switch />
              </div>

              {/* Show Location */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <Label>Show Location</Label>
                  <p className="text-sm text-muted-foreground">
                    Display city and country
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              {/* Show Work History */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <Label>Show Work History</Label>
                  <p className="text-sm text-muted-foreground">
                    Display employment history
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              {/* Show Connections */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <Label>Show Connections</Label>
                  <p className="text-sm text-muted-foreground">
                    Display your connections list
                  </p>
                </div>
                <Select defaultValue="all">
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Everyone</SelectItem>
                    <SelectItem value="connections">Connections</SelectItem>
                    <SelectItem value="none">No one</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Activity Status */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <Label>Show Activity Status</Label>
                  <p className="text-sm text-muted-foreground">
                    Let others see when you're online
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onClose}>Save Changes</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
