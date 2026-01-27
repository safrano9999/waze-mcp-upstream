export type Region = "us" | "eu" | "il" | "au";
export type VehicleType = "car" | "taxi" | "motorcycle";

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface RouteOptions {
  region: Region;
  vehicleType?: VehicleType;
  avoidTollRoads?: boolean;
  avoidFerries?: boolean;
  realtime?: boolean;
}

export interface WazeRoute {
  duration: number;
  distance: number;
  name: string;
  streetNames: string[];
}

export interface WazeRouteResponse {
  routes: WazeRoute[];
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  name: string;
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

export interface WazeApiRoute {
  response: {
    routeName: string;
    totalRouteTime: number;
    totalRouteTimeWithoutRealtime?: number;
    totalLength?: number;
    streetNames: Array<string | null>;
    results: Array<{
      street: number;
      length: number;
      crossTime: number;
    }>;
  };
}

export interface WazeApiResponse {
  alternatives?: WazeApiRoute[];
  error?: string;
}

export interface WazeGeocodeResult {
  name: string;
  city?: string;
  location: {
    lat: number;
    lon: number;
  };
  bounds?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}
