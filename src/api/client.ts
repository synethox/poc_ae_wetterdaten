import type { StationSearchParams, TemperatureQuery } from "./types";
import { searchStationsMock, fetchTemperaturesMock } from "./mock";

export async function searchStations(params: StationSearchParams) {
  return searchStationsMock(params);
}

export async function fetchTemperatures(query: TemperatureQuery) {
  return fetchTemperaturesMock(query);
}
