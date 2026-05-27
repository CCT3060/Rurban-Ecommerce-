"use client";

import { useEffect, useState } from "react";
import { Check, X, Star, Trash2, MoreHorizontal } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

type ReviewRow = {
  id: string;
  rating: number;
  comment: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  product: { name: string } | null;
  user: { full_name: string | null; email: string | null } | null;
};

const statusColors: Record<string, string> = { approved: "bg-green-100 text-green-700", pending: "bg-yellow-100 text-yellow-700", rejected: "bg-red-100 text-red-700" };

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/reviews", { cache: "no-store" });
      const json = (await response.json()) as { data?: ReviewRow[]; error?: string };
      if (!response.ok) throw new Error(json.error || "Failed to load reviews");
      setReviews(json.data ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load reviews");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchReviews();
  }, []);

  const updateStatus = async (id: string, status: "pending" | "approved" | "rejected") => {
    try {
      const response = await fetch(`/api/admin/reviews/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error || "Failed to update review");
      toast.success("Review updated");
      await fetchReviews();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update review");
    }
  };

  const deleteReview = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/reviews/${id}`, { method: "DELETE" });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error || "Failed to delete review");
      toast.success("Review deleted");
      await fetchReviews();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete review");
    }
  };

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Reviews</h1><p className="text-sm text-muted-foreground">Manage product reviews</p></div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Product</TableHead><TableHead>Rating</TableHead><TableHead>Comment</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead><TableHead className="w-12"></TableHead></TableRow></TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">Loading reviews...</TableCell>
                </TableRow>
              )}
              {!loading && reviews.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">No reviews found.</TableCell>
                </TableRow>
              )}
              {!loading && reviews.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.user?.full_name || r.user?.email || "Customer"}</TableCell>
                  <TableCell className="text-sm">{r.product?.name || "-"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-0.5">
                      {[...Array(5)].map((_, i) => <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? "text-cta fill-cta" : "text-muted-foreground/20"}`} />)}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{r.comment || "-"}</TableCell>
                  <TableCell><Badge className={`border-0 ${statusColors[r.status]}`}>{r.status}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(r.created_at).toLocaleDateString("en-GB")}</TableCell>
                  <TableCell>
                    <DropdownMenu><DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"><MoreHorizontal className="h-4 w-4" /></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => void updateStatus(r.id, "approved")}><Check className="h-4 w-4 mr-2" /> Approve</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => void updateStatus(r.id, "rejected")}><X className="h-4 w-4 mr-2" /> Reject</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => void deleteReview(r.id)}><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
                    </DropdownMenuContent></DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
