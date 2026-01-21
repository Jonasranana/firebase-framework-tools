import { pgTable, text, serial, integer, boolean, timestamp, real, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users as authUsers } from "./models/auth";
import { relations } from "drizzle-orm";

// Re-export auth models
export * from "./models/auth";

// === TABLE DEFINITIONS ===

// Extend user profile with application specific fields if needed, 
// but for now we'll rely on the auth users table and maybe add a separate profile table if complex.
// For simplicity in this MVP, we'll assume authUsers holds the core identity.
// If we need extra fields like 'isOwner', we can add a 'profiles' table linked to authUsers.

export const profiles = pgTable("profiles", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => authUsers.id),
  bio: text("bio"),
  phoneNumber: text("phone_number"),
  isOwner: boolean("is_owner").default(false),
  city: text("city"),
});

export const cars = pgTable("cars", {
  id: serial("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => authUsers.id),
  make: text("make").notNull(),
  model: text("model").notNull(),
  year: integer("year").notNull(),
  pricePerDay: integer("price_per_day").notNull(),
  location: text("location").notNull(),
  description: text("description"),
  imageUrl: text("image_url").notNull(),
  isElectric: boolean("is_electric").default(false),
  isKeyless: boolean("is_keyless").default(false),
  hasSevenSeats: boolean("has_seven_seats").default(false),
  rating: real("rating").default(5.0),
  tripCount: integer("trip_count").default(0),
  badges: text("badges").array(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  carId: integer("car_id").notNull().references(() => cars.id),
  renterId: text("renter_id").notNull().references(() => authUsers.id),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }).notNull(),
  totalPrice: integer("total_price").notNull(),
  status: text("status", { enum: ["pending", "approved", "rejected", "completed", "cancelled"] }).default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

// === RELATIONS ===

export const profilesRelations = relations(profiles, ({ one }) => ({
  user: one(authUsers, {
    fields: [profiles.userId],
    references: [authUsers.id],
  }),
}));

export const carsRelations = relations(cars, ({ one, many }) => ({
  owner: one(authUsers, {
    fields: [cars.ownerId],
    references: [authUsers.id],
  }),
  bookings: many(bookings),
}));

export const bookingsRelations = relations(bookings, ({ one }) => ({
  car: one(cars, {
    fields: [bookings.carId],
    references: [cars.id],
  }),
  renter: one(authUsers, {
    fields: [bookings.renterId],
    references: [authUsers.id],
  }),
}));

// === BASE SCHEMAS ===

export const insertProfileSchema = createInsertSchema(profiles).omit({ id: true });
export const insertCarSchema = createInsertSchema(cars).omit({ id: true, createdAt: true, rating: true, tripCount: true });
export const insertBookingSchema = createInsertSchema(bookings).omit({ id: true, createdAt: true, status: true });

// === EXPLICIT API CONTRACT TYPES ===

export type Profile = typeof profiles.$inferSelect;
export type InsertProfile = z.infer<typeof insertProfileSchema>;

export type Car = typeof cars.$inferSelect;
export type InsertCar = z.infer<typeof insertCarSchema>;

export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = z.infer<typeof insertBookingSchema>;

// Request types
export type CreateCarRequest = InsertCar;
export type UpdateCarRequest = Partial<InsertCar>;

export type CreateBookingRequest = InsertBooking;
export type UpdateBookingStatusRequest = { status: "approved" | "rejected" | "cancelled" | "completed" };

// Response types
export type CarResponse = Car & { owner?: typeof authUsers.$inferSelect };
export type BookingResponse = Booking & { car?: Car, renter?: typeof authUsers.$inferSelect };

// Query Params
export interface CarQueryParams {
  location?: string;
  date?: string;
  isElectric?: string; // "true" | "false"
  isKeyless?: string;
  hasSevenSeats?: string;
}
