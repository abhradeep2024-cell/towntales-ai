import tempfile
import unittest
from pathlib import Path

from audio_pipeline import make_effects, normalize_word_alignments, validate_word_alignment_bounds, write_word_ass, prepare_audio, mux_prepared_audio
import wave
from unittest.mock import patch



class PreparedAudioTests(unittest.TestCase):
    def test_audio_is_prepared_before_render_with_scene_relative_word_alignment_and_hashes(self):
        spec = {
            "durationSeconds": 5,
            "styleId": "test",
            "scenes": [
                {"durationSeconds": 2, "narration": "Hello town"},
                {"durationSeconds": 3, "narration": "Shadow moves"}
            ],
            "subtitles": [],
            "audio": {"musicEnabled": False, "voiceEnabled": True, "effectsEnabled": False}
        }
        def fake_voice(text, voice, target):
            target.write_bytes(b"voice-track-" * 60)
            return "edge-tts", [
                {"text": "Hello", "start": 0.1, "end": 0.4},
                {"text": "Shadow", "start": 2.1, "end": 2.4}
            ]
        with tempfile.TemporaryDirectory() as directory:
            with patch("audio_pipeline.make_voice", side_effect=fake_voice), patch("audio_pipeline.media_duration", return_value=4.5):
                manifest = prepare_audio(spec, Path(directory), require_word_alignment=True)
            self.assertEqual(manifest["report"]["voiceLines"], 1)
            self.assertEqual(manifest["report"]["voiceSegments"], 2)
            self.assertEqual(manifest["report"]["wordAlignmentProvider"], "edge-tts-word-boundary")
            self.assertTrue((Path(directory) / "audio-manifest.json").exists())
            self.assertTrue((Path(directory) / "word-alignments.json").exists())
            self.assertEqual([track["kind"] for track in manifest["tracks"]], ["voice"])
            self.assertEqual([word["sceneIndex"] for word in json.loads((Path(directory) / "word-alignments.json").read_text())["words"]], [0, 1])
            self.assertTrue(all(track["sha256"] and track["bytes"] > 100 for track in manifest["tracks"]))

    def test_narration_that_spills_past_its_scene_is_rejected(self):
        spec = {
            "durationSeconds": 2,
            "styleId": "test",
            "scenes": [{"durationSeconds": 2, "narration": "This line is too long"}],
            "subtitles": [],
            "audio": {"musicEnabled": False, "voiceEnabled": True, "effectsEnabled": False}
        }
        def fake_voice(text, voice, target):
            target.write_bytes(b"voice-track-" * 60)
            return "edge-tts", [{"text": "This", "start": 0.1, "end": 0.4}]
        with tempfile.TemporaryDirectory() as directory:
            with patch("audio_pipeline.make_voice", side_effect=fake_voice), patch("audio_pipeline.media_duration", return_value=2.2):
                with self.assertRaisesRegex(RuntimeError, "Continuous narration takes 2.20s"):
                    prepare_audio(spec, Path(directory), require_word_alignment=True)

    def test_mux_rejects_changed_prepared_audio_hash(self):
        with tempfile.TemporaryDirectory() as directory:
            workdir = Path(directory)
            audio_file = workdir / "voice.mp3"
            audio_file.write_bytes(b"prepared-audio" * 60)
            manifest = {"tracks": [{"kind": "voice", "file": "voice.mp3", "delayMs": 0, "volume": 1, "bytes": audio_file.stat().st_size, "sha256": "incorrect"}], "report": {}}
            spec = {"durationSeconds": 5, "subtitles": []}
            with self.assertRaisesRegex(RuntimeError, "hash changed"):
                mux_prepared_audio(spec, workdir / "not-needed.mp4", workdir / "output.mp4", workdir, manifest, False, False)

class WordAlignmentTests(unittest.TestCase):
    def test_small_boundary_overlap_is_corrected(self):
        words = [
            {"text": "first", "start": 0.10, "end": 0.42},
            {"text": "second", "start": 0.39, "end": 0.70},
        ]
        result = normalize_word_alignments(words)
        self.assertEqual(result[1]["start"], 0.42)
        self.assertGreater(result[1]["end"], result[1]["start"])

    def test_material_overlap_is_rejected(self):
        words = [
            {"text": "first", "start": 0.10, "end": 0.70},
            {"text": "second", "start": 0.40, "end": 0.90},
        ]
        with self.assertRaisesRegex(RuntimeError, "overlaps by"):
            normalize_word_alignments(words)

    def test_word_events_cannot_extend_past_video_duration(self):
        words = [{"text": "late", "start": 59.8, "end": 60.2}]
        with self.assertRaisesRegex(RuntimeError, "outside the 60.00s video timeline"):
            validate_word_alignment_bounds(words, 60.0)

    def test_zero_length_word_is_rejected(self):
        with self.assertRaisesRegex(RuntimeError, "zero-length"):
            normalize_word_alignments([{"text": "empty", "start": 0.5, "end": 0.5}])

    def test_episode_fixture_matches_nine_scene_60_second_bible_timing(self):
        fixture = Path(__file__).parent.parent / "fixtures" / "episode-01-roblox.json"
        spec = __import__("json").loads(fixture.read_text(encoding="utf-8"))
        self.assertEqual(spec["styleId"], "roblox-cinematic-horror")
        self.assertEqual(spec["durationSeconds"], 60)
        self.assertEqual([scene["durationSeconds"] for scene in spec["scenes"]], [5, 6, 6, 7, 7, 8, 12, 5, 4])
        self.assertEqual(len(spec["scenes"]), 9)
        self.assertTrue(all(scene["narration"].strip() for scene in spec["scenes"]))
        self.assertAlmostEqual(sum(scene["durationSeconds"] for scene in spec["scenes"]), 60)

    def test_episode_production_defaults_to_bible_master_format(self):
        source = (Path(__file__).parent.parent / "src" / "compositions" / "episode01.ts").read_text(encoding="utf-8")
        self.assertIn("width: 1080", source)
        self.assertIn("height: 1920", source)
        self.assertIn("fps: 30", source)
        self.assertIn("durationSeconds: 60", source)

    def test_original_effects_render_as_stereo_24khz_audio(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "effects.wav"
            make_effects(target, 2.0)
            with wave.open(str(target), "rb") as audio:
                self.assertEqual(audio.getnchannels(), 2)
                self.assertEqual(audio.getframerate(), 24000)
                self.assertEqual(audio.getnframes(), 48000)
                self.assertGreater(max(abs(value) for value in audio.readframes(1000)), 0)

    def test_ass_captions_use_actual_word_timestamps_and_red_emphasis(self):
        words = [
            {"text": "shadow", "start": 0.10, "end": 0.30},
            {"text": "there", "start": 0.31, "end": 0.55},
            {"text": "friend.", "start": 0.56, "end": 0.90},
        ]
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "captions.ass"
            write_word_ass(words, target, 1080, 1920)
            output = target.read_text(encoding="utf-8")
        self.assertIn("Dialogue: 0,0:00:00.10,0:00:00.30", output)
        self.assertIn("shadow", output)
        self.assertIn("there", output)
        self.assertIn("&H000040FF&", output)
        self.assertIn("PlayResX: 1080", output)
        self.assertIn("PlayResY: 1920", output)


if __name__ == "__main__":
    unittest.main()
