import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Navbar } from "@/components/layout/Navbar";
import {
  Users,
  Briefcase,
  MessageSquare,
  TrendingUp,
  Zap,
  Shield,
  ArrowRight,
  CheckCircle2,
  Star,
  Loader2,
} from "lucide-react";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { useAuth } from "@/lib/auth";
import { backendApi, type Review } from "@/lib/backend-api";
import { useToast } from "@/hooks/use-toast";

const features = [
  {
    icon: Users,
    title: "Build Your Network",
    description:
      "Connect with industry leaders, potential partners, and like-minded professionals.",
  },
  {
    icon: Briefcase,
    title: "Showcase Expertise",
    description:
      "Share your skills, experience, and achievements to stand out in your field.",
  },
  {
    icon: MessageSquare,
    title: "Meaningful Conversations",
    description:
      "Engage in discussions that matter and exchange valuable insights.",
  },
  {
    icon: TrendingUp,
    title: "Grow Together",
    description:
      "Discover opportunities, partnerships, and collaborations that accelerate growth.",
  },
];

interface DisplayTestimonial {
  id: string;
  name: string;
  role: string;
  avatar?: string;
  content: string;
  rating: number;
}

function toDisplayTestimonial(review: Review): DisplayTestimonial {
  const name = review.user
    ? `${review.user.first_name ?? ""} ${review.user.last_name ?? ""}`.trim() || review.user.username || "Mericet user"
    : "Mericet user";
  return {
    id: review.id,
    name,
    role: review.user?.headline || "",
    avatar: review.user?.avatar_url ?? undefined,
    content: review.content,
    rating: review.rating,
  };
}

const ROTATE_INTERVAL_MS = 7000;

