#!/usr/bin/env python3
"""Audio-first narration, word alignment, music and effects preparation plus MP4 muxing.

Edge TTS is optional for smoke jobs, but required for narrated production when
--require-word-alignment is set. Production fails closed rather than silently
substituting unaligned speech. FFmpeg performs the final audio/video mux.
"""
from __future__ import annotations

import argparse
import asyncio
import array
import json
import hashlib
import difflib
import math
import re
import shutil
import subprocess
import sys
import wave
from pathlib import Path


def run(command: list[str]) -> None:
    completed = subprocess.run(command, text=True, capture_output=True)
    if completed.returncode:
        detail = (completed.stderr or completed.stdout)[-2500:]
        raise RuntimeError(f"Command failed ({completed.returncode}): {' '.join(command[:5])}\n{detail}")


def media_dimensions(path: Path) -> tuple[int, int]:
    completed = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "json", str(path)],
        text=True, capture_output=True
    )
    if completed.returncode:
        raise RuntimeError(f"Could not read video dimensions for {path}: {completed.stderr[-1000:]}")
    streams = json.loads(completed.stdout).get("streams", [])
    if not streams:
        raise RuntimeError(f"No video stream found in {path}.")
    return int(streams[0]["width"]), int(streams[0]["height"])

def media_duration(path: Path) -> float:
    completed = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
        text=True, capture_output=True
    )
    if completed.returncode:
        raise RuntimeError(f"Could not read audio duration for {path}: {completed.stderr[-1000:]}")
    return float(completed.stdout.strip())


def midi_hz(note: int) -> float:
    return 440.0 * (2.0 ** ((note - 69) / 12.0))


