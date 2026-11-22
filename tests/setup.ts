import { vi } from "vitest";

// Test environment configuration — must run before app modules load
;(process.env as Record<string, string>).DATABASE_URL = "file:./prisma/test.db";
;(process.env as Record<string, string>).NODE_ENV = "test";
;(process.env as Record<string, string>).SESSION_SECRET =
  "test-secret-key-that-is-at-least-32-chars-long!!!";

// Shared cookie store so tests can read session tokens set by createSession
export const cookieStore = new Map<string, string>();

vi.mock("next/headers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/headers")>();
  return {
    ...actual,
    cookies: () => ({
      get: (name: string) => ({ value: cookieStore.get(name) ?? undefined }),
      set: (name: string, value: string, options?: Record<string, unknown>) => {
        cookieStore.set(name, value);
        return { name, value, options };
      },
      delete: (name: string) => cookieStore.delete(name),
      has: (name: string) => cookieStore.has(name),
      getAll: () => Array.from(cookieStore.entries()).map(([name, value]) => ({ name, value })),
    }),
  };
});

export {};
