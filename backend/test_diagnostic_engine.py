from unittest.mock import MagicMock, patch
import pytest

from diagnostic_engine import (
    parse_ping_output,
    run_dns_test,
    run_gateway_test,
    run_mild_load_test,
    run_packet_loss_test,
)
from rule_engine import evaluate_diagnostic_evidence


def test_parse_ping_output_windows():
    sample_win = """
Pinging 10.17.172.10 with 32 bytes of data:
Reply from 10.17.172.10: bytes=32 time=4ms TTL=64
Reply from 10.17.172.10: bytes=32 time=5ms TTL=64

Ping statistics for 10.17.172.10:
    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss),
Approximate round trip times in milli-seconds:
    Minimum = 4ms, Maximum = 5ms, Average = 4ms
"""
    res = parse_ping_output(sample_win, "windows")
    assert res["packets_sent"] == 4
    assert res["packets_received"] == 4
    assert res["packet_loss_pct"] == 0.0
    assert res["rtt_min_ms"] == 4.0
    assert res["rtt_max_ms"] == 5.0
    assert res["rtt_avg_ms"] == 4.0


def test_parse_ping_output_linux():
    sample_linux = """
4 packets transmitted, 4 received, 0% packet loss, time 3004ms
rtt min/avg/max/mdev = 3.921/4.120/4.312/0.142 ms
"""
    res = parse_ping_output(sample_linux, "linux")
    assert res["packets_sent"] == 4
    assert res["packets_received"] == 4
    assert res["packet_loss_pct"] == 0.0
    assert res["rtt_min_ms"] == 3.921
    assert res["rtt_avg_ms"] == 4.120
    assert res["rtt_max_ms"] == 4.312


@patch("diagnostic_engine.detect_default_gateway", return_value=("192.168.1.1", "Mocked"))
@patch("diagnostic_engine.execute_ping")
def test_run_gateway_test_healthy(mock_ping, mock_detect):
    mock_ping.return_value = (
        {
            "packets_sent": 4,
            "packets_received": 4,
            "packet_loss_pct": 0.0,
            "rtt_avg_ms": 3.2,
            "rtt_min_ms": 2.5,
            "rtt_max_ms": 4.1,
        },
        None,
    )
    result = run_gateway_test()
    assert result["status"] == "pass"
    assert result["measured_values"]["gateway_ip"] == "192.168.1.1"
    assert result["measured_values"]["rtt_avg_ms"] == 3.2


@patch("diagnostic_engine.detect_default_gateway", return_value=("192.168.1.1", "Mocked"))
@patch("diagnostic_engine.execute_ping")
def test_run_gateway_test_unreachable(mock_ping, mock_detect):
    mock_ping.return_value = (
        {
            "packets_sent": 4,
            "packets_received": 0,
            "packet_loss_pct": 100.0,
            "rtt_avg_ms": None,
            "rtt_min_ms": None,
            "rtt_max_ms": None,
        },
        "Destination host unreachable",
    )
    result = run_gateway_test()
    assert result["status"] == "fail"
    assert result["measured_values"]["packet_loss_pct"] == 100.0


@patch("socket.getaddrinfo")
def test_run_dns_test_success(mock_getaddrinfo):
    mock_getaddrinfo.return_value = [
        (2, 1, 6, "", ("142.250.190.46", 80)),
        (2, 1, 6, "", ("142.250.190.78", 80)),
    ]
    result = run_dns_test(hostname="google.com")
    assert result["status"] == "pass"
    assert "142.250.190.46" in result["measured_values"]["resolved_ips"]


@patch("diagnostic_engine.execute_ping")
def test_run_packet_loss_test_warning(mock_ping):
    mock_ping.return_value = (
        {
            "packets_sent": 5,
            "packets_received": 4,
            "packet_loss_pct": 20.0,
            "rtt_avg_ms": 25.0,
            "rtt_min_ms": 20.0,
            "rtt_max_ms": 35.0,
        },
        None,
    )
    result = run_packet_loss_test(target="8.8.8.8", count=5)
    assert result["status"] == "warning"
    assert result["measured_values"]["packet_loss_pct"] == 20.0


# ---------------------------------------------------------------------------
# Rule Engine Deterministic Tests
# ---------------------------------------------------------------------------

def test_rule_engine_all_healthy():
    tests = {
        "gateway": {"status": "pass", "measured_values": {"gateway_ip": "192.168.1.1", "rtt_avg_ms": 2.5, "packet_loss_pct": 0}},
        "dns": {"status": "pass", "measured_values": {"resolution_time_ms": 15.0, "hostname": "google.com"}},
        "external_icmp": {"status": "pass", "measured_values": {"target": "1.1.1.1", "rtt_avg_ms": 18.0, "packet_loss_pct": 0}},
        "external_http": {"status": "pass", "measured_values": {"status_code": 204, "http_rtt_ms": 35.0}},
        "packet_loss": {"status": "pass", "measured_values": {"packet_loss_pct": 0.0, "rtt_avg_ms": 18.5}},
        "mild_load": {"status": "pass", "measured_values": {"baseline_rtt_ms": 18.0, "loaded_rtt_ms": 22.0, "delta_ms": 4.0}},
    }
    diag = evaluate_diagnostic_evidence(tests)
    assert diag["primary_diagnosis"] == "Healthy Home & Last-Mile Connection"
    assert diag["severity"] == "healthy"
    assert diag["confidence"] == "High"
    assert len(diag["observed_evidence"]) > 0


