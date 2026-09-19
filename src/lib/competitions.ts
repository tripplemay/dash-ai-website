import "server-only";
import raw from "../../scripts/competitions-content.json";
import type { Competition, MoeListMeta } from "./competition-domain";

export * from "./competition-domain";

const content = raw as { generatedAt: string; moeList: MoeListMeta; competitions: Competition[] };
export const MOE_LIST = content.moeList;
export const COMPETITIONS = content.competitions;
export const COMPETITIONS_GENERATED_AT = content.generatedAt;
const competitionMap = new Map(COMPETITIONS.map((item) => [item.slug, item]));

export function getCompetition(slug: string): Competition | undefined {
  return competitionMap.get(slug);
}
