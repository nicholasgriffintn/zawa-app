import { Kafka, logLevel, type EachMessagePayload, type SASLOptions } from "kafkajs";

import { railEventSchema } from "@zawa/domain/schemas";
import {
  normaliseRdmStreamingMessage,
  RDM_REALTIME_FEED_NAME,
  RDM_TRAIN_MOVEMENTS_FEED_NAME,
  type RdmStreamingFeed,
} from "@zawa/rdm/streaming";
import { booleanEnv, csvEnv, optionalEnv, requiredEnv } from "@zawa/shared/env";
import { nowIso } from "@zawa/shared/time";
import { isRecord, positiveIntegerValue } from "@zawa/shared/values";

interface IngestConfig {
  kafka: {
    brokers: string[];
    clientId: string;
    groupId: string;
    ssl: boolean;
    sasl: SASLOptions;
    topics: Record<RdmStreamingFeed, string>;
  };
  queue: {
    accountId: string;
    queueId: string;
    apiToken: string;
    sendTimeoutMs: number;
  } | null;
}

const DEFAULT_CLIENT_ID = "zawa-rdm-ingest";
const DEFAULT_GROUP_ID = "zawa-rdm-ingest";
const DEFAULT_QUEUE_SEND_TIMEOUT_MS = 20_000;

const config = readConfig(process.env);
const kafka = new Kafka({
  clientId: config.kafka.clientId,
  brokers: config.kafka.brokers,
  ssl: config.kafka.ssl,
  sasl: config.kafka.sasl,
  logLevel: logLevel.INFO,
});
const consumer = kafka.consumer({ groupId: config.kafka.groupId });

console.log(
  JSON.stringify({
    event: "rdm.ingest.starting",
    clientId: config.kafka.clientId,
    groupId: config.kafka.groupId,
    topics: Object.keys(config.kafka.topics).length,
    queuePublishing: config.queue !== null,
  }),
);

await consumer.connect();
await consumer.subscribe({
  topic: config.kafka.topics[RDM_REALTIME_FEED_NAME],
  fromBeginning: false,
});
await consumer.subscribe({
  topic: config.kafka.topics[RDM_TRAIN_MOVEMENTS_FEED_NAME],
  fromBeginning: false,
});

console.log(
  JSON.stringify({
    event: "rdm.ingest.connected",
    topics: Object.keys(config.kafka.topics).length,
    queuePublishing: config.queue !== null,
  }),
);

await consumer.run({
  eachMessage: async (message) => {
    await ingestKafkaMessage(config, message);
  },
});

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

async function ingestKafkaMessage(
  config: IngestConfig,
  message: EachMessagePayload,
): Promise<void> {
  const feed = feedForTopic(config, message.topic);
  const receivedAt = nowIso();
  const payload = parseKafkaJsonPayload(message);
  const result = await normaliseRdmStreamingMessage(feed, payload, receivedAt);

  if (result.ignored) {
    console.warn(
      JSON.stringify({
        event: "rdm.ingest.kafka.ignored",
        feed,
        topic: message.topic,
        partition: message.partition,
        offset: message.message.offset,
        reason: result.reason ?? "ignored RDM Kafka message",
      }),
    );
    return;
  }

  for (const event of result.events) {
    const parsed = railEventSchema.safeParse(event);
    if (!parsed.success) {
      throw new Error(`Normalised RDM event failed schema validation: ${parsed.error.message}`);
    }
    if (config.queue) {
      await publishRailEvent(config.queue, parsed.data);
    }
  }

  console.log(
    JSON.stringify({
      event: "rdm.ingest.kafka.message",
      feed,
      topic: message.topic,
      partition: message.partition,
      offset: message.message.offset,
      events: result.events.length,
      published: config.queue ? result.events.length : 0,
      skippedPublish: config.queue ? 0 : result.events.length,
    }),
  );
}

