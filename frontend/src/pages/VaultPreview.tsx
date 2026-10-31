import { useState, useEffect } from "react";
import { ResumeVault } from "@/components/profile/ResumeVault";
import { Profile } from "@/types/api";
import { Card } from "@/components/ui/card";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MapPin,
  Briefcase,
  Calendar,
  ShieldCheck,
  Share2,
  ExternalLink,
  Github,
  Linkedin,
  Twitter,
  UserCheck,
  Sparkles,
} from "lucide-react";

const DEMO_PROFILE: Profile = {
  id: "usr-demo-alex",
  username: "alexvance",
  first_name: "Alex",
  last_name: "Vance",
  headline: "Senior Staff Systems Architect • Distributed Consensus & Cryptographic Protocols",
  bio: "Architecting zero-knowledge verifiable credentials, distributed consensus engines, and real-time streaming architectures. Passionate about trustless verification, data privacy, and open-source infrastructure.",
  current_position: "Principal Systems Architect",
  current_company: "Mericet Labs",
  location: "San Francisco, CA (Remote)",
  account_type: "personal",
  avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=300",
  cover_url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=1200",
  github_url: "https://github.com/alexvance",
  linkedin_url: "https://linkedin.com/in/alexvance",
  twitter_url: "https://x.com/alexvance_dev",
  connections_count: 524,
  followers_count: 1420,
  connections_visible: true,
  work_experience: [
    {
      id: "exp-1",
      user_id: "usr-demo-alex",
      title: "Principal Systems Architect",
      company: "Mericet Labs",
      location: "San Francisco, CA",
      start_date: "2023-01-01",
      end_date: null,
      is_current: true,
      is_remote: true,
      description:
        "Leading core architecture for the Resume Vault zero-knowledge proof engine and Living Graph automated telemetry. Designed high-throughput distributed worker pipeline with lease locking.",
    },
    {
      id: "exp-2",
      user_id: "usr-demo-alex",
      title: "Senior Staff Distributed Engineer",
      company: "Protocol Engineering Group",
      location: "Palo Alto, CA",
      start_date: "2020-03-01",
      end_date: "2022-12-01",
      is_current: false,
      is_remote: true,
      description:
        "Engineered Byzantine fault-tolerant consensus mechanisms and peer-to-peer gossip layers. Reduced block propagation latency by 42% across globally distributed validator nodes.",
    },
    {
      id: "exp-3",
      user_id: "usr-demo-alex",
      title: "Software Engineer",
      company: "Cloudscale Infrastructure",
      location: "Mountain View, CA",
      start_date: "2018-06-01",
      end_date: "2020-02-01",
      is_current: false,
      is_remote: false,
      description:
        "Developed high-concurrency microservices in Go and Rust handling over 100k requests/second. Maintained distributed database persistence layer with strict ACID guarantees.",
    },
  ],
  education: [
    {
      id: "edu-1",
      user_id: "usr-demo-alex",
      institution: "Stanford University",
      degree: "B.S.",
      field_of_study: "Computer Science (Systems & Cryptography)",
      start_date: "2014-09-01",
      end_date: "2018-06-01",
      is_current: false,
      grade: "Honors • 3.92 GPA",
      description:
        "Specialized in Distributed Computing and Cryptography. President of Blockchain & Security Research Group. Published senior thesis on verifiable computation.",
    },
  ],
  skills: [
    { id: "sk-1", user_id: "usr-demo-alex", skill: "Rust", endorsement_count: 48 },
    { id: "sk-2", user_id: "usr-demo-alex", skill: "Zero-Knowledge Proofs (ZKP)", endorsement_count: 36 },
    { id: "sk-3", user_id: "usr-demo-alex", skill: "Distributed Systems", endorsement_count: 52 },
    { id: "sk-4", user_id: "usr-demo-alex", skill: "TypeScript / React", endorsement_count: 41 },
    { id: "sk-5", user_id: "usr-demo-alex", skill: "PostgreSQL & pgvector", endorsement_count: 29 },
    { id: "sk-6", user_id: "usr-demo-alex", skill: "WebAssembly", endorsement_count: 24 },
    { id: "sk-7", user_id: "usr-demo-alex", skill: "Kubernetes & Docker", endorsement_count: 33 },
    { id: "sk-8", user_id: "usr-demo-alex", skill: "Cryptography & Poseidon Hashing", endorsement_count: 27 },
  ],
};

