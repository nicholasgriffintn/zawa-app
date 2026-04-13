# Rail Data Marketplace Sources

Zawa uses Rail Data Marketplace products as the source of live rail data. The checked-in docs under this directory are the implementation contract for the RDM clients.

## Implemented Sources

| Product                                                                                | Docs checked                                      | Owner                                                                            | Storage / queue target                                                                                        | Cadence                                                          |
| -------------------------------------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Live Arrival and Departure Boards `P-2eec03eb-4d53-4955-8a96-0314964a4e9e`             | `Live Arrival and Departure Boards/*`             | `apps/projector` for queued refreshes, `apps/edge` for request-driven live reads | `station_board_entries`, `service_journeys`, `rail-events`                                                    | Per station cursor from `apps/rdm-sync`; direct user board reads |
| Service Details `P-4dec1247-d040-4290-80a4-639dfac54a92`                               | `Service Details/*`                               | `apps/edge`                                                                      | `service_journeys`, `service_call_points` through projection events                                           | Request-driven from board/service selection                      |
| Query Services and Service Details `P-9a4b5235-d06a-483d-b12f-7d0d95b06b18`            | `Query Services and Service Details/*`            | `apps/edge`                                                                      | Service lookup surface; no broad polling                                                                      | Request-driven                                                   |
| Reference Data `P-c73f0d2a-c233-497d-846b-8354e2cac326`                                | `Reference Data/*`                                | `apps/rdm-sync`                                                                  | `station_profiles`, `operators`, `reason_codes`, `loading_categories`, `source_instances`                     | Daily version check; unversioned lists refreshed daily           |
| Knowledgebase Stations data feed `P-88ffe920-471c-4fd9-8e0d-95d5b9b7a257`              | `Knowledgebase Stations data feed/*`              | `apps/rdm-sync`                                                                  | Structured `station_profiles` address, operator, facility, accessibility, parking, and profile status columns | Hourly cursor-batched from stored station references             |
| Disruption List `P-fffd1a4b-9fee-4d07-8102-efa8ce848d81`                               | `Disruption List/*`                               | `apps/rdm-sync`                                                                  | `station_disruptions`                                                                                         | 15-minute cursor-batched CRS lists                               |
| Knowledgebase National Service Indicator data `P-7a5989cb-4600-4727-9ab0-baa7e483a0f2` | `Knowledgebase National Service Indicator data/*` | `apps/rdm-sync`                                                                  | `operator_statuses`, `operator_disruptions`                                                                   | Every scheduled sync run                                         |
| Knowledgebase Incidents data `P-cf16832d-d971-46e7-8883-4fca2101d3fa`                  | `Knowledgebase Incidents data/*`                  | `apps/rdm-sync`                                                                  | `network_incidents`, `network_incident_operators`                                                             | Every scheduled sync run                                         |
| Darwin Real Time Train Information `P-d3bf124c-1058-4040-8a62-87181a877d59`            | `Darwin Real Time Train Information/*`            | `apps/rdm-ingest` Kafka consumer, projection in `apps/projector`                 | `rail-events`, `source_events`, service/stop/board projections where identifiers are usable                   | Kafka stream                                                     |
| NWR Train Movements `P-826477b8-3789-45e7-85bd-22c4ae9bcfae`                           | `NWR Train Movements/*`                           | `apps/rdm-ingest` Kafka consumer, projection in `apps/projector`                 | `rail-events`, `source_events`, service location projections                                                  | Kafka stream                                                     |

## Worker Boundaries

- `apps/rdm-sync` handles scheduled API ingestion and queueing. It stores sync cursors in `source_sync_runs`.
- `apps/rdm-ingest` handles RDM Kafka stream consumption and publishes normalised events to `rail-events` through the Cloudflare Queues HTTP API.
- `apps/projector` handles queued event processing. It owns LDB board refresh requests because queue retries belong around the API call plus projection write. It records raw streaming payloads in `source_events` before projection.
- `apps/edge` handles public request/response APIs, WebSockets, and static UI.

## Streaming Migration Plan

The RDM Kafka consumer must stay outside `apps/edge`. Edge workers handle reads, request-driven API calls, and UI delivery; they must not own long-running Kafka connections or product-specific stream parsing.

The current `apps/rdm-ingest` service is the local and transitional runtime for Kafka ingestion. The likely production runtime is AWS, where the service can run as a long-lived consumer with stable networking, secret management, consumer-group ownership, and operational alerts. Keep the queue/projector boundary while Cloudflare D1 remains the projection store.

Kafka should become the primary freshness path for operational state. The end state is:

- Kafka stream consumers populate current service, movement, berth, schedule-delta, consist, and performance projections.
- The 5-minute scheduled jobs stop refreshing data that has an equivalent streaming source.
- The frontend reads projected state from the edge API. Remove frontend-owned realtime refresh paths once Kafka-backed projections and edge cache invalidation cover the same user-visible updates.
- `apps/rdm-sync` remains for reference files, slow-changing station/profile data, and products without a streaming equivalent.

