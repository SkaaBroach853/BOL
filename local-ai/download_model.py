"""One-time public model download. Runtime never downloads or calls a cloud API."""
import os
import sys
from pathlib import Path

os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
from faster_whisper.utils import download_model

target = Path(sys.argv[1] if len(sys.argv) > 1 else 'models/whisper-base').resolve()
target.mkdir(parents=True, exist_ok=True)
download_model('base', output_dir=str(target))
print('Local multilingual Whisper base model installed:', target)
