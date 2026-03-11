#!/usr/bin/env python3
"""
Telegram MCP Server for Claude Code.
Exposes Telegram User API (via Telethon) as MCP tools.

Tools:
  - get_daily_summary: all mentions + target groups summary (last 24h)
  - get_mentions: mentions/tags of current user (last N hours)
  - get_insapp_summary: summary from groups matching keyword only
  - send_message: send a message to any chat

Setup: see README.md or skills/telegram_daily/SKILL.md
"""

import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone
from typing import Optional

from telethon import TelegramClient
from telethon.tl.types import (
    Channel, Chat, User,
    MessageEntityMention, MessageEntityMentionName,
)
from mcp.server.fastmcp import FastMCP

# ── Credentials ──────────────────────────────────────────────────────────────
# Get your API credentials at https://my.telegram.org → API development tools
API_ID = 0           # ← Replace with your App api_id (integer)
API_HASH = ""        # ← Replace with your App api_hash (string)

SESSION_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "session", "user")

# ── MCP Server ────────────────────────────────────────────────────────────────
mcp = FastMCP("telegram")


# ── Helpers ───────────────────────────────────────────────────────────────────

def get_client() -> TelegramClient:
    return TelegramClient(SESSION_PATH, API_ID, API_HASH)


def entity_name(entity) -> str:
    if entity is None:
        return "Unknown"
    if isinstance(entity, User):
        parts = [entity.first_name or "", entity.last_name or ""]
        name = " ".join(p for p in parts if p).strip()
        if entity.username:
            name += f" (@{entity.username})"
        return name or f"User#{entity.id}"
    if isinstance(entity, (Channel, Chat)):
        return getattr(entity, "title", None) or f"Chat#{entity.id}"
    return str(entity)


def format_message(msg, chat_name: str) -> str:
    ts = msg.date.strftime("%H:%M")
    sender = "Unknown"
    if msg.sender:
        sender = entity_name(msg.sender)
    text = (msg.message or "").strip()
    if len(text) > 300:
        text = text[:297] + "..."
    return f"[{ts}] {chat_name} | {sender}: {text}"


def is_mentioned(msg, my_id: int, my_username: Optional[str]) -> bool:
    if getattr(msg, "mentioned", False):
        return True
    if msg.entities:
        for ent in msg.entities:
            if isinstance(ent, MessageEntityMentionName):
                if ent.user_id == my_id:
                    return True
            if isinstance(ent, MessageEntityMention) and my_username:
                text = msg.message or ""
                mention_text = text[ent.offset: ent.offset + ent.length]
                if mention_text.lstrip("@").lower() == my_username.lower():
                    return True
    return False


# ── Tool: get_mentions ────────────────────────────────────────────────────────

@mcp.tool()
async def get_mentions(hours: int = 24) -> str:
    """
    Returns all messages where the current user was mentioned/tagged
    across all personal and group chats in the last N hours (default 24).
    """
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    results = []

    async with get_client() as client:
        me = await client.get_me()
        my_id = me.id
        my_username = me.username

        async for dialog in client.iter_dialogs():
            entity = dialog.entity
            chat_name = entity_name(entity)
            try:
                async for msg in client.iter_messages(entity, limit=None):
                    if msg.date < cutoff:
                        break
                    if not msg.message:
                        continue
                    if is_mentioned(msg, my_id, my_username):
                        results.append(format_message(msg, chat_name))
            except Exception:
                continue

    if not results:
        return f"No mentions found in the last {hours} hours."

    return f"=== Mentions of you in the last {hours}h ({len(results)} total) ===\n" + "\n".join(results)


# ── Tool: get_insapp_summary ──────────────────────────────────────────────────

