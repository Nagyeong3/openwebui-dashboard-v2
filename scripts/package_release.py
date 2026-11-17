"""Package the checked source and API build, excluding ignored runtime data."""
import hashlib
import json
from pathlib import Path
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def main():
    names = subprocess.check_output(
        ['git', 'ls-files', '-co', '--exclude-standard', '-z'], cwd=ROOT
    ).decode().split('\0')
    files = sorted({name for name in names if name and name != 'BUILD-MANIFEST.json'
                    and (ROOT / name).is_file() and not (ROOT / name).is_symlink()})
    manifest = {
        'release': '2026-11-17-reporting-v2',
        'repository': 'https://github.com/Nagyeong3/openwebui-dashboard-v2',
        'checks': {'backendTests': 112, 'frontendTests': 34, 'apiBuild': 'passed',
                   'browserVisual': 'not-run-chromium-launch-failed'},
        'sha256': {name: hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in files},
    }
    (ROOT/'BUILD-MANIFEST.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    target = ROOT/'artifacts/oui-dashboard-v2-reporting-20261117.zip'
    target.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as archive:
        for name in files + ['BUILD-MANIFEST.json']:
            archive.write(ROOT/name, name)
    with zipfile.ZipFile(target) as archive:
        assert archive.testzip() is None
        for name, digest in manifest['sha256'].items():
            assert hashlib.sha256(archive.read(name)).hexdigest() == digest, name
    print(json.dumps({'file': str(target), 'bytes': target.stat().st_size,
                      'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
                      'entries': len(files)+1}))


if __name__ == '__main__':
    main()
