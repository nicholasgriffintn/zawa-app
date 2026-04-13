import { z } from "zod";

import { dateTimeToIso } from "@zawa/shared/time";

import { railEventTypes } from "./events";

const isoDateTimeSchema = z.preprocess(
  (value) =>
    typeof value === "string" || typeof value === "number"
      ? (dateTimeToIso(value) ?? value)
      : value,
  z.string().datetime(),
);

export const railEventSchema = z.object({
  id: z.string().min(1),
  source: z.enum(["rdm", "trust", "td"]),
  topic: z.string().min(1),
  type: z.enum(railEventTypes),
  occurredAt: isoDateTimeSchema,
  ingestedAt: isoDateTimeSchema,
  serviceKey: z.string().optional(),
  trainRunKey: z.string().optional(),
  stationKey: z.string().optional(),
  payloadVersion: z.number().int().positive(),
  payload: z.record(z.string(), z.unknown()),
});

export type RailEventSchema = z.infer<typeof railEventSchema>;