@mcp.tool()
async def get_insapp_summary(hours: int = 24) -> str:
    """
    Returns a summary of all messages from Telegram groups/channels
    whose title contains 'Insapp' (case-insensitive) in the last N hours.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    group_summaries = {}

    async with get_client() as client:
        async for dialog in client.iter_dialogs():
            entity = dialog.entity
            title = getattr(entity, "title", "") or ""
            if "insapp" not in title.lower():
                continue
            chat_name = entity_name(entity)
            messages = []
            try:
                async for msg in client.iter_messages(entity, limit=None):
                    if msg.date < cutoff:
                        break
                    if not msg.message:
                        continue
                    messages.append(format_message(msg, chat_name))
            except Exception:
                continue
            if messages:
                group_summaries[chat_name] = list(reversed(messages))

    if not group_summaries:
        return f"No messages found in Insapp groups in the last {hours} hours."

    lines = [f"=== Insapp Groups Summary (last {hours}h) ===\n"]
    for group, msgs in group_summaries.items():
        lines.append(f"\n── {group} ({len(msgs)} messages) ──")
        lines.extend(msgs)
    return "\n".join(lines)


# ── Tool: get_daily_summary ───────────────────────────────────────────────────

@mcp.tool()
async def get_daily_summary() -> str:
    """
    Full daily digest for the last 24 hours:
    1. TASK LIST — all mentions of you (who wants what from you)
    2. TARGET GROUPS — summary of all groups with 'Insapp' in the name
    """
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    mentions = []
    group_summaries = {}

    async with get_client() as client:
        me = await client.get_me()
        my_id = me.id
        my_username = me.username

        async for dialog in client.iter_dialogs():
            entity = dialog.entity
            chat_name = entity_name(entity)
            title = getattr(entity, "title", "") or ""
            is_insapp = "insapp" in title.lower()
            try:
                chat_messages = []
                async for msg in client.iter_messages(entity, limit=None):
                    if msg.date < cutoff:
                        break
                    if not msg.message:
                        continue
                    if is_mentioned(msg, my_id, my_username):
                        mentions.append(format_message(msg, chat_name))
                    if is_insapp:
                        chat_messages.append(format_message(msg, chat_name))
                if is_insapp and chat_messages:
                    group_summaries[chat_name] = list(reversed(chat_messages))
            except Exception:
                continue

    lines = []
    lines.append("╔══════════════════════════════════════════════╗")
    lines.append("║          ЗАДАЧИ — УПОМИНАНИЯ ЗА 24Ч          ║")
    lines.append("╚══════════════════════════════════════════════╝")
    if mentions:
        lines.append(f"Найдено {len(mentions)} упоминаний:\n")
        for i, m in enumerate(mentions, 1):
            lines.append(f"{i}. {m}")
    else:
        lines.append("Упоминаний не найдено.")

    lines.append("")
    lines.append("╔══════════════════════════════════════════════╗")
    lines.append("║         INSAPP ГРУППЫ — СВОДКА ЗА 24Ч        ║")
    lines.append("╚══════════════════════════════════════════════╝")
    if group_summaries:
        for group, msgs in group_summaries.items():
            lines.append(f"\n── {group} ({len(msgs)} сообщений) ──")
            lines.extend(msgs)
    else:
        lines.append("Сообщений в Insapp-группах не найдено.")

    return "\n".join(lines)


# ── Tool: send_message ────────────────────────────────────────────────────────

@mcp.tool()
async def send_message(chat_name_or_username: str, text: str) -> str:
    """
    Send a Telegram message to a chat.

    Args:
        chat_name_or_username: Username (@username), phone number, or
                               exact chat/group title to search for.
        text: The message text to send.
    """
    async with get_client() as client:
        entity = None
        try:
            entity = await client.get_entity(chat_name_or_username)
        except Exception:
            pass

        if entity is None:
            query_lower = chat_name_or_username.lower()
            async for dialog in client.iter_dialogs():
                title = getattr(dialog.entity, "title", "") or ""
                fname = getattr(dialog.entity, "first_name", "") or ""
                lname = getattr(dialog.entity, "last_name", "") or ""
                full_name = f"{fname} {lname}".strip()
                if query_lower in title.lower() or query_lower in full_name.lower():
                    entity = dialog.entity
                    break

        if entity is None:
            return f"Error: Could not find chat '{chat_name_or_username}'."

        await client.send_message(entity, text)
        return f"Message sent to {entity_name(entity)}."


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if not API_ID or not API_HASH:
        print(
            "ERROR: API_ID and API_HASH are not set.\n"
            "Edit server.py and insert your credentials from https://my.telegram.org",
            file=sys.stderr,
        )
        sys.exit(1)

    session_file = SESSION_PATH + ".session"
    if not os.path.exists(session_file):
        print(
            f"ERROR: Session file not found at {session_file}\n"
            "Please run auth.py first.",
            file=sys.stderr,
        )
        sys.exit(1)

    mcp.run(transport="stdio")
