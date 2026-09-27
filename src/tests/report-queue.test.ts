import { describe, it, expect } from "vitest";
import { orderByLongestWait } from "@/lib/report-queue";

type Atleta = { athleteId: string };
const id = (a: Atleta) => a.athleteId;
const semana = (dia: string) => new Date(`${dia}T23:59:59Z`).getTime();

describe("orderByLongestWait", () => {
  it("puts an athlete who has never had a report first", () => {
    const fila = orderByLongestWait(
      [{ athleteId: "isabel" }, { athleteId: "francisco" }],
      id,
      new Map([["isabel", semana("2026-09-20")]])
    );
    expect(fila.map(id)).toEqual(["francisco", "isabel"]);
  });

  it("orders by how long ago the last reported week ended", () => {
    const fila = orderByLongestWait(
      [{ athleteId: "recente" }, { athleteId: "antigo" }, { athleteId: "meio" }],
      id,
      new Map([
        ["recente", semana("2026-09-20")],
        ["antigo", semana("2026-08-30")],
        ["meio", semana("2026-09-13")],
      ])
    );
    expect(fila.map(id)).toEqual(["antigo", "meio", "recente"]);
  });

  it("does not punish an athlete whose report arrived late", () => {
    // The case this went wrong on. Both heard about the week ending 20 Sep, but
    // Pedro's was written on the Monday because Sunday's job had run out of
    // time. Ordering by when the report was written sent him to the back of the
    // queue the following week — so the athlete the budget cut off was the one
    // it cut off again.
    const fila = orderByLongestWait(
      [{ athleteId: "pedro" }, { athleteId: "isabel" }],
      id,
      new Map([
        ["pedro", semana("2026-09-20")],   // escrito na segunda, 21/09
        ["isabel", semana("2026-09-20")],  // escrito no domingo, 20/09
      ])
    );
    expect(fila.map(id)).toEqual(["pedro", "isabel"]);
  });

  it("leaves the order alone when nobody has ever had a report", () => {
    const fila = orderByLongestWait(
      [{ athleteId: "a" }, { athleteId: "b" }, { athleteId: "c" }],
      id,
      new Map()
    );
    expect(fila.map(id)).toEqual(["a", "b", "c"]);
  });

  it("does not modify the list it was given", () => {
    const original = [{ athleteId: "z" }, { athleteId: "a" }];
    orderByLongestWait(original, id, new Map([["z", semana("2026-01-01")]]));
    expect(original.map(id)).toEqual(["z", "a"]);
  });
});
