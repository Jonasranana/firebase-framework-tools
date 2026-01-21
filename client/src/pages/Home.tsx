import { useCars } from "@/hooks/use-cars";
import { Layout } from "@/components/Layout";
import { CarCard } from "@/components/CarCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Search, MapPin, Calendar as CalendarIcon, Filter, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";

export default function Home() {
  const [location, setLocation] = useState("");
  const [isElectric, setIsElectric] = useState<string | undefined>(undefined);
  const [hasSevenSeats, setHasSevenSeats] = useState<string | undefined>(undefined);
  const { user } = useAuth();
  
  // Create filters object only with defined values
  const filters: any = {};
  if (location) filters.location = location;
  if (isElectric) filters.isElectric = isElectric;
  if (hasSevenSeats) filters.hasSevenSeats = hasSevenSeats;

  const { data: cars, isLoading, error } = useCars(filters);

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative h-[500px] w-full bg-slate-900 flex items-center justify-center overflow-hidden">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0 z-0">
          {/* scenic road trip car landscape */}
          <img 
            src="https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=2021&auto=format&fit=crop" 
            alt="Driving on a scenic road" 
            className="w-full h-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent"></div>
        </div>

        <div className="container relative z-10 px-4 text-center">
          <h1 className="text-4xl md:text-6xl font-black text-white mb-6 drop-shadow-lg tracking-tight">
            מצא את הרכב המושלם <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-200">
              לנסיעה הבאה שלך
            </span>
          </h1>
          <p className="text-lg md:text-xl text-slate-200 mb-8 max-w-2xl mx-auto drop-shadow-md">
            השכרת רכב מאנשים פרטיים במחירים משתלמים. ביטוח מלא כלול בכל נסיעה.
          </p>

          {/* Search Box */}
          <div className="bg-white/95 backdrop-blur-sm p-4 rounded-2xl shadow-xl max-w-4xl mx-auto flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-1 w-full relative">
              <MapPin className="absolute right-3 top-3 h-5 w-5 text-muted-foreground" />
              <Input 
                placeholder="איפה תרצה לאסוף את הרכב?" 
                className="pr-10 h-12 text-lg border-transparent bg-slate-50 focus:bg-white transition-colors"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            
            <div className="w-full md:w-px h-px md:h-8 bg-slate-200 mx-2" />

            <div className="flex-1 w-full relative">
              <CalendarIcon className="absolute right-3 top-3 h-5 w-5 text-muted-foreground" />
              <Input 
                placeholder="תאריכי נסיעה" 
                className="pr-10 h-12 text-lg border-transparent bg-slate-50 focus:bg-white transition-colors"
                type="text"
                onFocus={(e) => e.target.type = 'date'}
                onBlur={(e) => e.target.type = 'text'}
              />
            </div>

            <Button size="lg" className="w-full md:w-auto px-8 h-12 text-lg font-bold bg-primary hover:bg-orange-600 shadow-lg shadow-orange-500/30 transition-all">
              <Search className="ml-2 h-5 w-5" />
              חפש
            </Button>
          </div>
        </div>
      </section>

      {/* Filter Chips Section */}
      <section className="border-b bg-white sticky top-16 z-40 shadow-sm overflow-x-auto no-scrollbar">
        <div className="container mx-auto px-4 py-4 flex gap-3 min-w-max">
          <Button 
            variant={isElectric === "true" ? "default" : "outline"} 
            size="sm" 
            className="rounded-full gap-2"
            onClick={() => setIsElectric(prev => prev === "true" ? undefined : "true")}
          >
            <span className="text-lg">⚡</span> רכב חשמלי
          </Button>
          <Button 
            variant={hasSevenSeats === "true" ? "default" : "outline"} 
            size="sm" 
            className="rounded-full gap-2"
            onClick={() => setHasSevenSeats(prev => prev === "true" ? undefined : "true")}
          >
            <Users className="w-4 h-4" /> 7 מושבים
          </Button>
          <Button variant="outline" size="sm" className="rounded-full gap-2 border-dashed">
            <Filter className="w-4 h-4" /> עוד מסננים
          </Button>
          
          {(isElectric || hasSevenSeats) && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-muted-foreground hover:text-destructive"
              onClick={() => {
                setIsElectric(undefined);
                setHasSevenSeats(undefined);
              }}
            >
              <X className="w-4 h-4 ml-1" />
              נקה הכל
            </Button>
          )}
        </div>
      </section>

      {/* Results Section */}
      <section className="container mx-auto px-4 py-12">
        <div className="flex items-baseline justify-between mb-8">
          <h2 className="text-2xl font-bold text-slate-900">
            {location ? `רכבים זמינים ב${location}` : 'רכבים מומלצים בסביבה'}
          </h2>
          <span className="text-muted-foreground text-sm">
            {cars?.length || 0} תוצאות
          </span>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-[320px] rounded-2xl border bg-card p-4 space-y-4">
                <Skeleton className="h-40 w-full rounded-xl" />
                <div className="space-y-2">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
                <div className="pt-4 mt-auto">
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-20 bg-red-50 rounded-3xl">
            <h3 className="text-xl font-semibold text-red-600 mb-2">שגיאה בטעינת הנתונים</h3>
            <p className="text-muted-foreground">אנא נסה לרענן את העמוד מאוחר יותר.</p>
          </div>
        ) : cars?.length === 0 ? (
          <div className="text-center py-20 bg-slate-50 rounded-3xl border border-dashed">
            <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-xl font-semibold text-slate-700 mb-2">לא נמצאו רכבים</h3>
            <p className="text-muted-foreground mb-6">נסה לשנות את מסנני החיפוש או לבדוק מיקום אחר.</p>
            <Button onClick={() => { setLocation(""); setIsElectric(undefined); setHasSevenSeats(undefined); }}>
              נקה את כל הסינונים
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {cars?.map((car) => (
              <CarCard key={car.id} car={car} />
            ))}
          </div>
        )}
      </section>

      {/* CTA Section */}
      <section className="bg-primary/5 py-16 md:py-24 border-y border-primary/10">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-12">
          <div className="flex-1 space-y-6">
            <Badge variant="outline" className="border-primary text-primary px-4 py-1 text-sm bg-primary/5">
              הצטרף למהפכה
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 leading-tight">
              הפוך את הרכב שלך <br/>
              <span className="text-primary">למקור הכנסה</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-md">
              יש לך רכב שעומד בחניה? הצטרף לאלפי בעלי רכבים שמרוויחים כסף מהשכרת הרכב שלהם בביטחון מלא.
            </p>
            <Button size="lg" className="bg-slate-900 text-white hover:bg-slate-800 shadow-xl" asChild>
              <a href={user ? "/list-car" : "/api/login"}>פרסם את הרכב שלך</a>
            </Button>
          </div>
          <div className="flex-1 relative w-full max-w-md aspect-square">
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-blue-500/20 rounded-full blur-3xl animate-pulse"></div>
            {/* person holding car keys smiling */}
            <img 
              src="https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?q=80&w=2070&auto=format&fit=crop" 
              alt="Happy car owner" 
              className="relative z-10 w-full h-full object-cover rounded-3xl shadow-2xl rotate-3 hover:rotate-0 transition-transform duration-500"
            />
          </div>
        </div>
      </section>
    </Layout>
  );
}