function useRotatingWindow<T>(pool: T[], windowSize: number) {
  const [start, setStart] = useState(0);

  useEffect(() => {
    setStart(0);
    if (pool.length <= windowSize) return;
    const timer = setInterval(() => {
      setStart((s) => (s + windowSize) % pool.length);
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [pool.length, windowSize]);

  if (pool.length <= windowSize) return pool;
  return Array.from({ length: windowSize }, (_, i) => pool[(start + i) % pool.length]);
}

const stats = [
  { value: "50K+", label: "Professionals" },
  { value: "10K+", label: "Companies" },
  { value: "100K+", label: "Connections Made" },
  { value: "95%", label: "Satisfaction" },
];

const Landing = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: featuredReviews } = useQuery({
    queryKey: ["reviews", "public"],
    queryFn: () => backendApi.reviews.getPublic(12),
    staleTime: 60_000,
  });

  const displayPool: DisplayTestimonial[] = (featuredReviews ?? []).map(toDisplayTestimonial);

  const visibleTestimonials = useRotatingWindow(displayPool, 3);

  const { data: myReview } = useQuery({
    queryKey: ["reviews", "mine"],
    queryFn: () => backendApi.reviews.getMine(),
    enabled: !!user,
  });

  const [reviewRating, setReviewRating] = useState(0);
  const [reviewContent, setReviewContent] = useState("");
  const [hoverRating, setHoverRating] = useState(0);

  useEffect(() => {
    if (myReview) {
      setReviewRating(myReview.rating);
      setReviewContent(myReview.content);
    }
  }, [myReview]);

  const submitReviewMutation = useMutation({
    mutationFn: () => backendApi.reviews.submit(reviewRating, reviewContent.trim()),
    onSuccess: () => {
      toast({ title: "Thanks for your review!", description: "It'll appear on the site once approved." });
      queryClient.invalidateQueries({ queryKey: ["reviews", "mine"] });
    },
    onError: () => toast({ title: "Couldn't submit your review", variant: "destructive" }),
  });

  const handleSubmitReview = () => {
    if (reviewRating < 1) {
      toast({ title: "Pick a star rating first", variant: "destructive" });
      return;
    }
    if (!reviewContent.trim()) {
      toast({ title: "Write a few words about your experience", variant: "destructive" });
      return;
    }
    submitReviewMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-gradient-hero">
      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 -left-40 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-4 py-20 lg:py-32 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                <Zap className="h-4 w-4" />
                The future of professional networking
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6"
            >
              Where Professionals{" "}
              <span className="text-gradient">Connect, Collaborate</span> & Grow
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto"
            >
              Join mericet - the exclusive network for professionals, entrepreneurs, 
              innovators, and leaders. Share insights, discover opportunities, 
              and build meaningful business relationships.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Button variant="hero" size="xl" asChild>
                <Link to="/signup">
                  Get Started Free
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              <Button variant="outline" size="xl" asChild>
                <Link to="/login">Sign In</Link>
              </Button>
            </motion.div>

            {/* Social Proof */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="mt-12 flex items-center justify-center gap-4"
            >
              <div className="flex -space-x-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <img
                    key={i}
                    src={`https://i.pravatar.cc/100?img=${i + 10}`}
                    alt="User"
                    className="h-10 w-10 rounded-full border-2 border-background object-cover"
                  />
                ))}
              </div>
              <div className="text-left">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star
                      key={i}
                      className="h-4 w-4 fill-yellow-400 text-yellow-400"
                    />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  Loved by 50,000+ professionals
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 border-y border-border bg-card/50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="text-center"
              >
                <p className="text-3xl md:text-4xl font-bold text-gradient">
                  {stat.value}
                </p>
                <p className="text-muted-foreground mt-1">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 lg:py-32">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-3xl md:text-4xl font-bold mb-4"
            >
              Everything you need to{" "}
              <span className="text-gradient">succeed</span>
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-muted-foreground text-lg"
            >
              Powerful features designed to help you build meaningful
              professional relationships
            </motion.p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="p-6 rounded-2xl bg-card border border-border hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group"
              >
                <div className="h-12 w-12 rounded-xl bg-gradient-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <feature.icon className="h-6 w-6 text-primary-foreground" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 lg:py-32 bg-secondary/30">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-3xl md:text-4xl font-bold mb-4"
            >
              Trusted by industry{" "}
              <span className="text-gradient">leaders</span>
            </motion.h2>
          </div>

          {visibleTestimonials.length === 0 ? (
            <p className="text-center text-muted-foreground mb-4">
              Be the first to share your experience below.
            </p>
          ) : (
          <div className="grid md:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {visibleTestimonials.map((testimonial, index) => (
                <motion.div
                  key={testimonial.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: index * 0.1 }}
                  className="p-6 rounded-2xl bg-card border border-border"
                >
                  <div className="flex items-center gap-1 mb-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${i <= testimonial.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
                      />
                    ))}
                  </div>
                  <p className="text-foreground mb-6">"{testimonial.content}"</p>
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      name={testimonial.name}
                      src={testimonial.avatar}
                      size="md"
                    />
                    <div>
                      <p className="font-semibold">{testimonial.name}</p>
                      {testimonial.role && (
                        <p className="text-sm text-muted-foreground">
                          {testimonial.role}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          )}

          {/* Write a review */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-xl mx-auto mt-12 p-6 rounded-2xl bg-card border border-border"
          >
            {!user ? (
              <div className="text-center">
                <p className="font-semibold mb-1">Used Mericet? Leave a review.</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Log in to share your experience — it'll show here once approved.
                </p>
                <Button asChild variant="outline">
                  <Link to="/login">Log in to review</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 pb-1 border-b border-border/60">
                  <UserAvatar
                    name={`${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || user.email || "You"}
                    src={user.avatar_url}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {`${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || user.email}
                    </p>
                    <p className="text-xs text-muted-foreground">Posting as this account</p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <p className="font-semibold">
                    {myReview ? "Your review" : "Share your experience"}
                  </p>
                  {myReview && (
                    <Badge
                      variant={
                        myReview.status === "approved"
                          ? "default"
                          : myReview.status === "rejected"
                          ? "destructive"
                          : "secondary"
                      }
                      className="capitalize"
                    >
                      {myReview.status}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setReviewRating(i)}
                      onMouseEnter={() => setHoverRating(i)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="p-0.5"
                    >
                      <Star
                        className={`h-6 w-6 transition-colors ${
                          i <= (hoverRating || reviewRating)
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-muted-foreground/30"
                        }`}
                      />
                    </button>
                  ))}
                </div>

                <Textarea
                  placeholder="What was your experience like on Mericet?"
                  value={reviewContent}
                  onChange={(e) => setReviewContent(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  className="resize-none"
                />

                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    {myReview
                      ? "Editing will require re-approval before it shows again."
                      : "Reviews are checked before appearing publicly."}
                  </p>
                  <Button
                    onClick={handleSubmitReview}
                    disabled={submitReviewMutation.isPending}
                    size="sm"
                  >
                    {submitReviewMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : myReview ? (
                      "Update review"
                    ) : (
                      "Submit review"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 lg:py-32">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative rounded-3xl bg-gradient-primary p-10 md:p-16 text-center overflow-hidden"
          >
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yIDItNCAyLTRzMiAyIDIgNC0yIDQtMiA0LTItMi0yLTR6bTAtMTJjMC0yIDItNCAyLTRzMiAyIDIgNC0yIDQtMiA0LTItMi0yLTR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
                Ready to grow your network?
              </h2>
              <p className="text-primary-foreground/80 text-lg mb-8 max-w-xl mx-auto">
                Join thousands of professionals already building valuable
                connections on Mericet.
              </p>
              <Button
                size="xl"
                className="bg-background text-foreground hover:bg-background/90"
                asChild
              >
                <Link to="/signup">
                  Start Free Today
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="Mericet" className="h-8" />
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
              <Link to="/privacy-policy" className="hover:text-foreground transition-colors">
                Privacy
              </Link>
              <Link to="/terms-of-service" className="hover:text-foreground transition-colors">
                Terms
              </Link>
              <Link to="/contact" className="hover:text-foreground transition-colors">
                Contact
              </Link>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <a href="https://x.com/MericetCorp" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">X</a>
              <a href="https://www.instagram.com/mericet_hq/" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Instagram</a>
              <a href="https://www.linkedin.com/company/mericetapp/" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">LinkedIn</a>
              <a href="https://www.youtube.com/@mericetapp" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">YouTube</a>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2026 Mericet. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
