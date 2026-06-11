import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import { getInitialUser } from "@/lib/auth/get-initial-user";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const initialUser = await getInitialUser();
  return (
    <>
      <Navbar initialUser={initialUser} />
      <main className="flex-1 flex items-center justify-center bg-muted/30 py-10 md:py-16">
        {children}
      </main>
      <Footer />
    </>
  );
}
