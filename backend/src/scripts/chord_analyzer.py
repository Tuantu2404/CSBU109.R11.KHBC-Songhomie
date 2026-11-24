# -*- coding: utf-8 -*-
import sys
import os
import re
import io
import json
import uuid
import shutil
import logging
import tempfile
import warnings
import urllib.request
import urllib.parse
import numpy as np

warnings.filterwarnings("ignore")

if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
if hasattr(sys.stderr, "buffer"):
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")

PITCHES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
SUPPORTED_LANGUAGES = {"vi", "en"}
SEPARATION_MODEL = "UVR_MDXNET_KARA_2.onnx"

HALLUCINATION_PATTERNS = [
    r"subscribe",
    r"đăng\s*ký\s*kênh",
    r"ghiền\s*mì\s*gõ",
    r"la\s*la\s*school",
    r"video\s*hấp\s*dẫn",
    r"theo\s*dõi\s*kênh",
    r"bản\s*quyền\s*thuộc\s*về",
    r"cảm\s*ơn\s*các\s*bạn\s*đã\s*theo\s*dõi",
    r"thanks?\s+for\s+watching",
    r"please\s+subscribe",
    r"subtitles\s+by",
    r"captioned\s+by",
    r"amara\.org",
]

NOISE_SEGMENT_PATTERNS = [
    r"^official\s*(mv|m/v|music\s*video|audio|video|lyric\s*video|visualizer)?$",
    r"^m/?v$",
    r"^lyrics?(\s*video)?$",
    r"^audio$",
    r"^visualizer$",
    r"^teaser$",
    r"^trailer$",
    r"^karaoke$",
    r"^beat$",
    r"^instrumental$",
    r"^hd$",
    r"^4k$",
    r"^vietsub$",
]


def _is_hallucinated_subtitle(text):
    lowered = text.lower().strip()
    if len(lowered) < 1:
        return True
    if len(lowered) == 1 and re.match(r"^[a-zA-Z0-9\W]$", lowered):
        return True
    return any(re.search(pattern, lowered) for pattern in HALLUCINATION_PATTERNS)


def _strip_noise_words(text):
    if not text:
        return ""
    cleaned = re.sub(r"[「」『』《》〈〉]", " ", text)
    cleaned = re.sub(r"\([^)]*\)|\[[^\]]*\]|【[^】]*】", " ", cleaned)
    inline_noise = [
        r"\bofficial\s*(mv|m/v|music\s*video|audio|video|lyric\s*video|visualizer)?\b",
        r"\blyrics?(\s*video)?\b",
        r"\bvietsub\b",
        r"\bM/?V\b",
        r"\bHD\b",
        r"\b4K\b",
        r"\bprod\.?.*$",
        r"\bft\.?\b",
        r"\bfeat\.?\b",
    ]
    for pattern in inline_noise:
        cleaned = re.sub(pattern, " ", cleaned, flags=re.IGNORECASE)
    return re.sub(r"\s+", " ", cleaned).strip()


def _build_search_candidates(yt_meta, fallback_title=""):
    """Tạo danh sách từ khóa tìm kiếm thông minh từ tiêu đề YouTube (tối ưu nhạc Việt & Anh)."""
    candidates = []

    def add_candidate(val):
        cleaned = _strip_noise_words(val)
        if len(cleaned) >= 2 and cleaned.lower() not in {c.lower() for c in candidates}:
            candidates.append(cleaned)

    track = (yt_meta or {}).get("track", "")
    artist = (yt_meta or {}).get("artist", "")
    raw_title = (yt_meta or {}).get("title", "") or fallback_title

    if track and artist:
        add_candidate(f"{track} {artist}")
    if track:
        add_candidate(track)

    parts = [p.strip() for p in re.split(r"\s*(?:\||//)\s*", raw_title) if p.strip()]
    meaningful_parts = []
    for part in parts:
        clean_part = _strip_noise_words(part)
        if not clean_part:
            continue
        if any(re.match(pat, clean_part, flags=re.IGNORECASE) for pat in NOISE_SEGMENT_PATTERNS):
            continue
        meaningful_parts.append(clean_part)

    if len(meaningful_parts) >= 2:
        add_candidate(meaningful_parts[1])
        add_candidate(f"{meaningful_parts[1]} {meaningful_parts[0]}")
        add_candidate(" ".join(meaningful_parts[:2]))
    for p in meaningful_parts:
        add_candidate(p)

    if " - " in raw_title:
        dash_parts = [p.strip() for p in raw_title.split(" - ") if p.strip()]
        for dp in dash_parts:
            add_candidate(dp)

    add_candidate(re.sub(r"[-_|/]+", " ", raw_title))
    return candidates


