import { useCar } from "@/hooks/use-cars";
import { Layout } from "@/components/Layout";
import { useRoute } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useCreateBooking } from "@/hooks/use-bookings";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { addDays, format, differenceInDays } from "date-fns";
import { he } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { 
  MapPin, 
  Star, 
  ShieldCheck, 
  User, 
  Zap, 
  Key, 
  Users, 
  Share2, 
  Heart,
  Calendar as CalendarIcon
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function CarDetails() {
  const [, params] = useRoute("/cars/:id");
  const id = parseInt(params?.id || "0");
  const { data: car, isLoading } = useCar(id);
  const { mutate: createBooking, isPending } = useCreateBooking();
  const { user } = useAuth();
  const { toast } = useToast();

  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(),
    to: addDays(new Date(), 3),
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8 space-y-8">
          <Skeleton className="w-full aspect-[21/9] rounded-3xl" />
          <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-4">
              <Skeleton className="h-10 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-64 w-full rounded-xl" />
            </div>
            <Skeleton className="h-96 w-full rounded-xl" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!car) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 text-center">
          <h1 className="text-2xl font-bold">הרכב לא נמצא</h1>
          <Button variant="link" asChild className="mt-4"><a href="/">חזרה לחיפוש</a></Button>
        </div>
      </Layout>
    );
  }

  const days = date?.from && date?.to ? differenceInDays(date.to, date.from) : 0;
  const totalPrice = days * car.pricePerDay;

  const handleBooking = () => {
    if (!user) {
      toast({
        title: "התחברות נדרשת",
        description: "עליך להתחבר כדי להזמין רכב",
        variant: "destructive",
      });
      // Redirect handled by link usually, but here we just toast
      return;
    }

    if (!date?.from || !date?.to) {
      toast({
        title: "תאריכים חסרים",
        description: "נא לבחור תאריכי התחלה וסיום",
        variant: "destructive",
      });
      return;
    }

    createBooking({
      carId: car.id,
      renterId: user.id, // Should come from session implicitly usually, but schema requires it
      startDate: format(date.from, "yyyy-MM-dd"),
      endDate: format(date.to, "yyyy-MM-dd"),
      totalPrice: totalPrice,
    });
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 md:py-10">
        {/* Header Images */}
        <div className="relative w-full aspect-[16/9] md:aspect-[21/9] rounded-3xl overflow-hidden shadow-2xl mb-8 group">
          <img 
            src={car.imageUrl} 
            alt={`${car.make} ${car.model}`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          />
          <div className="absolute top-4 right-4 flex gap-2">
            <Button size="icon" variant="secondary" className="rounded-full bg-white/80 backdrop-blur hover:bg-white shadow-sm">
              <Share2 className="w-5 h-5 text-slate-700" />
            </Button>
            <Button size="icon" variant="secondary" className="rounded-full bg-white/80 backdrop-blur hover:bg-white shadow-sm">
              <Heart className="w-5 h-5 text-slate-700" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
          {/* Left Column: Details */}
          <div className="lg:col-span-2 space-y-8">
            <div>
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
                    {car.make} {car.model} <span className="text-muted-foreground font-normal">{car.year}</span>
                  </h1>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span className="font-medium text-foreground">{car.rating}</span> ({car.tripCount} נסיעות)
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {car.location}
                    </span>
                  </div>
                </div>
                {car.owner && (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-slate-200 overflow-hidden">
                      {/* Placeholder for owner avatar */}
                      <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${car.ownerId}`} alt="Owner" />
                    </div>
                    <span className="text-xs text-muted-foreground">הבעלים</span>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Features */}
            <div>
              <h3 className="text-xl font-bold mb-4">מאפיינים בולטים</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {car.isElectric && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 text-green-700 border border-green-100">
                    <Zap className="w-5 h-5" />
                    <span className="font-medium">חשמלי</span>
                  </div>
                )}
                {car.isKeyless && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 text-blue-700 border border-blue-100">
                    <Key className="w-5 h-5" />
                    <span className="font-medium">כניסה ללא מפתח</span>
                  </div>
                )}
                {car.hasSevenSeats && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-purple-50 text-purple-700 border border-purple-100">
                    <Users className="w-5 h-5" />
                    <span className="font-medium">7 מושבים</span>
                  </div>
                )}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 text-slate-700 border border-slate-100">
                  <ShieldCheck className="w-5 h-5" />
                  <span className="font-medium">מבוטח מלא</span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Description */}
            <div>
              <h3 className="text-xl font-bold mb-4">תיאור הרכב</h3>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                {car.description || "אין תיאור זמין לרכב זה."}
              </p>
            </div>

            <Separator />

            {/* Map Placeholder */}
            <div>
              <h3 className="text-xl font-bold mb-4">מיקום</h3>
              <div className="w-full h-64 bg-slate-100 rounded-2xl overflow-hidden relative">
                {/* map placeholder aerial city view */}
                <img 
                  src="https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=1774&auto=format&fit=crop" 
                  alt="Map Location" 
                  className="w-full h-full object-cover opacity-80 grayscale hover:grayscale-0 transition-all duration-500"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-white/90 backdrop-blur px-6 py-3 rounded-full shadow-lg flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-primary" />
                    <span className="font-bold text-slate-900">{car.location}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Booking Card */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <Card className="p-6 shadow-card border-none ring-1 ring-slate-100">
                <div className="flex justify-between items-baseline mb-6">
                  <div>
                    <span className="text-3xl font-bold text-slate-900">₪{car.pricePerDay}</span>
                    <span className="text-muted-foreground"> / ליום</span>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-green-600 bg-green-50 px-2 py-1 rounded-full">
                    <ShieldCheck className="w-3 h-3" />
                    <span>ביטוח כלול</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="border rounded-xl p-3 bg-white">
                    <div className="flex items-center gap-2 mb-2 text-sm font-medium text-muted-foreground">
                      <CalendarIcon className="w-4 h-4" />
                      בחר תאריכים
                    </div>
                    <Calendar
                      mode="range"
                      selected={date}
                      onSelect={setDate}
                      numberOfMonths={1}
                      locale={he}
                      className="rounded-md border-0 w-full flex justify-center p-0"
                      classNames={{
                        day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                        day_today: "bg-accent text-accent-foreground",
                      }}
                      disabled={(date) => date < new Date()}
                    />
                  </div>

                  <div className="space-y-3 pt-4 border-t border-dashed">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">₪{car.pricePerDay} x {days} ימים</span>
                      <span>₪{totalPrice}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">דמי שירות</span>
                      <span>₪{(totalPrice * 0.1).toFixed(0)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-bold text-lg">
                      <span>סה"כ לתשלום</span>
                      <span className="text-primary">₪{(totalPrice * 1.1).toFixed(0)}</span>
                    </div>
                  </div>

                  {user ? (
                    <Button 
                      className="w-full text-lg h-12 font-bold shadow-lg shadow-primary/20" 
                      onClick={handleBooking}
                      disabled={isPending || days === 0}
                    >
                      {isPending ? "שולח בקשה..." : "הזמן עכשיו"}
                    </Button>
                  ) : (
                    <Button className="w-full text-lg h-12" variant="outline" asChild>
                      <a href="/api/login">התחבר להזמנה</a>
                    </Button>
                  )}
                  
                  <p className="text-xs text-center text-muted-foreground mt-4">
                    לא תחוייב עד לאישור ההזמנה ע"י בעל הרכב
                  </p>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
