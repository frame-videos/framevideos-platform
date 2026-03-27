/**
 * Terms of Service Page
 * GDPR Compliance - Placeholder
 */

export default function TermsPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Terms of Service</h1>
      
      <div className="prose prose-gray dark:prose-invert max-w-none">
        <p className="text-sm text-gray-600 mb-4">
          Last updated: {new Date().toISOString().split('T')[0]}
        </p>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
          <p>
            By accessing and using Frame Videos, you accept and agree to be bound by these
            Terms of Service. If you do not agree to these terms, please do not use our service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">2. Service Description</h2>
          <p>
            Frame Videos is a multi-tenant video hosting platform that allows users to upload,
            manage, and share video content. We provide:
          </p>
          <ul className="list-disc pl-6 mt-2">
            <li>Video upload and transcoding</li>
            <li>Video player and streaming</li>
            <li>Content management and analytics</li>
            <li>Custom domain support for tenants</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">3. User Accounts</h2>
          <p>To use Frame Videos, you must:</p>
          <ul className="list-disc pl-6 mt-2">
            <li>Be at least 18 years old</li>
            <li>Provide accurate and complete registration information</li>
            <li>Maintain the security of your account credentials</li>
            <li>Accept our Privacy Policy</li>
          </ul>
          <p className="mt-4">
            You are responsible for all activities that occur under your account.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">4. Content Policy</h2>
          <p>When uploading content to Frame Videos, you agree:</p>
          <ul className="list-disc pl-6 mt-2">
            <li>You own or have rights to the content you upload</li>
            <li>Your content does not violate any laws or third-party rights</li>
            <li>Your content does not contain malware or harmful code</li>
            <li>You will not upload illegal, harmful, or offensive content</li>
          </ul>
          <p className="mt-4">
            We reserve the right to remove content that violates these terms.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">5. Prohibited Activities</h2>
          <p>You may not:</p>
          <ul className="list-disc pl-6 mt-2">
            <li>Use the service for illegal purposes</li>
            <li>Attempt to gain unauthorized access to our systems</li>
            <li>Interfere with or disrupt the service</li>
            <li>Scrape or harvest data from the platform</li>
            <li>Impersonate others or provide false information</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">6. Intellectual Property</h2>
          <p>
            Frame Videos and its original content, features, and functionality are owned by
            Frame Videos and are protected by international copyright, trademark, and other
            intellectual property laws.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">7. Termination</h2>
          <p>
            We may terminate or suspend your account immediately, without prior notice or
            liability, for any reason, including breach of these Terms. Upon termination,
            your right to use the service will immediately cease.
          </p>
          <p className="mt-4">
            You may delete your account at any time from your account settings. Your data
            will be anonymized in accordance with our Privacy Policy.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">8. Limitation of Liability</h2>
          <p>
            Frame Videos is provided "as is" without warranties of any kind. We shall not be
            liable for any indirect, incidental, special, consequential, or punitive damages
            resulting from your use of the service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">9. Changes to Terms</h2>
          <p>
            We reserve the right to modify these terms at any time. We will notify users of
            any material changes via email or through the platform. Continued use of the
            service after changes constitutes acceptance of the new terms.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">10. Governing Law</h2>
          <p>
            These Terms shall be governed by and construed in accordance with the laws of
            [Your Jurisdiction], without regard to its conflict of law provisions.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">11. Contact</h2>
          <p>
            For questions about these Terms, please contact us at:
          </p>
          <p className="mt-2">
            <strong>Email:</strong> legal@framevideos.com<br />
            <strong>Support:</strong> support@framevideos.com
          </p>
        </section>
      </div>
    </div>
  );
}
