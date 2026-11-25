import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase,
  GraduationCap,
  FolderGit2,
  Sparkles,
  Award,
  Wrench,
  Activity,
  ArrowUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface VaultSectionItem {
  id: string;
  label: string;
  shortLabel?: string;
  icon: React.ComponentType<{ className?: string }>;
}

const VAULT_SECTIONS: VaultSectionItem[] = [
  { id: "vault-experience", label: "Experience", shortLabel: "Exp", icon: Briefcase },
  { id: "vault-education", label: "Education", shortLabel: "Edu", icon: GraduationCap },
  { id: "vault-projects", label: "Projects", shortLabel: "Proj", icon: FolderGit2 },
  { id: "vault-skills", label: "Skills", shortLabel: "Skills", icon: Sparkles },
  { id: "vault-achievements", label: "Achievements", shortLabel: "Awards", icon: Award },
  { id: "vault-tools", label: "Connected Tools", shortLabel: "Tools", icon: Wrench },
  { id: "vault-living-graph", label: "Living Graph", shortLabel: "Graph", icon: Activity },
];

interface VaultSectionNavProps {
  className?: string;
  sentinelId?: string;
}

/**
 * Contextual Floating Section Shortcuts
 *
 * Rules:
 * 1. Initially HIDDEN when user is at the top of the profile / Vault.
 * 2. Appears smoothly only after user scrolls past the top sentinel threshold.
 * 3. Uses IntersectionObserver to track and highlight the currently active section.
 * 4. Smoothly scrolls into view on click without mutating history or causing jumps.
 * 5. Compact, touch-friendly, and mobile-responsive.
 */
export const VaultSectionNav = ({
  className = "",
  sentinelId = "vault-scroll-sentinel",
}: VaultSectionNavProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("vault-experience");

  // 1. Monitor Sentinel to show/hide the navigation dock
  useEffect(() => {
    const sentinel = document.getElementById(sentinelId);
    if (!sentinel) {
      // Fallback: check window scroll if sentinel is missing
      const handleScroll = () => {
        setIsVisible(window.scrollY > 280);
      };
      window.addEventListener("scroll", handleScroll, { passive: true });
      handleScroll();
      return () => window.removeEventListener("scroll", handleScroll);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        // If sentinel is visible on screen, user is at the top -> hide dock
        // If sentinel has scrolled out of view above, user is scrolling down -> show dock
        setIsVisible(!entry.isIntersecting);
      },
      {
        threshold: 0,
        rootMargin: "-40px 0px 0px 0px",
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinelId]);

  // 2. Track which section is currently centered in viewport
  useEffect(() => {
    const sectionElements = VAULT_SECTIONS.map((s) => document.getElementById(s.id)).filter(
      Boolean
    ) as HTMLElement[];

    if (sectionElements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Find visible sections sorted by intersection ratio
        const visibleEntries = entries.filter((e) => e.isIntersecting);
        if (visibleEntries.length > 0) {
          // Choose the one highest up or with greatest intersection
          const topEntry = visibleEntries.reduce((prev, curr) =>
            curr.intersectionRatio > prev.intersectionRatio ? curr : prev
          );
          if (topEntry?.target?.id) {
            setActiveSection(topEntry.target.id);
          }
        }
      },
      {
        threshold: [0.15, 0.4, 0.7],
        rootMargin: "-20% 0px -50% 0px", // focus on the upper-middle reading band
      }
    );

    sectionElements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const handleScrollToSection = useCallback((sectionId: string) => {
    const target = document.getElementById(sectionId);
    if (target) {
      // Offset for sticky navigation or comfortable breathing room
      const rect = target.getBoundingClientRect();
      const targetY = window.scrollY + rect.top - 80;
      window.scrollTo({
        top: Math.max(0, targetY),
        behavior: "smooth",
      });
      setActiveSection(sectionId);
    }
  }, []);

  const handleScrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.aside
          initial={{ opacity: 0, y: 32, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 32, scale: 0.94 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          aria-label="Resume Vault section shortcuts"
          className={cn(
            "fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-[95vw] sm:max-w-max",
            className
          )}
        >
          <div className="flex items-center gap-1 p-1.5 rounded-full bg-background/90 dark:bg-card/95 backdrop-blur-md border border-border/80 shadow-2xl ring-1 ring-black/5 dark:ring-white/10 overflow-x-auto scrollbar-none">
            {VAULT_SECTIONS.map((sec) => {
              const Icon = sec.icon;
              const isActive = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => handleScrollToSection(sec.id)}
                  aria-current={isActive ? "true" : undefined}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 select-none cursor-pointer",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
                  )}
                  title={sec.label}
                >
                  <Icon className={cn("w-3.5 h-3.5", isActive ? "text-primary-foreground" : "text-muted-foreground")} />
                  <span className="hidden md:inline">{sec.label}</span>
                  <span className="inline md:hidden">{sec.shortLabel || sec.label}</span>
                </button>
              );
            })}

            <div className="w-px h-4 bg-border/60 mx-0.5 shrink-0" />

            <button
              type="button"
              onClick={handleScrollToTop}
              className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors shrink-0"
              title="Back to top"
              aria-label="Back to top"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
};
