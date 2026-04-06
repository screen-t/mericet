import { Link } from "react-router-dom";

const PrivacyPolicy = () => {
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
            <Link to="/terms-of-service" className="text-muted-foreground hover:text-foreground transition-colors">
              Terms of Service
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
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated: {lastUpdated}</p>

        <div className="mt-8 space-y-8 text-sm md:text-base leading-7 text-foreground/90">
          <section>
            <h2 className="text-xl font-semibold text-foreground">1. Information We Collect</h2>
            <p className="mt-2">
              We may collect account details (such as name, email, username), profile information,
              communication data, and technical information (such as IP address, browser type, and device
              information) when you use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">2. How We Use Information</h2>
            <p className="mt-2">
              We use your information to provide and secure the Service, authenticate users, personalize
              experience, enable networking features, communicate service updates, and improve platform
              performance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">3. Legal Bases and Consent</h2>
            <p className="mt-2">
              Where required, we process personal data based on consent, contractual necessity, legitimate
              interests, or legal obligations. You may withdraw consent where applicable.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">4. Sharing of Information</h2>
            <p className="mt-2">
              We may share information with service providers who help operate the Service (for example,
              hosting, analytics, and authentication providers), and when required by law or to protect rights
              and safety.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">5. Data Retention</h2>
            <p className="mt-2">
              We keep personal information only as long as needed for the purposes described in this policy,
              legal compliance, dispute resolution, and enforcement of agreements.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">6. Data Security</h2>
            <p className="mt-2">
              We use reasonable technical and organizational safeguards to protect information, but no online
              system can be guaranteed 100% secure.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">7. Your Rights</h2>
            <p className="mt-2">
              Depending on your jurisdiction, you may have rights to access, correct, delete, or restrict
              processing of your personal information, and to data portability.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">8. International Transfers</h2>
            <p className="mt-2">
              Your information may be processed in countries other than your own. We take reasonable measures to
              protect transferred data in accordance with applicable law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">9. Changes to This Policy</h2>
            <p className="mt-2">
              We may update this Privacy Policy from time to time. Updated versions are effective when posted,
              unless otherwise stated.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">10. Contact</h2>
            <p className="mt-2">
              Privacy questions or requests can be sent to <span className="font-medium">privacy@mericet.app</span>.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
};

export default PrivacyPolicy;