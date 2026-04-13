import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useFavouriteStations } from "../hooks/useFavouriteStations";
import { useGlobalSearchShortcut } from "../hooks/useGlobalSearchShortcut";
import { useSearchResultNavigation } from "../hooks/useSearchResultNavigation";
import { getSearchResults } from "../lib/api";
import {
  searchResultContext,
  searchResultHref,
  searchResultKindLabel,
  searchResultMatchLabel,
  type AppSearchResult,
} from "../lib/search-results";
import { resolveStationSearchTarget, stationBoardHref } from "../lib/station-search";
import { Icon } from "./Icon";

import "./StationSearch.scss";

export function StationSearch({ activeStationKey }: { activeStationKey?: string }) {
  const [query, setQuery] = useState("");
  const { favourites } = useFavouriteStations();
  const [results, setResults] = useState<AppSearchResult[]>([]);
  const [searchState, setSearchState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const searchInputRef = useRef<HTMLInputElement>(null);
  useGlobalSearchShortcut(searchInputRef);
  const trimmedQuery = query.trim();
  const debouncedQuery = useDebouncedValue(trimmedQuery, 220);
  const visibleResults = useMemo(() => results.slice(0, 8), [results]);

  useEffect(() => {
    if (!debouncedQuery) {
      setResults([]);
      setSearchState("idle");
      return undefined;
    }

    let cancelled = false;
    setSearchState("loading");
    void getSearchResults(debouncedQuery, 8)
      .then((data) => {
        if (cancelled) return;
        setResults(data.results);
        setSearchState("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setResults([]);
        setSearchState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const quickLinks = favourites;
  const hasSearchQuery = Boolean(trimmedQuery);
  const fallbackStation = resolveStationSearchTarget({
    query,
    favourites: quickLinks,
    results: [],
  });
  const targetHref = visibleResults[0]
    ? searchResultHref(visibleResults[0])
    : fallbackStation
      ? stationBoardHref(fallbackStation)
      : null;
  const clearSearch = useCallback(() => {
    setQuery("");
    setResults([]);
    setSearchState("idle");
  }, []);
  const openSearchResult = useCallback((result: AppSearchResult) => {
    window.location.href = searchResultHref(result);
  }, []);
  const { activeResultId, getResultOptionProps, handleInputKeyDown, listboxId } =
    useSearchResultNavigation({
      isOpen: hasSearchQuery,
      items: visibleResults,
      onClear: clearSearch,
      onSelect: openSearchResult,
    });

  return (
    <div className="station-search">
      <form
        className="search-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (targetHref) window.location.href = targetHref;
        }}
      >
        <label htmlFor="station-search">Rail search</label>
        <div className="search-row">
          <Icon name="search" className="search-icon" />
          <input
            ref={searchInputRef}
            id="station-search"
            name="station"
            placeholder="Search station, service, predicate..."
            value={query}
            role="combobox"
            aria-autocomplete="list"
            aria-controls={hasSearchQuery ? listboxId : undefined}
            aria-expanded={hasSearchQuery ? "true" : "false"}
            aria-activedescendant={activeResultId}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleInputKeyDown}
          />
          <span className="search-shortcut" aria-hidden="true">
            /
          </span>
          <button type="submit">Open</button>
        </div>
      </form>
      <nav className="quick-stations" aria-label="Quick stations">
        {quickLinks.map((station) => (
          <a
            key={station.key}
            className={station.key === activeStationKey ? "active" : ""}
            href={stationBoardHref(station.key)}
            title={station.name}
          >
            {station.name}
          </a>
        ))}
      </nav>
      {hasSearchQuery ? (
        <div className="search-results" id={listboxId} role="listbox">
          {visibleResults.length ? (
            visibleResults.map((result, index) => (
              <a
                key={result.result_id}
                href={searchResultHref(result)}
                {...getResultOptionProps(index)}
              >
                <div>
                  <strong>{result.title}</strong>
                  <small>{searchResultContext(result)}</small>
                </div>
                <span title={searchResultMatchLabel(result)}>{searchResultKindLabel(result)}</span>
              </a>
            ))
          ) : (
            <div className="search-results-state">
              {searchState === "loading"
                ? "Searching rail data..."
                : searchState === "error"
                  ? "Search is unavailable. Try a CRS code such as KGX or PAD."
                  : "No matches yet. Try a station, service, operator, incident, or predicate."}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
