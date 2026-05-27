import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="flex-1 flex items-center justify-center bg-muted/30 py-10 md:py-16">
        {children}
      </main>
      <Footer />
    </>
  );
}
