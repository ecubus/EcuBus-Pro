import subprocess
import pytest


def test_run_lin_j2602_test():
    """Test spawning multiple commands"""
    commands = [
        ["ecb_cli", "test", "lin_j2602_test.ecb", "lin_j2602_test","-t","5.4.1.6 Multiple Errors","-l","debug"],
    ]
    
    for cmd in commands:
        result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
        print(result.stdout)
        print(result.stderr)
        assert result.returncode == 0


