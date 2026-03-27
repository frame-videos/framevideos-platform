/**
 * Privacy Policy Page
 * GDPR Compliance - Placeholder
 */

export default function PrivacyPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
      
      <div className="prose prose-gray dark:prose-invert max-w-none">
        <p className="text-sm text-gray-600 mb-4">
          Last updated: {new Date().toISOString().split('T')[0]}
        </p>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">1. Data We Collect</h2>
          <p>
            Frame Videos collects and processes the following personal data:
          </p>
          <ul className="list-disc pl-6 mt-2">
            <li>Email address (for account creation and authentication)</li>
            <li>Name (optional, for personalization)</li>
            <li>Video content and metadata (titles, descriptions, thumbnails)</li>
            <li>Usage analytics (views, interactions, preferences)</li>
            <li>Technical data (IP address, browser type, device information)</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">2. How We Use Your Data</h2>
          <p>We use your personal data to:</p>
          <ul className="list-disc pl-6 mt-2">
            <li>Provide and maintain our video hosting service</li>
            <li>Authenticate and secure your account</li>
            <li>Improve our platform and user experience</li>
            <li>Send important service notifications</li>
            <li>Comply with legal obligations</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">3. Your Rights (GDPR)</h2>
          <p>Under GDPR, you have the right to:</p>
          <ul className="list-disc pl-6 mt-2">
            <li><strong>Access:</strong> Request a copy of all your personal data</li>
            <li><strong>Rectification:</strong> Correct inaccurate or incomplete data</li>
            <li><strong>Erasure:</strong> Request deletion of your account and data</li>
            <li><strong>Portability:</strong> Receive your data in a structured format</li>
            <li><strong>Objection:</strong> Object to processing of your data</li>
          </ul>
          <p className="mt-4">
            To exercise these rights, visit your{' '}
            <a href="/dashboard" className="text-blue-600 hover:underline">
              account settings
            </a>{' '}
            or contact us at privacy@framevideos.com
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">4. Data Retention</h2>
          <p>
            We retain your personal data only for as long as necessary to provide our services
            and comply with legal obligations. When you delete your account, your personal data
            is anonymized within 30 days.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">5. Data Security</h2>
          <p>
            We implement industry-standard security measures including:
          </p>
          <ul className="list-disc pl-6 mt-2">
            <li>Encryption in transit (HTTPS/TLS)</li>
            <li>Secure password hashing (bcrypt)</li>
            <li>Multi-tenant data isolation</li>
            <li>Regular security audits</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">6. Third-Party Services</h2>
          <p>
            Frame Videos uses Cloudflare for hosting and content delivery. Cloudflare may
            process your data in accordance with their{' '}
            <a 
              href="https://www.cloudflare.com/privacypolicy/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              privacy policy
            </a>.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">7. Contact Us</h2>
          <p>
            For privacy-related questions or to exercise your GDPR rights, contact us at:
          </p>
          <p className="mt-2">
            <strong>Email:</strong> privacy@framevideos.com<br />
            <strong>Data Protection Officer:</strong> dpo@framevideos.com
          </p>
        </section>
      </div>
    </div>
  );
}
