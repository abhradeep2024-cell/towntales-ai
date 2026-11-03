#!/usr/bin/env python3
"""Free, local audio bed + optional Edge TTS narration, muxed into a rendered MP4.

Edge TTS is online and optional. If it is unavailable, espeak-ng is used when installed.
All voice/music is mixed and encoded by FFmpeg. No API credential is needed.
"""
from __future__ import annotations

import argparse
import asyncio
import array
import json
import hashlib
import math
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
            if 17 <= t < 24:
                section_gain = 1.08
            elif 24 <= t < 31:
                section_gain = 1.16
            elif 31 <= t < 39:
                section_gain = 0.88
            elif 39 <= t < 51:
                section_gain = 0.72
            elif 51 <= t < 56:
                section_gain = 0.18
            elif t >= 56:
                section_gain = 0.9 + 0.25 * min(1.0, (t - 56) / 4)
            bass_hz = freqs[chord_idx][0] * 0.5
            heartbeat = max(0.0, math.sin(2 * math.pi * 0.82 * t)) ** 8
            value += 0.018 * heartbeat * math.sin(2 * math.pi * bass_hz * t)
            tension = min(1.0, max(0.0, (t - 16) / 8))
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


def make_effects(path: Path, duration: float, duck_intervals: list[tuple[float, float]] | None = None, shadow_wave_start: float = 20.0) -> None:
    """Create a deterministic, original suspense SFX bed aligned to Episode 01 story beats."""
    sr = 24000
    frame_count = max(1, int(duration * sr))
    mono = array.array("h", [0]) * frame_count

    def add_event(start: float, seconds: float, kind: str, frequency: float, amplitude: float) -> None:
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
            else:  # filtered, low-frequency wind texture
                envelope = 0.7 + 0.3 * math.sin(2 * math.pi * 0.11 * t)
                wave_value = noise_state * 1.8 + 0.18 * math.sin(2 * math.pi * frequency * t)
            index = first + offset
            global_time = start + t
            duck_gain = 0.0 if duck_intervals and any(left <= global_time <= right for left, right in duck_intervals) else 1.0
            value = mono[index] + int(amplitude * envelope * wave_value * duck_gain * 32767)
            mono[index] = max(-32768, min(32767, value))

    add_event(0.0, min(51.0, duration), "wind", 92, 0.035)
    add_event(0.0, 0.95, "boom", 48, 0.26)
    add_event(1.45, 0.32, "click", 1250, 0.12)
    for tick in (5.35, 6.35, 7.35, 8.35, 9.35, 10.35):
        add_event(tick, 0.075, "click", 1750, 0.10)
    add_event(8.7, 0.8, "breath", 180, 0.04)
    for wave_index in range(3):
        add_event(shadow_wave_start + 0.15 + wave_index * 0.6, 0.26, "boom", 52, 0.12)
    add_event(shadow_wave_start + 1.95, 1.1, "breath", 72, 0.06)
    for index in range(14):
        add_event(24.25 + index * 0.46, 0.16, "step", 72 if index % 2 == 0 else 88, 0.12)
    for breath in (26.4, 28.1, 29.7):
        add_event(breath, 0.65, "breath", 105, 0.06)
    add_event(30.75, 0.32, "boom", 60, 0.18)
    add_event(31.35, 1.25, "creak", 310, 0.10)
    for beat in range(5):
        add_event(33.0 + beat * 0.92, 0.20, "boom", 58, 0.09)
        add_event(33.24 + beat * 0.92, 0.16, "boom", 66, 0.075)
    add_event(40.2, 2.4, "buzz", 60, 0.075)
    add_event(43.0, 0.9, "breath", 145, 0.065)
    add_event(48.2, 1.7, "buzz", 54, 0.065)
    for chirp in (51.25, 52.05, 53.1, 54.0, 55.0):
        add_event(chirp, 0.32, "bird", 1850, 0.045)
    add_event(57.35, 1.15, "breath", 110, 0.085)
    add_event(59.25, 0.72, "boom", 42, 0.22)

    stereo = array.array("h")
    for sample in mono:
        stereo.append(sample)
        stereo.append(int(sample * 0.97))
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(2)
        wav.setsampwidth(2)
        wav.setframerate(sr)
        wav.writeframes(stereo.tobytes())


