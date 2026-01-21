import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

// Fetch all cars with optional filters
export function useCars(filters?: z.infer<typeof api.cars.list.input>) {
  // Construct query string for cache key stability
  const queryKey = [api.cars.list.path, JSON.stringify(filters)];

  return useQuery({
    queryKey,
    queryFn: async () => {
      // Build URL with query params
      const url = new URL(api.cars.list.path, window.location.origin);
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value) url.searchParams.append(key, value);
        });
      }
      
      const res = await fetch(url.toString(), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch cars");
      return api.cars.list.responses[200].parse(await res.json());
    },
  });
}

// Fetch single car details
export function useCar(id: number) {
  return useQuery({
    queryKey: [api.cars.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.cars.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch car details");
      return api.cars.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

// Create a new car listing
export function useCreateCar() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: z.infer<typeof api.cars.create.input>) => {
      const res = await fetch(api.cars.create.path, {
        method: api.cars.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 401) throw new Error("Unauthorized");
        const error = await res.json();
        throw new Error(error.message || "Failed to create car listing");
      }
      return api.cars.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.cars.list.path] });
      toast({
        title: "רכב נוסף בהצלחה!",
        description: "הרכב שלך זמין כעת להשכרה בפלטפורמה.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "שגיאה ביצירת הרכב",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