def test_rule_engine_local_gateway_down():
    tests = {
        "gateway": {"status": "fail", "measured_values": {"gateway_ip": "192.168.1.1", "rtt_avg_ms": None, "packet_loss_pct": 100}},
        "dns": {"status": "fail", "measured_values": {}},
        "external_icmp": {"status": "fail", "measured_values": {}},
        "external_http": {"status": "fail", "measured_values": {}},
        "packet_loss": {"status": "fail", "measured_values": {}},
        "mild_load": {"status": "inconclusive", "measured_values": {}},
    }
    diag = evaluate_diagnostic_evidence(tests)
    assert diag["primary_diagnosis"] == "Local Gateway Unreachable"
    assert diag["severity"] == "critical"
    assert any(h["hypothesis"] == "Local Physical Link or Gateway Outage" and h["state"] == "supported" for h in diag["hypotheses"])


def test_rule_engine_upstream_isp_down():
    tests = {
        "gateway": {"status": "pass", "measured_values": {"gateway_ip": "192.168.1.1", "rtt_avg_ms": 2.1, "packet_loss_pct": 0}},
        "dns": {"status": "fail", "measured_values": {}},
        "external_icmp": {"status": "fail", "measured_values": {"target": "1.1.1.1", "packet_loss_pct": 100}},
        "external_http": {"status": "fail", "measured_values": {}},
        "packet_loss": {"status": "fail", "measured_values": {}},
        "mild_load": {"status": "inconclusive", "measured_values": {}},
    }
    diag = evaluate_diagnostic_evidence(tests)
    assert diag["primary_diagnosis"] == "Upstream ISP Broadband Outage"
    assert diag["severity"] == "critical"
    assert any(h["hypothesis"] == "Upstream ISP or Transit Link Outage" and h["state"] == "supported" for h in diag["hypotheses"])


def test_rule_engine_bufferbloat_detected():
    tests = {
        "gateway": {"status": "pass", "measured_values": {"gateway_ip": "192.168.1.1", "rtt_avg_ms": 3.0, "packet_loss_pct": 0}},
        "dns": {"status": "pass", "measured_values": {"resolution_time_ms": 18.0}},
        "external_icmp": {"status": "pass", "measured_values": {"rtt_avg_ms": 22.0, "packet_loss_pct": 0}},
        "external_http": {"status": "pass", "measured_values": {"status_code": 204}},
        "packet_loss": {"status": "pass", "measured_values": {"packet_loss_pct": 0}},
        "mild_load": {"status": "fail", "measured_values": {"baseline_rtt_ms": 22.0, "loaded_rtt_ms": 135.0, "delta_ms": 113.0, "ratio": 6.1}},
    }
    diag = evaluate_diagnostic_evidence(tests)
    assert diag["primary_diagnosis"] == "Last-Mile Bufferbloat Under Load"
    assert diag["severity"] == "warning"
    assert any(h["hypothesis"] == "Last-Mile Bufferbloat / Queue Buildup Under Load" and h["state"] == "supported" for h in diag["hypotheses"])


def test_rule_engine_failed_public_ping_does_not_claim_internet_down():
    # ICMP ping fails, but HTTP web probe succeeds
    tests = {
        "gateway": {"status": "pass", "measured_values": {"gateway_ip": "192.168.1.1", "rtt_avg_ms": 2.2, "packet_loss_pct": 0}},
        "dns": {"status": "pass", "measured_values": {"resolution_time_ms": 15.0}},
        "external_icmp": {"status": "fail", "measured_values": {"target": "1.1.1.1", "packet_loss_pct": 100.0}},
        "external_http": {"status": "pass", "measured_values": {"status_code": 204, "http_rtt_ms": 35.0}},
        "packet_loss": {"status": "fail", "measured_values": {"packet_loss_pct": 100.0}},
        "mild_load": {"status": "inconclusive", "measured_values": {}},
    }
    diag = evaluate_diagnostic_evidence(tests)
    assert "ICMP" in diag["primary_diagnosis"]
    assert "Active" in diag["primary_diagnosis"] or "Intact" in diag["primary_diagnosis"]
    assert diag["severity"] == "healthy"
    # Verify ISP outage hypothesis is contradicted, not supported
    assert any(h["hypothesis"] == "Upstream ISP or Transit Link Outage" and h["state"] == "contradicted" for h in diag["hypotheses"])
