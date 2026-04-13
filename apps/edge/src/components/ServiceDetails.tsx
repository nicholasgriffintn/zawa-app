import type { ServiceResponse, StationBoardResponse } from "@zawa/domain/api";

import type { ServiceDetailsState } from "../hooks/useServiceDetails";
import type { BoardType } from "../lib/api";
import { boardStatusTone, formatBoardStatus, formatServiceCode, formatTime } from "../lib/format";
import {
  boardServiceHeadline,
  firstFormationLoading,
  formationClassSummary,
  formationCoachDetails,
  formationCoachCount,
  formationCoachLabel,
  isServiceRouteStopCancelled,
  movementEvidenceDetails,
  routeStopDetails,
  serviceDisruptionNotice,
  serviceFacts,
  serviceHeadline,
  serviceMode,
  serviceModeIcon,
  serviceModeLabel,
  serviceModeNoun,
  serviceRouteStopState,
  serviceRouteTiming,
  serviceStats,
  serviceTypeLabel,
  stationProfileFacts,
  shouldShowTrainFormation,
  usefulStationProfiles,
  type ServiceMode,
  type ServiceFact,
  type ServiceStat,
} from "../lib/service-detail-view-model";
import { serviceTravelAlerts } from "../lib/travel-alerts";
import { DetailState } from "./DetailState";
import { Icon, type IconName } from "./Icon";
import { StatusBadge } from "./StatusBadge";
import { TravelAlertButton } from "./TravelAlerts";

import "./DetailPanel.scss";
import "./ServiceDetails.scss";

type BoardRow = StationBoardResponse["rows"][number];
type Service = ServiceResponse["service"];
type ServiceStop = ServiceResponse["stops"][number];
type StationProfile = ServiceResponse["stationProfiles"][number];
type ServiceSummary = ServiceResponse["summary"] | null;

export function ServiceTags({
  operatorCode,
  serviceKey,
  serviceType,
}: {
  operatorCode: string | null | undefined;
  serviceKey: string;
  serviceType?: string | null;
}) {
  const mode = serviceMode({ service_type: serviceType });
  const typeLabel = serviceTypeLabel(serviceType);

  return (
    <div className="service-tags">
      <span>{operatorCode ?? "Service"}</span>
      {typeLabel ? <span>{typeLabel}</span> : null}
      <span>{formatServiceCode(serviceKey)}</span>
    </div>
  );
}

export function ServiceHero({
  time,
  timeLabel,
  platform,
  status,
  statusLabel,
  tone,
}: {
  time: string | null | undefined;
  timeLabel: string;
  platform?: string | null;
  status: string;
  statusLabel: string | null;
  tone: "good" | "warn" | "bad" | "neutral";
}) {
  return (
    <div className={platform ? "service-hero" : "service-hero service-hero-no-platform"}>
      <div>
        <strong>{formatTime(time)}</strong>
        <span>{timeLabel}</span>
      </div>
      {platform ? (
        <div>
          <strong>{platform}</strong>
          <span>Platform</span>
        </div>
      ) : null}
      <StatusBadge label={statusLabel ?? undefined} status={status} tone={tone} />
    </div>
  );
}

