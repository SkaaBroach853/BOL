"""Persistent CPU speech agent. JSON lines over stdio; audio stays in memory."""
import os
os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
os.environ['DO_NOT_TRACK'] = '1'
import sys
import json
import base64
from io import BytesIO

sys.stdout.reconfigure(encoding='utf-8')
sys.stdin.reconfigure(encoding='utf-8')

def send(value):
    print(json.dumps(value, ensure_ascii=False), flush=True)

try:
    from faster_whisper import WhisperModel
    from faster_whisper.audio import decode_audio
    model = WhisperModel(sys.argv[1], device='cpu', compute_type='int8',
                         cpu_threads=min(4, os.cpu_count() or 2), local_files_only=True)
    send({'ready': True, 'engine': 'Whisper base / CPU int8'})
except Exception as error:
    send({'ready': False, 'code': 'LOCAL_MODEL_ERROR', 'errorClass': type(error).__name__})
    sys.exit(1)

for line in sys.stdin:
    request = {}
    try:
        if len(line) > 7_100_000:
            raise ValueError('request too large')
        request = json.loads(line)
        raw = base64.b64decode(request['audio'], validate=True)
        if not 16 <= len(raw) <= 5 * 1024 * 1024:
            raise ValueError('invalid audio size')
        audio = decode_audio(BytesIO(raw), sampling_rate=16000)
        del raw
        if len(audio) > 21 * 16000:
            send({'id': request['id'], 'ok': False, 'code': 'AUDIO_TOO_LONG'})
            continue
        segments, info = model.transcribe(audio, beam_size=3, vad_filter=True,
                                         condition_on_previous_text=False,
                                         vad_parameters={'min_silence_duration_ms': 500})
        text = ' '.join(segment.text.strip() for segment in segments).strip()
        del audio
        if not text or len(text) > 2000:
            send({'id': request['id'], 'ok': False, 'code': 'NO_SPEECH'})
        else:
            send({'id': request['id'], 'ok': True, 'transcript': text,
                  'language': info.language})
    except Exception as error:
        send({'id': request.get('id'), 'ok': False, 'code': 'LOCAL_AUDIO_ERROR',
              'errorClass': type(error).__name__})
    finally:
        request.clear()
        line = ''
        if 'raw' in locals():
            del raw
        if 'audio' in locals():
            del audio
