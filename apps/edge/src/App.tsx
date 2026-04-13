import { StationPage } from "./pages/StationPage";
import { ServicePage } from "./pages/ServicePage";
import { HomePage } from "./pages/HomePage";
import { OntologyPage } from "./pages/OntologyPage";
import { normaliseAppPathname } from "./lib/app-routes";

export function App() {
  const path = normaliseAppPathname(window.location.pathname);
  const stationMatch = path.match(/^\/stations\/([^/]+)$/);
  const serviceMatch = path.match(/^\/services\/([^/]+)$/);
  const ontologyClassMatch = path.match(/^\/ontologies\/classes\/(.+)$/);
  const ontologyPropertyMatch = path.match(/^\/ontologies\/properties\/(.+)$/);
  const ontologyThingMatch = path.match(/^\/ontologies\/things\/(.+)$/);

  if (path === "/ontologies") {
    return <OntologyPage />;
  }
  if (path === "/ontologies/classes") {
    return <OntologyPage browse="classes" />;
  }
  if (path === "/ontologies/properties") {
    return <OntologyPage browse="properties" />;
  }
  if (path === "/ontologies/things") {
    return <OntologyPage browse="things" />;
  }
  if (path === "/ontologies/triples") {
    return <OntologyPage browse="triples" />;
  }
  if (path === "/ontologies/quality") {
    return <OntologyPage browse="quality" />;
  }
  if (ontologyClassMatch) {
    return (
      <OntologyPage detail={{ kind: "class", id: decodeURIComponent(ontologyClassMatch[1]) }} />
    );
  }
  if (ontologyPropertyMatch) {
    return (
      <OntologyPage
        detail={{ kind: "property", id: decodeURIComponent(ontologyPropertyMatch[1]) }}
      />
    );
  }
  if (ontologyThingMatch) {
    return (
      <OntologyPage detail={{ kind: "thing", id: decodeURIComponent(ontologyThingMatch[1]) }} />
    );
  }

  if (stationMatch) {
    return <StationPage stationKey={decodeURIComponent(stationMatch[1]).toUpperCase()} />;
  }
  if (serviceMatch) {
    return <ServicePage serviceKey={decodeURIComponent(serviceMatch[1])} />;
  }

  return <HomePage />;
}
