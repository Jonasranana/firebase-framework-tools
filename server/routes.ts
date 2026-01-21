import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { cars } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // 1. Setup Auth
  await setupAuth(app);
  registerAuthRoutes(app);

  // 2. API Routes

  // --- CARS ---
  app.get(api.cars.list.path, async (req, res) => {
    try {
      // Manually parse query params if needed, or pass directly.
      // Basic string filtering is handled in storage
      const params = req.query as any;
      const results = await storage.getCars(params);
      res.json(results);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.cars.get.path, async (req, res) => {
    const id = Number(req.params.id);
    const car = await storage.getCar(id);
    if (!car) {
      return res.status(404).json({ message: "Car not found" });
    }
    // Ideally we fetch owner details too
    res.json(car);
  });

  app.post(api.cars.create.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.cars.create.input.parse(req.body);
      const user = req.user as any;
      const userId = user.claims.sub; // From Replit Auth

      const car = await storage.createCar({ ...input, ownerId: userId });
      res.status(201).json(car);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
        return;
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // --- BOOKINGS ---
  app.get(api.bookings.list.path, isAuthenticated, async (req, res) => {
    const user = req.user as any;
    const userId = user.claims.sub;
    
    // Simplification: Return renter bookings for now. 
    // In a real app we might want separate endpoints or a type param.
    const bookings = await storage.getBookingsByRenter(userId);
    res.json(bookings);
  });

  app.post(api.bookings.create.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.bookings.create.input.parse(req.body);
      const user = req.user as any;
      const userId = user.claims.sub;

      const booking = await storage.createBooking({ ...input, renterId: userId });
      res.status(201).json(booking);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
        return;
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch(api.bookings.updateStatus.path, isAuthenticated, async (req, res) => {
    // TODO: Add verification that current user owns the car associated with this booking
    const id = Number(req.params.id);
    const { status } = req.body;
    
    const updated = await storage.updateBookingStatus(id, status);
    if (!updated) {
      return res.status(404).json({ message: "Booking not found" });
    }
    res.json(updated);
  });

  // --- PROFILES ---
  app.get(api.profiles.me.path, isAuthenticated, async (req, res) => {
    const user = req.user as any;
    const userId = user.claims.sub;
    const profile = await storage.getProfile(userId);
    res.json(profile || null);
  });

  app.post(api.profiles.update.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.profiles.update.input.parse(req.body);
      const user = req.user as any;
      const userId = user.claims.sub;

      const profile = await storage.upsertProfile({ ...input, userId });
      res.json(profile);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
        return;
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Seed Data function (Simple version)
  await seedDatabase();

  return httpServer;
}

async function seedDatabase() {
  const existingCars = await storage.getCars();
  if (existingCars.length === 0) {
    // Since we rely on Replit Auth Users (which we can't create programmatically without login),
    // We will just wait for real users or manual testing.
    // OR we can create "Ghost" users in the auth table directly if we wanted to strictly follow the pattern,
    // but with Replit Auth it's trickier as the ID is from the provider.
    
    // For demo purposes, we'll skip auto-seeding linked data that strictly requires valid Auth IDs.
    // Ideally, the first user who logs in should post a car.
    console.log("Database empty. Log in and post a car to seed data!");
  }
}