def _build_whisper_initial_prompt(yt_meta, fallback_title=""):
    """Tạo prompt mồi giúp Whisper viết chuẩn tên bài hát, tên ca sĩ tiếng Việt & tiếng Anh."""
    parts = []
    track = _strip_noise_words((yt_meta or {}).get("track", ""))
    artist = _strip_noise_words((yt_meta or {}).get("artist", ""))
    clean_title = _strip_noise_words((yt_meta or {}).get("title", "") or fallback_title)

    if track:
        parts.append(track)
    elif clean_title:
        parts.append(clean_title)

    if artist and artist.lower() not in " ".join(parts).lower():
        parts.append(artist)

    prompt = " - ".join(parts).strip()
    return prompt[:180] if prompt else None


def _separate_vocals_and_instrumental(audio_path):
    """
    Tách file âm thanh gốc thành 2 track sạch: vocals.wav và instrumental.wav
    bằng audio-separator (tối ưu batch_size=4 cho CPU).
    """
    stem_dir = tempfile.mkdtemp(prefix="songhomie_stems_")
    model_cache_dir = os.path.join(tempfile.gettempdir(), "songhomie_onnx_models")
    os.makedirs(model_cache_dir, exist_ok=True)

    try:
        from audio_separator.separator import Separator

        separator = Separator(
            log_level=logging.ERROR,
            model_file_dir=model_cache_dir,
            output_dir=stem_dir,
            output_format="WAV",
            mdx_params={
                "hop_length": 1024,
                "segment_size": 256,
                "overlap": 0.25,
                "batch_size": 4,
                "enable_denoise": False,
            },
        )
        separator.load_model(model_filename=SEPARATION_MODEL)
        output_files = separator.separate(audio_path) or []

        vocals_path = None
        inst_path = None

        for f in output_files:
            full_path = f if os.path.exists(f) else os.path.join(stem_dir, os.path.basename(f))
            if not os.path.exists(full_path):
                continue
            lower_name = os.path.basename(full_path).lower()
            if "(vocals)" in lower_name or "_vocals" in lower_name:
                vocals_path = full_path
            elif (
                "(instrumental)" in lower_name
                or "(no vocals)" in lower_name
                or "_instrumental" in lower_name
            ):
                inst_path = full_path

        if vocals_path and inst_path:
            return vocals_path, inst_path, stem_dir

        shutil.rmtree(stem_dir, ignore_errors=True)
        return None, None, None
    except Exception as e:
        sys.stderr.write(f"[DEBUG] Audio separation skipped (fallback to mixed audio): {e}\n")
        shutil.rmtree(stem_dir, ignore_errors=True)
        return None, None, None


def _parse_lrc_lyrics(synced_lrc):
    """Chuyển đổi chuỗi định dạng LRC ([mm:ss.xx] Lời) sang danh sách mốc thời gian."""
    if not synced_lrc:
        return []
    segments = []
    for line in synced_lrc.splitlines():
        match = re.match(r"^\[(\d+):(\d+(?:\.\d+)?)\]\s*(.*)$", line.strip())
        if match:
            mins = int(match.group(1))
            secs = float(match.group(2))
            text = match.group(3).strip()
            if text and not text.startswith(("♪", "♫", "[", "(")):
                segments.append({
                    "start": round(mins * 60 + secs, 2),
                    "text": text,
                })
    return segments


