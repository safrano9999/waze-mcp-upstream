import type {
  Region,
  VehicleType,
  Coordinates,
  RouteOptions,
  WazeRoute,
  GeocodeResult,
  WazeApiResponse,
  WazeGeocodeResult,
} from "./types.js";

const REGION_SERVERS: Record<Region, string> = {
  us: "am",
  eu: "row",
  il: "il",
  au: "row",
};

const REGION_GEOCODE: Record<Region, string> = {
  us: "SearchServer/mozi",
  eu: "row-SearchServer/mozi",
  il: "il-SearchServer/mozi",
  au: "row-SearchServer/mozi",
};

const BASE_COORDS: Record<Region, { lat: number; lon: number }> = {
  us: { lat: 40.713, lon: -74.006 },
  eu: { lat: 47.498, lon: 19.040 },
  il: { lat: 31.768, lon: 35.214 },
  au: { lat: -35.281, lon: 149.128 },
};

const VEHICLE_TYPE_MAP: Record<VehicleType, string> = {
  car: "",
  taxi: "TAXI",
  motorcycle: "MOTORCYCLE",
};

const DEFAULT_HEADERS = {
  "User-Agent": "waze-mcp",
  Referer: "https://www.waze.com/",
};

export class WazeClient {
  private async fetch<T>(url: string): Promise<T> {
    const response = await fetch(url, {
      headers: DEFAULT_HEADERS,
    });

    if (!response.ok) {
      throw new Error(`Waze API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  async geocode(address: string, region: Region): Promise<GeocodeResult> {
    const geocodeServer = REGION_GEOCODE[region];
    const baseCoords = BASE_COORDS[region];

    const params = new URLSearchParams({
      q: address,
      lang: "eng",
      origin: "livemap",
      lat: baseCoords.lat.toString(),
      lon: baseCoords.lon.toString(),
    });

    const url = `https://www.waze.com/${geocodeServer}?${params.toString()}`;

    const results = await this.fetch<WazeGeocodeResult[]>(url);

    if (!results || results.length === 0) {
      throw new Error(`No results found for address: ${address}`);
    }

    // Find first result with a city (more precise) or fall back to first result
    const result = results.find((r) => r.city) || results[0];
    return {
      lat: result.location.lat,
      lng: result.location.lon,
      name: result.name,
      bounds: result.bounds
        ? {
            north: Math.max(result.bounds.top, result.bounds.bottom),
            south: Math.min(result.bounds.top, result.bounds.bottom),
            east: Math.max(result.bounds.left, result.bounds.right),
            west: Math.min(result.bounds.left, result.bounds.right),
          }
        : undefined,
    };
  }

  async calcRoutes(
    from: Coordinates,
    to: Coordinates,
    options: RouteOptions
  ): Promise<WazeRoute[]> {
    const server = REGION_SERVERS[options.region];
    const vehicleType = options.vehicleType
      ? VEHICLE_TYPE_MAP[options.vehicleType]
      : "";

    const avoidOptions = [
      "AVOID_TRAILS:t",
      `AVOID_TOLL_ROADS:${options.avoidTollRoads ? "t" : "f"}`,
      `AVOID_FERRIES:${options.avoidFerries ? "t" : "f"}`,
    ].join(",");

    const params = new URLSearchParams({
      from: `x:${from.lng} y:${from.lat}`,
      to: `x:${to.lng} y:${to.lat}`,
      returnJSON: "true",
      returnGeometries: "false",
      returnInstructions: "true",
      timeout: "60000",
      nPaths: "3",
      options: avoidOptions,
    });

    if (vehicleType) {
      params.set("vehicleType", vehicleType);
    }

    const url = `https://routing-livemap-${server}.waze.com/RoutingManager/routingRequest?${params.toString()}`;

    const response = await this.fetch<WazeApiResponse>(url);

    if (response.error) {
      throw new Error(`Waze routing error: ${response.error}`);
    }

    if (!response.alternatives || response.alternatives.length === 0) {
      throw new Error("No routes found");
    }

    return response.alternatives.map((alt) => {
      // Street names are at top level, results contain indices
      const streetNames = alt.response.streetNames
        .filter((s): s is string => s !== null && s.length > 0);

      // Calculate total distance from segments if totalLength not available
      const totalLengthMeters = alt.response.totalLength ??
        alt.response.results.reduce((sum, r) => sum + r.length, 0);

      const durationSeconds = options.realtime !== false
        ? alt.response.totalRouteTime
        : (alt.response.totalRouteTimeWithoutRealtime ?? alt.response.totalRouteTime);

      return {
        duration: Math.round(durationSeconds / 60),
        distance: Math.round(totalLengthMeters / 100) / 10,
        name: alt.response.routeName || "Unknown Route",
        streetNames,
      };
    });
  }

  parseCoordinates(input: string): Coordinates | null {
    const match = input.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
    if (match) {
      return {
        lat: parseFloat(match[1]),
        lng: parseFloat(match[2]),
      };
    }
    return null;
  }

  async resolveLocation(
    input: string,
    region: Region
  ): Promise<Coordinates> {
    const coords = this.parseCoordinates(input);
    if (coords) {
      return coords;
    }
    const geocoded = await this.geocode(input, region);
    return { lat: geocoded.lat, lng: geocoded.lng };
  }
}
