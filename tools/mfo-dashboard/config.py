"""Конфигурация дашборда МФО"""

import os
import re

# MCP
MCP_URL = os.getenv("INSAPP_DB_URL", "https://db-mcp.insapp.pro/mcp")
MCP_KEY = os.getenv("INSAPP_DB_API_KEY", "YOUR_API_KEY_HERE")

# Партнёры: ключ, PartnerId, название, сплит партнёра (%)
PARTNERS = {
    "loko": {"id": "4e96325d-0734-4989-bddd-eebf459d132e", "name": "ЛОКО", "split": 80},
    "mts": {"id": "477a5c28-4577-4c53-a190-95b8f4ca4b2a", "name": "МТС Банк", "split": 80},
}

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
