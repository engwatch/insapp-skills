"""MCP JSON-RPC клиент для insapp-db"""

import json
import requests as http_requests
from config import MCP_URL, MCP_KEY


class MCPClient:
    def __init__(self):
        self.session_id = None
        self.req_id = 0

    def _next_id(self):
        self.req_id += 1
        return self.req_id

    def _headers(self):
        h = {
            "Content-Type": "application/json",
            "x-api-key": MCP_KEY,
            "Accept": "application/json, text/event-stream",
        }
        if self.session_id:
            h["mcp-session-id"] = self.session_id
        return h

    def _ensure_session(self):
        if self.session_id:
            return
        try:
            resp = http_requests.post(MCP_URL, json={
                "jsonrpc": "2.0", "method": "initialize",
                "params": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {},
                    "clientInfo": {"name": "mfo-dashboard", "version": "1.0"},
                },
                "id": self._next_id(),
            }, headers=self._headers(), timeout=10)
            self.session_id = resp.headers.get("mcp-session-id") or resp.headers.get("Mcp-Session")
            http_requests.post(MCP_URL, json={
                "jsonrpc": "2.0", "method": "notifications/initialized", "params": {},
            }, headers=self._headers(), timeout=5)
            print(f"MCP session: {self.session_id}")
        except Exception as e:
            print(f"MCP init error: {e}")

    def query(self, sql, desc="dashboard"):
        self._ensure_session()
        try:
            resp = http_requests.post(MCP_URL, json={
                "jsonrpc": "2.0", "method": "tools/call",
                "params": {"name": "query", "arguments": {
                    "database": "InsappCoreProd",
                    "sql": sql,
                    "user_prompt": "dashboard",
                    "query_description": desc,
                }},
                "id": self._next_id(),
            }, headers=self._headers(), timeout=60)

            ct = resp.headers.get("Content-Type", "")
            if "text/event-stream" in ct:
                for line in resp.text.split("\n"):
                    if line.startswith("data: "):
                        return self._parse(json.loads(line[6:]))
            else:
                return self._parse(resp.json())
        except Exception as e:
            print(f"MCP query error: {e}")
        return []

    def _parse(self, data):
        try:
            for item in data.get("result", {}).get("content", []):
                if item.get("type") == "text":
                    parsed = json.loads(item["text"])
                    if parsed.get("success"):
                        return parsed.get("rows", [])
                    if parsed.get("error"):
                        print(f"SQL error: {parsed['error']}")
        except Exception as e:
            print(f"Parse error: {e}, data: {str(data)[:200]}")
        return []