async def make_edge_voice(text: str, voice: str, target: Path) -> list[dict]:
    """Stream Edge TTS audio and retain its genuine word-boundary timestamps."""
    import edge_tts

    words: list[dict] = []
    communicate = edge_tts.Communicate(text, voice=voice, rate="+0%", volume="+0%", pitch="+0Hz", boundary="WordBoundary")
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


def make_voice(text: str, voice: str, target: Path) -> tuple[str, list[dict]]:
    try:
        words = asyncio.run(make_edge_voice(text, voice, target))
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


def write_word_ass(words: list[dict], path: Path, width: int, height: int) -> None:
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
        current = ass_escape(str(item["text"]))
        if index:
            previous = ass_escape(str(words[index - 1]["text"]))
            caption = f"{{\\an5\\pos({width // 2},{y})\\bord5\\shad2\\1c&H00FFFFFF&}}{previous} {{\\1c&H000040FF&}}{current}"
        else:
            caption = f"{{\\an5\\pos({width // 2},{y})\\bord5\\shad2\\1c&H000040FF&}}{current}"
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
    report: dict = {"voiceProvider": None, "voiceLines": 0, "musicGenerated": False, "effectsGenerated": False, "wordAlignmentProvider": None, "alignedWordCount": 0}
    aligned_words: list[dict] = []
    voice_tracks: list[dict] = []
    scene_start = 0.0
    voice_cursor = 0.0
    providers: set[str] = set()

    if audio.get("voiceEnabled", True):
        voice_name = audio.get("voice", "en-US-AriaNeural")
        for idx, scene in enumerate(spec.get("scenes", [])):
            narration = (scene.get("narration") or "").strip()
            scene_duration = float(scene["durationSeconds"])
            if narration:
                if voice_cursor > scene_start + 0.12:
                    raise RuntimeError(f"Scene {idx - 1} narration overruns the next scene by {voice_cursor - scene_start:.2f}s; keep approved narration inside its own scene.")
                target = workdir / f"voice-{idx:02d}.mp3"
                provider, word_events = make_voice(narration, voice_name, target)
                providers.add(provider)
                if require_word_alignment and (provider != "edge-tts" or not word_events):
                    raise RuntimeError(f"Production word alignment required, but scene {idx} used {provider} without real word boundaries.")
                voice_start = scene_start
                clip_duration = media_duration(target)
                if clip_duration <= 0:
                    raise RuntimeError(f"Scene {idx} narration produced an empty audio track.")
                if clip_duration > scene_duration + 0.12:
                    raise RuntimeError(f"Scene {idx} narration takes {clip_duration:.2f}s but its approved scene duration is {scene_duration:.2f}s; revise timing or narration rather than letting dialogue spill into the next shot.")
                for event in word_events:
                    aligned_words.append({**event, "sceneIndex": idx, "start": round(voice_start + float(event["start"]), 6), "end": round(voice_start + float(event["end"]), 6)})
                voice_tracks.append({"kind": "voice", "file": target.name, "delayMs": max(0, round(voice_start * 1000)), "volume": float(audio.get("voiceVolume", 1)), "bytes": target.stat().st_size, "sha256": hashlib.sha256(target.read_bytes()).hexdigest(), "sceneIndex": idx})
                report["voiceLines"] += 1
                voice_cursor = voice_start + clip_duration
            scene_start += scene_duration
        report["voiceProvider"] = "+".join(sorted(providers)) if providers else None

    if aligned_words:
        aligned_words = normalize_word_alignments(aligned_words)
        validate_word_alignment_bounds(aligned_words, duration)
        alignment_path = workdir / "word-alignments.json"
        alignment_path.write_text(json.dumps({"schemaVersion": 1, "timebase": "seconds-from-video-start", "provider": "edge-tts-word-boundary", "words": aligned_words}, indent=2), encoding="utf-8")
        report["wordAlignmentProvider"] = "edge-tts-word-boundary"
        report["alignedWordCount"] = len(aligned_words)
        report["wordAlignmentFile"] = alignment_path.name
    elif require_word_alignment:
        raise RuntimeError("Production word alignment required, but no word-boundary events were captured.")

    waved_word = next((item for item in aligned_words if item.get("sceneIndex") == 3 and str(item["text"]).strip(".,!?;:").lower() == "waved"), None)
    shadow_wave_start = max(0.0, float(waved_word["start"]) - 0.25) if waved_word else 20.0
    music_ducks: list[tuple[float, float]] = []
    if spec.get("styleId") == "roblox-cinematic-horror":
        music_ducks.append((max(0.0, shadow_wave_start - 0.08), shadow_wave_start + 1.8))
    effects_ducks: list[tuple[float, float]] = []
    except_word = next((item for item in aligned_words if item.get("sceneIndex") == 7 and str(item["text"]).strip(".,!?;:").lower() == "except"), None)
    if except_word:
        me_word = next((item for item in aligned_words if item.get("sceneIndex") == 7 and str(item["text"]).strip(".,!?;:").lower() == "me" and float(item["start"]) >= float(except_word["start"])), None)
        if me_word:
            reveal_silence = (max(0.0, float(except_word["start"]) - 0.04), min(duration, float(me_word["end"]) + 0.35))
            music_ducks.append(reveal_silence)
            effects_ducks.append(reveal_silence)

    tracks: list[dict] = []
    if audio.get("musicEnabled", True):
        music_path = workdir / "music.wav"
        make_music(music_path, duration, audio.get("musicStyle", "ambient"), music_ducks)
        tracks.append({"kind": "music", "file": music_path.name, "delayMs": 0, "volume": float(audio.get("musicVolume", 0.12)), "bytes": music_path.stat().st_size, "sha256": hashlib.sha256(music_path.read_bytes()).hexdigest()})
        report["musicGenerated"] = True
    effects_enabled = bool(audio.get("effectsEnabled", spec.get("styleId") == "roblox-cinematic-horror"))
    if effects_enabled:
        effects_path = workdir / "effects.wav"
        make_effects(effects_path, duration, effects_ducks, shadow_wave_start)
        tracks.append({"kind": "effects", "file": effects_path.name, "delayMs": 0, "volume": 0.18, "bytes": effects_path.stat().st_size, "sha256": hashlib.sha256(effects_path.read_bytes()).hexdigest()})
        report["effectsGenerated"] = True
    tracks.extend(voice_tracks)
    report["effectsEnabled"] = effects_enabled
    report["musicDuckIntervals"] = music_ducks
    report["effectsDuckIntervals"] = effects_ducks
    report["shadowWaveStart"] = shadow_wave_start
    report["subtitleTiming"] = "edge-tts-word-boundary" if aligned_words else None
    report["subtitlesBurned"] = bool(aligned_words or (audio.get("burnSubtitles") and spec.get("subtitles")))
    manifest_path = workdir / "audio-manifest.json"
    report["audioManifestFile"] = manifest_path.name
    manifest = {"schemaVersion": 1, "durationSeconds": duration, "tracks": tracks, "report": report}
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
        input_args += ["-i", str(audio_path)]
        delay_ms = int(track.get("delayMs", 0))
        volume = float(track.get("volume", 1.0))
        label = f"audio{input_index}"
        if delay_ms:
            filters.append(f"[{input_index}:a]adelay={delay_ms}|{delay_ms},volume={volume:.3f}[{label}]")
        else:
            filters.append(f"[{input_index}:a]volume={volume:.3f}[{label}]")
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
        width, height = media_dimensions(video_path)
        ass_path = workdir / "word-captions.ass"
        write_word_ass(words, ass_path, width, height)
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