export function BoardServiceDetail({
  stationName,
  nextTrain,
  boardStatus,
  boardTone,
  boardType,
  nextService,
}: {
  stationName: string;
  nextTrain: BoardRow;
  boardStatus: string | null;
  boardTone: "good" | "warn" | "bad" | "neutral";
  boardType: BoardType;
  nextService: ServiceDetailsState;
}) {
  const headline = boardServiceHeadline(stationName, nextTrain, boardType);
  const facts = serviceFacts({ service: nextService.service });
  const alerts = serviceTravelAlerts(nextService.incidents);
  const mode = serviceMode(nextService.service);
  const notice = serviceDisruptionNotice(
    nextService.service,
    nextService.stops,
    nextService.summary,
  );

  return (
    <>
      <ServiceTags
        operatorCode={nextTrain.operator_code}
        serviceKey={nextTrain.service_key}
        serviceType={nextService.service?.service_type}
      />
      <ServiceHero
        time={nextTrain.expected_ts ?? nextTrain.scheduled_ts}
        timeLabel={boardStatus === "On time" ? "Departs on time" : (boardStatus ?? "Service time")}
        platform={nextTrain.platform}
        status={nextTrain.status}
        statusLabel={boardStatus}
        tone={boardTone}
      />
      <h2>{headline}</h2>
      {nextTrain.via_name ? <p className="muted">via {nextTrain.via_name}</p> : null}
      <ServiceDisruptionNotice notice={notice} />
      <ServiceStatGrid stats={serviceStats(nextService.summary, nextService.service, nextTrain)} />
      <ServiceFormationSummary formations={nextService.formations} mode={mode} compact />
      <TravelAlertButton alerts={alerts} />
      <ServiceRouteSummary
        loading={nextService.loading}
        error={nextService.error}
        stops={nextService.stops}
        fallbackStatus={nextService.service?.status ?? nextTrain.status}
        mode={mode}
      />
      <ServiceFacts facts={facts} />
    </>
  );
}

export function FullServiceDetail({
  service,
  stops,
  summary,
  formations,
  movements,
  stationProfiles,
}: {
  service: Service;
  stops: ServiceResponse["stops"];
  summary: ServiceSummary;
  formations: ServiceResponse["formations"];
  movements: ServiceResponse["movements"];
  stationProfiles: ServiceResponse["stationProfiles"];
}) {
  const routeTiming = serviceRouteTiming(stops, service);
  const notice = serviceDisruptionNotice(service, stops, summary);
  const mode = serviceMode(service);

  return (
    <>
      <section className="service-page-hero">
        <ServiceTags
          operatorCode={service.operator_code}
          serviceKey={service.service_key}
          serviceType={service.service_type}
        />
        <div className="service-page-heading">
          <div>
            <p className="section-label">
              {serviceTypeLabel(service.service_type) ?? serviceModeLabel(mode)} service
            </p>
            <h1>{serviceHeadline(service.origin_name, service.destination_name)}</h1>
            {routeTiming ? <p className="muted">{routeTiming}</p> : null}
          </div>
        </div>
        <ServiceDisruptionNotice notice={notice} />
      </section>

      <ServiceRouteSummary stops={stops} fallbackStatus={service.status} mode={mode} expanded />
      <ServiceFormationDetail formations={formations} mode={mode} />
      <ServiceMovementEvidence movements={movements} mode={mode} />

      <StationContext profiles={stationProfiles} />
    </>
  );
}

export function ServiceDetailSidebar({
  service,
  summary,
  formations,
  incidents,
  connected,
  lastUpdatedAt,
}: {
  service: Service;
  summary: ServiceSummary;
  formations: ServiceResponse["formations"];
  incidents: ServiceResponse["incidents"];
  connected: boolean;
  lastUpdatedAt: string | null;
}) {
  const statusLabel = formatBoardStatus({
    expected: service.expected_start_ts,
    scheduled: service.scheduled_start_ts,
    status: service.status,
  });
  const tone = boardStatusTone({
    expected: service.expected_start_ts,
    scheduled: service.scheduled_start_ts,
    status: service.status,
  });
  const facts = serviceFacts({
    service,
    connected,
    lastUpdatedAt,
  });
  const alerts = serviceTravelAlerts(incidents);
  const mode = serviceMode(service);

  return (
    <div className="service-sidebar-content">
      <ServiceTags
        operatorCode={service.operator_code}
        serviceKey={service.service_key}
        serviceType={service.service_type}
      />
      <section className="service-sidebar-status">
        <div>
          <p className="overview-title">Current status</p>
          <strong>{formatTime(service.expected_start_ts ?? service.scheduled_start_ts)}</strong>
          <span>
            {statusLabel === "On time" ? `${serviceModeLabel(mode)} runs on time` : statusLabel}
          </span>
        </div>
        <StatusBadge label={statusLabel} status={service.status} tone={tone} />
      </section>
      <ServiceStatGrid stats={serviceStats(summary, service)} />
      <TravelAlertButton alerts={alerts} />
      <ServiceFormationSummary formations={formations} mode={mode} />
      <ServiceFacts facts={facts} />
    </div>
  );
}

