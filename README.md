# Zawa

Zawa is a Cloudflare Workers platform for live train information. It ingests Rail Data Marketplace products into D1 projections, serves station-board and service APIs from the edge worker, and broadcasts current-state updates through Durable Objects.

## Apps

- `apps/edge`: public HTTP APIs, WebSockets, Durable Objects, and the React UI.
- `apps/rdm-ingest`: Kafka consumer for RDM realtime and train-movement products.
- `apps/rdm-sync`: scheduled RDM API ingestion for reference data, station profiles, NSI, incidents, station disruptions, and station-board refresh jobs.
- `apps/projector`: queue consumer that projects RDM events and station-board refresh jobs into D1 and WebSocket broadcasts.

## Packages

- `packages/domain`: event contracts, API schemas, keys, RDM product catalogue.
- `packages/db`: D1 migrations and query helpers.
- `packages/rdm`: RDM HTTP, JSON, XML, LDB, reference, and projection-event clients.
- `packages/realtime`: realtime message contracts.
- `packages/shared`: common parsing, time, hash, and value helpers.

## Data Flow

Zawa uses an ontology structure to specify what exists across the system and the relationships between those things. More can be found in `./docs/database-structure.md` and in the `@zawa/ontology` package.

`apps/rdm-sync` owns scheduled API ingestion. It version-checks RDM reference data daily, advances station profile and disruption cursors on separate schedules, and keeps the 5-minute operational run focused on operator status, incidents, and station-board refresh jobs. It does not fetch the whole station catalogue on every run.

`apps/rdm-ingest` consumes the RDM Kafka topics for Darwin realtime and NWR Train Movements, normalises payloads into `RailEvent`s, and publishes them to the Cloudflare `rail-events` queue.

`apps/projector` consumes `rail-events`. For station-board refresh requests, it calls the LDB board API, projects `station_board_entries` and `service_journeys`, and broadcasts patches. For RDM realtime and train-movement ingress, it records raw source events and projects service and stop state when the payload contains enough identifiers.

`apps/edge` serves UI/API reads from D1 projections and only calls RDM directly for request-driven station board/service endpoints that are intentionally live.

## API Surface

- `GET /health/live`: edge liveness.
- `GET /health`: RDM ingestion freshness and configuration health.
- `GET /api/stations?q=PAD`: station discovery from `station_profiles`.
- `GET /api/stations/:stationKey/departures`: live departures board.
- `GET /api/stations/:stationKey/arrivals`: live arrivals board.
- `GET /api/services/:serviceKey`: service detail and stop timeline.
- `GET /api/dashboard`: current passenger-facing overview.
- `GET /api/ontologies`: ontology catalogue, classes, properties, constraints, and counts.
- `GET /api/ontologies/things/:thingId`: linked graph for one canonical thing.
- `GET /ws/stations/:stationKey?boardType=departures`: station board WebSocket stream.
- `GET /ws/services/:serviceKey`: service WebSocket stream.

Domain API responses include an `ontology` envelope with `rootThingIds`, `things`, and `triples`. WebSocket snapshots carry the same envelope, while patch/remove messages carry `rootThingIds` that link the delta back to canonical things.

## Rail Data Marketplace

RDM products, endpoint templates, samples, and remaining future candidates are documented in [Rail Data Marketplace Sources](docs/rail-data-marketplace/index.md).

The current ingestion model uses:

- Reference Data for stations, TOCs, reason codes, loading categories, and source instance names.
- Knowledgebase Stations XML for station profile enrichment.
- Knowledgebase National Service Indicator XML for operator status.
- Knowledgebase Incidents XML for incident state.
- Disruption List for station disruption state.
- Live Arrival and Departure Boards for station-board snapshots.
- Service Details and Query Services for service detail lookups.
- Darwin Real Time Train Information and NWR Train Movements through `apps/rdm-ingest`.

## Configuration

Set secrets in `.dev.vars` for local work and Worker secrets for deployed environments. Do not commit credentials.

`apps/edge` needs:

- `RDM_LDB_API_KEY`
- `RDM_SERVICE_DETAILS_API_KEY`
- `RDM_QUERY_SERVICES_API_KEY`
- `RDM_REFERENCE_DATA_API_KEY`
- `RDM_STATIONS_API_KEY`
- `RDM_DISRUPTIONS_API_KEY`
- `RDM_NSI_API_KEY`
- `RDM_INCIDENTS_API_KEY`

`apps/rdm-sync` needs:

- `RDM_REFERENCE_DATA_API_KEY`
- `RDM_STATIONS_API_KEY`
- `RDM_DISRUPTIONS_API_KEY`
- `RDM_NSI_API_KEY`
- `RDM_INCIDENTS_API_KEY`

`apps/projector` needs:

- `RDM_LDB_API_KEY`

`apps/rdm-ingest` needs:

