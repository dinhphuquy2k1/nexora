#!/usr/bin/env python3
"""Exercise the compiled CLI through a real pseudo-TTY; never print captured secrets."""
import os
import pty
import select
import subprocess
import sys
import termios
import time


def exercise(prefix, username, steps, expected_status):
    master, slave = pty.openpty()
    before = termios.tcgetattr(slave)
    command = (
        'mode=$(stty -g); '
        f'node dist/cli/user-create.js --username {username}; result=$?; '
        '[ "$(stty -g)" = "$mode" ] || exit 90; '
        'printf "TERMINAL_RESTORED\\n"; exit "$result"'
    )
    child = subprocess.Popen(prefix + ['sh', '-c', command], stdin=slave, stdout=slave, stderr=slave, close_fds=True)
    captured = bytearray()
    deadline = time.monotonic() + 30
    try:
        for prompt, payload in steps:
            while prompt not in captured:
                if time.monotonic() > deadline or child.poll() is not None:
                    raise AssertionError('CLI did not reach expected prompt')
                if select.select([master], [], [], 0.2)[0]:
                    captured.extend(os.read(master, 4096))
            os.write(master, payload)
        while child.poll() is None:
            if time.monotonic() > deadline:
                raise AssertionError('CLI timeout')
            if select.select([master], [], [], 0.2)[0]:
                captured.extend(os.read(master, 4096))
        while select.select([master], [], [], 0)[0]:
            captured.extend(os.read(master, 4096))
        assert child.returncode == expected_status, 'Unexpected CLI exit status'
        assert b'Tty-Fixture' not in captured, 'Password echo detected'
        assert b'TERMINAL_RESTORED' in captured, 'Container terminal mode not restored'
        assert termios.tcgetattr(slave) == before, 'Host terminal mode not restored'
    finally:
        if child.poll() is None:
            child.kill()
        child.wait()
        os.close(master)
        os.close(slave)


if __name__ == '__main__':
    try:
        # A compose override is optional, keeping this test usable in cloud environments.
        prefix = ['docker', 'compose', '-f', 'compose.yml']
        override = os.environ.get('NEXORA_COMPOSE_OVERRIDE')
        if override:
            prefix += ['-f', override]
        prefix += ['exec', 'api', 'sh', '/scripts/api-entrypoint.sh']
        exercise(prefix, 'tty_operator', [(b'Password: ', b'Tty-Fixture-PasswordX\x7f\r'), (b'Confirm password: ', b'Tty-Fixture-Password\r')], 0)
        exercise(prefix, 'tty_cancel', [(b'Password: ', b'Tty-Fixture\x03')], 1)
        exercise(prefix, 'tty_eof', [(b'Password: ', b'Tty-Fixture\x04')], 1)
        exercise(prefix, 'tty_mismatch', [(b'Password: ', b'Tty-Fixture-Password\r'), (b'Confirm password: ', b'Tty-Fixture-Different\r')], 1)
        print('Compiled provisioning CLI pseudo-TTY/backspace/cancellation/restoration PASS')
    except Exception:
        print('Provisioning pseudo-TTY verification failed (capture withheld)', file=sys.stderr)
        sys.exit(1)
