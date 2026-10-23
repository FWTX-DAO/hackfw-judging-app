type RankedSubmission = { id: number; avg_weighted: number; judge_count: number; requirements_met: boolean };

/** Unscored/unverified entries have no place. Equal scores share a place. */
export function rankStandings<T extends RankedSubmission>(entries: T[]) {
  const ranked = entries.filter((entry) => entry.requirements_met && entry.judge_count > 0)
    .sort((a, b) => b.avg_weighted - a.avg_weighted || a.id - b.id);
  let place = 0;
  return [
    ...ranked.map((entry, index) => {
      if (index === 0 || entry.avg_weighted !== ranked[index - 1]!.avg_weighted) place = index + 1;
      return { entry, place: place as number | null };
    }),
    ...entries.filter((entry) => !entry.requirements_met || entry.judge_count === 0)
      .sort((a, b) => a.id - b.id).map((entry) => ({ entry, place: null as number | null })),
  ];
}

export function ordinal(place: number) {
  const lastTwo = place % 100;
  const suffix = lastTwo >= 11 && lastTwo <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[place % 10] ?? "th");
  return `${place}${suffix}`;
}