def _detect_first_vocal_time(y_vocal, sr, librosa):
    """Dò giây đầu tiên có giọng hát để bù độ trễ đoạn nhạc dạo đầu (intro)."""
    try:
        from faster_whisper.vad import get_speech_timestamps, VadOptions

        y_16k = (
            librosa.resample(y_vocal, orig_sr=sr, target_sr=16000).astype(np.float32)
            if sr != 16000
            else y_vocal.astype(np.float32)
        )
        speech_chunks = get_speech_timestamps(
            y_16k,
            VadOptions(min_silence_duration_ms=700, speech_pad_ms=150),
        )
        if speech_chunks:
            return round(float(speech_chunks[0]["start"]) / 16000.0, 2)
    except Exception:
        pass
    return None


def _fetch_synced_lyrics_from_lrclib(yt_meta, fallback_title=""):
    """Chế độ 1: Tra cứu lời bài hát chuẩn từ LRCLIB qua nhiều ứng viên từ khóa."""
    candidates = _build_search_candidates(yt_meta, fallback_title)
    if not candidates:
        return [], ""

    best_query_used = candidates[0]
    for query in candidates[:5]:
        try:
            encoded_q = urllib.parse.quote(query)
            url = f"https://lrclib.net/api/search?q={encoded_q}"
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "Songhomie/1.0 (https://songhomie.app)"},
            )
            with urllib.request.urlopen(req, timeout=6) as resp:
                if resp.status != 200:
                    continue
                items = json.loads(resp.read().decode("utf-8"))
                if not isinstance(items, list):
                    continue

                for item in items:
                    synced = item.get("syncedLyrics")
                    if synced:
                        parsed = _parse_lrc_lyrics(synced)
                        if len(parsed) >= 4:
                            detected_name = item.get("trackName") or query
                            return parsed, detected_name
        except Exception as e:
            sys.stderr.write(f"[DEBUG] LRCLIB query '{query}' skipped: {e}\n")

    return [], best_query_used


def _polish_lyrics_with_llm(segments, song_title="", lang_code="auto"):
    """Hiệu đính dấu thanh tiếng Việt / chính tả tiếng Anh bằng Gemini hoặc Groq (không đổi sang bài khác)."""
    if not segments:
        return segments

    gemini_key = os.environ.get("GEMINI_API_KEY", "").strip()
    groq_key = os.environ.get("GROQ_API_KEY", "").strip()
    if not gemini_key and not groq_key:
        return segments

    target_lang = (
        "Vietnamese"
        if lang_code == "vi"
        else ("English" if lang_code == "en" else "Vietnamese or English")
    )
    numbered_lines = "\n".join(f"{i}: {s['text']}" for i, s in enumerate(segments))
    prompt = (
        f"You are a professional music lyric editor. Below are raw ASR-transcribed lyrics for '{song_title}' in {target_lang}.\n"
        "Fix spelling, Vietnamese diacritics, and homophone errors caused by singing pronunciation while preserving the exact original words.\n"
        "STRICT RULES: Do NOT replace with lyrics from another song. Keep the exact 'number: ' prefix at the beginning of each line, do not add or remove lines, and output nothing else.\n\n"
        f"{numbered_lines}"
    )

    try:
        corrected_text = ""
        if gemini_key:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_key}"
            body = json.dumps({"contents": [{"parts": [{"text": prompt}]}]}).encode("utf-8")
            req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=12) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                corrected_text = data["candidates"][0]["content"]["parts"][0]["text"]
        elif groq_key:
            url = "https://api.groq.com/openai/v1/chat/completions"
            body = json.dumps({
                "model": "llama-3.3-70b-versatile",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.2,
            }).encode("utf-8")
            req = urllib.request.Request(
                url,
                data=body,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {groq_key}",
                },
            )
            with urllib.request.urlopen(req, timeout=12) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                corrected_text = data["choices"][0]["message"]["content"]

        if corrected_text:
            updated = [dict(s) for s in segments]
            for line in corrected_text.splitlines():
                m = re.match(r"^(\d+)\s*:\s*(.+)$", line.strip())
                if m:
                    idx = int(m.group(1))
                    if 0 <= idx < len(updated):
                        updated[idx]["text"] = m.group(2).strip()
            return updated
    except Exception as e:
        sys.stderr.write(f"[DEBUG] LLM polish skipped: {e}\n")

    return segments


