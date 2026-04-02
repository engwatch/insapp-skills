"""Конфигурация дашборда МФО"""

import os
import re

# MCP
MCP_URL = os.getenv("INSAPP_DB_URL", "https://db-mcp.insapp.pro/mcp")
MCP_KEY = os.getenv("INSAPP_DB_API_KEY", "810075b46868cd6e240576f92630d5ca32f971512cbeaf6e")

# Партнёры: ключ, PartnerId, название, сплит партнёра (%)
PARTNERS = {
    "loko": {"id": "4e96325d-0734-4989-bddd-eebf459d132e", "name": "ЛОКО", "split": 80},
    "mts": {"id": "477a5c28-4577-4c53-a190-95b8f4ca4b2a", "name": "МТС Банк", "split": 80},
}

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

# Referral Products API
SHOWCASE_API = {
    "test": "https://test-api.insapp.pro",
    "prod": "https://api.insapp.pro",
}
SHOWCASE_AUTH_INTERNAL = "20484668CF7C4395B8BE8D0FE1C2NNET"
SHOWCASE_AUTH_CACHE = "DBB9EE36046E47EF82C4E515EEFCD60C"
