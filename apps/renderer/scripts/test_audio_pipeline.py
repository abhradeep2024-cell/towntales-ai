import tempfile
import unittest
from pathlib import Path

from audio_pipeline import make_effects, normalize_word_alignments, validate_word_alignment_bounds, write_word_ass
import wave


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
        self.assertEqual([scene["durationSeconds"] for scene in spec["scenes"]], [5, 8, 6, 9, 3, 8, 9, 6, 6])
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
