"""Regression checks run by the image workflow, without Waze requests."""
from pathlib import Path
import sys
import unittest
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "python"))
import curl_fallback


class FallbackTests(unittest.TestCase):
    def response(self, status, payload):
        context = patch.object(curl_fallback.requests, "Session")
        session = context.start()
        self.addCleanup(context.stop)
        client = session.return_value.__enter__.return_value
        response = Mock(status_code=status, reason="OK" if status == 200 else "Forbidden")
        response.json.return_value = payload
        client.get.return_value = response
        return session, client, response

    def test_current_geocoder_and_response_shape_for_each_region(self):
        session, client, _ = self.response(200, ["query", [
            ["Ad", 0, [], {"v": "advertisement.poi-test", "x": 1, "y": 2}],
            ["Bahnhofstraße", 0, [], {"x": 8.69, "y": 49.4}],
            ["No coordinates", 0, [], {}]]])
        for prefix, environment in [("row-", "ROW"), ("il-", "IL"), ("", "NA")]:
            result = curl_fallback.fetch(f"https://www.waze.com/{prefix}SearchServer/mozi?q=Heidelberg&lat=49&lon=8")
            args, kwargs = client.get.call_args
            self.assertEqual(args[0], "https://gapi.waze.com/autocomplete/q")
            self.assertEqual(kwargs["params"]["e"], environment)
            self.assertEqual(result["data"], [{"name": "Bahnhofstraße", "location": {"lat": 49.4, "lon": 8.69}}])
        self.assertEqual(session.call_count, 3)
        session.assert_called_with(impersonate="chrome")

    def test_routing_body_is_preserved(self):
        _, client, _ = self.response(200, {"alternatives": [{"response": {"totalRouteTime": 600}}]})
        url = "https://routing-livemap-row.waze.com/RoutingManager/routingRequest?from=test"
        result = curl_fallback.fetch(url)
        self.assertEqual(client.get.call_args.args[0], url)
        self.assertEqual(result["data"]["alternatives"][0]["response"]["totalRouteTime"], 600)

    def test_failed_http_is_not_parsed_as_json(self):
        _, _, response = self.response(403, None)
        result = curl_fallback.fetch("https://routing-livemap-row.waze.com/RoutingManager/routingRequest")
        response.json.assert_not_called()
        self.assertEqual(result["status"], 403)
        self.assertIsNone(result["data"])


if __name__ == "__main__":
    unittest.main()
