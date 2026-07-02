import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Complete Your B2B Account | Rurban",
};

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