export function ServiceRouteSummary({
  loading = false,
  error = null,
  stops,
  fallbackStatus,
  mode = "service",
  expanded = false,
}: {
  loading?: boolean;
  error?: string | null;
  stops: ServiceResponse["stops"];
  fallbackStatus: string;
  mode?: ServiceMode;
  expanded?: boolean;
}) {
  if (!loading && !error && stops.length === 0) return null;

  return (
    <section className={expanded ? "route-summary route-summary-expanded" : "route-summary"}>
      <p className="overview-title">{serviceModeLabel(mode)} route</p>
      {loading ? (
        <DetailState icon="clock" title={`Loading ${serviceModeNoun(mode)} route`} />
      ) : error ? (
        <DetailState icon="alert-circle" title="Unable to load route" body={error} />
      ) : (
        <ol>
          {stops.map((stop, index) => (
            <ServiceRouteStop
              key={`${stop.service_key}-${stop.stop_index}`}
              stop={stop}
              nextStop={stops[index + 1] ?? null}
              fallbackStatus={fallbackStatus}
              mode={mode}
              expanded={expanded}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

export function ServiceFacts({
  facts,
  className,
}: {
  facts: Array<{ label: string; value: string; icon: IconName; tone?: "good" | "warn" }>;
  className?: string;
}) {
  if (facts.length === 0) return null;

  return (
    <section className={["about-service", className].filter(Boolean).join(" ")}>
      <p className="overview-title">Service metadata</p>
      <dl>
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt>
              <Icon name={fact.icon} />
              {fact.label}
            </dt>
            <dd className={fact.tone ? `signal ${fact.tone}` : undefined}>{fact.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ServiceDisruptionNotice({
  notice,
}: {
  notice: ReturnType<typeof serviceDisruptionNotice>;
}) {
  if (!notice) return null;

  return (
    <section className={`service-disruption-notice ${notice.tone}`}>
      <Icon name="alert-circle" />
      <div>
        <p>{notice.title}</p>
        <strong>{notice.body}</strong>
      </div>
    </section>
  );
}

function ServiceStatGrid({
  stats,
}: {
  stats: Array<{ label: string; value: string; icon: IconName }>;
}) {
  if (stats.length === 0) return null;

  return (
    <dl className="service-stat-grid">
      {stats.map((stat) => (
        <div key={stat.label}>
          <dt>
            <Icon name={stat.icon} />
            {stat.label}
          </dt>
          <dd>{stat.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ServiceRouteStop({
  stop,
  nextStop,
  fallbackStatus,
  mode,
  expanded,
}: {
  stop: ServiceStop;
  nextStop: ServiceStop | null;
  fallbackStatus: string;
  mode: ServiceMode;
  expanded: boolean;
}) {
  const scheduled = stop.scheduled_departure_ts ?? stop.scheduled_arrival_ts;
  const expected =
    stop.actual_departure_ts ??
    stop.actual_arrival_ts ??
    stop.expected_departure_ts ??
    stop.expected_arrival_ts;
  const status = stop.stop_status ?? fallbackStatus;
  const stopTone = boardStatusTone({ expected, scheduled, status });
  const stopLabel = formatBoardStatus({ expected, scheduled, status });
  const details = routeStopDetails(stop, mode);
  const stopState = serviceRouteStopState(stop);
  const stopCancelled = isServiceRouteStopCancelled(stop);
  const nextStopCancelled = nextStop ? isServiceRouteStopCancelled(nextStop) : false;
  const segmentCancelled = stopCancelled || nextStopCancelled;
  const routeStopClasses = [
    stopState === "passed" ? "route-stop-passed" : null,
    stopCancelled ? "route-stop-cancelled" : null,
    segmentCancelled ? "route-segment-cancelled" : null,
  ].filter(Boolean);

  return (
    <li className={routeStopClasses.length ? routeStopClasses.join(" ") : undefined}>
      <span aria-hidden="true" />
      <time>{formatTime(expected ?? scheduled)}</time>
      <div>
        <strong>{stop.station_name ?? stop.station_key}</strong>
        {details.length ? <small>{details.join(" · ")}</small> : null}
      </div>
      <StatusBadge label={expanded ? stopLabel : stopLabel} status={status} tone={stopTone} />
    </li>
  );
}

function StationContext({ profiles }: { profiles: StationProfile[] }) {
  const usefulProfiles = usefulStationProfiles(profiles);
  if (usefulProfiles.length === 0) return null;

  return (
    <section className="station-context service-page-section">
      <p className="overview-title">Stations on this service</p>
      <div className="station-context-grid">
        {usefulProfiles.map((profile) => (
          <article key={profile.station_key} className="station-context-card">
            <div>
              <Icon name="map-pin" />
              <strong>{profile.station_name}</strong>
              <span>{profile.station_key}</span>
            </div>
            <dl>
              {stationProfileFacts(profile).map((fact) => (
                <div key={fact.label}>
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}

function ServiceFormationSummary({
  formations,
  mode,
  compact = false,
}: {
  formations: ServiceResponse["formations"];
  mode: ServiceMode;
  compact?: boolean;
}) {
  if (!shouldShowTrainFormation(formations, mode)) return null;

  const coachCount = formationCoachCount(formations);
  const loading = firstFormationLoading(formations);
  const classes = formationClassSummary(formations);

  return (
    <section
      className={compact ? "formation-summary formation-summary-compact" : "formation-summary"}
    >
      <p className="overview-title">Train formation</p>
      <div>
        <Icon name={serviceModeIcon(mode)} />
        <strong>{coachCount} coaches</strong>
        <span>{[classes, loading].filter(Boolean).join(" · ")}</span>
      </div>
    </section>
  );
}

function ServiceFormationDetail({
  formations,
  mode,
}: {
  formations: ServiceResponse["formations"];
  mode: ServiceMode;
}) {
  if (!shouldShowTrainFormation(formations, mode)) return null;

  return (
    <section className="service-page-section formation-detail">
      <p className="overview-title">Coach details</p>
      {formations.map((formation) => (
        <div
          key={`${formation.service_key}-${formation.formation_index}`}
          className="formation-row"
        >
          <div className="formation-row-heading">
            <strong>{formation.tiploc ? `At ${formation.tiploc}` : "Service formation"}</strong>
            <span>{firstFormationLoading([formation])}</span>
          </div>
          <ol>
            {formation.coaches.map((coach) => (
              <li key={`${coach.formation_index}-${coach.coach_index}`}>
                <strong>{formationCoachLabel(coach)}</strong>
                <span>{formationCoachDetails(coach)}</span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </section>
  );
}

function ServiceMovementEvidence({
  movements,
  mode,
}: {
  movements: ServiceResponse["movements"];
  mode: ServiceMode;
}) {
  if (movements.length === 0) return null;

  return (
    <section className="service-page-section movement-evidence">
      <p className="overview-title">Reported {serviceModeNoun(mode)} movements</p>
      <ol>
        {movements.slice(-8).map((movement) => (
          <li key={`${movement.train_run_key}-${movement.movement_index}`}>
            <time>{formatTime(movement.actual_ts ?? movement.gbtt_ts ?? movement.planned_ts)}</time>
            <div>
              <strong>{movement.event_type ?? movement.planned_event_type ?? "Movement"}</strong>
              <small>{movementEvidenceDetails(movement).join(" · ")}</small>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