def _ensure_ffmpeg_in_path():
    existing = shutil.which("ffmpeg")
    if existing:
        return os.path.dirname(existing)

    local_app_data = os.environ.get("LOCALAPPDATA", "")
    winget_links = os.path.join(local_app_data, "Microsoft", "WinGet", "Links", "ffmpeg.exe")
    if os.path.exists(winget_links):
        ffmpeg_dir = os.path.dirname(winget_links)
        os.environ["PATH"] = ffmpeg_dir + os.pathsep + os.environ.get("PATH", "")
        return ffmpeg_dir

    winget_packages = os.path.join(local_app_data, "Microsoft", "WinGet", "Packages")
    if os.path.isdir(winget_packages):
        for root, _, files in os.walk(winget_packages):
            if "ffmpeg.exe" in files:
                os.environ["PATH"] = root + os.pathsep + os.environ.get("PATH", "")
                return root

    return None


def _convert_to_wav_fallback(input_path):
    import av
    import soundfile as sf

    wav_path = f"{os.path.splitext(input_path)[0]}_decoded.wav"
    container = av.open(input_path)
    resampler = av.AudioResampler(format="flt", layout="mono", rate=22050)
    chunks = []

    for frame in container.decode(audio=0):
        for resampled in resampler.resample(frame):
            chunks.append(resampled.to_ndarray().reshape(-1))
    for resampled in resampler.resample(None):
        chunks.append(resampled.to_ndarray().reshape(-1))

    container.close()
    if not chunks:
        raise RuntimeError("Không giải mã được dữ liệu âm thanh từ file tải về")

    audio_data = np.concatenate(chunks)
    sf.write(wav_path, audio_data, 22050)
    return wav_path


def _build_chord_templates():
    names = []
    vectors = []
    for i, root in enumerate(PITCHES):
        maj = np.zeros(12, dtype=np.float32)
        maj[i] = 1.0
        maj[(i + 4) % 12] = 0.85
        maj[(i + 7) % 12] = 0.85
        names.append(root)
        vectors.append(maj / np.linalg.norm(maj))

        minor = np.zeros(12, dtype=np.float32)
        minor[i] = 1.0
        minor[(i + 3) % 12] = 0.85
        minor[(i + 7) % 12] = 0.85
        names.append(f"{root}m")
        vectors.append(minor / np.linalg.norm(minor))

    return names, np.vstack(vectors)


CHORD_NAMES, CHORD_MATRIX = _build_chord_templates()


def _download_youtube_audio(url):
    """Tải audio từ YouTube, trích xuất metadata (title, track, artist) và chuẩn hóa WAV."""
    import yt_dlp

    ffmpeg_dir = _ensure_ffmpeg_in_path()
    temp_dir = tempfile.gettempdir()
    file_id = uuid.uuid4().hex[:10]
    out_tpl = os.path.join(temp_dir, f"songhomie_yt_{file_id}.%(ext)s")

    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": out_tpl,
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
        "js_runtimes": {"node": {}},
    }

    # Hỗ trợ cookies.txt khi deploy lên VPS/Cloud để vượt qua kiểm tra bot của YouTube
    cookies_path = os.environ.get("YT_COOKIES_PATH", "").strip()
    if cookies_path and os.path.exists(cookies_path):
        ydl_opts["cookiefile"] = cookies_path

    if ffmpeg_dir:
        ydl_opts["ffmpeg_location"] = ffmpeg_dir
        ydl_opts["postprocessors"] = [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "wav",
            }
        ]

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        yt_meta = {
            "title": info.get("title", ""),
            "track": info.get("track", ""),
            "artist": info.get("artist", "") or info.get("creator", ""),
        }
        raw_filename = ydl.prepare_filename(info)
        wav_filename = f"{os.path.splitext(raw_filename)[0]}.wav"

        if os.path.exists(wav_filename):
            return wav_filename, [wav_filename, raw_filename], yt_meta

        decoded_wav = _convert_to_wav_fallback(raw_filename)
        return decoded_wav, [decoded_wav, raw_filename], yt_meta


