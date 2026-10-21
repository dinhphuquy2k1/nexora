#!/usr/bin/env python3
"""Controlled Docker CLI regressions; real SQL runs remain separate mandatory gates."""
import json
import importlib.util
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch

LAUNCHER = Path(__file__).with_name("provision-cluster-smoke.py")
# Fake only Docker, never the real PostgreSQL regression assertions.
DOCKER = r'''#!/usr/bin/env python3
import json, os, sys, time
from pathlib import Path
p=Path(os.environ['FIXTURE_STATE']); s=json.loads(p.read_text()); a=sys.argv[1:]; mode=os.environ.get('FIXTURE_MODE','normal')
def save():p.write_text(json.dumps(s))
def end(rc=0,out='',err=''):
 save();print(out,end='');print(err,end='',file=sys.stderr);sys.exit(rc)
def ident(kind):return {'pg':'a','node':'b','net':'c'}[kind]*64
s['calls'].append(a[:2])
if a[:2]==['network','create']:
 s['network']=ident('net');end(out=s['network'])
if a[:2]==['network','rm']:
 s['network']=None;end(out=a[-1])
if a[:2]==['network','inspect']:
 if not s['network']:end(1,err='Error response from daemon: network '+a[-1]+' not found')
 end(out=json.dumps([{'Id':s['network']}]))
if a[0] in ('create','run'):
 ispg='postgres:17.11-bookworm' in a; cid=ident('pg' if ispg else 'node'); name=a[a.index('--name')+1]
 s['containers'][cid]={'name':name,'network':a[a.index('--network')+1],'pg':ispg,'running':a[0]=='run','labels':{'nexora.cluster-test':a[a.index('--label')+1].split('=',1)[1]} if '--label' in a else {}}
 if (ispg and mode=='partial-create') or (not ispg and mode=='partial-node-create'):end(1,err='controlled create failure')
 if not ispg and a[0]=='run':s['suites']+=1;end()
 end(out=cid)
if a[0]=='start':
 cid=a[-1]; c=s['containers'][cid];c['running']=True
 if not c['pg']:
  s['suites']+=1; save()
  if mode=='signal':time.sleep(1)
  if mode in ('suite-fail','both-fail'):end(17,err='controlled suite failure')
  end(out='controlled SQL suite PASS\n')
 if mode=='startup-fail':c['running']=False
 end(out=cid)
if a[0]=='inspect':
 cid=a[-1]; c=s['containers'].get(cid) or next((v for v in s['containers'].values() if v['name']==cid),None)
 if mode=='inspect-fail' and s.get('removed'):end(1,err='permission denied by daemon')
 if not c:
  if mode=='malformed' and s.get('removed'):end(out='not json')
  end(1,err='Error response from daemon: No such object: '+cid)
 if mode=='malformed' and s.get('removed'):end(out='not json')
 if mode=='ownership-fail':end(out=json.dumps([{'Id':'wrong'}]))
 end(out=json.dumps([{'Id':ident('pg' if c['pg'] else 'node'),'Name':'/'+c['name'],'State':{'Running':c['running'],'ExitCode':17 if mode in ('suite-fail','both-fail','suite-status-fail') and not c['pg'] else 0},'Config':{'Image':'postgres:17.11-bookworm','Labels':c['labels']},'NetworkSettings':{'Networks':{c['network']:{}}}}]))
if a[0]=='exec':
 if '-i' not in a and '-c' not in a:end()
 if any('PGPASSWORD=' in x for x in a) and '-i' not in a:end()
 tcp='-h' in a or any(' -h ' in x for x in a)
 if tcp:s['tcp']+=1
 else:s['socket']+=1
 if mode=='tcp-timeout' and tcp:end(1)
 if mode=='temporary' and tcp and s['tcp']<3:end(1)
 if 'COMMENT' in sys.stdin.read():s['stamped']=True
 end(out='1\n')
if a[0]=='rm':
 cid=a[-1];s['removed']=True
 if mode in ('rm-fail','both-fail'):end(1,err='controlled removal failure')
 s['containers'].pop(cid,None);end(out=cid)
if a[:2]==['image','inspect']:end(out='[]')
end(2,err='unexpected fixture command')
'''


