import { describe, it, expect } from "vitest";
import { athleteProgress, lastSeen, needsOnboarding, type ProgressFacts } from "@/lib/athlete-progress";

const now = new Date("2026-09-16T12:00:00Z");
const ago = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

const facts = (over: Partial<ProgressFacts> = {}): ProgressFacts => ({
  createdAt: ago(30), lastLoginAt: ago(1), hasProfile: true,
  eventCount: 1, planCount: 1, hasActivePlan: true,
  activityCount: 20, lastActivityAt: ago(1), sessionsAhead: 4, ...over,
});

describe("athleteProgress", () => {
  it("is quiet about someone who is training", () => {
    expect(athleteProgress(facts(), now)).toEqual({ stage: "a-treinar", label: "A treinar", stuck: false });
  });

  it("separates someone who just registered from someone who stalled there", () => {
    const fresh = athleteProgress(facts({ createdAt: ago(1), hasProfile: false, eventCount: 0, planCount: 0 }), now);
    expect(fresh).toMatchObject({ stage: "conta", stuck: false });

    const stalled = athleteProgress(facts({ createdAt: ago(5), hasProfile: false, eventCount: 0, planCount: 0 }), now);
    expect(stalled).toMatchObject({ stage: "conta", stuck: true });
  });

  it("says when someone never came back after registering", () => {
    expect(athleteProgress(facts({
      createdAt: ago(1), hasProfile: false, eventCount: 0, planCount: 0, lastLoginAt: null,
    }), now).detail).toBe("Nunca entrou depois do registo");
  });

  it("does not claim that about accounts older than the record of sign-ins", () => {
    // lastLoginAt has only been written since 14 September: before that, an empty
    // one means nobody was writing it down.
    expect(athleteProgress(facts({
      createdAt: new Date("2026-08-01"), hasProfile: false, eventCount: 0, planCount: 0, lastLoginAt: null,
    }), now).detail).toBe("Não preencheu o perfil");
  });

  it("treats a race without a plan as broken, however recent", () => {
    // They asked for a plan and did not get one — generation failed or timed out.
    expect(athleteProgress(facts({ createdAt: ago(0.1), planCount: 0, activityCount: 0 }), now))
      .toMatchObject({ stage: "evento", stuck: true, detail: "Plano não chegou a ser gerado" });
  });

  it("counts an archived plan as having got that far", () => {
    expect(athleteProgress(facts({ planCount: 1, hasActivePlan: false, activityCount: 0, createdAt: ago(1) }), now).stage)
      .toBe("plano");
  });

  it("notices a plan nobody is training to", () => {
    expect(athleteProgress(facts({ activityCount: 0, lastActivityAt: null, createdAt: ago(10) }), now))
      .toMatchObject({ stage: "plano", stuck: true, detail: "Ainda não chegou nenhum treino" });
  });

  it("notices someone who drifted away", () => {
    expect(athleteProgress(facts({ lastActivityAt: ago(20) }), now))
      .toMatchObject({ stage: "parado", stuck: true, detail: "Último treino há 20 dias" });
  });

  it("notices a plan that has run out of weeks", () => {
    // The rolling horizon only materialises a few weeks; an empty plan reads as
    // a bug to the athlete.
    expect(athleteProgress(facts({ sessionsAhead: 0 }), now))
      .toMatchObject({ stage: "a-treinar", stuck: true, detail: "Plano sem treinos à frente" });
  });
});

describe("needsOnboarding", () => {
  it("sends only those with nothing set up", () => {
    expect(needsOnboarding({ eventCount: 0, planCount: 0 })).toBe(true);
    expect(needsOnboarding({ eventCount: 1, planCount: 0 })).toBe(false);
    expect(needsOnboarding({ eventCount: 0, planCount: 1 })).toBe(false);
  });
});

describe("lastSeen", () => {
  it("tells an unknown history apart from a real absence", () => {
    expect(lastSeen({ createdAt: new Date("2026-08-01"), lastLoginAt: null })).toEqual({ known: false });
    expect(lastSeen({ createdAt: new Date("2026-09-15"), lastLoginAt: null })).toEqual({ known: true, at: null });
    const at = new Date("2026-09-16");
    expect(lastSeen({ createdAt: new Date("2026-08-01"), lastLoginAt: at })).toEqual({ known: true, at });
  });
});