def _smooth_chord_timeline(raw_segments, min_duration=0.55):
    """Loại bỏ các hợp âm nhiễu thoáng qua (< 0.55s) để cần đàn chuyển nhịp mượt mà."""
    if not raw_segments:
        return [{"time": 0.0, "chord": "C"}]

    merged = [dict(raw_segments[0])]
    for seg in raw_segments[1:]:
        if seg["chord"] == merged[-1]["chord"]:
            merged[-1]["end"] = seg["end"]
        else:
            merged.append(dict(seg))

    smoothed = []
    for seg in merged:
        duration = seg["end"] - seg["start"]
        if smoothed and duration < min_duration:
            smoothed[-1]["end"] = seg["end"]
        else:
            smoothed.append(dict(seg))

    final_segments = [smoothed[0]]
    for seg in smoothed[1:]:
        if seg["chord"] == final_segments[-1]["chord"]:
            final_segments[-1]["end"] = seg["end"]
        else:
            final_segments.append(seg)

    return [
        {"time": round(float(s["start"]), 2), "chord": s["chord"]}
        for s in final_segments
    ]


def _extract_chords_and_tempo(y_inst, sr, librosa):
    """Nhận diện tông chủ đạo, tempo và hợp âm."""
    y_harmonic = librosa.effects.harmonic(y_inst, margin=3.0)
    chroma = librosa.feature.chroma_cqt(y=y_harmonic, sr=sr)

    mean_chroma = np.mean(chroma, axis=1)
    mean_norm = np.linalg.norm(mean_chroma)
    detected_key = "C"
    if mean_norm > 1e-9:
        key_scores = CHORD_MATRIX @ (mean_chroma / mean_norm)
        detected_key = CHORD_NAMES[int(np.argmax(key_scores))]

    duration = float(librosa.get_duration(y=y_inst, sr=sr))
    tempo, beat_frames = librosa.beat.beat_track(y=y_harmonic, sr=sr)
    if len(beat_frames) < 2:
        beat_frames = librosa.time_to_frames(np.arange(0, max(duration, 2.0), 2.0), sr=sr)

    beat_chroma = librosa.util.sync(chroma, beat_frames, aggregate=np.median)
    fixed_frames = librosa.util.fix_frames(beat_frames, x_min=0, x_max=chroma.shape[1])
    beat_times = librosa.frames_to_time(fixed_frames, sr=sr)

    norms = np.linalg.norm(beat_chroma, axis=0, keepdims=True)
    valid_mask = norms[0] > 1e-9
    beat_chroma_norm = np.divide(beat_chroma, norms, out=np.zeros_like(beat_chroma), where=norms > 1e-9)

    similarities = CHORD_MATRIX @ beat_chroma_norm
    best_indices = np.argmax(similarities, axis=0)
    best_scores = similarities[best_indices, np.arange(similarities.shape[1])]

    raw_segments = []
    num_segments = min(len(best_indices), len(beat_times))

    for idx in range(num_segments):
        if not valid_mask[idx] or best_scores[idx] <= 0.42:
            continue
        start_t = float(beat_times[idx])
        end_t = float(beat_times[idx + 1]) if idx + 1 < len(beat_times) else duration
        raw_segments.append({
            "start": start_t,
            "end": max(end_t, start_t + 0.1),
            "chord": CHORD_NAMES[best_indices[idx]],
        })

    chords_output = _smooth_chord_timeline(raw_segments, min_duration=0.55)
    calc_tempo = round(float(tempo), 2) if np.isscalar(tempo) else round(float(tempo[0]), 2)
    return chords_output, calc_tempo, detected_key


