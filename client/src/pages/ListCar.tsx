import { Layout } from "@/components/Layout";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCarSchema } from "@shared/schema";
import { z } from "zod";
import { useCreateCar } from "@/hooks/use-cars";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Upload, Car } from "lucide-react";
import { useEffect } from "react";

// Extend schema to accept string inputs for numbers (form handling)
const formSchema = insertCarSchema.extend({
  year: z.coerce.number().min(1900).max(new Date().getFullYear() + 1),
  pricePerDay: z.coerce.number().min(1),
  ownerId: z.string().optional(), // Will be injected
  badges: z.array(z.string()).optional(), // Optional array
  imageUrl: z.string().url("נא להזין כתובת תמונה תקינה"),
});

export default function ListCar() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { mutate: createCar, isPending } = useCreateCar();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      make: "",
      model: "",
      location: "",
      description: "",
      imageUrl: "https://images.unsplash.com/photo-1550355291-bbee04a92027?q=80&w=2036&auto=format&fit=crop", // Default placeholder
      isElectric: false,
      isKeyless: false,
      hasSevenSeats: false,
    },
  });

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      window.location.href = "/api/login";
    }
  }, [authLoading, user]);

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (!user) return;
    
    createCar({
      ...values,
      ownerId: user.id, // Explicitly set ownerId
    }, {
      onSuccess: () => {
        setLocation("/"); // Redirect to home on success
      }
    });
  };

  if (authLoading || !user) {
    return <Layout><div className="flex justify-center p-20"><Loader2 className="animate-spin" /></div></Layout>;
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-10 max-w-3xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-2">פרסם את הרכב שלך</h1>
          <p className="text-muted-foreground">הכנס את פרטי הרכב והתחל להרוויח כסף מהשכרות.</p>
        </div>

        <Card className="border-none shadow-card">
          <CardHeader className="bg-slate-50 rounded-t-xl border-b">
            <div className="flex items-center gap-3">
              <div className="bg-white p-2 rounded-lg shadow-sm">
                <Car className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle>פרטי הרכב</CardTitle>
                <CardDescription>מלא את כל הפרטים בצורה מדויקת כדי למשוך שוכרים.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 md:p-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="make"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>יצרן</FormLabel>
                        <FormControl>
                          <Input placeholder="לדוגמה: טויוטה, מאזדה..." {...field} className="bg-slate-50" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="model"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>דגם</FormLabel>
                        <FormControl>
                          <Input placeholder="לדוגמה: קורולה, 3..." {...field} className="bg-slate-50" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="year"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>שנת ייצור</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} className="bg-slate-50" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="pricePerDay"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>מחיר ליום (₪)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} className="bg-slate-50 font-bold text-primary" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>מיקום איסוף</FormLabel>
                      <FormControl>
                        <Input placeholder="עיר וכתובת..." {...field} className="bg-slate-50" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="imageUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>קישור לתמונה</FormLabel>
                      <FormControl>
                        <div className="flex gap-2">
                          <Input placeholder="https://..." {...field} className="bg-slate-50" />
                          <Button type="button" variant="outline" size="icon">
                            <Upload className="w-4 h-4" />
                          </Button>
                        </div>
                      </FormControl>
                      <FormDescription>
                        כרגע יש להזין כתובת URL לתמונה. בעתיד תתאפשר העלאת קבצים.
                      </FormDescription>
                      {field.value && (
                        <div className="mt-2 rounded-lg overflow-hidden h-40 w-full bg-slate-100 border">
                          <img src={field.value} alt="Preview" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                        </div>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>תיאור הרכב</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="ספר קצת על הרכב, מצבו, והנחיות מיוחדות לשוכר..." 
                          className="min-h-[120px] bg-slate-50 resize-none" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="isElectric"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-x-reverse space-y-0 rounded-md border p-4 shadow-sm hover:bg-slate-50 transition-colors">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none mr-2">
                          <FormLabel className="cursor-pointer">
                            רכב חשמלי
                          </FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="isKeyless"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-x-reverse space-y-0 rounded-md border p-4 shadow-sm hover:bg-slate-50 transition-colors">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none mr-2">
                          <FormLabel className="cursor-pointer">
                            כניסה ללא מפתח
                          </FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="hasSevenSeats"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-x-reverse space-y-0 rounded-md border p-4 shadow-sm hover:bg-slate-50 transition-colors">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none mr-2">
                          <FormLabel className="cursor-pointer">
                            7 מושבים
                          </FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>

                <Button type="submit" size="lg" className="w-full text-lg font-bold" disabled={isPending}>
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> שומר נתונים...
                    </>
                  ) : (
                    "פרסם רכב"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
