import { describe, it, expect, vi } from "vitest";
import { enviarComEspera, limitePorRitmo } from "@/lib/email-retry";

/** Retries without waiting, and records how long it would have waited. */
const semEsperar = (registo: number[]) => async (ms: number) => { registo.push(ms); };

describe("limitePorRitmo", () => {
  it("recognises how Resend words a rate limit", () => {
    expect(limitePorRitmo({ name: "rate_limit_exceeded", message: "Too many requests" })).toBe(true);
    expect(limitePorRitmo({ name: "application_error", message: "429" })).toBe(true);
  });

  it("does not mistake a real refusal for one", () => {
    expect(limitePorRitmo({ name: "validation_error", message: "Invalid `to` field" })).toBe(false);
    expect(limitePorRitmo({ name: "missing_api_key", message: "API key is invalid" })).toBe(false);
    expect(limitePorRitmo({ name: null, message: null })).toBe(false);
  });
});

describe("enviarComEspera", () => {
  it("sends once when nothing goes wrong", async () => {
    const enviar = vi.fn(async () => null);
    await enviarComEspera(enviar, semEsperar([]));
    expect(enviar).toHaveBeenCalledTimes(1);
  });

  it("waits out a rate limit and delivers", async () => {
    const esperas: number[] = [];
    const enviar = vi.fn()
      .mockResolvedValueOnce({ name: "rate_limit_exceeded", message: "Too many requests" })
      .mockResolvedValueOnce({ name: "rate_limit_exceeded", message: "Too many requests" })
      .mockResolvedValueOnce(null);

    await enviarComEspera(enviar, semEsperar(esperas));
    expect(enviar).toHaveBeenCalledTimes(3);
    expect(esperas).toEqual([400, 800]);
  });

  it("gives up rather than retrying forever", async () => {
    const esperas: number[] = [];
    const enviar = vi.fn(async () => ({ name: "rate_limit_exceeded", message: "Too many requests" }));

    await expect(enviarComEspera(enviar, semEsperar(esperas))).rejects.toThrow(/rate_limit_exceeded/);
    expect(enviar).toHaveBeenCalledTimes(4);
    expect(esperas).toEqual([400, 800, 1600]);
  });

  it("does not retry a rejected address", async () => {
    // Sending it again would get the same answer, and the report is owed to
    // Sentry, not to a fourth attempt.
    const enviar = vi.fn(async () => ({ name: "validation_error", message: "Invalid `to` field" }));
    await expect(enviarComEspera(enviar, semEsperar([]))).rejects.toThrow(/Invalid `to` field/);
    expect(enviar).toHaveBeenCalledTimes(1);
  });
});
