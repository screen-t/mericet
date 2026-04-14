import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import  Onboarding from "./pages/Onboarding";
import { AuthProvider, RequireAuth } from "@/lib/auth";
import Feed from "./pages/Feed";
import FeedNew from "./pages/FeedNew";
import Profile from "./pages/Profile";
import ProfileNew from "./pages/ProfileNew";
import Network from "./pages/Network";
import NetworkNew from "./pages/NetworkNew";
import Messages from "./pages/Messages";
import MessagesNew from "./pages/MessagesNew";
import Notifications from "./pages/Notifications";
import NotificationsNew from "./pages/NotificationsNew";
import SearchPage from "./pages/SearchPage";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import OAuthCallback from "./pages/OAuthCallBack";
import Companies from "./pages/Companies";
import Saved from "./pages/SavedNew";
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/PrivacyPolicy";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,      // 5 min — data stays fresh, no unnecessary refetches
      gcTime: 1000 * 60 * 15,        // 15 min — keep unused data in cache longer
      retry: 1,                      // retry once on failure
      refetchOnWindowFocus: false,   // don't reload the whole feed on alt+tab
      refetchOnMount: false,         // don't re-hit the API if data is still fresh
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/auth/callback" element={<OAuthCallback />} />
            <Route path="/terms-of-service" element={<TermsOfService />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />

            {/* Protected routes */}
            <Route path="/feed" element={<RequireAuth><FeedNew /></RequireAuth>} />
            <Route path="/profile" element={<RequireAuth><ProfileNew /></RequireAuth>} />
            <Route path="/profile/:userId" element={<RequireAuth><ProfileNew /></RequireAuth>} />
            <Route path="/network" element={<RequireAuth><NetworkNew /></RequireAuth>} />
            <Route path="/messages" element={<RequireAuth><MessagesNew /></RequireAuth>} />
            <Route path="/messages/:userId" element={<RequireAuth><MessagesNew /></RequireAuth>} />
            <Route path="/notifications" element={<RequireAuth><NotificationsNew /></RequireAuth>} />
            <Route path="/search" element={<RequireAuth><SearchPage /></RequireAuth>} />
            <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
            <Route path="/companies" element={<RequireAuth><Companies /></RequireAuth>} />
            <Route path="/saved" element={<RequireAuth><Saved /></RequireAuth>} />
            <Route path="/saved/:folderId" element={<RequireAuth><Saved /></RequireAuth>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
