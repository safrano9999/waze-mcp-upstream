# Waze MCP Server

An MCP (Model Context Protocol) server that provides Waze travel time calculations as tools.

## Features

- **get_travel_time**: Calculate travel time between two locations
- **get_routes**: Get all available routes (up to 3 alternatives)
- **geocode_address**: Resolve addresses to coordinates

## Installation

```bash
npm ci
python3 -m pip install -r python/requirements.txt
npm run build
```

This fork keeps the original tools and adds a fallback for Waze's HTTP 403
responses. It requires Python 3.15 and uses a fresh `curl_cffi` Chrome session
for each fallback request. Address lookups use Waze's current autocomplete
endpoint while preserving the existing tool result fields. No account,
API key, database, browser process or persistent volume is needed.

The fallback approach follows [Home Assistant #183923](https://github.com/home-assistant/core/pull/183923)
and [#184663](https://github.com/home-assistant/core/pull/184663), adapted to
this TypeScript MCP server. Runtime dependencies are pinned in
`python/requirements.txt` and `package-lock.json`.

## Usage with Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "waze": {
      "command": "node",
      "args": ["yourLocation/waze-mcp/dist/index.js"]
    }
  }
}
```

## Tools

### get_travel_time

Calculate travel time between two locations.

**Parameters:**
- `origin` (string): Origin as "lat,lng" coordinates or address
- `destination` (string): Destination as "lat,lng" coordinates or address
- `region` (enum: us, eu, il, au): Waze server region (default: eu)
- `vehicle_type` (enum: car, taxi, motorcycle): Vehicle type (default: car)
- `avoid_toll_roads` (boolean): Avoid toll roads (default: false)
- `avoid_ferries` (boolean): Avoid ferries (default: false)
- `realtime` (boolean): Use realtime traffic data (default: true)

**Returns:**
- `duration_minutes`: Travel time in minutes
- `distance_km`: Distance in kilometers
- `route_name`: Name of the route

### get_routes

Get all available routes between two locations.

**Parameters:** Same as `get_travel_time`

**Returns:**
- Array of routes, each with:
  - `duration_minutes`
  - `distance_km`
  - `route_name`
  - `street_names`: Array of street names on the route

### geocode_address

Resolve an address to geographic coordinates.

**Parameters:**
- `address` (string): Address to geocode
- `region` (enum): Region for geocoding

**Returns:**
- `lat`: Latitude
- `lng`: Longitude
- `name`: Resolved name
- `bounds`: Bounding box (if available)

## Region Codes

- `us`: United States / North America
- `eu`: Europe / Australia
- `il`: Israel
- `au`: Australia (uses EU server)
