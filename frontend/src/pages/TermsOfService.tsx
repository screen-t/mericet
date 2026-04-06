import { Link } from "react-router-dom";

const TermsOfService = () => {
  const lastUpdated = "March 16, 2026";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-foreground hover:opacity-80">
            <img src="/logo.png" alt="Mericet" className="h-8" />
            <span className="font-bold text-xl tracking-tight">Mericet</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link to="/privacy-policy" className="text-muted-foreground hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
            <Link to="/login" className="text-muted-foreground hover:text-foreground transition-colors">
              Login
            </Link>
            <Link to="/signup" className="text-muted-foreground hover:text-foreground transition-colors">
              Sign up
            </Link>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-10 md:py-14 max-w-4xl">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Terms of Service</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated: {lastUpdated}</p>

        <div className="mt-8 space-y-8 text-sm md:text-base leading-7 text-foreground/90">
          <section>
            <h2 className="text-xl font-semibold text-foreground">1. Acceptance of Terms</h2>
            <p className="mt-2">
              By accessing or using Mericet (the "Service"), you agree to these Terms of Service. If you do
              not agree, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">2. Eligibility and Accounts</h2>
            <p className="mt-2">
              You must be legally able to enter into a binding agreement in your jurisdiction. You are
              responsible for maintaining the confidentiality of your account credentials and for activity on
              your account.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">3. Acceptable Use</h2>
            <p className="mt-2">
              You agree not to misuse the Service, including by posting unlawful, deceptive, infringing,
              abusive, or harmful content; attempting unauthorized access; or interfering with platform
              security or availability.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">4. User Content</h2>
            <p className="mt-2">
              You retain ownership of content you submit. By posting content, you grant Mericet a non-exclusive,
              worldwide, royalty-free license to host, store, reproduce, and display that content solely to
              operate and improve the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">5. Intellectual Property</h2>
            <p className="mt-2">
              The Service, including software, branding, and design elements, is owned by or licensed to
              Mericet and protected by applicable intellectual property laws.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">6. Third-Party Services</h2>
            <p className="mt-2">
              The Service may integrate third-party services, such as authentication providers. Mericet is not
              responsible for third-party services and your use of them is subject to their terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">7. Account Suspension and Termination</h2>
            <p className="mt-2">
              Mericet may suspend or terminate accounts that violate these Terms or pose risk to users, the
              platform, or legal compliance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">8. Disclaimer of Warranties</h2>
            <p className="mt-2">
              The Service is provided "as is" and "as available" without warranties of any kind, to the maximum
              extent allowed by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">9. Limitation of Liability</h2>
            <p className="mt-2">
              To the fullest extent permitted by law, Mericet is not liable for indirect, incidental, special,
              consequential, or punitive damages arising from your use of the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">10. Changes to Terms</h2>
            <p className="mt-2">
              We may update these Terms from time to time. Updated terms become effective upon posting, unless
              stated otherwise.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">11. Contact</h2>
            <p className="mt-2">
              Questions about these Terms can be sent to <span className="font-medium">support@mericet.app</span>.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
};

export default TermsOfService;