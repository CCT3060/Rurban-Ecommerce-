import Link from "next/link";
import { Home, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center max-w-md">
        <h1 className="text-8xl font-bold text-primary/20">404</h1>
        <h2 className="text-2xl font-bold mt-4">Page Not Found</h2>
        <p className="text-muted-foreground mt-2">
          Sorry, the page you are looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
          <Link href="/">
            <Button className="gap-2 rounded-full px-6">
              <Home className="h-4 w-4" /> Go Home
            </Button>
          </Link>
          <Link href="/">
            <Button variant="outline" className="gap-2 rounded-full px-6">
              <Search className="h-4 w-4" /> Browse Categories
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
