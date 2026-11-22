import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of service",
  description: "Terms governing use of the Brandmark discovery platform.",
};

export default function TermsPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-[-0.02em]">Terms of service</h1>
        <p className="mt-1 text-sm text-muted">Plain-language terms for using Brandmark.</p>
      </header>
      <div className="surface space-y-5 p-6 text-sm leading-7 text-ink">
        <section>
          <h2 className="text-base font-semibold">Using the platform</h2>
          <p className="text-muted">
            Brandmark helps you discover products and services from indexed catalog data. You agree to use the
            platform lawfully and not to attempt to scrape, overload, or interfere with its operation.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold">Listings and availability</h2>
          <p className="text-muted">
            Prices, ratings, and availability come from the source catalog and can change. Always confirm details
            with the seller before making a purchase or booking.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold">Your account</h2>
          <p className="text-muted">
            Keep your credentials private. You are responsible for activity performed with your account. Contact
            support if you believe your account has been compromised.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold">Changes</h2>
          <p className="text-muted">
            These terms may be updated as the platform evolves. Material changes will be announced in the app.
          </p>
        </section>
      </div>
    </div>
  );
}
