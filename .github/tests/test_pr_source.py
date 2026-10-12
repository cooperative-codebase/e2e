import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "clone-e2e-repos.sh"
SHA = "a" * 40
FAKE_GIT = """
import json, os, re, sys
from pathlib import Path
args = sys.argv[1:]
with open(os.environ['GIT_CALLS'], 'a') as log:
    log.write(json.dumps(args) + '\\n')
if 'ls-remote' in args:
    repo = re.search(r'/(se-[^/]+)\\.git', args[-2])[1]
    if repo in os.environ.get('LOOKUP_FAILURE', '').split(','): sys.exit(128)
    if repo in os.environ.get('MISSING', '').split(','): sys.exit(2)
elif 'clone' in args:
    repo = Path(args[-1])
    repo.mkdir()
    (repo / 'test-head').write_text('b' * 40)
elif args[:1] == ['-C']:
    repo = Path(args[1])
    if 'fetch' in args and os.environ.get('FETCH_FAILURE'): sys.exit(128)
    if 'checkout' in args: (repo / 'test-head').write_text(args[-1])
    if 'rev-parse' in args: print((repo / 'test-head').read_text())
else:
    sys.exit(99)
"""


class SourceSelectionTests(unittest.TestCase):
    def invoke(self, **overrides):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            binary = root / "git"
            binary.write_text(f"#!{sys.executable}\n" + FAKE_GIT)
            binary.chmod(0o700)
            calls = root / "calls.jsonl"
            env = {
                "PATH": directory + ":/usr/bin:/bin",
                "FORGEJO_E2E_TOKEN": "test-token-only",
                "E2E_WORKFLOW_BRANCH": "main",
                "GITHUB_EVENT_NAME": "workflow_dispatch",
                "RUN_KIND": "pr",
                "SOURCE_REPOSITORY": "cooperative-codebase/se-frontend",
                "SOURCE_SHA": SHA,
                "FRONTEND_BRANCH_INPUT": "codex/browser-pr-gate",
                "BACKEND_BRANCH_INPUT": "codex/browser-pr-gate",
                "INTEGRATION_TESTS_BRANCH_INPUT": "codex/browser-pr-gate",
                "GIT_CALLS": str(calls),
                **overrides,
            }
            result = subprocess.run(
                ["/bin/bash", str(SCRIPT)],
                env=env,
                cwd=root,
                text=True,
                capture_output=True,
            )
            commands = (
                [json.loads(line) for line in calls.read_text().splitlines()]
                if calls.exists()
                else []
            )
            return result, commands

    def test_pr_pins_requested_commit_after_branch_has_advanced(self):
        result, commands = self.invoke()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn(f"Resolved source: se-frontend {SHA}", result.stdout)
        self.assertIn(
            ["-C", "se-frontend", "fetch", "--depth", "1", "origin", SHA], commands
        )
        self.assertIn(["-C", "se-frontend", "checkout", "--detach", SHA], commands)

    def test_missing_frontend_never_substitutes_main(self):
        result, commands = self.invoke(MISSING="se-frontend")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("main cannot substitute", result.stdout)
        self.assertFalse(any("clone" in call for call in commands))

    def test_lookup_or_fetch_failure_cannot_green_source_selection(self):
        for override in ({"LOOKUP_FAILURE": "se-frontend"}, {"FETCH_FAILURE": "1"}):
            with self.subTest(override=override):
                result, commands = self.invoke(**override)
                self.assertEqual(result.returncode, 128, result.stderr)
                self.assertFalse(any("checkout" in call for call in commands))
                if "LOOKUP_FAILURE" in override:
                    self.assertIn("Could not resolve", result.stderr)

    def test_missing_partner_branches_keep_existing_independent_main_fallback(self):
        result, commands = self.invoke(MISSING="se-backend,se-integration-tests")
        self.assertEqual(result.returncode, 0, result.stderr)
        partners = [
            call for call in commands if "clone" in call and call[-1] != "se-frontend"
        ]
        self.assertEqual(len(partners), 2)
        self.assertTrue(
            all(call[call.index("--branch") + 1] == "main" for call in partners)
        )

    def test_invalid_source_inputs_fail_before_any_private_repository_request(self):
        for override in (
            {"SOURCE_SHA": "not-a-sha"},
            {"SOURCE_REPOSITORY": "another/repo"},
            {"FRONTEND_BRANCH_INPUT": ""},
        ):
            with self.subTest(override=override):
                result, commands = self.invoke(**override)
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(commands, [])


if __name__ == "__main__":
    unittest.main()
