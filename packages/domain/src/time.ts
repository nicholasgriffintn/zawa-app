import { localClockTimeToIso } from "@zawa/shared/time";

const UK_RAIL_TIME_ZONE = "Europe/London";

export function railClockTimeToIso(
  clockTime: string | null | undefined,
  serviceDate: string | null | undefined,
): string | null {
  return localClockTimeToIso({ clockTime, serviceDate, timeZone: UK_RAIL_TIME_ZONE });
}