- `RDM_KAFKA_BOOTSTRAP_SERVERS`
- `RDM_REALTIME_KAFKA_TOPIC`
- `RDM_TRAIN_MOVEMENTS_KAFKA_TOPIC`
- `RDM_KAFKA_USERNAME`
- `RDM_KAFKA_PASSWORD`
- `RDM_KAFKA_USER_GROUP` or `RDM_KAFKA_GROUP_ID`

To publish normalised events, `apps/rdm-ingest` also needs:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_RAIL_EVENTS_QUEUE_ID` or `CLOUDFLARE_QUEUE_ID`
- `CLOUDFLARE_API_TOKEN` with `Queues Edit` permission

Non-secret endpoint templates and product codes live in each worker `wrangler.json`.

## Local Workflow

Apply migrations:

```bash
pnpm db:migrate:local
```

Validate:

```bash
pnpm -r check
pnpm -r build
```

Run workers:

```bash
pnpm dev:edge
pnpm dev:rdm-ingest
pnpm dev:rdm-sync
pnpm dev:projector
```

## Local E2E Data Pipeline Check

Run this after changes to `apps/rdm-sync`, `apps/projector`, `apps/rdm-ingest`, D1 migrations, or high-volume query helpers. Use the repo-level commands so the Workers share the checked-in local state at `.wrangler/state`.

Apply migrations first:

```bash
pnpm db:migrate:local
```

Start the all-three Worker session:

```bash
pnpm dev:e2e:workers
```

This starts `apps/rdm-sync`, `apps/projector`, and `apps/edge` in one Wrangler process. `rdm-sync` is the primary Worker so the scheduled endpoint is exposed on port `8789`; `projector` shares the same local Queue consumer; `edge` shares the same local D1 state.

For realtime Kafka ingestion, start the Kafka service in a separate terminal:

```bash
pnpm dev:e2e:rdm-ingest
```

This reads `apps/rdm-ingest/.dev.vars` and consumes the configured RDM Kafka topics. If Cloudflare queue settings are present it publishes normalised events to that queue; otherwise it runs consume/normalise-only and logs `skippedPublish` counts. Use queue publishing only when the queue target is the environment you are verifying; the local Wrangler queue is still owned by the Worker session above.

Use `apps/rdm-ingest/.dev.vars.example` as the key list. Kafka settings are required to run the service. Cloudflare queue settings are optional and only required when verifying projector/D1 writes from live stream events.

In another terminal, populate reference data through the real scheduled sync:

```bash
pnpm e2e:trigger:scheduled
```

Wait for `rdm.sync.job.complete` for these jobs:

- `reference-data`
- `station-profiles`
- `operator-statuses`
- `network-incidents`
- `station-disruptions`
- `station-board-refresh`
- `ontology-quality`

Also wait for `rdm.station_boards.queued` from `rdm-sync` and `projector.batch` from `projector`.

Service detail projection is request-driven, not scheduled. Stop `pnpm dev:e2e:workers`, then start the edge-primary all-three session:

```bash
pnpm dev
```

This exposes edge on port `8787` while keeping `projector` on the shared local Queue and D1 state. Trigger one real service detail request from a recent board row:

```bash
pnpm e2e:trigger:service-detail
```

Then verify D1:

```bash
pnpm e2e:verify:local
```

Expected signs of a good run:

- Reference tables contain `station_profiles`, `operators`, and enriched station profile rows.
- Operational sync states exist for operator statuses, incidents, and station disruptions.
- `station_board_refreshes.last_refreshed_at`, `station_board_entries`, and `service_journeys` have rows.
- `service_call_points`, `service_formations`, and `service_coaches` have rows after the service detail trigger.
- Ontology tables have `things`, `ontology_triples`, and `ontology_quality_runs`.

`network_incidents` and `station_disruptions` may be empty when the upstream feed has no active data, but their `source_sync_runs` rows must still show a completed status.

Do not post handcrafted realtime or train-movement payloads to satisfy this check. `source_events`, `station_messages`, and `train_movements` only count as verified when `apps/rdm-ingest` consumes real Kafka messages and the projector writes them.

To require streaming rows in the local verifier, run:

```bash
pnpm e2e:verify:local:streaming
```

Use the default verifier when checking only the scheduled/request-driven local pipeline:

```bash
pnpm e2e:verify:local
```

To check the edge read surface against the same local state, keep `pnpm dev` running and request:

```bash
curl -fsS "http://localhost:8787/api/dashboard"
curl -fsS "http://localhost:8787/api/stations?q=AAP"
```

If you need to rerun one scheduled phase, use the repo-level trigger commands:

```bash
pnpm e2e:trigger:reference
pnpm e2e:trigger:station-profiles
pnpm e2e:trigger:operator-statuses
pnpm e2e:trigger:incidents
pnpm e2e:trigger:station-disruptions
pnpm e2e:trigger:boards
pnpm e2e:trigger:ontology-quality
pnpm e2e:trigger:service-detail
```

Do not seed station rows manually for this check. If reference ingestion cannot populate stations, treat that as the failure to investigate.
