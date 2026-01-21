import { z } from 'zod';
import { insertCarSchema, insertBookingSchema, insertProfileSchema, cars, bookings, profiles } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
};

export const api = {
  cars: {
    list: {
      method: 'GET' as const,
      path: '/api/cars',
      input: z.object({
        location: z.string().optional(),
        date: z.string().optional(),
        isElectric: z.string().optional(),
        isKeyless: z.string().optional(),
        hasSevenSeats: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof cars.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/cars/:id',
      responses: {
        200: z.custom<typeof cars.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/cars',
      input: insertCarSchema,
      responses: {
        201: z.custom<typeof cars.$inferSelect>(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
  },
  bookings: {
    list: {
      method: 'GET' as const,
      path: '/api/bookings',
      responses: {
        200: z.array(z.custom<typeof bookings.$inferSelect>()),
        401: errorSchemas.unauthorized,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/bookings',
      input: insertBookingSchema,
      responses: {
        201: z.custom<typeof bookings.$inferSelect>(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
    updateStatus: {
      method: 'PATCH' as const,
      path: '/api/bookings/:id/status',
      input: z.object({ status: z.enum(["approved", "rejected", "cancelled", "completed"]) }),
      responses: {
        200: z.custom<typeof bookings.$inferSelect>(),
        404: errorSchemas.notFound,
        401: errorSchemas.unauthorized,
      },
    },
  },
  profiles: {
    me: {
      method: 'GET' as const,
      path: '/api/profiles/me',
      responses: {
        200: z.custom<typeof profiles.$inferSelect>().nullable(), // might be null if not created yet
        401: errorSchemas.unauthorized,
      },
    },
    update: {
      method: 'POST' as const, // Upsert
      path: '/api/profiles',
      input: insertProfileSchema.omit({ userId: true }), // userId comes from session
      responses: {
        200: z.custom<typeof profiles.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
