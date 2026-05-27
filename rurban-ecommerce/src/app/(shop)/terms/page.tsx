export const metadata = { title: "Terms & Conditions" };

export default function TermsPage() {
  return (
    <div className="bg-background min-h-screen">
      <div className="bg-muted/30 border-b py-10 md:py-16">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-4xl font-bold">Terms & Conditions</h1>
          <p className="text-muted-foreground mt-2">Last updated: April 2026</p>
        </div>
      </div>
      <div className="container mx-auto px-4 py-10 md:py-16 max-w-3xl">
        <div className="prose prose-sm max-w-none text-muted-foreground space-y-6">
          <section><h2 className="text-xl font-bold text-foreground">1. Acceptance of Terms</h2><p>By accessing or using Rurban Ecommerce, you agree to be bound by these terms and conditions. If you do not agree, please do not use our services.</p></section>
          <section><h2 className="text-xl font-bold text-foreground">2. Account Registration</h2><p>You must provide accurate and complete information when creating an account. You are responsible for maintaining the confidentiality of your account credentials.</p></section>
          <section><h2 className="text-xl font-bold text-foreground">3. Products & Pricing</h2><p>All prices are listed in Indian Rupees (INR) and include applicable taxes unless stated otherwise. We reserve the right to modify prices without prior notice. Product availability is subject to stock.</p></section>
          <section><h2 className="text-xl font-bold text-foreground">4. Orders & Payment</h2><p>Placing an order constitutes an offer to purchase. We reserve the right to accept or reject orders. Payment must be made through the available methods at checkout.</p></section>
          <section><h2 className="text-xl font-bold text-foreground">5. Shipping & Delivery</h2><p>We aim to deliver orders within 5-7 business days. Delivery timelines may vary based on location and product availability. Shipping charges apply for orders below ₹999.</p></section>
          <section><h2 className="text-xl font-bold text-foreground">6. Returns & Refunds</h2><p>We offer a 7-day return policy for most products. Items must be returned in original condition with packaging intact. Refunds are processed within 5-7 business days after receiving the returned item.</p></section>
          <section><h2 className="text-xl font-bold text-foreground">7. Intellectual Property</h2><p>All content on this website including logos, designs, text, and images are the property of Rurban Ecommerce and are protected by copyright laws.</p></section>
          <section><h2 className="text-xl font-bold text-foreground">8. Contact</h2><p>For any questions regarding these terms, contact us at support@rurban.com.</p></section>
        </div>
      </div>
    </div>
  );
}
