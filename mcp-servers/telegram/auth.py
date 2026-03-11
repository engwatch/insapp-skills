#!/usr/bin/env python3
"""
One-time Telegram authentication script.
Run this ONCE to create the session file before using the MCP server.

Usage:
    cd ~/.claude/mcp-servers/telegram
    ./venv/bin/python3 auth.py
"""

import asyncio
import os
from telethon import TelegramClient
from telethon.errors import SessionPasswordNeededError

# ── Credentials ───────────────────────────────────────────────────────────────
# Get your API credentials at https://my.telegram.org → API development tools
API_ID = 0           # ← Replace with your App api_id (integer)
API_HASH = ""        # ← Replace with your App api_hash (string)

SESSION_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "session", "user")


async def main():
    if not API_ID or not API_HASH:
        print("ERROR: Set API_ID and API_HASH in this file first.")
        print("Get credentials at https://my.telegram.org → API development tools")
        return

    print("=== Telegram MCP Server — First-time Authentication ===\n")
    print(f"Session will be saved to: {SESSION_PATH}\n")

    os.makedirs(os.path.dirname(SESSION_PATH), exist_ok=True)

    client = TelegramClient(SESSION_PATH, API_ID, API_HASH)
    await client.connect()

    if await client.is_user_authorized():
        me = await client.get_me()
        print(f"Already authenticated as: {me.first_name} (@{me.username})")
        print("Authentication successful! You can now use the MCP server.")
        await client.disconnect()
        return

    phone = input("Enter your phone number (with country code, e.g. +79001234567): ").strip()

    await client.send_code_request(phone)
    print("\nA code has been sent to your Telegram app (or SMS).")
    code = input("Enter the code: ").strip()

    try:
        await client.sign_in(phone, code)
    except SessionPasswordNeededError:
        print("\nTwo-step verification is enabled.")
        password = input("Enter your 2FA password: ").strip()
        await client.sign_in(password=password)

    me = await client.get_me()
    print(f"\nAuthenticated as: {me.first_name} {me.last_name or ''} (@{me.username})")
    print("Authentication successful! Session saved.")
    print("\nYou can now use the Telegram MCP server in Claude Code.")

    await client.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
