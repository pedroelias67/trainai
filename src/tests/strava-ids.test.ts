import { describe, it, expect } from "vitest";
import { idFromJsonText, mayHaveLostPrecision, stravaId } from "@/lib/strava-ids";

// Um id de 64 bits real, acima do que o JavaScript aguenta sem arredondar.
const GRANDE = "12345678901234567890";

describe("o problema que isto existe para resolver", () => {
  it("o JSON.parse estraga o id antes de o nosso código lhe tocar", () => {
    // Não é o String() que falha nem o nosso código: é o parser. Quando a
    // conversão para texto acontece, o número já vem errado — e errado de uma
    // forma que parece perfeitamente plausível.
    const estragado = String(JSON.parse(`{"id":${GRANDE}}`).id);

    expect(estragado).not.toBe(GRANDE);
    expect(estragado).toBe("12345678901234567000");
    // Mesmos dígitos no início, três zeros no fim. Nada estoira, nada avisa.
    expect(estragado.slice(0, 17)).toBe(GRANDE.slice(0, 17));
  });

  it("abaixo do limite não há problema nenhum", () => {
    // Os ids de hoje, com dez dígitos, passam sem beliscadura — que é a razão
    // de isto nunca ter dado problemas até agora.
    const hoje = "15847263901";
    expect(String(JSON.parse(`{"id":${hoje}}`).id)).toBe(hoje);
  });
});

describe("stravaId", () => {
  it("prefere o id_str, que é o que a Strava recomenda", () => {
    // Mesmo com o id numérico já estragado ao lado, o id_str está certo.
    const vindoDaApi = JSON.parse(`{"id":${GRANDE},"id_str":"${GRANDE}"}`);
    expect(stravaId(vindoDaApi)).toBe(GRANDE);
  });

  it("aceita um id que venha em texto", () => {
    expect(stravaId({ id: GRANDE })).toBe(GRANDE);
  });

  it("ainda funciona com os ids numéricos de hoje", () => {
    expect(stravaId({ id: 15847263901 })).toBe("15847263901");
  });

  it("devolve nada em vez de um palpite", () => {
    // Quem escreve linhas com esta chave deve parar, não inventar.
    expect(stravaId(null)).toBeNull();
    expect(stravaId({})).toBeNull();
    expect(stravaId({ id: null })).toBeNull();
    expect(stravaId({ id_str: "não é um número" })).toBeNull();
    expect(stravaId({ id: NaN })).toBeNull();
  });
});

describe("mayHaveLostPrecision", () => {
  it("assinala um número grande que chegou sem id_str", () => {
    expect(mayHaveLostPrecision(JSON.parse(`{"id":${GRANDE}}`))).toBe(true);
  });

  it("cala-se quando há id_str ou quando o número é pequeno", () => {
    expect(mayHaveLostPrecision(JSON.parse(`{"id":${GRANDE},"id_str":"${GRANDE}"}`))).toBe(false);
    expect(mayHaveLostPrecision({ id: 15847263901 })).toBe(false);
  });
});

describe("idFromJsonText", () => {
  const webhook = `{"object_type":"activity","object_id":${GRANDE},"aspect_type":"create","owner_id":9876543210987654321}`;

  it("lê os dígitos do corpo em bruto, sem passar pelo parser", () => {
    expect(idFromJsonText(webhook, "object_id")).toBe(GRANDE);
    expect(idFromJsonText(webhook, "owner_id")).toBe("9876543210987654321");
  });

  it("aceita o valor entre aspas, caso a Strava passe a enviá-lo assim", () => {
    expect(idFromJsonText(`{"object_id":"${GRANDE}"}`, "object_id")).toBe(GRANDE);
  });

  it("devolve nada quando o campo não está lá", () => {
    expect(idFromJsonText(webhook, "nao_existe")).toBeNull();
    expect(idFromJsonText("{}", "object_id")).toBeNull();
  });

  it("não confunde um campo com outro que o contenha", () => {
    expect(idFromJsonText(`{"owner_id":42}`, "id")).toBeNull();
  });
});

describe("o webhook, de ponta a ponta", () => {
  // O corpo que a Strava envia hoje, e o que enviará depois de junho de 2027.
  const hoje = `{"object_type":"activity","object_id":15847263901,"aspect_type":"create","owner_id":202941}`;
  const futuro = `{"object_type":"activity","object_id":${GRANDE},"aspect_type":"create","owner_id":9876543210987654321}`;

  it("tira o mesmo id de hoje que o JSON.parse tiraria", () => {
    expect(idFromJsonText(hoje, "object_id")).toBe(String(JSON.parse(hoje).object_id));
  });

  it("e, ao contrário do JSON.parse, acerta no de 2027", () => {
    expect(idFromJsonText(futuro, "object_id")).toBe(GRANDE);
    expect(String(JSON.parse(futuro).object_id)).not.toBe(GRANDE);
  });

  it("sobrevive a um evento de desautorização, que não traz object_id", () => {
    // O atleta encontra-se pelo dono; o objeto só interessa a uma atividade.
    const deauth = `{"object_type":"athlete","aspect_type":"update","owner_id":202941,"updates":{"authorized":"false"}}`;
    expect(idFromJsonText(deauth, "owner_id")).toBe("202941");
    expect(idFromJsonText(deauth, "object_id")).toBeNull();
  });
});
