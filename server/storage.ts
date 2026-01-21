import { 
  cars, profiles, bookings,
  type Car, type InsertCar, type UpdateCarRequest,
  type Profile, type InsertProfile,
  type Booking, type InsertBooking, type UpdateBookingStatusRequest,
  type CarQueryParams,
  users
} from "@shared/schema";
import { users as authUsers, type User, type UpsertUser } from "@shared/models/auth";
import { db } from "./db";
import { eq, and, desc, sql, ilike } from "drizzle-orm";
import { authStorage, type IAuthStorage } from "./replit_integrations/auth";

export interface IStorage extends IAuthStorage {
  // Cars
  getCars(params?: CarQueryParams): Promise<Car[]>;
  getCar(id: number): Promise<Car | undefined>;
  createCar(car: InsertCar): Promise<Car>;
  // Bookings
  createBooking(booking: InsertBooking): Promise<Booking>;
  getBookingsByRenter(renterId: string): Promise<Booking[]>;
  getBookingsByOwner(ownerId: string): Promise<Booking[]>;
  updateBookingStatus(id: number, status: string): Promise<Booking | undefined>;
  // Profiles
  getProfile(userId: string): Promise<Profile | undefined>;
  upsertProfile(profile: InsertProfile): Promise<Profile>;
}

export class DatabaseStorage implements IStorage {
  // Auth Storage Implementation Delegate
  async getUser(id: string): Promise<User | undefined> {
    return authStorage.getUser(id);
  }
  async upsertUser(user: UpsertUser): Promise<User> {
    return authStorage.upsertUser(user);
  }

  // Cars
  async getCars(params?: CarQueryParams): Promise<Car[]> {
    let conditions = [];
    
    if (params?.location) {
      conditions.push(ilike(cars.location, `%${params.location}%`));
    }
    if (params?.isElectric === "true") {
      conditions.push(eq(cars.isElectric, true));
    }
    if (params?.isKeyless === "true") {
      conditions.push(eq(cars.isKeyless, true));
    }
    if (params?.hasSevenSeats === "true") {
      conditions.push(eq(cars.hasSevenSeats, true));
    }

    // Basic implementation - allows stacking filters
    // Drizzle's where() takes varargs for AND, but building array is cleaner
    return await db.select().from(cars)
      .where(and(...conditions))
      .orderBy(desc(cars.createdAt));
  }

  async getCar(id: number): Promise<Car | undefined> {
    const [car] = await db.select().from(cars).where(eq(cars.id, id));
    return car;
  }

  async createCar(car: InsertCar): Promise<Car> {
    const [newCar] = await db.insert(cars).values(car).returning();
    return newCar;
  }

  // Bookings
  async createBooking(booking: InsertBooking): Promise<Booking> {
    const [newBooking] = await db.insert(bookings).values(booking).returning();
    return newBooking;
  }

  async getBookingsByRenter(renterId: string): Promise<Booking[]> {
    return await db.select().from(bookings)
      .where(eq(bookings.renterId, renterId))
      .orderBy(desc(bookings.createdAt));
  }

  async getBookingsByOwner(ownerId: string): Promise<Booking[]> {
    // Join not strictly needed if we query filtering by car ownership, 
    // but easier to query all bookings where car.ownerId = ownerId
    /* 
       SELECT b.* FROM bookings b 
       JOIN cars c ON b.car_id = c.id 
       WHERE c.owner_id = ownerId 
    */
   // Drizzle ORM query builder approach:
    const result = await db.select({ booking: bookings })
      .from(bookings)
      .innerJoin(cars, eq(bookings.carId, cars.id))
      .where(eq(cars.ownerId, ownerId))
      .orderBy(desc(bookings.createdAt));
    
    return result.map(r => r.booking);
  }

  async updateBookingStatus(id: number, status: string): Promise<Booking | undefined> {
    // Validate status string manually or trust route validation
    const [updated] = await db.update(bookings)
      .set({ status: status as any })
      .where(eq(bookings.id, id))
      .returning();
    return updated;
  }

  // Profiles
  async getProfile(userId: string): Promise<Profile | undefined> {
    const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId));
    return profile;
  }

  async upsertProfile(profile: InsertProfile): Promise<Profile> {
    // Check if exists using userId
    // Actually we can't easily do upsert on non-unique constraint without a unique index on userId.
    // The schema defines userId as references authUsers, but doesn't explicitly make it unique in 'profiles'.
    // However, logic dictates 1 profile per user.
    // Let's try to find it first.
    
    const existing = await this.getProfile(profile.userId);
    if (existing) {
      const [updated] = await db.update(profiles)
        .set(profile)
        .where(eq(profiles.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(profiles).values(profile).returning();
      return created;
    }
  }
}

export const storage = new DatabaseStorage();