export const VaultPreview = () => {
  const [activeTab, setActiveTab] = useState<string>("vault");

  useEffect(() => {
    try {
      const projKey = `mericet_vault_projects_${DEMO_PROFILE.id}`;
      if (!localStorage.getItem(projKey)) {
        localStorage.setItem(
          projKey,
          JSON.stringify([
            {
              id: "proj-1",
              title: "HyperScale Consensus Engine",
              description:
                "A Byzantine fault-tolerant consensus engine in Rust with sub-second finality and zero-knowledge validity rollups.",
              tech_stack: ["Rust", "WASM", "Tokio", "Zero-Knowledge Proofs"],
              repo_url: "https://github.com/alexvance/hyperscale-consensus",
              demo_url: "https://hyperscale.dev",
              verified: true,
              verification_tier: "weak",
              is_public: true,
            },
            {
              id: "proj-2",
              title: "Poseidon ZKP Credential Verifier",
              description:
                "Lightweight browser-native ZKP verification pipeline generating salted Poseidon commitments without cloud document exposure.",
              tech_stack: ["TypeScript", "Circom", "SnarkJS", "Web Workers"],
              repo_url: "https://github.com/alexvance/poseidon-zkp",
              verified: true,
              verification_tier: "strong",
              is_public: true,
            },
          ])
        );
      }

      const achKey = `mericet_vault_achievements_${DEMO_PROFILE.id}`;
      if (!localStorage.getItem(achKey)) {
        localStorage.setItem(
          achKey,
          JSON.stringify([
            {
              id: "ach-1",
              title: "AWS Certified Solutions Architect – Professional",
              issuer: "Amazon Web Services",
              date: "2024-03-15",
              description:
                "Advanced validation of overall cloud architecture design, security, and distributed computing across multi-region workloads.",
              credential_url: "https://credly.com/badges/aws-architect-demo",
              verified: true,
              verification_tier: "mid",
              is_public: true,
            },
            {
              id: "ach-2",
              title: "ETHGlobal ZK Hackathon Grand Prize",
              issuer: "ETHGlobal",
              date: "2023-11-20",
              description:
                "Awarded 1st place among 400+ engineering teams for building private reputation attestations using recursive SNARKs.",
              credential_url: "https://ethglobal.com/showcase/zk-reputation",
              verified: true,
              verification_tier: "weak",
              is_public: true,
            },
          ])
        );
      }
    } catch {
      // Ignore
    }
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/20">
      {/* Sleek Mericet Navigation Bar */}
      <header className="sticky top-0 z-50 w-full border-b border-border/70 bg-background/95 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-black text-sm shadow-xs">
              M
            </div>
            <span className="font-bold text-base tracking-tight text-foreground">Mericet</span>
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-muted-foreground px-2 py-0.5 rounded-full bg-muted/60 border border-border/50">
              <Sparkles className="w-3 h-3 text-primary" />
              Resume Profile Experience
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs font-medium border-primary/30 text-primary">
              Live Preview
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Profile Body */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Profile Hero Card */}
        <Card className="overflow-hidden border border-border/70 rounded-2xl shadow-xs">
          {/* Cover Banner */}
          <div className="relative h-44 sm:h-56 w-full bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900">
            {DEMO_PROFILE.cover_url && (
              <img
                src={DEMO_PROFILE.cover_url}
                alt="Profile cover"
                className="w-full h-full object-cover opacity-60"
              />
            )}
          </div>

          {/* Profile Header Info */}
          <div className="px-5 sm:px-8 pb-6 pt-0 relative">
            <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 -mt-16 sm:-mt-20 mb-4">
              <div className="relative">
                <UserAvatar
                  user={{
                    first_name: DEMO_PROFILE.first_name,
                    last_name: DEMO_PROFILE.last_name,
                    avatar_url: DEMO_PROFILE.avatar_url,
                  }}
                  className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl ring-4 ring-background shadow-lg"
                />
              </div>
              <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
                <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                  <Share2 className="w-3.5 h-3.5" />
                  Share Profile
                </Button>
                <Button size="sm" className="gap-1.5 text-xs bg-primary text-primary-foreground">
                  <UserCheck className="w-3.5 h-3.5" />
                  Connected
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  {DEMO_PROFILE.first_name} {DEMO_PROFILE.last_name}
                </h1>
                <Badge variant="outline" className="text-xs font-medium border-primary/30 text-primary">
                  @{DEMO_PROFILE.username}
                </Badge>
                <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-medium flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-500" />
                  Verified Identity
                </Badge>
              </div>

              <p className="text-sm sm:text-base font-medium text-foreground/90 max-w-2xl leading-snug">
                {DEMO_PROFILE.headline}
              </p>

              <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap pt-1">
                <span className="flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5 text-primary" />
                  {DEMO_PROFILE.current_position} at {DEMO_PROFILE.current_company}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {DEMO_PROFILE.location}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  Joined Mericet 2024
                </span>
              </div>

              {DEMO_PROFILE.bio && (
                <p className="text-xs sm:text-sm text-muted-foreground pt-2 leading-relaxed max-w-3xl">
                  {DEMO_PROFILE.bio}
                </p>
              )}

              {/* Social links */}
              <div className="flex items-center gap-2.5 pt-3">
                {DEMO_PROFILE.github_url && (
                  <a
                    href={DEMO_PROFILE.github_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg border border-border/70 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title="GitHub"
                  >
                    <Github className="w-4 h-4" />
                  </a>
                )}
                {DEMO_PROFILE.linkedin_url && (
                  <a
                    href={DEMO_PROFILE.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg border border-border/70 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title="LinkedIn"
                  >
                    <Linkedin className="w-4 h-4" />
                  </a>
                )}
                {DEMO_PROFILE.twitter_url && (
                  <a
                    href={DEMO_PROFILE.twitter_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg border border-border/70 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title="X / Twitter"
                  >
                    <Twitter className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* 3-Tab Architecture (About, Posts, Resume Vault) */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="border-b border-border/70 mb-6">
            <TabsList className="grid grid-cols-3 w-full max-w-md mx-auto h-12 bg-transparent p-0 gap-0">
              <TabsTrigger
                value="about"
                className="text-xs sm:text-sm font-semibold py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary transition-all cursor-pointer"
              >
                About
              </TabsTrigger>
              <TabsTrigger
                value="posts"
                className="text-xs sm:text-sm font-semibold py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary transition-all cursor-pointer"
              >
                Posts
              </TabsTrigger>
              <TabsTrigger
                value="vault"
                className="text-xs sm:text-sm font-semibold py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 text-primary" />
                Resume Vault
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="about" className="space-y-4">
            <Card className="p-6 rounded-2xl border border-border/70">
              <h3 className="text-base font-bold text-foreground mb-3">About Alex Vance</h3>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {DEMO_PROFILE.bio}
              </p>
            </Card>
          </TabsContent>

          <TabsContent value="posts">
            <Card className="p-8 text-center text-sm text-muted-foreground rounded-2xl border border-border/70">
              User's published posts, thoughts, and technical writeups appear here.
            </Card>
          </TabsContent>

          {/* TAB 3: RESUME VAULT (Continuous-scrolling professional journey) */}
          <TabsContent value="vault" className="mt-2">
            <ResumeVault
              userId={DEMO_PROFILE.id}
              isOwnProfile={true}
              profile={DEMO_PROFILE}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default VaultPreview;
