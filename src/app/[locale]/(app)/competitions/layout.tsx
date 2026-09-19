import { CompetitionTrackingProvider } from "@/components/competition-tracking-provider";
import { initialCompetitionTracking } from "@/lib/competition-tracking-server";

export default async function CompetitionLayout({ children }: { children: React.ReactNode }) {
  return <CompetitionTrackingProvider initial={await initialCompetitionTracking()}>{children}</CompetitionTrackingProvider>;
}
