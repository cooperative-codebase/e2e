import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "e2e-notify-failure.sh"


class NotificationTests(unittest.TestCase):
    def invoke(self, *, branch="main", has_mail=True, mail_status=0, soak=False):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "cat").symlink_to(shutil.which("cat"))
            output = root / "submitted.json"
            if has_mail:
                stub = root / "mail"
                stub.write_text(
                    f"#!{sys.executable}\n"
                    "import json, sys\n"
                    f'open({str(output)!r}, "w").write(json.dumps({{"args": sys.argv[1:], "body": sys.stdin.read()}}))\n'
                    f"sys.exit({mail_status})\n"
                )
                stub.chmod(0o700)
            result = subprocess.run(
                ["/bin/bash", str(SCRIPT)],
                env={
                    "PATH": directory,
                    "GITHUB_REF_NAME": branch,
                    "GITHUB_RUN_ID": "123",
                    "GITHUB_SHA": "a" * 40,
                    "SE_E2E_REPORT_DIR": "/test-reports/123",
                    "E2E_NOTIFICATION_SOAK": "1" if soak else "0",
                },
                text=True,
                capture_output=True,
            )
            submission = json.loads(output.read_text()) if output.exists() else None
            return result, submission

    def test_main_submits_expected_recipient_and_attributable_report(self):
        result, submission = self.invoke()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(submission["args"][-1], "aaron@cooperativecodebase.com")
        self.assertIn(
            "https://github.com/cooperative-codebase/e2e/actions/runs/123",
            submission["body"],
        )
        self.assertIn("/test-reports/123", submission["body"])
        self.assertIn("submitted", result.stdout)

    def test_other_branch_never_calls_mail(self):
        result, submission = self.invoke(branch="codex/browser-pr-gate")
        self.assertEqual(result.returncode, 0)
        self.assertIsNone(submission)
        self.assertIn("Skipping", result.stdout)

    def test_missing_mail_and_failed_submission_do_not_claim_success(self):
        for arguments in ({"has_mail": False}, {"mail_status": 1}):
            with self.subTest(arguments=arguments):
                result, _ = self.invoke(**arguments)
                self.assertNotEqual(result.returncode, 0)
                self.assertNotIn("alert submitted", result.stdout)

    def test_controlled_exercise_is_clearly_identified(self):
        result, submission = self.invoke(soak=True)
        self.assertEqual(result.returncode, 0)
        self.assertIn("[E2E notification test]", submission["args"][1])
        self.assertIn(
            "No application browser tests or payments were run.", submission["body"]
        )

    def test_authorized_branch_exercise_keeps_actual_branch_and_test_subject(self):
        result, submission = self.invoke(branch="codex/browser-pr-gate", soak=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(submission["args"][-1], "aaron@cooperativecodebase.com")
        self.assertIn("[E2E notification test]", submission["args"][1])
        self.assertIn("Branch: codex/browser-pr-gate", submission["body"])
        self.assertIn("No application browser tests or payments", submission["body"])

    def test_branch_exercise_failed_submission_is_an_error(self):
        result, _ = self.invoke(branch="codex/browser-pr-gate", soak=True, mail_status=1)
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn("alert submitted", result.stdout)


if __name__ == "__main__":
    unittest.main()
