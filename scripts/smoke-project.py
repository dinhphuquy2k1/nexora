#!/usr/bin/env python3
"""Refuse an occupied disposable Compose namespace before any cleanup trap."""
import os
import re
import subprocess
import sys
from pathlib import Path


def claim(project, run=subprocess.check_output):
    if not re.fullmatch(r'nexora-(?:verify|smoke|data-smoke|dev-smoke|https)-[a-z0-9-]+', project):
        raise ValueError('INVALID_TEST_PROJECT')
    for kind, args in [('container', ['ps', '-aq']), ('volume', ['volume', 'ls', '-q']),
                       ('network', ['network', 'ls', '-q'])]:
        if run(['docker', *args, '--filter', 'label=com.docker.compose.project=' + project], text=True).strip():
            raise ValueError('OCCUPIED_TEST_PROJECT')
        if kind != 'container':
            names = run(['docker', kind, 'ls', '--format', '{{.Name}}'], text=True).splitlines()
            if any(name.startswith(project + '_') for name in names):
                raise ValueError('OCCUPIED_TEST_RESOURCE')
    registry = os.environ.get('NEXORA_VERIFICATION_OWNERSHIP_DIR')
    if registry:
        directory = Path(registry)
        if directory.is_symlink() or not directory.is_dir() or (hasattr(os, 'getuid') and directory.stat().st_uid != os.getuid()):
            raise ValueError('INVALID_OWNERSHIP_DIRECTORY')
        with (directory / project).open('x') as marker:
            marker.write(project + '\n')


if __name__ == '__main__':
    try:
        if len(sys.argv) != 2:
            raise ValueError('INVALID_ARGUMENTS')
        claim(sys.argv[1])
    except Exception:
        print('TEST_PROJECT_OWNERSHIP_REJECTED', file=sys.stderr)
        sys.exit(1)
