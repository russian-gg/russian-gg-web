#!/usr/bin/env python3
"""
Records the onboarding brief with Gemini TTS and writes it where the app expects it.

Run once, whenever the words change:

    GEMINI_API_KEY=... python3 scripts/build-onboarding-audio.py

The brief is the same forty words for every visitor, so it is a file rather than a call: the
app plays it while the microphone ring fills, and nobody pays a model to say a constant again
per person. The key never leaves your shell — it is read from the environment here and is not
stored, printed, or committed.
"""

import base64
import json
import os
import pathlib
import struct
import sys
import urllib.error
import urllib.request

# The words, exactly as they are spoken. Kept here so the file and its script never drift.
TEXT = """Assalomu alaykum! Hozir 40 soniya ichida menga o'zingiz haqingizda gapirib bering: Ismingiz nima, qayerda ishlaysiz yoki o'qiysiz? Rus tilini o'rganishdan asosiy maqsadingiz nima — ishdami, ko'chadami yoki sayohatdami?
Eng muhimi — o'zbekcha gapiravering! Ruscha so'zlar bilsangiz, qo'shib ketasiz, bilmasangiz to'liq o'zbekcha ayting. Xato qilishdan umuman tortinmang, tayyor bo'lsangiz, boshladik!"""

# Warm and unhurried. The first thing a stranger hears from this product should not sound
# like an announcement.
VOICE = os.environ.get("GEMINI_TTS_VOICE", "Achernar")
MODEL = os.environ.get("GEMINI_TTS_MODEL", "gemini-2.5-flash-preview-tts")

OUTPUT = pathlib.Path(__file__).resolve().parent.parent / "public" / "audio" / "onboarding-intro.wav"

# What Gemini returns: signed 16-bit little-endian PCM, single channel, 24 kHz.
SAMPLE_RATE = 24_000
CHANNELS = 1
BITS = 16


def wav(pcm: bytes) -> bytes:
    """Wraps raw PCM in a WAV header. Browsers will not play headerless audio."""
    byte_rate = SAMPLE_RATE * CHANNELS * BITS // 8
    block_align = CHANNELS * BITS // 8

    header = b"RIFF" + struct.pack("<I", 36 + len(pcm)) + b"WAVE"
    header += b"fmt " + struct.pack("<IHHIIHH", 16, 1, CHANNELS, SAMPLE_RATE, byte_rate, block_align, BITS)
    header += b"data" + struct.pack("<I", len(pcm))

    return header + pcm


def main() -> int:
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("VOICE_API_KEY")
    if not key:
        print("Set GEMINI_API_KEY and run again.", file=sys.stderr)
        return 2

    body = json.dumps(
        {
            "contents": [{"parts": [{"text": TEXT}]}],
            "generationConfig": {
                "responseModalities": ["AUDIO"],
                "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": VOICE}}},
            },
        }
    ).encode()

    request = urllib.request.Request(
        f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={key}",
        data=body,
        headers={"content-type": "application/json"},
    )

    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            payload = json.load(response)
    except urllib.error.HTTPError as error:
        # The key is in the URL, so the URL is not printed with the failure.
        print(f"Gemini returned {error.code}: {error.read()[:400].decode(errors='replace')}", file=sys.stderr)
        return 1

    try:
        part = payload["candidates"][0]["content"]["parts"][0]["inlineData"]["data"]
    except (KeyError, IndexError):
        print(f"No audio in the reply: {json.dumps(payload)[:400]}", file=sys.stderr)
        return 1

    audio = wav(base64.b64decode(part))

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_bytes(audio)

    seconds = len(audio) / (SAMPLE_RATE * CHANNELS * BITS // 8)
    print(f"Wrote {OUTPUT.relative_to(OUTPUT.parent.parent.parent)} — {seconds:.1f}s, {len(audio) / 1024:.0f} KB")
    print("Commit it, and the app will play it on the next deploy.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
