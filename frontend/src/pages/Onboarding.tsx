import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  User,
  ArrowRight,
  ArrowLeft,
  Check,
  SkipForward,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const Onboarding = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    headline: "",
    currentPosition: "",
    currentCompany: "",
  });

  const handleNext = () => {
    if (currentStep < 2) {
      setCurrentStep(currentStep + 1);
    } else {
      navigate("/feed");
    }
  };

  const handleSkip = () => {
    navigate("/feed");
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl"
      >
        <div className="bg-card rounded-2xl shadow-xl p-8 border border-border">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-4">
              <img src="/logo.png" alt="Mericet" className="h-10" />
              <span className="font-bold text-2xl tracking-tight">Mericet</span>
            </div>
            <h1 className="text-3xl font-bold mb-2">Welcome to mericet</h1>
            <p className="text-muted-foreground">
              Let's set up your professional profile
            </p>
          </div>

          {/* Progress */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {[1, 2].map((step) => (
              <div
                key={step}
                className={`h-2 rounded-full transition-all ${
                  step === currentStep
                    ? "w-8 bg-primary"
                    : step < currentStep
                    ? "w-2 bg-primary/50"
                    : "w-2 bg-muted"
                }`}
              />
            ))}
          </div>

          <AnimatePresence mode="wait">
            {/* Step 1: Basic Info */}
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-2xl font-semibold mb-2">
                    Tell us about yourself
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    This information will be visible on your profile
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">
                      First Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="firstName"
                      placeholder="John"
                      value={formData.firstName}
                      onChange={(e) => updateField("firstName", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">
                      Last Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="lastName"
                      placeholder="Doe"
                      value={formData.lastName}
                      onChange={(e) => updateField("lastName", e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="headline">
                    Headline
                    <span className="text-xs text-muted-foreground ml-2">
                      (Optional - you can add this later)
                    </span>
                  </Label>
                  <Input
                    id="headline"
                    placeholder="e.g., Product Manager | Entrepreneur | Tech Enthusiast"
                    value={formData.headline}
                    onChange={(e) => updateField("headline", e.target.value)}
                    maxLength={120}
                  />
                  <p className="text-xs text-muted-foreground">
                    Sum up what you do in a few words
                  </p>
                </div>
              </motion.div>
            )}

            {/* Step 2: Professional Info (All Optional) */}
            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-2xl font-semibold mb-2">
                    Current professional status
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    All fields are optional - add what you're comfortable sharing
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currentPosition">
                    What do you do?
                    <span className="text-xs text-muted-foreground ml-2">
                      (Optional)
                    </span>
                  </Label>
                  <Input
                    id="currentPosition"
                    placeholder="e.g., CEO, Developer, Consultant, Entrepreneur, Investor"
                    value={formData.currentPosition}
                    onChange={(e) =>
                      updateField("currentPosition", e.target.value)
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Type freely - no dropdown limits
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currentCompany">
                    Where do you work?
                    <span className="text-xs text-muted-foreground ml-2">
                      (Optional)
                    </span>
                  </Label>
                  <Input
                    id="currentCompany"
                    placeholder="e.g., Your company or 'Self-employed' or 'Freelance'"
                    value={formData.currentCompany}
                    onChange={(e) => updateField("currentCompany", e.target.value)}
                  />
                </div>

                <div className="p-4 bg-muted/50 rounded-lg border border-muted">
                  <p className="text-sm text-muted-foreground">
                    <strong>Tip:</strong> You can skip this and add more details
                    later from your profile settings. We believe in flexibility -
                    add what matters to you!
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t">
            <Button
              variant="ghost"
              onClick={handlePrevious}
              disabled={currentStep === 1}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Previous
            </Button>

            <div className="flex gap-2">
              {currentStep === 2 && (
                <Button
                  variant="ghost"
                  onClick={handleSkip}
                  className="gap-2"
                >
                  <SkipForward className="h-4 w-4" />
                  Skip & Complete
                </Button>
              )}
              <Button
                onClick={handleNext}
                disabled={!formData.firstName || !formData.lastName}
                className="gap-2"
              >
                {currentStep === 2 ? (
                  <>
                    <Check className="h-4 w-4" />
                    Complete Setup
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Onboarding;