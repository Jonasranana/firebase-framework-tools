import { Layout } from "@/components/Layout";
import { useBookings, useUpdateBookingStatus } from "@/hooks/use-bookings";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Calendar, MapPin, CheckCircle, XCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect } from "react";

export default function MyBookings() {
  const { user, isLoading: authLoading } = useAuth();
  const { data: bookings, isLoading } = useBookings();
  const { mutate: updateStatus } = useUpdateBookingStatus();

  useEffect(() => {
    if (!authLoading && !user) {
      window.location.href = "/api/login";
    }
  }, [authLoading, user]);

  if (authLoading || isLoading) {
    return <Layout><div className="flex justify-center p-20"><Loader2 className="animate-spin" /></div></Layout>;
  }

  // Filter bookings
  const myRequests = bookings?.filter(b => b.renterId === user?.id) || [];
  const incomingRequests = bookings?.filter(b => b.car?.ownerId === user?.id) || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><Clock className="w-3 h-3 ml-1" /> ממתין לאישור</Badge>;
      case "approved": return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle className="w-3 h-3 ml-1" /> מאושר</Badge>;
      case "rejected": return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><XCircle className="w-3 h-3 ml-1" /> נדחה</Badge>;
      case "completed": return <Badge variant="secondary"><CheckCircle className="w-3 h-3 ml-1" /> הושלם</Badge>;
      case "cancelled": return <Badge variant="secondary" className="bg-gray-100 text-gray-500">בוטל</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">ניהול הזמנות</h1>

        <Tabs defaultValue="my-requests" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8 h-12">
            <TabsTrigger value="my-requests" className="text-lg">ההזמנות שלי</TabsTrigger>
            <TabsTrigger value="incoming" className="text-lg">בקשות לרכבים שלי</TabsTrigger>
          </TabsList>

          <TabsContent value="my-requests" className="space-y-4">
            {myRequests.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-xl">
                <p className="text-muted-foreground">טרם ביצעת הזמנות.</p>
                <Button variant="link" asChild><a href="/">חפש רכב עכשיו</a></Button>
              </div>
            ) : (
              myRequests.map((booking) => (
                <Card key={booking.id} className="overflow-hidden hover:shadow-md transition-shadow">
                  <div className="flex flex-col md:flex-row">
                    <div className="w-full md:w-48 h-32 md:h-auto bg-slate-200 relative">
                      <img src={booking.car?.imageUrl} className="w-full h-full object-cover" alt="Car" />
                    </div>
                    <div className="p-6 flex-1 flex flex-col md:flex-row justify-between gap-4">
                      <div>
                        <h3 className="font-bold text-lg mb-1">{booking.car?.make} {booking.car?.model}</h3>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                          <MapPin className="w-4 h-4" />
                          {booking.car?.location}
                        </div>
                        <div className="flex items-center gap-2 text-sm mb-4">
                          <Calendar className="w-4 h-4 text-primary" />
                          <span>
                            {format(new Date(booking.startDate), "d MMM", { locale: he })} - {format(new Date(booking.endDate), "d MMM yyyy", { locale: he })}
                          </span>
                        </div>
                        {getStatusBadge(booking.status || 'pending')}
                      </div>
                      <div className="flex flex-col items-end justify-between">
                        <div className="text-xl font-bold">₪{booking.totalPrice}</div>
                        {booking.status === 'pending' && (
                          <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => updateStatus({ id: booking.id, status: 'cancelled' })}>
                            בטל הזמנה
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="incoming" className="space-y-4">
            {incomingRequests.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-xl">
                <p className="text-muted-foreground">אין בקשות ממתינות לרכבים שלך.</p>
              </div>
            ) : (
              incomingRequests.map((booking) => (
                <Card key={booking.id} className="overflow-hidden border-l-4 border-l-primary">
                  <CardHeader className="bg-slate-50 pb-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>{booking.car?.make} {booking.car?.model}</CardTitle>
                        <CardDescription>בקשה מאת {booking.renter?.firstName} {booking.renter?.lastName}</CardDescription>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-primary">₪{booking.totalPrice}</div>
                        <div className="text-sm text-muted-foreground">סה"כ הכנסה</div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-5 h-5 text-muted-foreground" />
                          <span className="font-medium">
                            {format(new Date(booking.startDate), "d MMM", { locale: he })} - {format(new Date(booking.endDate), "d MMM yyyy", { locale: he })}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">סטטוס נוכחי: {getStatusBadge(booking.status || 'pending')}</p>
                      </div>

                      {booking.status === 'pending' && (
                        <div className="flex gap-3 w-full md:w-auto">
                          <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => updateStatus({ id: booking.id, status: 'approved' })}>
                            <CheckCircle className="w-4 h-4 ml-2" />
                            אשר בקשה
                          </Button>
                          <Button variant="outline" className="flex-1 text-red-600 border-red-200 hover:bg-red-50" onClick={() => updateStatus({ id: booking.id, status: 'rejected' })}>
                            <XCircle className="w-4 h-4 ml-2" />
                            דחה
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
