import { useCallback, useEffect, useMemo, useState } from "react";

import type { StationListResponse } from "@zawa/domain/api";

import { useDebouncedValue } from "../hooks/useDebouncedValue";
import {
  type SearchResultOptionProps,
  useSearchResultNavigation,
} from "../hooks/useSearchResultNavigation";
import { getStations, type BoardType } from "../lib/api";
import type { FavouriteStation } from "../lib/favourites";
import {
  mergeStationSuggestions,
  resolveStationSearchTarget,
  stationBoardHref,
} from "../lib/station-search";
import { Icon } from "./Icon";
import { PageHero } from "./PageHero";

import "./HomeStationSearch.scss";

type StationSuggestion = StationListResponse["stations"][number];

export function HomeStationSearch({
  favourites,
  initialStations,
}: {
  favourites: FavouriteStation[];
  initialStations: StationSuggestion[];
}) {
  const [query, setQuery] = useState("");
  const [boardType, setBoardType] = useState<BoardType>("departures");
  const [results, setResults] = useState<StationSuggestion[]>(initialStations.slice(0, 4));
  const [searchState, setSearchState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const trimmedQuery = query.trim();
  const debouncedQuery = useDebouncedValue(trimmedQuery, 220);
  const suggestedStations = useMemo(
    () => mergeStationSuggestions(favourites, results, initialStations, trimmedQuery).slice(0, 4),
    [favourites, results, initialStations, trimmedQuery],
  );
  const targetStation = resolveStationSearchTarget({
    query,
    favourites,
    results: suggestedStations,
    initialStations,
  });
  const suggestionsVisible = suggestedStations.length > 0;
  const searchIsActive = Boolean(trimmedQuery) && suggestionsVisible;
  const clearSearch = useCallback(() => {
    setQuery("");
    setResults(initialStations.slice(0, 4));
    setSearchState("idle");
  }, [initialStations]);
  const openSearchResult = useCallback(
    (station: StationSuggestion) => {
      window.location.href = stationBoardHref(station.station_key, boardType);
    },
    [boardType],
  );
  const { activeResultId, getResultOptionProps, handleInputKeyDown, listboxId } =
    useSearchResultNavigation({
      isOpen: searchIsActive,
      items: suggestedStations,
      onClear: clearSearch,
      onSelect: openSearchResult,
    });

  useEffect(() => {
    if (!debouncedQuery) {
      setResults(initialStations.slice(0, 4));
      setSearchState("idle");
      return undefined;
    }

    let cancelled = false;
    setSearchState("loading");
    void getStations(debouncedQuery)
      .then((data) => {
        if (cancelled) return;
        setResults(data.stations.slice(0, 4));
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
  }, [debouncedQuery, initialStations]);

  const searchForm = (
    <form
      className="home-station-search"
      onSubmit={(event) => {
        event.preventDefault();
        if (!targetStation) return;

        window.location.href = stationBoardHref(targetStation, boardType);
      }}
    >
      <div className="home-board-toggle" aria-label="Board type">
        <button
          className={boardType === "departures" ? "active" : ""}
          type="button"
          aria-pressed={boardType === "departures"}
          onClick={() => setBoardType("departures")}
        >
          Departures
        </button>
        <button
          className={boardType === "arrivals" ? "active" : ""}
          type="button"
          aria-pressed={boardType === "arrivals"}
          onClick={() => setBoardType("arrivals")}
        >
          Arrivals
        </button>
      </div>
      <label htmlFor="home-station-search">Station name or CRS</label>
      <div className="home-search-input-row">
        <Icon name="search" />
        <input
          id="home-station-search"
          name="station"
          placeholder="Search station name or CRS..."
          value={query}
          role="combobox"
          aria-autocomplete="list"
          aria-controls={searchIsActive ? listboxId : undefined}
          aria-expanded={searchIsActive ? "true" : "false"}
          aria-activedescendant={activeResultId}
          onChange={(event) => setQuery(event.currentTarget.value)}
          onKeyDown={handleInputKeyDown}
        />
        <button disabled={!targetStation} type="submit">
          Open board
        </button>
      </div>
      <StationSuggestionList
        boardType={boardType}
        getResultOptionProps={getResultOptionProps}
        isSearchActive={searchIsActive}
        listboxId={listboxId}
        searchState={searchState}
        stations={suggestedStations}
      />
    </form>
  );

  return (
    <PageHero
      aside={searchForm}
      asideSize="wide"
      body={
        <p>Open a live departure or arrival board and follow platform, delay, and route changes.</p>
      }
      headingId="home-search-heading"
      title="Find live trains from your station."
    />
  );
}

function StationSuggestionList({
  boardType,
  getResultOptionProps,
  isSearchActive,
  listboxId,
  searchState,
  stations,
}: {
  boardType: BoardType;
  getResultOptionProps: (index: number) => SearchResultOptionProps;
  isSearchActive: boolean;
  listboxId: string;
  searchState: "idle" | "loading" | "ready" | "error";
  stations: StationSuggestion[];
}) {
  if (!stations.length) {
    return (
      <div className="home-search-empty">
        {searchState === "loading"
          ? "Searching stations..."
          : searchState === "error"
            ? "Station search is unavailable right now."
            : searchState === "idle"
              ? "Station suggestions will appear here."
              : "No stations matched that search."}
      </div>
    );
  }

  return (
    <div
      className="home-search-results"
      id={isSearchActive ? listboxId : undefined}
      role={isSearchActive ? "listbox" : undefined}
      aria-label="Station suggestions"
    >
      {stations.map((station, index) => (
        <a
          key={station.station_key}
          href={stationBoardHref(station.station_key, boardType)}
          {...(isSearchActive ? getResultOptionProps(index) : {})}
        >
          <strong>{station.station_name ?? station.station_key}</strong>
          <span>{station.station_name ? station.station_key : "CRS code"}</span>
        </a>
      ))}
    </div>
  );
}
