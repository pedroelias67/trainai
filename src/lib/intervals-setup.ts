// Setting up Intervals.icu, written once.
//
// These steps existed inside the connect form, which is the one place an
// athlete only reaches if they already know to look for it. They are now also
// sent by email to someone whose watch is not receiving workouts, and the two
// must not drift: an athlete comparing the mail against the screen should find
// the same four steps in the same order.

export const INTERVALS_STEPS = [
  {
    title: "Cria uma conta gratuita",
    detail: "Em intervals.icu. Leva um minuto e não custa nada.",
  },
  {
    title: "Liga lá o teu relógio",
    detail:
      "Ícone do perfil → Settings → Integrations → escolhe a tua marca → Connect. " +
      "Inicia sessão com a mesma conta do relógio.",
  },
  {
    title: "Copia a API key",
    detail: "Ainda em Settings, desce até ao fundo, a Developer Settings.",
  },
  {
    title: "Cola-a no TrainAI",
    detail: "No Perfil, no cartão do Intervals.icu, carrega em Ligar.",
  },
];

/**
 * Why a threshold pace has to be set, in the athlete's terms.
 *
 * The failure it prevents is the quietest one in the whole app: the workout
 * reaches the watch with every step in place, and only the pace targets are
 * gone, so the watch counts down minutes and guides by heart rate instead.
 */
export const THRESHOLD_HELP = {
  where: "intervals.icu → Settings → Corrida → Definições de Ritmo → Ritmo de Limiar",
  why:
    "Sem esse valor, o Intervals.icu descarta os alvos de ritmo a caminho do relógio. " +
    "O treino aparece correto na app e no Intervals.icu, e chega ao relógio com as fases " +
    "sem ritmo nenhum — só com a duração.",
};
