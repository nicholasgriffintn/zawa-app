import { useCallback, useEffect, useMemo, useState } from "react";

import {
  favouriteStationsChangedEventName,
  getFavouriteStations,
  isFavouriteStationKey,
  type FavouriteStation,
  removeFavouriteStation,
  saveFavouriteStation,
} from "../lib/favourites";

export function useFavouriteStations() {
  const [favourites, setFavourites] = useState<FavouriteStation[]>(() => getFavouriteStations());

  useEffect(() => {
    const update = () => setFavourites(getFavouriteStations());
    window.addEventListener(favouriteStationsChangedEventName(), update);
    window.addEventListener("storage", update);
    update();

    return () => {
      window.removeEventListener(favouriteStationsChangedEventName(), update);
      window.removeEventListener("storage", update);
    };
  }, []);

  const favouriteKeys = useMemo(
    () => new Set(favourites.map((station) => station.key)),
    [favourites],
  );

  const save = useCallback((station: FavouriteStation) => {
    saveFavouriteStation(station);
    setFavourites(getFavouriteStations());
  }, []);

  const remove = useCallback((stationKey: string) => {
    removeFavouriteStation(stationKey);
    setFavourites(getFavouriteStations());
  }, []);

  const isFavourite = useCallback(
    (stationKey: string) => favouriteKeys.has(stationKey) || isFavouriteStationKey(stationKey),
    [favouriteKeys],
  );

  return { favourites, save, remove, isFavourite };
}
