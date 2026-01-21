import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

// Fetch user's bookings (as renter or owner)
export function useBookings() {
  return useQuery({
    queryKey: [api.bookings.list.path],
    queryFn: async () => {
      const res = await fetch(api.bookings.list.path, { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to fetch bookings");
      return api.bookings.list.responses[200].parse(await res.json());
    },
  });
}

// Create a new booking request
export function useCreateBooking() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: z.infer<typeof api.bookings.create.input>) => {
      const res = await fetch(api.bookings.create.path, {
        method: api.bookings.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 401) throw new Error("יש להתחבר כדי להזמין רכב");
        const error = await res.json();
        throw new Error(error.message || "Failed to create booking");
      }
      return api.bookings.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.bookings.list.path] });
      toast({
        title: "בקשת ההזמנה נשלחה!",
        description: "בעל הרכב יקבל התראה ויאשר את ההזמנה בהקדם.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "שגיאה בהזמנה",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// Update booking status (Approve/Reject/Cancel)
export function useUpdateBookingStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, status }: { id: number; status: "approved" | "rejected" | "cancelled" | "completed" }) => {
      const url = buildUrl(api.bookings.updateStatus.path, { id });
      const res = await fetch(url, {
        method: api.bookings.updateStatus.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to update booking status");
      return api.bookings.updateStatus.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.bookings.list.path] });
      toast({
        title: "סטטוס הזמנה עודכן",
        description: "השינויים נשמרו בהצלחה.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "שגיאה בעדכון",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