## RDM Catalogue Search

On 2026-06-15, the active Network Rail product search for `bpid=1033` returned 49 products over five pages using `size: 12`. Streaming products in that result set are the Kafka products to fold into `apps/rdm-ingest`.

Query used:

```json
{
  "from": 0,
  "size": 12,
  "query": {
    "bool": {
      "filter": [
        { "term": { "state.keyword": { "value": "active" } } },
        { "term": { "isProduct.keyword": { "value": "true" } } },
        { "term": { "bpid.keyword": { "value": "1033" } } }
      ],
      "must": []
    }
  },
  "sort": [{ "publishedAt": { "order": "DESC" } }]
}
```

## Next Streaming Products To Wire

These products came from the paginated RDM catalogue search above. They should be added in priority order, because they reduce the current reliance on poll snapshots and frontend refresh behaviour.

| Priority | Product                                                                                   | Why next                                                                                                                        | First projection target                                                                          |
| -------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 1        | NWR Train Describer (TD) `P-8d5f90a7-2fce-4179-b233-0dd272cee896`                         | Adds signalling berth-level train position. This is the main missing realtime source after TRUST train movements.               | Berth occupation/current train position, joined through SMART and location reference data.       |
| 2        | NWR Very Short-Term Planning (VSTP) `P-3cc7c8b3-a311-406b-85ed-8032c60f1b29`              | Adds late-notice schedules that are not available through the base schedule feed. This should reduce stale service assumptions. | Schedule delta events, service identity joins, and journey creation/update projections.          |
| 3        | NWR Passenger Train Allocation and Consist `P-3a2ccb58-e1f9-416b-a40e-0614d0269ecf`       | Adds planned unit and vehicle consist data from Gemini. This can replace request-driven formation gaps where identifiers match. | `service_formations_current`, `service_coaches_current`, and vehicle/unit reference projections. |
| 4        | NWR Real Time Public Performance Measure (RTPPM) `P-8c086887-c4bc-4608-83e2-76c5c4d728ad` | Adds minute-level network performance status. This is useful for dashboard and network context, but not core board correctness. | Operator/route/network performance snapshots and dashboard aggregates.                           |
| 5        | NWR Temporary Speed Restrictions (TSR) `P-f3ff2c0c-5803-410b-a5e2-a3f8c6704228`           | Adds weekly infrastructure restrictions. It is streaming, but lower priority because it is not a high-frequency passenger feed. | Infrastructure restriction snapshots linked to route/location reference data.                    |

Before wiring Train Describer, ingest `NWR SMART` `P-883f25d9-9483-4d26-9975-81203795243f` as reference data. SMART is not realtime, but it maps train-describer berths to locations and is required to turn berth-level events into useful passenger/service state.

## Database Notes

Reference and operational datasets are separate typed projections over the linked rail knowledge graph. See [Database Structure](../database-structure.md) for the table groups, graph conventions, and pipeline responsibilities.

Structured reference and current-state tables store extracted columns rather than raw source payload blobs. `source_events.payload_json` is retained only for inbound realtime payload capture and replay. UI code must not inject RDM HTML fragments directly; render them only after sanitisation.

## Deferred Products

These are documented as useful but are not wired until their product specs and access patterns are present in this repo:

| Product                                                                                           | Why deferred                                                                                                     |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Darwin Timetable Files `P-9ca6bc7e-62e1-44d6-b93a-1616f7d2caf8`                                   | No checked-in timetable file spec/sample parser yet. Needed for full schedule seeding and TIPLOC/STANOX mapping. |
| NationalRail Knowledgebase Stations JSON production feed `P-9c97bd03-e2f2-462d-860a-5bec92700c2d` | Current docs contain XML station samples, not the JSON feed contract.                                            |
| Darwin Real Time Train Information Push `P-3f10bf96-d8e8-4041-aa5e-d75d82c45c4e`                  | Keep until RDM confirms whether it replaces or complements the existing realtime delivery product.               |
| NWR SMART `P-883f25d9-9483-4d26-9975-81203795243f`                                                | Required reference input for Train Describer before berth events can become useful passenger state.              |
| NWR Schedule `P-dbd92416-2f09-4f72-ad42-d53bbfec50f3`                                             | Consider after Darwin timetable ingestion is in place.                                                           |
| HSP and historical performance files                                                              | Useful for analytics, but not part of the live Kafka replacement path.                                           |

## Runtime Configuration

Non-secret endpoint templates live in worker `wrangler.json` files. Credentials must be `.dev.vars` locally or Worker secrets remotely.

`apps/rdm-sync` needs reference, station XML, disruption, NSI, and incident credentials.

`apps/projector` needs the LDB board credential because it processes queued board refresh requests.

`apps/edge` needs credentials for request-driven board/service APIs.

`apps/rdm-ingest` needs RDM Kafka broker credentials and a Cloudflare API token with `Queues Edit` permission for publishing to `rail-events`.
