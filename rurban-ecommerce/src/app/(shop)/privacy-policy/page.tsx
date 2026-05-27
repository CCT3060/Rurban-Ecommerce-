export const metadata = { title: "Privacy Policy" };

export default function PrivacyPolicyPage() {
  return (
    <div className="bg-background min-h-screen">
      <div className="bg-muted/30 border-b py-10 md:py-16">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-4xl font-bold">Privacy Policy</h1>
          <p className="text-muted-foreground mt-2">Last updated: April 2026</p>
        </div>
      </div>
      <div className="container mx-auto px-4 py-10 md:py-16 max-w-3xl">
        <div className="prose prose-sm max-w-none text-muted-foreground space-y-6">
          <section><h2 className="text-xl font-bold text-foreground">1. Information We Collect</h2><p>We collect information you provide when creating an account, placing orders, or contacting us. This includes your name, email, phone number, shipping address, and payment information.</p></section>
          <section><h2 className="text-xl font-bold text-foreground">2. How We Use Your Information</h2><p>We use your information to process orders, improve our services, send relevant communications, provide customer support, and personalize your shopping experience.</p></section>
          <section><h2 className="text-xl font-bold text-foreground">3. Data Protection</h2><p>We implement industry-standard security measures to protect your personal information from unauthorized access, alteration, or disclosure. All sensitive data is encrypted using SSL technology.</p></section>
          <section><h2 className="text-xl font-bold text-foreground">4. Cookies</h2><p>We use cookies to enhance your browsing experience, analyze site traffic, and personalize content. You can control cookie settings through your browser preferences.</p></section>
          <section><h2 className="text-xl font-bold text-foreground">5. Third-Party Services</h2><p>We may use third-party services for payment processing, analytics, and delivery. These services have their own privacy policies governing the use of your information.</p></section>
          <section><h2 className="text-xl font-bold text-foreground">6. Your Rights</h2><p>You have the right to access, update, or delete your personal information at any time through your account settings or by contacting our support team.</p></section>
          <section><h2 className="text-xl font-bold text-foreground">7. Contact Us</h2><p>If you have questions about this privacy policy, please contact us at support@rurban.com or call +91 123 456 7890.</p></section>
        </div>
      </div>
    </div>
  );
}
