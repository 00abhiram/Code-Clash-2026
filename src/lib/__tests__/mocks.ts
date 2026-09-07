import { vi } from "vitest";

/**
 * Creates a mock Supabase client with chainable query builders.
 * Each method (select, insert, update, delete, eq, single, etc.)
 * returns the builder itself for chaining, and `data`/`error` are configurable.
 */
export function createMockSupabase(
  overrides: {
    data?: unknown;
    error?: { message: string; code?: string } | null;
    rpcData?: unknown;
    rpcError?: { message: string } | null;
  } = {}
) {
  const mockSingle = vi.fn().mockResolvedValue({
    data: overrides.data ?? null,
    error: overrides.error ?? null,
  });

  const mockMaybeSingle = vi.fn().mockResolvedValue({
    data: overrides.data ?? null,
    error: overrides.error ?? null,
  });

  const chainableMethods = [
    "select",
    "insert",
    "update",
    "delete",
    "eq",
    "neq",
    "gt",
    "gte",
    "lt",
    "lte",
    "order",
    "limit",
    "filter",
  ];

  const builder: Record<string, unknown> = {};
  chainableMethods.forEach((method) => {
    builder[method] = vi.fn().mockReturnValue(builder);
  });
  builder.single = mockSingle;
  builder.maybeSingle = mockMaybeSingle;

  const fromMock = vi.fn().mockReturnValue(builder);

  const rpcMock = vi.fn().mockResolvedValue({
    data: overrides.rpcData ?? null,
    error: overrides.rpcError ?? null,
  });

  const supabase = {
    from: fromMock,
    rpc: rpcMock,
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: { id: "test-user-id", email: "test@example.com" },
        },
        error: null,
      }),
    },
    _mocks: {
      from: fromMock,
      rpc: rpcMock,
      single: mockSingle,
      maybeSingle: mockMaybeSingle,
      builder,
    },
  };

  return supabase;
}

export const MOCK_USER_ID = "test-user-id-12345";
export const MOCK_SESSION_ID = "test-session-id-12345";
export const MOCK_QUESTION_ID = "test-question-id-12345";