async function publishRailEvent(
  config: NonNullable<IngestConfig["queue"]>,
  event: unknown,
): Promise<void> {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/queues/${config.queueId}/messages`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.apiToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ body: event }),
      signal: AbortSignal.timeout(config.sendTimeoutMs),
    },
  );
  const responseBody = await response.text();

  if (!response.ok) {
    throw new Error(`Cloudflare Queue publish failed with ${response.status}: ${responseBody}`);
  }

  const parsed: unknown = JSON.parse(responseBody);
  if (!isRecord(parsed) || parsed.success !== true) {
    throw new Error(`Cloudflare Queue publish was not accepted: ${responseBody}`);
  }
}

function parseKafkaJsonPayload(message: EachMessagePayload): unknown {
  const value = message.message.value;
  if (!value) {
    throw new Error(
      `RDM Kafka message ${message.topic}:${message.partition}:${message.message.offset} has no value`,
    );
  }

  return JSON.parse(value.toString("utf8"));
}

function feedForTopic(config: IngestConfig, topic: string): RdmStreamingFeed {
  if (topic === config.kafka.topics[RDM_REALTIME_FEED_NAME]) return RDM_REALTIME_FEED_NAME;
  if (topic === config.kafka.topics[RDM_TRAIN_MOVEMENTS_FEED_NAME]) {
    return RDM_TRAIN_MOVEMENTS_FEED_NAME;
  }
  throw new Error(`Unexpected Kafka topic ${topic}`);
}

function readConfig(env: NodeJS.ProcessEnv): IngestConfig {
  return {
    kafka: {
      brokers: csvEnv(env, "RDM_KAFKA_BOOTSTRAP_SERVERS"),
      clientId: optionalEnv(env, "RDM_KAFKA_CLIENT_ID", DEFAULT_CLIENT_ID),
      groupId: readKafkaGroupId(env),
      ssl: readKafkaSsl(env),
      sasl: readKafkaSasl(env),
      topics: {
        [RDM_REALTIME_FEED_NAME]: requiredEnv(env, "RDM_REALTIME_KAFKA_TOPIC"),
        [RDM_TRAIN_MOVEMENTS_FEED_NAME]: requiredEnv(env, "RDM_TRAIN_MOVEMENTS_KAFKA_TOPIC"),
      },
    },
    queue: readQueueConfig(env),
  };
}

function readKafkaSasl(env: NodeJS.ProcessEnv): SASLOptions {
  const mechanism = optionalEnv(env, "RDM_KAFKA_SASL_MECHANISM", "plain").toLowerCase();
  if (mechanism !== "plain" && mechanism !== "scram-sha-256" && mechanism !== "scram-sha-512") {
    throw new Error("RDM_KAFKA_SASL_MECHANISM must be plain, scram-sha-256, or scram-sha-512");
  }

  return {
    mechanism,
    username: requiredEnv(env, "RDM_KAFKA_USERNAME"),
    password: requiredEnv(env, "RDM_KAFKA_PASSWORD"),
  };
}

function readKafkaGroupId(env: NodeJS.ProcessEnv): string {
  return env.RDM_KAFKA_GROUP_ID?.trim() || env.RDM_KAFKA_USER_GROUP?.trim() || DEFAULT_GROUP_ID;
}

function readKafkaSsl(env: NodeJS.ProcessEnv): boolean {
  const protocol = env.RDM_KAFKA_SECURITY_PROTOCOL?.trim().toUpperCase();
  if (protocol === "SASL_SSL") return true;
  if (protocol === "SASL_PLAINTEXT") return false;
  return booleanEnv(env, "RDM_KAFKA_SSL", true);
}

function readQueueConfig(env: NodeJS.ProcessEnv): IngestConfig["queue"] {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const queueId = env.CLOUDFLARE_RAIL_EVENTS_QUEUE_ID?.trim() || env.CLOUDFLARE_QUEUE_ID?.trim();
  const apiToken = env.CLOUDFLARE_API_TOKEN?.trim();

  if (!accountId || !queueId || !apiToken) return null;

  return {
    accountId,
    queueId,
    apiToken,
    sendTimeoutMs: positiveIntegerValue(
      env.RDM_INGEST_QUEUE_SEND_TIMEOUT_MS,
      DEFAULT_QUEUE_SEND_TIMEOUT_MS,
    ),
  };
}

async function shutdown(): Promise<void> {
  await consumer.disconnect();
  process.exit(0);
}
