import { Car } from "@shared/schema";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Star, Zap, Users, Key } from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

interface CarCardProps {
  car: Car;
}

export function CarCard({ car }: CarCardProps) {
  return (
    <Link href={`/cars/${car.id}`} className="block h-full">
      <Card className="h-full overflow-hidden hover:shadow-xl transition-all duration-300 group border-transparent hover:border-primary/20 bg-card">
        {/* Image Container */}
        <div className="relative aspect-[4/3] overflow-hidden">
          {/* Dynamic Image from Unsplash with descriptive alt */}
          <img 
            src={car.imageUrl} 
            alt={`${car.make} ${car.model}`}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute top-3 right-3 flex gap-2">
            {car.isElectric && (
              <Badge variant="secondary" className="bg-white/90 backdrop-blur text-green-700 shadow-sm gap-1">
                <Zap className="w-3 h-3 fill-current" />
                חשמלי
              </Badge>
            )}
          </div>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4 pt-12">
            <div className="flex justify-between items-end text-white">
              <div className="flex items-center gap-1 bg-black/40 backdrop-blur px-2 py-1 rounded-full text-xs font-medium">
                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                <span>{car.rating?.toFixed(1) || "5.0"}</span>
                <span className="opacity-70">({car.tripCount} נסיעות)</span>
              </div>
            </div>
          </div>
        </div>

        <CardContent className="p-4">
          <div className="mb-2">
            <h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors">
              {car.make} {car.model}
            </h3>
            <p className="text-muted-foreground text-sm">{car.year} • {car.location}</p>
          </div>

          <div className="flex gap-3 mt-3 text-xs text-muted-foreground">
            {car.hasSevenSeats && (
              <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-md">
                <Users className="w-3 h-3" />
                <span>7 מושבים</span>
              </div>
            )}
            {car.isKeyless && (
              <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-md">
                <Key className="w-3 h-3" />
                <span>כניסה ללא מפתח</span>
              </div>
            )}
          </div>
        </CardContent>

        <CardFooter className="p-4 pt-0 mt-auto flex justify-between items-center border-t border-dashed pt-4">
          <div>
            <span className="text-lg font-bold text-primary">₪{car.pricePerDay}</span>
            <span className="text-xs text-muted-foreground mr-1">/ ליום</span>
          </div>
          <Badge variant="outline" className="group-hover:bg-primary group-hover:text-white transition-colors">
            הזמן עכשיו
          </Badge>
        </CardFooter>
      </Card>
    </Link>
  );
}
