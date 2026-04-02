"""Конфигурация дашборда МФО"""

import os
import re

# MCP
MCP_URL = os.getenv("INSAPP_DB_URL", "https://db-mcp.insapp.pro/mcp")
MCP_KEY = os.getenv("INSAPP_DB_API_KEY", "810075b46868cd6e240576f92630d5ca32f971512cbeaf6e")

# Партнёры: ключ, PartnerId, название, сплит партнёра (%)
PARTNERS = {
    "mts": {"id": "477a5c28-4577-4c53-a190-95b8f4ca4b2a", "name": "МТС Банк", "split": 80},
    "loko": {"id": "4e96325d-0734-4989-bddd-eebf459d132e", "name": "ЛОКО", "split": 80},
    "insapp_mfo": {"id": "a5842f98-c8a8-4a91-9dec-7cd27e734c00", "name": "МФО Инсап", "split": 0},
    "emtech": {"id": "8985c811-6de6-4fcb-96aa-e1d75adfb9a5", "name": "ЭМТЕХНОЛОДЖИС", "split": 80},
    "futbolista": {"id": "3cc13c15-8039-4484-9ab2-888ea24041eb", "name": "ФУТБОЛИСТА", "split": 80},
    "str_partners": {"id": "2e1b192e-0126-4afd-b392-6e907045d225", "name": "Страховые партнёры", "split": 80},
    "gpb": {"id": "d9038ac9-a8eb-4e38-9a4e-93f223ad8a6c", "name": "ГПБ", "split": 80},
    "tbank": {"id": "17e1fe09-675c-40f6-8fb1-8cce9f273142", "name": "ТБАНК", "split": 80},
    "beskontakt": {"id": "30cd7727-caf7-4724-be0d-51cf4176829f", "name": "БЕСКОНТАКТ", "split": 80},
    "dolinsk": {"id": "a13932e8-85db-4862-be94-1de935f8c81c", "name": "ДОЛИНСК", "split": 80},
    "technoprods": {"id": "d45be224-1e73-4a42-8758-6d5c2c293008", "name": "ТЕХНОПРОДС", "split": 80},
    "33monety": {"id": "8aa128e6-8f25-4446-a224-c5c9454413ca", "name": "33 МОНЕТЫ", "split": 80},
}

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

# Referral Products API
SHOWCASE_API = {
    "test": "https://test-api.insapp.pro",
    "prod": "https://api.insapp.pro",
}
SHOWCASE_AUTH_INTERNAL = "20484668CF7C4395B8BE8D0FE1C2NNET"
SHOWCASE_AUTH_CACHE = "DBB9EE36046E47EF82C4E515EEFCD60C"
