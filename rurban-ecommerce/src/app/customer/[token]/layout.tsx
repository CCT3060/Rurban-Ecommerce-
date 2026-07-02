import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your Account Details | Rurban",
};

export default function CustomerDetailsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
