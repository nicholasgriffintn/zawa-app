import { getDashboardSummary } from "@zawa/db/queries/dashboard";
import { htmlToPlainText } from "@zawa/shared/html";
import { nowIso } from "@zawa/shared/time";

import { currentBoardSince } from "../lib/board-window";
import { withDashboardOntology } from "../lib/ontology";

export interface DashboardRoutesEnv {
  DB: D1Database;
}

export async function handleDashboardRoutes(
  request: Request,
  env: DashboardRoutesEnv,
): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname !== "/api/dashboard")
    return Response.json({ error: "Not found" }, { status: 404 });
  if (request.method !== "GET") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const generatedAt = nowIso();
  const summary = await getDashboardSummary(env.DB, generatedAt, currentBoardSince(generatedAt));

  return Response.json(
    await withDashboardOntology(env.DB, {
      generatedAt,
      ...summary,
      incidents: summary.incidents.map((incident) => ({
        incident_id: incident.incident_id,
        priority: incident.priority,
        summary: incident.summary,
        description: htmlToPlainText(incident.description_html),
        start_at: incident.start_at,
        end_at: incident.end_at,
        routes_affected: htmlToPlainText(incident.routes_affected_html),
        info_link_url: incident.info_link_url,
        info_link_label: incident.info_link_label,
        updated_at: incident.updated_at,
        operator_names: incident.operator_names,
      })),
    }),
  );
}
