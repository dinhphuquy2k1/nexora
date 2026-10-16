#!/usr/bin/env python3
"""Disposable-runtime MFA enrollment. Captured fixture secrets never reach logs."""
import base64, hashlib, hmac, json, os, pty, re, select, struct, subprocess, sys, termios, time

compose=['docker','compose','-f','compose.yml']
if os.environ.get('NEXORA_COMPOSE_OVERRIDE'): compose+=['-f',os.environ['NEXORA_COMPOSE_OVERRIDE']]
def sql(statement):
    result=subprocess.run(compose+['exec','-T','postgres','psql','-U','nexora','-d','nexora','-At','-v','ON_ERROR_STOP=1'],input=statement,text=True,capture_output=True,timeout=20)
    if result.returncode: raise AssertionError('MFA fixture SQL failed')
    return result.stdout.strip()
def code(key,step=None):
    secret=base64.b32decode(key)
    mac=hmac.new(secret,struct.pack('>Q',int(time.time()//30) if step is None else step),hashlib.sha1).digest()
    offset=mac[-1]&15
    return str((struct.unpack('>I',mac[offset:offset+4])[0]&0x7fffffff)%1000000).zfill(6)
def exercise(mode):
    master,slave=pty.openpty(); before=termios.tcgetattr(slave)
    command='mode=$(stty -g); node dist/cli/mfa-enroll.js; result=$?; [ "$(stty -g)" = "$mode" ] || exit 90; printf "TERMINAL_RESTORED\\n"; exit "$result"'
    child=subprocess.Popen(compose+['exec','api','sh','/scripts/api-entrypoint.sh','sh','-c',command],stdin=slave,stdout=slave,stderr=slave,close_fds=True)
    captured=bytearray();deadline=time.monotonic()+40;key=None
    def until(marker):
        while marker not in captured:
            if time.monotonic()>deadline or child.poll() is not None: raise AssertionError('MFA expected prompt unavailable')
            if select.select([master],[],[],0.2)[0]: captured.extend(os.read(master,8192))
    try:
        until(b'ADMIN username: ');os.write(master,b'browser_user\r')
        until(b'Nexora password: ')
        if mode in ['interrupt','eof']: os.write(master,b'Mfa-Hidden-Fixture'+(b'\x03' if mode=='interrupt' else b'\x04'))
        else:
            os.write(master,b'BrowserTestPass123!X\x7f\r')
            if mode!='duplicate':
                until(b'Initial TOTP code: ')
                key=re.search(rb'TOTP setup key: ([A-Z2-7]+)',captured).group(1).decode()
                if mode=='cancel-confirm':os.write(master,b'\x03')
                else:os.write(master,code(key).encode()+b'X\x7f\r')
        while child.poll() is None:
            if time.monotonic()>deadline:raise AssertionError('MFA CLI timeout')
            if select.select([master],[],[],0.2)[0]:captured.extend(os.read(master,8192))
        while select.select([master],[],[],0)[0]:captured.extend(os.read(master,8192))
        assert child.returncode==(0 if mode=='success' else 1),'Unexpected MFA CLI exit'
        assert b'BrowserTestPass' not in captured and b'Mfa-Hidden-Fixture' not in captured,'Password echoed'
        assert b'TERMINAL_RESTORED' in captured and termios.tcgetattr(slave)==before,'TTY restoration failed'
        codes=[v.decode() for v in re.findall(rb'(?m)^([A-F0-9]{8}(?:-[A-F0-9]{8}){3})$',captured.replace(b'\r',b''))]
        if mode=='success':
            assert len(codes)==10 and len(set(codes))==10,'Recovery code count'
            assert captured.index(b'MFA enrollment committed')<captured.index(codes[0].encode()),'Recovery output before commit'
            assert sql("SELECT count(*) FROM mfa_recovery_codes WHERE user_id=(SELECT id FROM users WHERE username='browser_user');")=='10','Enrollment not committed'
            return {'username':'browser_user','password':'BrowserTestPass123!','mfaSetupKey':key,'recoveryCodes':codes}
        assert not codes,'Recovery codes exposed on failure'
    finally:
        if child.poll() is None:child.kill()
        child.wait();os.close(master);os.close(slave)
try:
    for mode in ['interrupt','eof','cancel-confirm']:exercise(mode)
    assert sql("SELECT count(*) FROM user_mfa WHERE user_id=(SELECT id FROM users WHERE username='browser_user');")=='0'
    sql("CREATE FUNCTION mfa_fixture_rollback() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'controlled fixture rollback'; END $$; CREATE TRIGGER mfa_fixture_rollback BEFORE INSERT ON user_mfa FOR EACH ROW EXECUTE FUNCTION mfa_fixture_rollback();")
    try:exercise('rollback')
    finally:sql('DROP TRIGGER mfa_fixture_rollback ON user_mfa; DROP FUNCTION mfa_fixture_rollback();')
    assert sql("SELECT count(*) FROM user_mfa WHERE user_id=(SELECT id FROM users WHERE username='browser_user');")=='0'
    fixture=exercise('success');exercise('duplicate')
    with open(sys.argv[1],'x') as output:os.chmod(sys.argv[1],0o600);json.dump(fixture,output)
    print('Compiled MFA CLI TTY/backspace/cancellation/rollback/commit-before-codes/duplicate PASS')
except Exception:
    print('MFA enrollment TTY smoke failed (secret capture withheld)',file=sys.stderr);sys.exit(1)
