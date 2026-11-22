import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "How Brandmark handles the data you provide.",
};

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-[-0.02em]">Privacy policy</h1>
        <p className="mt-1 text-sm text-muted">What Brandmark stores and why.</p>
      </header>
      <div className="surface space-y-5 p-6 text-sm leading-7 text-ink">
        <section>
          <h2 className="text-base font-semibold">Data we store</h2>
          <p className="text-muted">
            We store your account details, saved items, bookings, reviews, and search history to provide the
            features you use. Passwords are hashed and session tokens are stored only as hashes.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold">Search and personalization</h2>
          <p className="text-muted">
            Search queries are recorded to show your history and improve recommendations. Personalized ranking
            uses only catalog interests and preferences you choose to save.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold">Telemetry</h2>
          <p className="text-muted">
            Server logs record request method, route, status, and latency for reliability monitoring. They do not
            include passwords, tokens, message bodies, or raw IP addresses. Vercel Analytics collects aggregate,
            privacy-friendly usage metrics.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold">Your controls</h2>
          <p className="text-muted">
            You can clear your search history and manage preferences from your account pages. Contact support for
            account deletion or data export requests.
          </p>
        </section>
      </div>
    </div>
  );
}