class ClusterLifecycle(unittest.TestCase):
    def run_launcher(self, mode="normal", suite=None, interrupt=False):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            docker = root / "docker"
            docker.write_text(DOCKER)
            docker.chmod(0o755)
            state = root / "state.json"
            state.write_text(json.dumps(dict(containers={}, network=None, calls=[], suites=0, tcp=0, socket=0)))
            env = {**os.environ, "PATH": str(root) + os.pathsep + os.environ["PATH"], "FIXTURE_STATE": str(state), "FIXTURE_MODE": mode}
            # Timeout/poll are test-patched constants in a private launcher copy, not production bypass flags.
            source = LAUNCHER.read_text().replace('TCP_TIMEOUT = 30', 'TCP_TIMEOUT = 1').replace('POLL_INTERVAL = 0.2', 'POLL_INTERVAL = 0.01')
            launcher = root / "launcher.py"
            launcher.write_text(source)
            args = [sys.executable, str(launcher)] + (["--suite=" + suite] if suite else [])
            proc = subprocess.Popen(args, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            if interrupt:
                deadline = time.monotonic() + 8
                while time.monotonic() < deadline:
                    try:
                        if json.loads(state.read_text())["suites"]:break
                    except json.JSONDecodeError:pass
                    time.sleep(.01)
                else:
                    proc.kill(); self.fail("fixture suite did not start")
                proc.send_signal(signal.SIGTERM)
            stdout, stderr = proc.communicate(timeout=15)
            return proc.returncode, stdout + stderr, json.loads(state.read_text())

    def assert_clean(self, state):
        self.assertEqual(state["containers"], {})
        self.assertIsNone(state["network"])
        for call in state["calls"]:
            # Full invocation IDs are checked by the fixture rather than names.
            self.assertNotIn("prune", call)

    def test_normal_and_suite_selectors(self):
        for suite, count in [(None, 2), ("provision", 1), ("customer-sql", 1)]:
            with self.subTest(suite=suite):
                rc, output, state = self.run_launcher(suite=suite)
                self.assertEqual(rc, 0, output)
                self.assertEqual(state["suites"], count)
                self.assert_clean(state)
                self.assertIn("Actual disposable cluster tests PASS", output)
                self.assertEqual(state["socket"], 0)

    def test_temporary_socket_server_is_not_tcp_ready(self):
        rc, output, state = self.run_launcher("temporary")
        self.assertEqual(rc, 0, output)
        self.assertGreaterEqual(state["tcp"], 3)
        self.assertEqual(state["socket"], 0)
        self.assert_clean(state)

    def test_tcp_timeout_does_not_stamp_or_run_suites(self):
        rc, output, state = self.run_launcher("tcp-timeout")
        self.assertNotEqual(rc, 0)
        self.assertIn("TCP_READINESS_TIMEOUT", output)
        self.assertFalse(state.get("stamped"))
        self.assertEqual(state["suites"], 0)
        self.assert_clean(state)

    def test_stopped_and_unverified_startup(self):
        for mode in ["startup-fail", "ownership-fail", "partial-create", "partial-node-create"]:
            with self.subTest(mode=mode):
                rc, output, state = self.run_launcher(mode)
                self.assertNotEqual(rc, 0)
                if mode != "partial-node-create":
                    self.assertEqual(state["suites"], 0)
                self.assertNotIn("Actual disposable cluster tests PASS", output)
                self.assert_clean(state)

    def test_suite_failure_preserved_and_cleaned(self):
        for mode in ["suite-fail", "suite-status-fail"]:
            with self.subTest(mode=mode):
                rc, output, state = self.run_launcher(mode)
                self.assertNotEqual(rc, 0)
                self.assertIn("SUITE_FAILED", output)
                self.assert_clean(state)

    def test_remove_failure_and_inspect_errors_cannot_pass(self):
        for mode in ["rm-fail", "inspect-fail", "malformed", "both-fail"]:
            with self.subTest(mode=mode):
                rc, output, state = self.run_launcher(mode)
                self.assertNotEqual(rc, 0)
                self.assertIn("CLEANUP_FAILED", output)
                self.assertNotIn("Actual disposable cluster tests PASS", output)
                if mode == "both-fail":self.assertIn("SUITE_FAILED", output)
                if mode in ("rm-fail", "both-fail"):
                    self.assertTrue(state["containers"])
                    self.assertGreaterEqual(sum(call[0]=='rm' for call in state['calls']), 2)

    def test_sigterm_cleans_once_and_never_passes(self):
        rc, output, state = self.run_launcher("signal", interrupt=True)
        self.assertEqual(rc, 128 + signal.SIGTERM, output)
        self.assert_clean(state)
        self.assertNotIn("Actual disposable cluster tests PASS", output)


class CleanupClassification(unittest.TestCase):
    def setUp(self):
        sys.dont_write_bytecode = True
        spec = importlib.util.spec_from_file_location("cluster_launcher", LAUNCHER)
        self.launcher = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.launcher)

    def test_only_exact_missing_diagnostic_proves_absence(self):
        m = self.launcher
        cid = "a" * 64
        for message in ["permission denied", "Cannot connect to Docker daemon", "timeout", "No such object: other-id"]:
            with self.subTest(message=message):
                m.OWNED_CONTAINERS[:] = [cid]
                responses = [subprocess.CompletedProcess([], 1, "", "remove failed"), subprocess.CompletedProcess([], 1, "", message)]
                with patch.object(m, "command", side_effect=responses):
                    self.assertIn("unable-to-verify", m.remove_owned("container", cid))
                self.assertEqual(m.OWNED_CONTAINERS, [cid])

    def test_partial_create_never_deletes_an_unowned_name_match(self):
        m = self.launcher
        m.PENDING_CREATIONS[:] = [("container", "collision-name")]
        body = json.dumps([{"Id": "d" * 64, "Config": {"Labels": {"nexora.cluster-test": "another-run"}}}])
        with patch.object(m, "command", return_value=subprocess.CompletedProcess([], 0, body, "")) as cmd:
            self.assertTrue(m.cleanup_owned())
            self.assertEqual(cmd.call_count, 1)
            self.assertNotIn("rm", cmd.call_args.args[0])
        self.assertEqual(m.OWNED_CONTAINERS, [])
        self.assertEqual(m.PENDING_CREATIONS, [("container", "collision-name")])

    def test_unknown_create_retains_pending_ownership_for_cleanup(self):
        m = self.launcher
        name = "owned-uuid-name"
        m.PENDING_CREATIONS[:] = [("container", name)]
        with patch.object(m, "command", return_value=subprocess.CompletedProcess([], 1, "", "daemon unavailable")):
            self.assertTrue(m.cleanup_owned())
        self.assertEqual(m.PENDING_CREATIONS, [("container", name)])
        with patch.object(m, "command", return_value=subprocess.CompletedProcess([], 1, "", "Error: No such object: " + name)):
            self.assertEqual(m.cleanup_owned(), [])
        self.assertEqual(m.PENDING_CREATIONS, [])

    def test_verified_absence_is_released_and_cleanup_idempotent(self):
        m = self.launcher
        cid = "a" * 64
        m.OWNED_CONTAINERS[:] = [cid]
        with patch.object(m, "command", side_effect=[subprocess.CompletedProcess([], 1, "", "already missing"), subprocess.CompletedProcess([], 1, "", "Error: No such object: " + cid)]) as cmd:
            self.assertEqual(m.cleanup_owned(), [])
            self.assertEqual(m.cleanup_owned(), [])
            self.assertEqual(cmd.call_count, 2)
            self.assertTrue(all(cid in call.args[0] for call in cmd.call_args_list))
        self.assertEqual(m.OWNED_CONTAINERS, [])

    def test_inspect_timeout_and_malformed_json_keep_tracking(self):
        m = self.launcher
        cid = "a" * 64
        for failure in [RuntimeError("DOCKER_COMMAND_TIMEOUT"), subprocess.CompletedProcess([], 0, "{}", ""), subprocess.CompletedProcess([], 0, "[null]", "")]:
            m.OWNED_CONTAINERS[:] = [cid]
            with patch.object(m, "command", side_effect=[subprocess.CompletedProcess([], 0, cid, ""), failure]):
                self.assertIsNotNone(m.remove_owned("container", cid))
            self.assertEqual(m.OWNED_CONTAINERS, [cid])

    def test_failed_suite_diagnostic_preserves_category_without_sql_or_secrets(self):
        m = self.launcher
        result = subprocess.CompletedProcess([], 17, "AssertionError SELECT password FROM users", "code: '42501' " + m.ADMIN_PASS)
        diagnostic = str(m.suite_failure("customer-sql", result))
        self.assertIn("attach_exit=17", diagnostic)
        self.assertIn("AssertionError", diagnostic)
        self.assertIn("42501", diagnostic)
        self.assertNotIn("SELECT", diagnostic)
        self.assertNotIn(m.ADMIN_PASS, diagnostic)

    def test_sanitization_and_signal_handler_do_not_cleanup(self):
        m = self.launcher
        with patch.object(m, "cleanup_owned") as cleanup:
            m.sig_handler(signal.SIGINT, None)
            m.sig_handler(signal.SIGTERM, None)
            cleanup.assert_not_called()
        self.assertEqual(m.INTERRUPTED, signal.SIGINT)
        value = m.safe(" ".join([m.ADMIN_PASS, m.RUNTIME_PASS, m.TOKEN, "postgresql://user:password@db/database"]))
        for secret in [m.ADMIN_PASS, m.RUNTIME_PASS, m.TOKEN, "user:password"]:
            self.assertNotIn(secret, value)


if __name__ == "__main__":
    unittest.main()
