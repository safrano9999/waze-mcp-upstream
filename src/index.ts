import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { WazeClient } from "./waze-client.js";
import type { Region, VehicleType } from "./types.js";

const wazeClient = new WazeClient();

const RegionSchema = z.enum(["us", "eu", "il", "au"]).describe("Waze server region");
const VehicleTypeSchema = z.enum(["car", "taxi", "motorcycle"]).describe("Vehicle type");

const server = new McpServer({
  name: "waze-mcp",
  version: "1.0.0",
});

server.tool(
  "get_travel_time",
  "Calculate travel time between two locations using Waze",
  {
    origin: z.string().describe("Origin as 'lat,lng' coordinates or address"),
    destination: z.string().describe("Destination as 'lat,lng' coordinates or address"),
    region: RegionSchema.default("eu"),
    vehicle_type: VehicleTypeSchema.default("car"),
    avoid_toll_roads: z.boolean().default(false).describe("Avoid toll roads"),
    avoid_ferries: z.boolean().default(false).describe("Avoid ferries"),
    realtime: z.boolean().default(true).describe("Use realtime traffic data"),
  },
  async ({
    origin,
    destination,
    region,
    vehicle_type,
    avoid_toll_roads,
    avoid_ferries,
    realtime,
  }) => {
    try {
      const [fromCoords, toCoords] = await Promise.all([
        wazeClient.resolveLocation(origin, region as Region),
        wazeClient.resolveLocation(destination, region as Region),
      ]);

      const routes = await wazeClient.calcRoutes(fromCoords, toCoords, {
        region: region as Region,
        vehicleType: vehicle_type as VehicleType,
        avoidTollRoads: avoid_toll_roads,
        avoidFerries: avoid_ferries,
        realtime,
      });

      if (routes.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No routes found between the specified locations.",
            },
          ],
        };
      }

      const bestRoute = routes[0];
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                duration_minutes: bestRoute.duration,
                distance_km: bestRoute.distance,
                route_name: bestRoute.name,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: ${message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "get_routes",
  "Get all available routes (up to 3 alternatives) between two locations",
  {
    origin: z.string().describe("Origin as 'lat,lng' coordinates or address"),
    destination: z.string().describe("Destination as 'lat,lng' coordinates or address"),
    region: RegionSchema.default("eu"),
    vehicle_type: VehicleTypeSchema.default("car"),
    avoid_toll_roads: z.boolean().default(false).describe("Avoid toll roads"),
    avoid_ferries: z.boolean().default(false).describe("Avoid ferries"),
    realtime: z.boolean().default(true).describe("Use realtime traffic data"),
  },
  async ({
    origin,
    destination,
    region,
    vehicle_type,
    avoid_toll_roads,
    avoid_ferries,
    realtime,
  }) => {
    try {
      const [fromCoords, toCoords] = await Promise.all([
        wazeClient.resolveLocation(origin, region as Region),
        wazeClient.resolveLocation(destination, region as Region),
      ]);

      const routes = await wazeClient.calcRoutes(fromCoords, toCoords, {
        region: region as Region,
        vehicleType: vehicle_type as VehicleType,
        avoidTollRoads: avoid_toll_roads,
        avoidFerries: avoid_ferries,
        realtime,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                routes: routes.map((route) => ({
                  duration_minutes: route.duration,
                  distance_km: route.distance,
                  route_name: route.name,
                  street_names: route.streetNames,
                })),
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: ${message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "geocode_address",
  "Resolve an address to geographic coordinates using Waze",
  {
    address: z.string().describe("Address to geocode"),
    region: RegionSchema.default("eu"),
  },
  async ({ address, region }) => {
    try {
      const result = await wazeClient.geocode(address, region as Region);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                lat: result.lat,
                lng: result.lng,
                name: result.name,
                bounds: result.bounds,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: ${message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
