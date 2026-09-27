// Who gets their weekly report first.
//
// Only matters when there are more athletes than the job has time for, which is
// exactly when getting it wrong costs someone their report. It has been wrong
// twice: first by plan age, which meant the same athlete came last every week,
// then by when their last report was written — and a report written late is a
// report that arrived late, so that ordering put the athlete who had just been
// cut off at the back of the queue again.
//
// The fair question is how long ago the last week they heard about ended.

/**
 * Athletes ordered by who has waited longest, longest first.
 *
 * `lastWeekCovered` holds the end of the most recent week each athlete has a
 * report for, in milliseconds; an athlete missing from it has never had one and
 * goes to the front. Equal waits keep the order they came in.
 */
export function orderByLongestWait<T>(
  items: T[],
  athleteId: (item: T) => string,
  lastWeekCovered: Map<string, number>
): T[] {
  return [...items].sort(
    (a, b) => (lastWeekCovered.get(athleteId(a)) ?? 0) - (lastWeekCovered.get(athleteId(b)) ?? 0)
  );
}
