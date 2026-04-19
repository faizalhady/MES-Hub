#!/usr/bin/env python3
"""
sql_bridge.py
Tiny HTTP server that proxies SQL Server stored procedure calls to Bun/Elysia.
Run alongside the MES Hub: python sql_bridge.py

Endpoints:
  POST /buildplan   { "from": "YYYY-MM-DD", "to": "YYYY-MM-DD" }
"""

import json
import pyodbc
from http.server import BaseHTTPRequestHandler, HTTPServer
from datetime import datetime

PORT = 3001

CONN_STR = (
    "DRIVER={SQL Server};"
    "SERVER=AWASE1PENSQL01;"
    "DATABASE=eDashboard_PEN;"
    "UID=eDashboard_MESystem;"
    "PWD=mesystem;"
)

def run_buildplan(from_date: str, to_date: str) -> list:
    conn = pyodbc.connect(CONN_STR, timeout=10)
    cursor = conn.cursor()
    # Accept either 'YYYY-MM-DD' or 'YYYY-MM-DD HH:MM:SS'
    from_dt = datetime.strptime(from_date.strip()[:10], "%Y-%m-%d").replace(hour=0,  minute=0,  second=0)
    to_dt   = datetime.strptime(to_date.strip()[:10],   "%Y-%m-%d").replace(hour=23, minute=59, second=59)
    cursor.execute("EXEC [dbo].[SP_GET_SY_SMT_BUILDPLAN] @from=?, @to=?", from_dt, to_dt)
    columns = [col[0] for col in cursor.description]
    rows = []
    for row in cursor.fetchall():
        obj = {}
        for i, val in enumerate(row):
            # Convert non-serializable types
            if isinstance(val, datetime):
                obj[columns[i]] = val.isoformat()
            else:
                obj[columns[i]] = val
        rows.append(obj)
    cursor.close()
    conn.close()
    return rows


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        print(f"[sql_bridge] {self.address_string()} - {format % args}")

    def send_json(self, status: int, data: dict):
        body = json.dumps(data, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        if self.path != "/buildplan":
            self.send_json(404, {"error": "Not found"})
            return

        length = int(self.headers.get("Content-Length", 0))
        try:
            body = json.loads(self.rfile.read(length))
            from_date = body["from"]
            to_date   = body["to"]
        except Exception as e:
            self.send_json(400, {"error": f"Bad request: {e}"})
            return

        try:
            rows = run_buildplan(from_date, to_date)
            self.send_json(200, {"ok": True, "count": len(rows), "rows": rows})
        except Exception as e:
            print(f"[sql_bridge] SQL error: {e}")
            self.send_json(500, {"error": str(e)})


if __name__ == "__main__":
    server = HTTPServer(("localhost", PORT), Handler)
    print(f"[sql_bridge] Running on http://localhost:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[sql_bridge] Stopped.")