def _transcribe_via_groq_cloud(y_vocal, sr, librosa, whisper_lang=None, initial_prompt=None):
    """Nén vocal sang 16kHz mono (< 4MB) rồi gửi lên Groq Whisper API (2s, 0MB RAM)."""
    groq_key = os.environ.get("GROQ_API_KEY", "").strip()
    if not groq_key:
        return None

    tmp_groq_wav = os.path.join(tempfile.gettempdir(), f"groq_vocal_{uuid.uuid4().hex[:8]}.wav")
    try:
        import requests
        import soundfile as sf

        y_16k = (
            librosa.resample(y_vocal, orig_sr=sr, target_sr=16000).astype(np.float32)
            if sr != 16000
            else y_vocal.astype(np.float32)
        )
        sf.write(tmp_groq_wav, y_16k, 16000, subtype="PCM_16")

        data = {
            "model": "whisper-large-v3-turbo",
            "response_format": "verbose_json",
        }
        if whisper_lang in SUPPORTED_LANGUAGES:
            data["language"] = whisper_lang
        if initial_prompt:
            data["prompt"] = initial_prompt

        with open(tmp_groq_wav, "rb") as f:
            resp = requests.post(
                "https://api.groq.com/openai/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {groq_key}"},
                data=data,
                files={"file": ("vocal.wav", f, "audio/wav")},
                timeout=30,
            )

        if resp.status_code != 200:
            sys.stderr.write(f"[DEBUG] Groq API status {resp.status_code}: {resp.text[:200]}\n")
            return None

        payload = resp.json()
        detected_lang = whisper_lang or payload.get("language", "vi")
        results = []
        for seg in payload.get("segments", []):
            text = (seg.get("text") or "").strip()
            if not text or _is_hallucinated_subtitle(text):
                continue
            results.append({
                "start": round(float(seg.get("start", 0.0)), 2),
                "text": text,
            })

        return results, detected_lang
    except Exception as e:
        sys.stderr.write(f"[DEBUG] Groq Whisper skipped (fallback to local): {e}\n")
        return None
    finally:
        if os.path.exists(tmp_groq_wav):
            try:
                os.remove(tmp_groq_wav)
            except Exception:
                pass


def _transcribe_with_whisper_fast(
    y_vocal,
    sr,
    librosa,
    song_title="",
    lang_code="auto",
    initial_prompt=None,
):
    """Chế độ 2: AI nghe giọng hát tiếng Việt & tiếng Anh (Groq Cloud -> Local Whisper fallback)."""
    whisper_lang = lang_code if lang_code in SUPPORTED_LANGUAGES else None

    # 1. Ưu tiên Groq Cloud (2 giây, không tốn RAM server)
    cloud_res = _transcribe_via_groq_cloud(y_vocal, sr, librosa, whisper_lang, initial_prompt)
    if cloud_res is not None:
        results, detected_lang = cloud_res
        results = _polish_lyrics_with_llm(results, song_title, detected_lang)
        return results, detected_lang, None

    # 2. Dự phòng chạy nội bộ bằng Faster-Whisper
    try:
        from faster_whisper import WhisperModel

        y_16k = (
            librosa.resample(y_vocal, orig_sr=sr, target_sr=16000).astype(np.float32)
            if sr != 16000
            else y_vocal.astype(np.float32)
        )

        whisper_size = (
            os.environ.get("WHISPER_MODEL")
            or os.environ.get("WHISPER_MODEL_SIZE")
            or "small"
        ).strip()
        model = WhisperModel(whisper_size, device="cpu", compute_type="int8")
        segments, info = model.transcribe(
            y_16k,
            language=whisper_lang,
            initial_prompt=initial_prompt,
            beam_size=3,
            word_timestamps=True,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=700, speech_pad_ms=250),
            no_speech_threshold=0.6,
            log_prob_threshold=-1.0,
            compression_ratio_threshold=2.4,
            condition_on_previous_text=False,
        )

        detected_lang = whisper_lang or getattr(info, "language", "vi")

        results = []
        for s in segments:
            text = (s.text or "").strip()
            no_speech_prob = getattr(s, "no_speech_prob", 0.0)
            if not text or no_speech_prob > 0.65 or _is_hallucinated_subtitle(text):
                continue

            words = getattr(s, "words", None) or []
            exact_start = float(words[0].start) if words else float(s.start)
            results.append({"start": round(exact_start, 2), "text": text})

        results = _polish_lyrics_with_llm(results, song_title, detected_lang)
        return results, detected_lang, None
    except Exception as e:
        sys.stderr.write(f"[DEBUG] Faster-Whisper Warning: {e}\n")
        return [], lang_code, str(e)


