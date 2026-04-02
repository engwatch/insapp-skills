"""MCP JSON-RPC клиент для insapp-db"""

import json
import threading
from concurrent.futures import ThreadPoolExecutor
import requests as http_requests
from config import MCP_URL, MCP_KEY


class MCPClient:
    def __init__(self):
        self.session_id = None
        self.req_id = 0
        self._lock = threading.Lock()
        self._http = http_requests.Session()

    def _next_id(self):
        with self._lock:
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
            resp = self._http.post(MCP_URL, json={
                "jsonrpc": "2.0", "method": "initialize",
                "params": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {},
                    "clientInfo": {"name": "mfo-dashboard", "version": "1.0"},
                },
                "id": self._next_id(),
            }, headers=self._headers(), timeout=10)
            self.session_id = resp.headers.get("mcp-session-id") or resp.headers.get("Mcp-Session")
            self._http.post(MCP_URL, json={
                "jsonrpc": "2.0", "method": "notifications/initialized", "params": {},
            }, headers=self._headers(), timeout=5)
            print(f"MCP session: {self.session_id}")
        except Exception as e:
            print(f"MCP init error: {e}")

    def query_parallel(self, queries):
        """Run multiple queries in parallel. queries = [(sql, desc), ...]. Returns list of row-lists."""
        self._ensure_session()
        with ThreadPoolExecutor(max_workers=len(queries)) as pool:
            return list(pool.map(lambda q: self.query(q[0], q[1]), queries))

    def _reset_session(self):
        """Сброс протухшей сессии — следующий query переинициализирует."""
        print("MCP session reset")
        self.session_id = None

    def query(self, sql, desc="dashboard"):
        self._ensure_session()
        for attempt in range(3):
            try:
                resp = self._http.post(MCP_URL, json={
                    "jsonrpc": "2.0", "method": "tools/call",
                    "params": {"name": "query", "arguments": {
                        "database": "InsappCoreProd",
                        "sql": sql,
                        "user_prompt": "dashboard",
                        "query_description": desc,
                    }},
                    "id": self._next_id(),
                }, headers=self._headers(), timeout=120)

                # Сессия протухла — сервер вернул 4xx
                if resp.status_code in (401, 403, 404, 410):
                    print(f"MCP session expired (HTTP {resp.status_code}), resetting")
                    self._reset_session()
                    self._ensure_session()
                    if attempt < 2:
                        continue
                    return []

                ct = resp.headers.get("Content-Type", "")
                if "text/event-stream" in ct:
                    for line in resp.text.split("\n"):
                        if line.startswith("data: "):
                            result = self._parse(json.loads(line[6:]))
                            if result is not None:
                                return result
                else:
                    result = self._parse(resp.json())
                    if result is not None:
                        return result

                # Пустой ответ при 200 — возможно сессия сломана
                if attempt < 2:
                    print(f"MCP empty response (attempt {attempt+1}/3): {desc}, resetting session")
                    self._reset_session()
                    self._ensure_session()
                    continue
            except (http_requests.exceptions.Timeout, http_requests.exceptions.ConnectionError):
                print(f"MCP timeout/conn error (attempt {attempt+1}/3): {desc}")
                if attempt < 2:
                    self._reset_session()
                    self._ensure_session()
                    continue
            except Exception as e:
                print(f"MCP query error: {e}")
                break
        return []

    def _parse(self, data):
        """Возвращает list строк при успехе, [] при SQL-ошибке, None при невалидном ответе."""
        try:
            for item in data.get("result", {}).get("content", []):
                if item.get("type") == "text":
                    parsed = json.loads(item["text"])
                    if parsed.get("success"):
                        return parsed.get("rows", [])
                    if parsed.get("error"):
                        print(f"SQL error: {parsed['error']}")
                        return []
        except Exception as e:
            print(f"Parse error: {e}, data: {str(data)[:200]}")
        return None