def make_music(path: Path, duration: float, mood: str, duck_intervals: list[tuple[float, float]] | None = None) -> None:
    sr = 24000
    # Four restrained, slowly changing harmonic pads; no copyrighted melody or samples.
    progressions = {
        "ambient": [(48, 55, 60, 64), (45, 52, 57, 60), (41, 48, 53, 57), (43, 50, 55, 59)],
        "uplifting": [(55, 62, 67, 71), (50, 57, 62, 66), (52, 59, 64, 67), (48, 55, 60, 64)],
        "suspense": [(45, 52, 57, 60), (41, 48, 53, 56), (40, 47, 52, 55), (43, 50, 55, 58)],
    }
    chords = progressions.get(mood, progressions["ambient"])
    freqs = [[midi_hz(n) for n in chord] for chord in chords]
    frames = max(1, int(duration * sr))
    samples = array.array("h")
    fade = min(1.2, duration / 4)
    for i in range(frames):
        t = i / sr
        chord_idx = int(t // 8) % len(freqs)
        local = t % 8
        change_fade = min(1.0, local / 0.8, (8.0 - local) / 0.8)
        edge_fade = min(1.0, t / fade, (duration - t) / fade) if fade else 1.0
        pulse = 0.90 + 0.10 * math.sin(2 * math.pi * 0.075 * t)
        section_gain = 1.0
        value = 0.0
        for voice, hz in enumerate(freqs[chord_idx]):
            amp = (0.020 if voice == 0 else 0.014) * (1.0 if voice < 2 else 0.78)
            value += amp * (math.sin(2 * math.pi * hz * t) + 0.18 * math.sin(4 * math.pi * hz * t))
        if mood == "suspense":
            progress = t / max(duration, 0.001)
            if progress < 0.28:
                section_gain = 1.02
            elif progress < 0.52:
                section_gain = 1.12
            elif progress < 0.70:
                section_gain = 0.86
            elif progress < 0.88:
                section_gain = 0.72
            elif progress < 0.96:
                section_gain = 0.22
            else:
                section_gain = 0.88 + 0.20 * min(1.0, (progress - 0.96) / 0.04)
            bass_hz = freqs[chord_idx][0] * 0.5
            heartbeat = max(0.0, math.sin(2 * math.pi * 0.82 * t)) ** 8
            value += 0.018 * heartbeat * math.sin(2 * math.pi * bass_hz * t)
            tension = min(1.0, max(0.0, (progress - 0.25) / 0.35))
            value += 0.004 * tension * math.sin(2 * math.pi * freqs[chord_idx][0] * 1.05946 * t)
        if duck_intervals and any(start <= t <= end for start, end in duck_intervals):
            section_gain = 0.0
        value *= max(0.0, edge_fade) * change_fade * pulse * section_gain
        value = max(-0.2, min(0.2, value))
        sample = int(value * 32767)
        samples.append(sample)
        samples.append(int(sample * (0.985 + 0.015 * math.sin(2 * math.pi * 0.03 * t))))
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(2)
        wav.setsampwidth(2)
        wav.setframerate(sr)
        wav.writeframes(samples.tobytes())


def make_effects(path: Path, duration: float, cues: list[dict] | None = None, duck_intervals: list[tuple[float, float]] | None = None) -> None:
    """Create deterministic original effects from production-defined audio cues."""
    sr = 24000
    frame_count = max(1, int(duration * sr))
    mono = array.array("h", [0]) * frame_count

    def add_event(start: float, seconds: float, kind: str, frequency: float, amplitude: float, fade_in: float = 0.0, fade_out: float = 0.0) -> None:
        first = max(0, int(start * sr))
        count = min(int(seconds * sr), frame_count - first)
        if count <= 0:
            return
        noise_state = 0.0
        for offset in range(count):
            t = offset / sr
            progress = t / max(seconds, 0.001)
            absolute_index = first + offset
            seed = (absolute_index * 1664525 + 1013904223) & 0xFFFFFFFF
            noise_sample = (seed / 0xFFFFFFFF) * 2.0 - 1.0
            noise_state = noise_state * 0.94 + noise_sample * 0.06
            if kind == "boom":
                envelope = math.exp(-5.5 * t)
                wave_value = math.sin(2 * math.pi * frequency * t) + 0.32 * math.sin(2 * math.pi * frequency * 0.5 * t) + noise_sample * 0.18
            elif kind == "click":
                envelope = math.exp(-48 * t)
                wave_value = math.sin(2 * math.pi * frequency * t) + 0.28 * math.sin(2 * math.pi * frequency * 2.3 * t) + noise_sample * 0.55
            elif kind == "step":
                envelope = math.exp(-20 * t)
                wave_value = math.sin(2 * math.pi * frequency * t) + 0.24 * math.sin(2 * math.pi * frequency * 2.1 * t) + noise_sample * 0.42
            elif kind == "creak":
                envelope = math.sin(math.pi * min(1.0, progress)) ** 1.4
                swept = frequency - 170 * progress
                wave_value = math.sin(2 * math.pi * swept * t) + 0.2 * math.sin(2 * math.pi * swept * 2 * t) + noise_sample * 0.28
            elif kind == "buzz":
                envelope = 0.62 + 0.38 * math.sin(2 * math.pi * 7 * t)
                wave_value = math.sin(2 * math.pi * frequency * t) + 0.25 * math.sin(2 * math.pi * frequency * 3 * t) + noise_sample * 0.08
            elif kind == "bird":
                envelope = math.sin(math.pi * min(1.0, progress)) ** 2
                swept = frequency + 420 * math.sin(math.pi * progress)
                wave_value = math.sin(2 * math.pi * swept * t) + 0.18 * math.sin(2 * math.pi * swept * 2.01 * t)
            elif kind == "breath":
                envelope = math.sin(math.pi * min(1.0, progress)) ** 2
                wave_value = noise_state * 1.6 + 0.25 * math.sin(2 * math.pi * frequency * t)
            elif kind == "whisper":
                envelope = math.sin(math.pi * min(1.0, progress)) ** 1.25
                swept = frequency + 24 * math.sin(2 * math.pi * 3.2 * t)
                wave_value = noise_state * 1.35 + 0.34 * math.sin(2 * math.pi * swept * t) + 0.16 * math.sin(2 * math.pi * swept * 1.51 * t)
            else:
                envelope = 0.7 + 0.3 * math.sin(2 * math.pi * 0.11 * t)
                wave_value = noise_state * 1.8 + 0.18 * math.sin(2 * math.pi * frequency * t)
            fade_in_gain = min(1.0, t / fade_in) if fade_in > 0 else 1.0
            fade_out_gain = min(1.0, (seconds - t) / fade_out) if fade_out > 0 else 1.0
            envelope *= max(0.0, min(fade_in_gain, fade_out_gain))
            global_time = start + t
            duck_gain = 0.0 if duck_intervals and any(left <= global_time <= right for left, right in duck_intervals) else 1.0
            index = first + offset
            value = mono[index] + int(amplitude * envelope * wave_value * duck_gain * 32767)
            mono[index] = max(-32768, min(32767, value))

    kind_settings = {
        "impact": ("boom", 58), "boom": ("boom", 58),
        "click": ("click", 1450), "footstep": ("step", 78), "step": ("step", 78),
        "door": ("creak", 300), "creak": ("creak", 300),
        "electric": ("buzz", 62), "buzz": ("buzz", 62),
        "bird": ("bird", 1850), "breath": ("breath", 120),
        "whisper": ("whisper", 95), "wind": ("wind", 92),
    }
    selected_cues = cues if cues is not None else [{"type":"ambience","label":"wind ambience","startSeconds":0,"durationSeconds":duration,"gainDb":-18}]
    for cue in selected_cues:
        cue_type = str(cue.get("type", "")).lower()
        if cue_type not in ("ambience", "foley", "sound-effect"):
            continue
        label = str(cue.get("label", "")).lower()
        match = next((settings for token, settings in kind_settings.items() if token in label), ("wind", 92) if cue_type == "ambience" else ("click", 900))
        kind, frequency = match
        start = max(0.0, float(cue.get("startSeconds", 0)))
        seconds = min(float(cue.get("durationSeconds") or 0.35), max(0.0, duration - start))
        gain_db = max(-48.0, min(12.0, float(cue.get("gainDb", -6))))
        amplitude = 0.075 * (10 ** (gain_db / 20.0))
        fade_in = min(seconds, max(0.0, float(cue.get('fadeInSeconds', 0))))
        fade_out = min(seconds, max(0.0, float(cue.get('fadeOutSeconds', 0))))
        add_event(start, seconds, kind, frequency, amplitude, fade_in, fade_out)

    stereo = array.array("h")
    for sample in mono:
        stereo.append(sample)
        stereo.append(int(sample * 0.97))
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(2)
        wav.setsampwidth(2)
        wav.setframerate(sr)
        wav.writeframes(stereo.tobytes())


async def make_edge_voice(text: str, voice: str, target: Path, rate: str = "+0%", pitch: str = "+0Hz", volume: str = "+0%") -> list[dict]:
    """Stream Edge TTS audio and retain its genuine word-boundary timestamps."""
    import edge_tts

    words: list[dict] = []
    communicate = edge_tts.Communicate(text, voice=voice, rate=rate, volume=volume, pitch=pitch, boundary="WordBoundary")
    with target.open("wb") as audio_file:
        async for chunk in communicate.stream():
            if chunk.get("type") == "audio":
                audio_file.write(chunk["data"])
            elif chunk.get("type") == "WordBoundary":
                # Edge TTS offsets/durations are expressed in 100-nanosecond ticks.
                offset = int(chunk["offset"])
                duration = int(chunk["duration"])
                words.append({
                    "text": str(chunk["text"]),
                    "start": offset / 10_000_000,
                    "end": (offset + duration) / 10_000_000,
                    "source": "edge-tts-word-boundary",
                })
    return words


def make_voice(text: str, voice: str, target: Path, rate: str = "+0%", pitch: str = "+0Hz", volume: str = "+0%") -> tuple[str, list[dict]]:
    try:
        words = asyncio.run(make_edge_voice(text, voice, target, rate, pitch, volume))
        if target.exists() and target.stat().st_size > 500 and words:
            return "edge-tts", words
        raise RuntimeError("Edge TTS returned audio without usable word-boundary events.")
    except Exception as exc:
        print(f"[audio] Edge TTS alignment unavailable; checking local espeak-ng fallback: {exc}", file=sys.stderr)
    espeak = shutil.which("espeak-ng") or shutil.which("espeak")
    if espeak:
        wav_target = target.with_suffix(".wav")
        try:
            run([espeak, "-v", "en-us", "-s", "155", "-w", str(wav_target), text])
            run(["ffmpeg", "-y", "-v", "error", "-i", str(wav_target), "-c:a", "libmp3lame", "-q:a", "4", str(target)])
            if not target.exists() or target.stat().st_size < 500:
                raise RuntimeError("espeak-ng MP3 conversion produced no audio.")
        finally:
            wav_target.unlink(missing_ok=True)
        # espeak-ng does not expose reliable word boundaries; never label it aligned.
        return "espeak-ng", []
    raise RuntimeError("Voice requested but neither Edge TTS nor espeak-ng is available.")


def srt_time(seconds: float) -> str:
    ms = max(0, round(seconds * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def ass_time(seconds: float) -> str:
    total = max(0, round(seconds * 100))
    hours, total = divmod(total, 360000)
    minutes, total = divmod(total, 6000)
    secs, centis = divmod(total, 100)
    return f"{hours}:{minutes:02d}:{secs:02d}.{centis:02d}"


def ass_escape(value: str) -> str:
    return value.replace("\\", "／").replace("{", "｛").replace("}", "｝").replace("\\n", " ")


def normalize_word_alignments(words: list[dict]) -> list[dict]:
    normalized = sorted(words, key=lambda item: (float(item["start"]), float(item["end"])))
    previous_end = -1.0
    for item in normalized:
        item["start"] = float(item["start"])
        item["end"] = float(item["end"])
        if item["end"] <= item["start"]:
            raise RuntimeError(f"Invalid zero-length word alignment near {item['text']!r}.")
        overlap = previous_end - item["start"]
        if overlap > 0:
            # Correct only tiny boundary jitter; a larger overlap is a real defect.
            if overlap > 0.08:
                raise RuntimeError(
                    f"Word alignment overlaps by {overlap:.3f}s near {item['text']!r}; "
                    "check narration scheduling and Edge TTS boundary data."
                )
            item["start"] = round(previous_end, 6)
            if item["end"] <= item["start"]:
                raise RuntimeError(f"Word alignment collapsed while correcting boundary near {item['text']!r}.")
        previous_end = item["end"]
    return normalized


def validate_word_alignment_bounds(words: list[dict], duration: float) -> None:
    for item in words:
        if float(item["start"]) < 0 or float(item["end"]) > duration + 0.05:
            raise RuntimeError(
                f"Word timing for {item['text']!r} falls outside the {duration:.2f}s video timeline."
            )


def compare_word_alignment_coverage(text: str, events: list[dict]) -> dict:
    """Compare actual speech-boundary tokens with the approved narration text.

    Sequence matching tolerates punctuation and provider tokenization differences,
    while exposing omitted or unexpected spoken tokens in the QA report.
    """
    token_pattern = re.compile(r"[\\w]+(?:['’][\\w]+)?", re.UNICODE)
    expected = [token.casefold().replace("’", "'") for token in token_pattern.findall(text)]
    observed = [token.casefold().replace("’", "'") for event in events
                for token in token_pattern.findall(str(event.get("text", "")))]
    matcher = difflib.SequenceMatcher(a=expected, b=observed, autojunk=False)
    matched_expected: set[int] = set()
    matched_observed: set[int] = set()
    for block in matcher.get_matching_blocks():
        matched_expected.update(range(block.a, block.a + block.size))
        matched_observed.update(range(block.b, block.b + block.size))
    missing = [expected[index] for index in range(len(expected)) if index not in matched_expected]
    extra = [observed[index] for index in range(len(observed)) if index not in matched_observed]
    return {
        "expectedWordCount": len(expected),
        "alignedWordCount": len(observed),
        "matchedWordCount": len(matched_expected),
        "coverage": len(matched_expected) / max(1, len(expected)),
        "missingWords": missing,
        "unexpectedWords": extra,
    }


def write_word_ass(words: list[dict], path: Path, width: int, height: int, emphasis_words: set[str] | None = None) -> None:
    # Keep two-word context on screen while the currently spoken word turns red.
    font_size = max(36, round(width * 0.075))
    y = round(height * 0.79)
    header = [
        "[Script Info]",
        "ScriptType: v4.00+",
        f"PlayResX: {width}",
        f"PlayResY: {height}",
        "WrapStyle: 2",
        "ScaledBorderAndShadow: yes",
        "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        f"Style: Default,Arial,{font_size},&H00FFFFFF,&H000040FF,&H00000000,&H99000000,-1,0,0,0,100,100,0,0,1,5,2,5,70,70,0,1",
        "",
        "[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"
    ]
    rows = []
    for index, item in enumerate(words):
        start = float(item["start"])
        end = float(item["end"])
        if index + 1 < len(words):
            next_start = float(words[index + 1]["start"])
            if next_start > start:
                end = min(end, next_start)
        if end <= start:
            continue
        current_text = str(item["text"])
        current = ass_escape(current_text)
        normalized = re.sub(r"[^a-z0-9]+", "", current_text.lower())
        current_colour = "&H000040FF&" if normalized in (emphasis_words or set()) else "&H00FFFFFF&"
        if index and words[index - 1].get("sceneIndex") == item.get("sceneIndex"):
            previous = ass_escape(str(words[index - 1]["text"]))
            caption = f"{{\\an5\\pos({width // 2},{y})\\bord5\\shad2\\1c&H00FFFFFF&}}{previous} {{\\1c{current_colour}}}{current}"
        else:
            caption = f"{{\\an5\\pos({width // 2},{y})\\bord5\\shad2\\1c{current_colour}}}{current}"
        rows.append(f"Dialogue: 0,{ass_time(start)},{ass_time(end)},Default,,0,0,0,,{caption}")
    path.write_text("\n".join(header + rows) + "\n", encoding="utf-8")


def write_srt(subtitles: list[dict], path: Path) -> None:
    rows = []
    for index, item in enumerate(subtitles, 1):
        rows.append(f"{index}\n{srt_time(float(item['start']))} --> {srt_time(float(item['end']))}\n{item['text']}\n")
    path.write_text("\n".join(rows), encoding="utf-8")


def prepare_audio(spec: dict, workdir: Path, require_word_alignment: bool) -> dict:
    audio = spec.get("audio") or {}
    duration = float(spec["durationSeconds"])
    report: dict = {"voiceProvider": None, "voiceLines": 0, "voiceSegments": 0, "voiceDurationSeconds": 0.0, "musicGenerated": False, "effectsGenerated": False, "wordAlignmentProvider": None, "alignedWordCount": 0}
    aligned_words: list[dict] = []
    voice_tracks: list[dict] = []
    scene_boundaries: list[tuple[int, float, float]] = []
    scene_cursor = 0.0
    narration_lines: list[str] = []
    dialogue_lines = spec.get('dialogue') or []
    voice_profiles = {profile['id']:profile for profile in (spec.get('voiceProfiles') or [])}
    scene_index_by_id = {scene['id']:index for index,scene in enumerate(spec.get('scenes', []))}
    alignment_audits: list[dict] = []
    for idx, scene in enumerate(spec.get("scenes", [])):
        scene_duration = float(scene["durationSeconds"])
        scene_boundaries.append((idx, scene_cursor, scene_cursor + scene_duration))
        narration = (scene.get("narration") or "").strip()
        if narration:
            narration_lines.append(narration)
        scene_cursor += scene_duration
    if abs(scene_cursor - duration) > 0.001:
        raise RuntimeError(f"Storyboard scene timecodes total {scene_cursor:.3f}s, not the required {duration:.3f}s.")

    if audio.get("voiceEnabled", True) and narration_lines:
        voice_name = audio.get("voice", "en-US-AriaNeural")
        # One continuous narration master preserves natural pacing across the production's fixed scene boundaries.
        voice_text = "\n\n".join(narration_lines)
        target = workdir / "voice-master.mp3"
        expected_word_count = len(re.findall(r"\b[\w]+(?:['’][\w]+)?\b", voice_text))
        # Fit the continuous voice track inside the configured production timeline.
        # Retry only with progressively faster Edge voices; retain the final attempt's
        # real word-boundary events so captions and animation remain aligned to its audio.
        voice_rate = "+10%"
        clip_duration = 0.0
        provider = ""
        word_events = []
        for candidate_rate in ("+10%", "+15%", "+20%", "+25%", "+30%"):
            provider, word_events = make_voice(voice_text, voice_name, target, rate=candidate_rate)
            clip_duration = media_duration(target)
            voice_rate = candidate_rate
            if clip_duration <= duration - 0.45:
                break
            if provider != "edge-tts":
                break
            print(f"[audio] Narration at {candidate_rate} is {clip_duration:.2f}s; retrying faster to preserve the configured production timeline.", file=sys.stderr)
        if require_word_alignment and (provider != "edge-tts" or not word_events):
            raise RuntimeError("Production word alignment required, but the continuous narration master has no genuine Edge TTS word boundaries.")
        alignment_coverage = compare_word_alignment_coverage(voice_text, word_events)
        alignment_audits.append(alignment_coverage)
        report["wordAlignmentAudit"] = alignment_coverage
        report["alignedWordCoverage"] = round(alignment_coverage["coverage"], 4)
        if require_word_alignment and alignment_coverage["coverage"] < 0.98:
            missing = ", ".join(alignment_coverage["missingWords"][:12]) or "unknown"
            raise RuntimeError(
                f"Edge TTS aligned {alignment_coverage['matchedWordCount']} of "
                f"{alignment_coverage['expectedWordCount']} narration words "
                f"({alignment_coverage['coverage']:.2%}); missing: {missing}. "
                "Word-synchronized captions and choreography require at least 98% token coverage."
            )
        if clip_duration <= 0:
            raise RuntimeError("Continuous narration master produced an empty audio track.")
        if clip_duration > duration - 0.45:
            raise RuntimeError(f"Continuous narration takes {clip_duration:.2f}s even at {voice_rate}; it must finish by {duration - 0.45:.2f}s to preserve the configured ending and silence. Adjust delivery without changing the approved scene timecodes.")
        for event in word_events:
            word_start = float(event["start"])
            scene_index = next((idx for idx, start, end in scene_boundaries if start <= word_start < end), None)
            if scene_index is None:
                raise RuntimeError(f"Narration word {event['text']!r} at {word_start:.3f}s falls outside the production timeline.")
            aligned_words.append({**event, "sceneIndex": scene_index, "start": round(word_start, 6), "end": round(float(event["end"]), 6)})
        providers = {provider}
        report["voiceProvider"] = provider
        report["voiceLines"] = 1
        report["voiceSegments"] = len(narration_lines)
        report["voiceDurationSeconds"] = round(clip_duration, 3)
        report["voiceRate"] = voice_rate
        report["expectedWordCount"] = expected_word_count
        report["alignedWordCoverage"] = round(len(word_events) / max(1, expected_word_count), 4)
        voice_tracks.append({"kind": "voice", "file": target.name, "delayMs": 0, "volume": float(audio.get("voiceVolume", 1)), "bytes": target.stat().st_size, "sha256": hashlib.sha256(target.read_bytes()).hexdigest()})
    elif require_word_alignment and not dialogue_lines:
        raise RuntimeError("Production word alignment required, but the specification contains no narration or dialogue.");

    if audio.get("voiceEnabled", True):
        for dialogue_index,line in enumerate(dialogue_lines):
            profile = voice_profiles.get(line.get("voiceProfileId")) if line.get("voiceProfileId") else None
            if line.get("voiceProfileId") and not profile:
                raise RuntimeError(f"Dialogue line {line.get('id')} references a missing voice profile.")
            voice_name = (profile or {}).get("voice", audio.get("voice", "en-US-AriaNeural"))
            preferred_rate = (profile or {}).get("rate", "+10%")
            pitch = (profile or {}).get("pitch", "+0Hz")
            profile_volume = (profile or {}).get("volume", "+0%")
            volume_factor = max(0.0, 1.0 + int(profile_volume.replace("%","")) / 100.0)
            line_start = float(line["startSeconds"])
            line_end = float(line["endSeconds"])
            slot_duration = line_end - line_start
            target = workdir / f"dialogue-{dialogue_index + 1:03d}.mp3"
            candidate_rates = list(dict.fromkeys([preferred_rate, "+15%", "+20%", "+25%", "+30%"]))
            provider = ""
            word_events = []
            clip_duration = 0.0
            final_rate = preferred_rate
            for candidate_rate in candidate_rates:
                provider,word_events = make_voice(str(line["text"]),voice_name,target,rate=candidate_rate,pitch=pitch,volume=profile_volume)
                clip_duration = media_duration(target)
                final_rate = candidate_rate
                if clip_duration <= slot_duration - 0.05:
                    break
                if provider != "edge-tts":
                    break
            if clip_duration > slot_duration - 0.05:
                raise RuntimeError(f"Dialogue line {line.get('id')} takes {clip_duration:.2f}s but its assigned window is only {slot_duration:.2f}s.");
            if require_word_alignment and (provider != "edge-tts" or not word_events):
                raise RuntimeError(f"Dialogue line {line.get('id')} has no genuine Edge TTS word boundaries.");
            audit = compare_word_alignment_coverage(str(line["text"]),word_events)
            alignment_audits.append(audit)
            if require_word_alignment and audit["coverage"] < 0.98:
                missing = ", ".join(audit["missingWords"][:12]) or "unknown"
                raise RuntimeError(f"Dialogue line {line.get('id')} word alignment coverage is {audit['coverage']:.2%}; missing: {missing}.");
            scene_index = scene_index_by_id.get(line["sceneId"])
            if scene_index is None:
                raise RuntimeError(f"Dialogue line {line.get('id')} references an unknown scene.");
            for event in word_events:
                absolute_start = line_start + float(event["start"])
                absolute_end = line_start + float(event["end"])
                if absolute_end > line_end + 0.05:
                    raise RuntimeError(f"Dialogue word {event['text']!r} exceeds its assigned line window.");
                aligned_words.append({**event,"sceneIndex":scene_index,"start":round(absolute_start,6),"end":round(absolute_end,6),"speaker":line.get("speaker"),"characterId":line.get("characterId")});
            voice_tracks.append({"kind":"dialogue","file":target.name,"delayMs":round(line_start * 1000),"volume":float(audio.get("voiceVolume",1)) * volume_factor,"bytes":target.stat().st_size,"sha256":hashlib.sha256(target.read_bytes()).hexdigest(),"speaker":line.get("speaker"),"voiceProfileId":line.get("voiceProfileId")});
            if not report.get("voiceProvider"):
                report["voiceProvider"] = provider
            report["voiceLines"] = int(report.get("voiceLines",0)) + 1
            report["voiceSegments"] = int(report.get("voiceSegments",0)) + 1
            report["voiceDurationSeconds"] = round(max(float(report.get("voiceDurationSeconds",0)),line_start + clip_duration),3)
            report["dialogueVoiceProfiles"] = report.get("dialogueVoiceProfiles",[]) + [{"lineId":line.get("id"),"speaker":line.get("speaker"),"voiceProfileId":line.get("voiceProfileId"),"provider":provider,"voice":voice_name,"rate":final_rate}]
            report["expectedWordCount"] = int(report.get("expectedWordCount",0)) + audit["expectedWordCount"]
        if alignment_audits:
            total_expected = sum(audit["expectedWordCount"] for audit in alignment_audits)
            total_aligned = sum(audit["alignedWordCount"] for audit in alignment_audits)
            total_matched = sum(audit["matchedWordCount"] for audit in alignment_audits)
            missing = [word for audit in alignment_audits for word in audit["missingWords"]]
            unexpected = [word for audit in alignment_audits for word in audit["unexpectedWords"]]
            combined_audit = {"expectedWordCount":total_expected,"alignedWordCount":total_aligned,"matchedWordCount":total_matched,"coverage":total_matched / max(1,total_expected),"missingWords":missing,"unexpectedWords":unexpected}
            report["wordAlignmentAudit"] = combined_audit
            report["alignedWordCoverage"] = round(combined_audit["coverage"],4)
            if require_word_alignment and combined_audit["coverage"] < 0.98:
                raise RuntimeError(f"Combined narration and dialogue word alignment coverage is {combined_audit['coverage']:.2%}; at least 98% is required.");

    if aligned_words:
        aligned_words = normalize_word_alignments(aligned_words)
        validate_word_alignment_bounds(aligned_words, duration)
        alignment_path = workdir / "word-alignments.json"
        alignment_path.write_text(json.dumps({"schemaVersion": 1, "timebase": "seconds-from-video-start", "provider": "edge-tts-word-boundary", "words": aligned_words}, indent=2), encoding="utf-8")
        report["wordAlignmentSha256"] = hashlib.sha256(alignment_path.read_bytes()).hexdigest()
        report["wordAlignmentProvider"] = "edge-tts-word-boundary"
        report["alignedWordCount"] = len(aligned_words)
        report["wordAlignmentFile"] = alignment_path.name
    elif require_word_alignment:
        raise RuntimeError("Production word alignment required, but no word-boundary events were captured.")

    music_ducks: list[tuple[float, float]] = []
    effects_ducks: list[tuple[float, float]] = []
    final_silence_start = max(0.0, duration - 0.15)
    music_ducks.append((final_silence_start, duration))
    effects_ducks.append((final_silence_start, duration))
    audio_cues = spec.get("audioCues") or []
    effect_cues = [cue for cue in audio_cues if cue.get("type") in ("ambience", "foley", "sound-effect") and not cue.get("assetId")]
    asset_cues = [cue for cue in audio_cues if cue.get("assetId")]
    production_assets = {asset.get("id"):asset for asset in (spec.get("assets") or [])}

    tracks: list[dict] = []
    has_asset_music = any(cue.get("type") == "music" for cue in asset_cues)
    if audio.get("musicEnabled", True) and not has_asset_music:
        music_path = workdir / "music.wav"
        make_music(music_path, duration, audio.get("musicStyle", "ambient"), music_ducks)
        tracks.append({"kind": "music", "file": music_path.name, "delayMs": 0, "volume": float(audio.get("musicVolume", 0.12)), "bytes": music_path.stat().st_size, "sha256": hashlib.sha256(music_path.read_bytes()).hexdigest()})
        report["musicGenerated"] = True
    effects_enabled = bool(audio.get("effectsEnabled", effect_cues or any(cue.get("type") in ("ambience", "foley", "sound-effect") for cue in asset_cues)))
    if effects_enabled:
        effects_path = workdir / "effects.wav"
        make_effects(effects_path, duration, effect_cues if audio_cues else None, effects_ducks)
        tracks.append({"kind": "effects", "file": effects_path.name, "delayMs": 0, "volume": 0.18, "bytes": effects_path.stat().st_size, "sha256": hashlib.sha256(effects_path.read_bytes()).hexdigest()})
        report["effectsGenerated"] = True
    for cue in asset_cues:
        asset = production_assets.get(cue.get("assetId"))
        metadata = (asset or {}).get("metadata") or {}
        relative_path = metadata.get("resolvedPath")
        if not relative_path:
            if (asset or {}).get("required", True):
                raise RuntimeError(f"Required audio cue asset {cue.get('assetId')} was not resolved from the private asset library.")
            continue
        asset_path = workdir / relative_path
        if not asset_path.is_file() or asset_path.stat().st_size < 100:
            raise RuntimeError(f"Resolved audio cue asset is missing or empty: {cue.get('assetId')}.")
        mime_type = str(metadata.get("resolvedMimeType", ""))
        if not mime_type.startswith("audio/"):
            raise RuntimeError(f"Audio cue asset {cue.get('assetId')} has unsupported MIME type {mime_type!r}.")
        cue_duration = float(cue.get("durationSeconds") or max(0.01,media_duration(asset_path)))
        start_seconds = float(cue.get("startSeconds",0))
        if start_seconds + cue_duration > duration + 0.05:
            cue_duration = max(0.01,duration-start_seconds)
        gain_db = max(-60.0,min(12.0,float(cue.get("gainDb",0))))
        tracks.append({
            "kind":cue.get("type","sound-effect"),"file":str(asset_path.relative_to(workdir)),
            "delayMs":round(start_seconds*1000),"volume":10 ** (gain_db/20),
            "durationSeconds":cue_duration,
            "fadeInSeconds":min(cue_duration,float(cue.get("fadeInSeconds",0))),
            "fadeOutSeconds":min(cue_duration,float(cue.get("fadeOutSeconds",0))),
            "bytes":asset_path.stat().st_size,
            "sha256":hashlib.sha256(asset_path.read_bytes()).hexdigest(),
            "assetId":cue.get("assetId"),"cueId":cue.get("id")
        })
    tracks.extend(voice_tracks)
    report["effectsEnabled"] = effects_enabled
    report["musicDuckIntervals"] = music_ducks
    report["effectsDuckIntervals"] = effects_ducks
    report["finalSilenceStart"] = final_silence_start
    report["subtitleTiming"] = "edge-tts-word-boundary" if aligned_words else None
    report["subtitlesBurned"] = bool(aligned_words or (audio.get("burnSubtitles") and spec.get("subtitles")))
    manifest_path = workdir / "audio-manifest.json"
    report["audioManifestFile"] = manifest_path.name
    spec_hash = hashlib.sha256(json.dumps(spec, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()
    report["productionSpecSha256"] = spec_hash
    manifest = {"schemaVersion": 1, "durationSeconds": duration, "productionSpecSha256": spec_hash, "tracks": tracks, "report": report}
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest


def mux_prepared_audio(spec: dict, video_path: Path, output_path: Path, workdir: Path, manifest: dict, require_word_alignment: bool, burn_subtitles: bool) -> dict:
    duration = float(spec["durationSeconds"])
    input_args = ["-i", str(video_path)]
    filters: list[str] = []
    labels: list[str] = []
    for input_index, track in enumerate(manifest.get("tracks", []), 1):
        audio_path = workdir / track["file"]
        if not audio_path.exists() or audio_path.stat().st_size < 100:
            raise RuntimeError(f"Prepared audio track is missing or empty: {track['file']}")
        if int(track.get("bytes", audio_path.stat().st_size)) != audio_path.stat().st_size:
            raise RuntimeError(f"Prepared audio track size changed after narration approval: {track['file']}")
        expected_hash = track.get("sha256")
        if expected_hash and hashlib.sha256(audio_path.read_bytes()).hexdigest() != expected_hash:
            raise RuntimeError(f"Prepared audio track hash changed after narration approval: {track['file']}")
        input_args += ["-i", str(audio_path)]
        delay_ms = int(track.get("delayMs", 0))
        volume = float(track.get("volume", 1.0))
        label = f"audio{input_index}"
        chain = f"[{input_index}:a]"
        duration_seconds = track.get("durationSeconds")
        if duration_seconds:
            chain += f"atrim=duration={float(duration_seconds):.3f},asetpts=PTS-STARTPTS,"
        fade_in = float(track.get("fadeInSeconds",0))
        fade_out = float(track.get("fadeOutSeconds",0))
        if fade_in > 0:
            chain += f"afade=t=in:st=0:d={fade_in:.3f},"
        if fade_out > 0 and duration_seconds:
            fade_start = max(0.0,float(duration_seconds)-fade_out)
            chain += f"afade=t=out:st={fade_start:.3f}:d={fade_out:.3f},"
        if delay_ms:
            chain += f"adelay={delay_ms}|{delay_ms},"
        chain += f"volume={volume:.3f}[{label}]"
        filters.append(chain)
        labels.append(f"[{label}]")
    has_audio = bool(labels)
    if has_audio:
        mix_inputs = "".join(labels)
        filters.append(f"{mix_inputs}amix=inputs={len(labels)}:duration=longest:dropout_transition=1:normalize=0,alimiter=limit=0.95,loudnorm=I=-14:TP=-1.2:LRA=11[aout]")
        map_audio = ["-map", "[aout]", "-c:a", "aac", "-b:a", "192k"]
    else:
        map_audio = ["-an"]

    report = dict(manifest.get("report", {}))
    vf_args: list[str] = []
    alignment_path = workdir / "word-alignments.json"
    if require_word_alignment:
        if not alignment_path.exists():
            raise RuntimeError("Word-synchronized captions cannot be generated without prepared word alignment.")
        alignment_data = json.loads(alignment_path.read_text(encoding="utf-8"))
        words = alignment_data.get("words", [])
        if not words:
            raise RuntimeError("Prepared word alignment is empty.")
        expected_alignment_hash = manifest.get("report", {}).get("wordAlignmentSha256")
        if expected_alignment_hash and hashlib.sha256(alignment_path.read_bytes()).hexdigest() != expected_alignment_hash:
            raise RuntimeError("Prepared word alignment changed after narration approval.")
        width, height = media_dimensions(video_path)
        ass_path = workdir / "word-captions.ass"
        emphasis_words = {token.strip(".,!?;:()[]{}\'\"").lower() for cue in (spec.get("captionCues") or []) if cue.get("emphasis") in ("word", "phrase") for token in str(cue.get("text", "")).split()}
        write_word_ass(words, ass_path, width, height, emphasis_words)
        vf_args = ["-vf", f"ass={ass_path}"]
        report["subtitlesBurned"] = True
        report["subtitleTiming"] = "edge-tts-word-boundary"
    elif burn_subtitles and spec.get("subtitles"):
        srt_path = workdir / "subtitles.srt"
        write_srt(spec["subtitles"], srt_path)
        vf_args = ["-vf", f"subtitles={srt_path}:force_style='FontName=Arial,FontSize=24,Outline=2,Shadow=1,MarginV=60'"]
        report["subtitlesBurned"] = True
        report["subtitleTiming"] = "sentence-cue"
    else:
        report["subtitlesBurned"] = False

    filter_args = ["-filter_complex", ";".join(filters)] if has_audio else []
    command = ["ffmpeg", "-y", "-v", "error", *input_args, *filter_args, *vf_args, "-map", "0:v:0", *map_audio,
               "-t", str(duration), "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
               "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(output_path)]
    run(command)
    if not output_path.exists() or output_path.stat().st_size < 1000:
        raise RuntimeError("Audio mux did not produce a valid MP4.")
    report["muxedOutput"] = output_path.name
    return report


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--spec", required=True)
    parser.add_argument("--video")
    parser.add_argument("--output")
    parser.add_argument("--workdir", required=True)
    parser.add_argument("--burn-subtitles", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--prepare-only", action="store_true", help="Generate narration, word alignment, music and effects before video rendering.")
    parser.add_argument("--reuse-prepared", action="store_true", help="Mux an already prepared audio workdir without regenerating TTS.")
    parser.add_argument("--require-word-alignment", action="store_true", help="Fail unless every narration line has genuine Edge TTS word boundaries.")
    args = parser.parse_args()
    if args.prepare_only and args.reuse_prepared:
        raise RuntimeError("Use either --prepare-only or --reuse-prepared, not both.")
    spec_path = Path(args.spec)
    workdir = Path(args.workdir)
    workdir.mkdir(parents=True, exist_ok=True)
    if args.self_test:
        spec = {"durationSeconds": 5, "styleId": "audio-smoke", "scenes": [{"durationSeconds": 5, "narration": ""}], "subtitles": [], "audio": {"musicEnabled": True, "voiceEnabled": False, "musicStyle": "ambient", "musicVolume": 0.12, "voiceVolume": 1}}
    else:
        spec = json.loads(spec_path.read_text(encoding="utf-8"))

    manifest_path = workdir / "audio-manifest.json"
    if args.reuse_prepared:
        if not manifest_path.exists():
            raise RuntimeError("Prepared audio manifest is missing; run --prepare-only first.")
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        if abs(float(manifest.get("durationSeconds", 0)) - float(spec["durationSeconds"])) > 0.001:
            raise RuntimeError("Prepared audio duration does not match the production specification.")
        spec_hash = hashlib.sha256(json.dumps(spec, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()
        if manifest.get("productionSpecSha256") != spec_hash:
            raise RuntimeError("Prepared audio belongs to a different production specification; regenerate narration and alignment.")
        if args.require_word_alignment and not (workdir / "word-alignments.json").exists():
            raise RuntimeError("Prepared word alignment is required but missing.")
    else:
        manifest = prepare_audio(spec, workdir, args.require_word_alignment)
    if args.prepare_only:
        print(json.dumps(manifest.get("report", {})))
        return 0
    if not args.video or not args.output:
        raise RuntimeError("--video and --output are required unless --prepare-only is used.")
    report = mux_prepared_audio(spec, Path(args.video), Path(args.output), workdir, manifest, args.require_word_alignment, args.burn_subtitles)
    print(json.dumps(report))
    return 0

if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"audio_pipeline: {exc}", file=sys.stderr)
        raise SystemExit(1)