def _format_synced_lyrics(lyrics_segments, chords_output):
    if not lyrics_segments:
        return "\n".join(
            f"[{c['time']}s] ({c['chord']}) [Beat Marker]" for c in chords_output
        )

    lines = []
    chord_idx = 0
    current_chord = chords_output[0]["chord"] if chords_output else "C"

    for seg in lyrics_segments:
        start_time = seg["start"]
        while chord_idx + 1 < len(chords_output) and chords_output[chord_idx + 1]["time"] <= start_time:
            chord_idx += 1
            current_chord = chords_output[chord_idx]["chord"]

        mins = int(start_time // 60)
        secs = start_time % 60
        lines.append(f"[{mins:02d}:{secs:05.2f}] ({current_chord}) {seg['text']}")

    return "\n".join(lines)


def _mock_fallback():
    return {
        "success": True,
        "isMock": True,
        "tempo": 120,
        "key": "C",
        "chords": [
            {"time": 0.0, "chord": "C"},
            {"time": 4.0, "chord": "G"},
            {"time": 8.0, "chord": "Am"},
            {"time": 12.0, "chord": "F"},
        ],
        "lyrics": (
            "[00:00.00] (C) Nắng vàng góc phố quen\n"
            "[00:04.00] (G) Tiếng đàn cất lên êm đềm\n"
            "[00:08.00] (Am) Songhomie ghi lại giai điệu\n"
            "[00:12.00] (F) Trao nhau từng nốt nhạc yêu thương"
        ),
    }


def analyze_audio(
    input_target,
    lang_code="auto",
    lyric_mode="search",
    quality_mode="fast",
):
    temp_files = []
    stem_dir = None
    try:
        _ensure_ffmpeg_in_path()
        file_path = input_target
        yt_meta = {}
        fallback_title = ""
        normalized_lang = (lang_code or "auto").strip().lower()
        normalized_mode = (lyric_mode or "search").strip().lower()
        normalized_quality = (quality_mode or "fast").strip().lower()

        if input_target.startswith(("http://", "https://")):
            try:
                file_path, temp_files, yt_meta = _download_youtube_audio(input_target)
                fallback_title = yt_meta.get("title", "")
            except Exception as yt_err:
                return {
                    "success": False,
                    "error": f"Không tải được audio từ YouTube: {str(yt_err)}",
                }
        else:
            fallback_title = os.path.splitext(os.path.basename(file_path))[0]

        if not os.path.exists(file_path):
            return {"success": False, "error": f"File không tồn tại: {file_path}"}

        import librosa

        working_wav = file_path
        if not working_wav.lower().endswith(".wav"):
            try:
                working_wav = _convert_to_wav_fallback(file_path)
                temp_files.append(working_wav)
            except Exception:
                working_wav = file_path

        try:
            y_mixed, sr = librosa.load(working_wav, sr=22050)
        except Exception:
            decoded_wav = _convert_to_wav_fallback(file_path)
            temp_files.append(decoded_wav)
            working_wav = decoded_wav
            y_mixed, sr = librosa.load(working_wav, sr=22050)

        y_vocal = y_mixed
        y_inst = y_mixed
        stem_separated = False

        # Chỉ tách vocal khi ở chế độ 'transcribe' (AI tự nghe) + chất lượng 'studio'
        disable_stem = os.environ.get("DISABLE_STEM_SEPARATION", "").lower() == "true"
        should_separate = (
            normalized_mode == "transcribe"
            and normalized_quality == "studio"
            and not disable_stem
        )
        if should_separate:
            vocals_path, inst_path, stem_dir = _separate_vocals_and_instrumental(working_wav)
            if vocals_path and inst_path:
                try:
                    y_vocal, _ = librosa.load(vocals_path, sr=sr)
                    y_inst, _ = librosa.load(inst_path, sr=sr)
                    stem_separated = True
                except Exception:
                    y_vocal = y_mixed
                    y_inst = y_mixed

        # Nhận diện hợp âm trên track instrumental
        chords_output, calc_tempo, detected_key = _extract_chords_and_tempo(y_inst, sr, librosa)

        whisper_err = None
        lyrics_segments = []
        matched_title = _strip_noise_words(fallback_title) or fallback_title
        detected_lang = normalized_lang
        initial_prompt = _build_whisper_initial_prompt(yt_meta, fallback_title)

        if normalized_mode == "transcribe":
            # CHẾ ĐỘ 2: AI nghe trực tiếp giọng hát
            lyrics_source = "whisper"
            lyrics_segments, detected_lang, whisper_err = _transcribe_with_whisper_fast(
                y_vocal,
                sr,
                librosa,
                song_title=matched_title,
                lang_code=normalized_lang,
                initial_prompt=initial_prompt,
            )
        else:
            # CHẾ ĐỘ 1: Tìm lời chuẩn theo tiêu đề trên LRCLIB + bù trễ intro
            lyrics_source = "lrclib"
            lyrics_segments, lrclib_title = _fetch_synced_lyrics_from_lrclib(yt_meta, fallback_title)
            if lrclib_title:
                matched_title = lrclib_title

            if lyrics_segments:
                first_vocal = _detect_first_vocal_time(y_vocal, sr, librosa)
                if first_vocal is not None:
                    intro_offset = round(first_vocal - lyrics_segments[0]["start"], 2)
                    if intro_offset > 3.5:
                        for seg in lyrics_segments:
                            seg["start"] = round(seg["start"] + intro_offset, 2)
            else:
                lyrics_source = "whisper"
                matched_title = _strip_noise_words(fallback_title) or fallback_title
                lyrics_segments, detected_lang, whisper_err = _transcribe_with_whisper_fast(
                    y_vocal,
                    sr,
                    librosa,
                    song_title=matched_title,
                    lang_code=normalized_lang,
                    initial_prompt=initial_prompt,
                )

        full_lyrics_text = _format_synced_lyrics(lyrics_segments, chords_output)

        return {
            "success": True,
            "lyrics": full_lyrics_text,
            "chords": chords_output,
            "tempo": calc_tempo,
            "key": detected_key,
            "lyricsSource": lyrics_source,
            "lyricMode": normalized_mode,
            "qualityMode": normalized_quality,
            "stemSeparated": stem_separated,
            "detectedLanguage": detected_lang,
            "detectedTitle": matched_title,
            "whisperWarning": whisper_err,
        }

    except ImportError:
        return _mock_fallback()
    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        if stem_dir and os.path.isdir(stem_dir):
            shutil.rmtree(stem_dir, ignore_errors=True)
        for f in set(temp_files):
            if f and os.path.exists(f):
                try:
                    os.remove(f)
                except Exception:
                    pass


if __name__ == "__main__":
    if len(sys.argv) > 1:
        input_path = sys.argv[1]
        requested_lang = sys.argv[2] if len(sys.argv) > 2 else "auto"
        requested_mode = sys.argv[3] if len(sys.argv) > 3 else "search"
        requested_quality = sys.argv[4] if len(sys.argv) > 4 else "fast"
        real_stdout = sys.stdout
        sys.stdout = sys.stderr
        try:
            result = analyze_audio(
                input_path,
                requested_lang,
                requested_mode,
                requested_quality,
            )
        finally:
            sys.stdout = real_stdout
        print(json.dumps(result, ensure_ascii=False), flush=True)
    else:
        print(
            json.dumps(
                {"success": False, "error": "Thiếu đường dẫn file âm thanh đầu vào"},
                ensure_ascii=False,
            ),
            flush=True,
        )