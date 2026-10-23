"""Fresh Chrome TLS sessions for Waze 403 responses; no persistent state.

Adapted from the approach in eifinger/pywaze v1.2.4 and Home Assistant
PRs #183923 / #184663. The old SearchServer geocoder is replaced with
Waze's current autocomplete endpoint, preserving the TypeScript response shape.
"""
import json
import sys
from urllib.parse import parse_qs, urlsplit

from curl_cffi import requests


def fetch(url):
    parsed = urlsplit(url)
    params = None
    geocode = parsed.hostname == "www.waze.com" and parsed.path.endswith("SearchServer/mozi")
    if geocode:
        query = parse_qs(parsed.query)
        region = "ROW" if parsed.path.startswith("/row-") else "IL" if parsed.path.startswith("/il-") else "NA"
        url = "https://gapi.waze.com/autocomplete/q"
        params = {"q": query["q"][0], "e": region, "c": "wd", "exp": "8", "gxy": "1",
                  "sll": query["lat"][0] + "," + query["lon"][0], "lang": "en"}
    with requests.Session(impersonate="chrome") as client:
        response = client.get(url, params=params, headers={"Referer": "https://www.waze.com/"}, timeout=20)
        data = response.json() if 200 <= response.status_code < 300 else None
        if geocode and response.status_code == 200:
            matches = data[1] if isinstance(data, list) and len(data) > 1 and isinstance(data[1], list) else []
            data = [{"name": item[0], "location": {"lat": item[3]["y"], "lon": item[3]["x"]}}
                    for item in matches if len(item) > 3 and isinstance(item[3], dict)
                    and not item[3].get("v", "").startswith("advertisement.poi-")
                    and item[3].get("x") is not None and item[3].get("y") is not None]
        return {"status": response.status_code, "statusText": response.reason, "data": data}


if __name__ == "__main__":
    try:
        result = fetch(sys.argv[1])
    except Exception as error:
        result = {"status": 502, "statusText": str(error), "data": None}
    print(json.dumps(result))
