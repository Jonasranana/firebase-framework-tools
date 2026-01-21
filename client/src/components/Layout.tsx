import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { 
  Menu, 
  X, 
  User, 
  LogOut, 
  Car, 
  Calendar, 
  Search 
} from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Helper to get initials
  const initials = user 
    ? `${user.firstName?.charAt(0) || ""}${user.lastName?.charAt(0) || ""}`
    : "G";

  return (
    <div className="min-h-screen flex flex-col font-sans bg-background" dir="rtl">
      {/* Navbar */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group cursor-pointer">
            <div className="relative w-8 h-8 bg-primary rounded-lg flex items-center justify-center transform transition-transform group-hover:rotate-12">
              <Car className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-orange-600">
              קח-אותו
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/" className={`text-sm font-medium transition-colors hover:text-primary ${location === '/' ? 'text-primary' : 'text-muted-foreground'}`}>
              חיפוש רכבים
            </Link>
            <Link href="/list-car" className={`text-sm font-medium transition-colors hover:text-primary ${location === '/list-car' ? 'text-primary' : 'text-muted-foreground'}`}>
              פרסם רכב
            </Link>
          </nav>

          {/* User Menu / Auth Buttons */}
          <div className="flex items-center gap-4">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full ring-2 ring-primary/10 hover:ring-primary/20 transition-all">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={user.profileImageUrl || undefined} alt={user.firstName || "User"} />
                      <AvatarFallback className="bg-orange-100 text-orange-700 font-medium">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user.firstName} {user.lastName}</p>
                      <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <Link href="/profile">
                    <DropdownMenuItem className="cursor-pointer">
                      <User className="ml-2 h-4 w-4" />
                      <span>הפרופיל שלי</span>
                    </DropdownMenuItem>
                  </Link>
                  <Link href="/my-bookings">
                    <DropdownMenuItem className="cursor-pointer">
                      <Calendar className="ml-2 h-4 w-4" />
                      <span>ההזמנות שלי</span>
                    </DropdownMenuItem>
                  </Link>
                  <Link href="/my-cars">
                    <DropdownMenuItem className="cursor-pointer">
                      <Car className="ml-2 h-4 w-4" />
                      <span>הרכבים שלי</span>
                    </DropdownMenuItem>
                  </Link>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => logout()} className="text-red-600 cursor-pointer focus:text-red-600 focus:bg-red-50">
                    <LogOut className="ml-2 h-4 w-4" />
                    <span>התנתק</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-2">
                <a href="/api/login">
                  <Button variant="ghost" size="sm" className="hidden md:flex">
                    התחבר
                  </Button>
                </a>
                <a href="/api/login">
                  <Button size="sm" className="shadow-lg shadow-primary/20">
                    הרשמה
                  </Button>
                </a>
              </div>
            )}

            {/* Mobile Menu Toggle */}
            <Button 
              variant="ghost" 
              size="icon" 
              className="md:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu Content */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t bg-background p-4 flex flex-col gap-4 animate-in slide-in-from-top-2">
            <Link href="/" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-2 p-2 hover:bg-accent rounded-lg">
              <Search className="h-4 w-4" />
              <span>חיפוש רכבים</span>
            </Link>
            <Link href="/list-car" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-2 p-2 hover:bg-accent rounded-lg">
              <Car className="h-4 w-4" />
              <span>פרסם רכב</span>
            </Link>
            {!user && (
              <div className="pt-2 border-t flex flex-col gap-2">
                <a href="/api/login" className="w-full">
                  <Button variant="outline" className="w-full justify-start">
                    התחבר
                  </Button>
                </a>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t bg-slate-50 mt-12">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
                  <Car className="w-4 h-4 text-primary-foreground" />
                </div>
                <span className="font-bold text-lg">קח-אותו</span>
              </div>
              <p className="text-sm text-muted-foreground">
                פלטפורמת השכרת הרכב השיתופית המובילה בישראל. שוכרים רכבים מאנשים פרטיים בקלות ובמהירות.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">ניווט מהיר</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/" className="hover:text-primary transition-colors">חיפוש רכב</Link></li>
                <li><Link href="/list-car" className="hover:text-primary transition-colors">השכרת הרכב שלי</Link></li>
                <li><Link href="/about" className="hover:text-primary transition-colors">אודות</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">תמיכה</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-primary transition-colors">מרכז עזרה</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">תקנון שימוש</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">מדיניות פרטיות</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">צור קשר</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>support@kachoto.co.il</li>
                <li>03-123-4567</li>
                <li>תל אביב, ישראל</li>
              </ul>
            </div>
          </div>
          <div className="border-t mt-8 pt-8 text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} קח-אותו. כל הזכויות שמורות.
          </div>
        </div>
      </footer>
    </div>
  );
}
