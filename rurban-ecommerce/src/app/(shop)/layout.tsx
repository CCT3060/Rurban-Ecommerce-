import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import { getInitialUser } from "@/lib/auth/get-initial-user";

export default async function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialUser = await getInitialUser();
  return (
    <>
      <Navbar initialUser={initialUser} />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
