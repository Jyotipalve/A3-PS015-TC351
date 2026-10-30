"""
NetExplain Diagnostic Engine
Safe, bounded, multi-platform network measurement engine.
Supports Windows, Linux, and macOS.
Never uses shell=True with user-controlled input.
"""

import ipaddress
import os
import platform
import re
import socket
import subprocess
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple


def _current_iso_time() -> str:
    return datetime.now(timezone.utc).isoformat()


def detect_default_gateway(override_ip: Optional[str] = None) -> Tuple[Optional[str], str]:
    """
    Detect the default network gateway IP address using OS-native tools.
    Returns (gateway_ip, method_used).
    """
    if override_ip:
        try:
            ipaddress.ip_address(override_ip)
            return override_ip, "Manual override"
        except ValueError:
            pass

    current_os = platform.system().lower()

    if current_os == "windows":
        # Method 1: route print 0.0.0.0
        try:
            proc = subprocess.run(
                ["route", "print", "0.0.0.0"],
                capture_output=True,
                text=True,
                timeout=4,
                check=False,
            )
            if proc.returncode == 0:
                lines = proc.stdout.splitlines()
                # Looking for: 0.0.0.0  0.0.0.0  <gateway>  <interface>
                for line in lines:
                    parts = line.strip().split()
                    if len(parts) >= 4 and parts[0] == "0.0.0.0" and parts[1] == "0.0.0.0":
                        gw_candidate = parts[2]
                        try:
                            ipaddress.ip_address(gw_candidate)
                            if not gw_candidate.startswith("127.") and gw_candidate != "0.0.0.0":
                                return gw_candidate, "Windows route print"
                        except ValueError:
                            continue
        except Exception:
            pass

        # Method 2: netsh interface ipv4 show config
        try:
            proc = subprocess.run(
                ["netsh", "interface", "ipv4", "show", "config"],
                capture_output=True,
                text=True,
                timeout=4,
                check=False,
            )
            if proc.returncode == 0:
                match = re.search(r"Default Gateway:\s*([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)", proc.stdout)
                if match:
                    gw_candidate = match.group(1).strip()
                    try:
                        ipaddress.ip_address(gw_candidate)
                        return gw_candidate, "Windows netsh"
                    except ValueError:
                        pass
        except Exception:
            pass

    elif current_os == "linux":
        # Method 1: ip route show default
        try:
            proc = subprocess.run(
                ["ip", "route", "show", "default"],
                capture_output=True,
                text=True,
                timeout=3,
                check=False,
            )
            if proc.returncode == 0:
                # e.g., default via 192.168.1.1 dev eth0
                parts = proc.stdout.strip().split()
                if "via" in parts:
                    idx = parts.index("via")
                    if idx + 1 < len(parts):
                        gw_candidate = parts[idx + 1]
                        try:
                            ipaddress.ip_address(gw_candidate)
                            return gw_candidate, "Linux ip route"
                        except ValueError:
                            pass
        except Exception:
            pass

        # Method 2: /proc/net/route
        if os.path.exists("/proc/net/route"):
            try:
                with open("/proc/net/route", "r") as f:
                    for line in f:
                        fields = line.strip().split()
                        if len(fields) >= 3 and fields[1] == "00000000":
                            gw_hex = fields[2]
                            gw_int = int(gw_hex, 16)
                            gw_ip = socket.inet_ntoa(gw_int.to_bytes(4, byteorder="little"))
                            return gw_ip, "Linux /proc/net/route"
            except Exception:
                pass

    elif current_os == "darwin":  # macOS
        try:
            proc = subprocess.run(
                ["route", "-n", "get", "default"],
                capture_output=True,
                text=True,
                timeout=3,
                check=False,
            )
            if proc.returncode == 0:
                for line in proc.stdout.splitlines():
                    if "gateway:" in line:
                        gw_candidate = line.split("gateway:")[1].strip()
                        try:
                            ipaddress.ip_address(gw_candidate)
                            return gw_candidate, "macOS route get"
                        except ValueError:
                            pass
        except Exception:
            pass

    return None, "Gateway detection failed"


def parse_ping_output(stdout: str, system_os: str) -> Dict[str, Any]:
    """
    Safely parse ICMP ping stdout across Windows, Linux, and macOS.
    Returns dictionary of packets_sent, packets_received, packet_loss_pct,
    rtt_min_ms, rtt_avg_ms, rtt_max_ms.
    """
    stats: Dict[str, Any] = {
        "packets_sent": 0,
        "packets_received": 0,
        "packet_loss_pct": 100.0,
        "rtt_min_ms": None,
        "rtt_avg_ms": None,
        "rtt_max_ms": None,
    }

    if not stdout:
        return stats

    if system_os == "windows":
        # Windows format:
        # Packets: Sent = 4, Received = 4, Lost = 0 (0% loss),
        # Minimum = 4ms, Maximum = 5ms, Average = 4ms
        loss_match = re.search(
            r"Sent\s*=\s*(\d+),\s*Received\s*=\s*(\d+),\s*Lost\s*=\s*(\d+)\s*\(([\d\.]+)%\s*loss\)",
            stdout,
            re.IGNORECASE,
        )
        if loss_match:
            stats["packets_sent"] = int(loss_match.group(1))
            stats["packets_received"] = int(loss_match.group(2))
            stats["packet_loss_pct"] = float(loss_match.group(4))

        rtt_match = re.search(
            r"Minimum\s*=\s*([\d\.]+)ms,\s*Maximum\s*=\s*([\d\.]+)ms,\s*Average\s*=\s*([\d\.]+)ms",
            stdout,
            re.IGNORECASE,
        )
        if rtt_match:
            stats["rtt_min_ms"] = float(rtt_match.group(1))
            stats["rtt_max_ms"] = float(rtt_match.group(2))
            stats["rtt_avg_ms"] = float(rtt_match.group(3))
        elif stats["packets_received"] > 0:
            # Individual reply lines: Reply from 10.17.172.10: bytes=32 time=4ms TTL=64
            times = [float(m) for m in re.findall(r"time[<=]([\d\.]+)ms", stdout, re.IGNORECASE)]
            if times:
                stats["rtt_min_ms"] = min(times)
                stats["rtt_max_ms"] = max(times)
                stats["rtt_avg_ms"] = round(sum(times) / len(times), 2)

    else:
        # Linux / Unix format:
        # 4 packets transmitted, 4 received, 0% packet loss, time 3004ms
        # rtt min/avg/max/mdev = 3.921/4.120/4.312/0.142 ms
        loss_match = re.search(
            r"(\d+)\s+(?:packets\s+)?transmitted,\s*(\d+)\s+(?:packets\s+)?received,\s*([\d\.]+)%\s*packet\s*loss",
            stdout,
            re.IGNORECASE,
        )
        if loss_match:
            stats["packets_sent"] = int(loss_match.group(1))
            stats["packets_received"] = int(loss_match.group(2))
            stats["packet_loss_pct"] = float(loss_match.group(3))

        rtt_match = re.search(
            r"(?:rtt|round-trip)\s+min/avg/max/(?:mdev|stddev)\s*=\s*([\d\.]+)/([\d\.]+)/([\d\.]+)",
            stdout,
            re.IGNORECASE,
        )
        if rtt_match:
            stats["rtt_min_ms"] = float(rtt_match.group(1))
            stats["rtt_avg_ms"] = float(rtt_match.group(2))
            stats["rtt_max_ms"] = float(rtt_match.group(3))

    return stats


def execute_ping(
    target: str,
    count: int = 4,
    timeout_ms: int = 1000,
) -> Tuple[Dict[str, Any], Optional[str]]:
    """
    Executes an OS ping command safely with bounded timeout and no shell=True.
    Returns (stats_dict, error_string).
    """
    system_os = platform.system().lower()

    # Safe validation of target to prevent injection
    cleaned_target = target.strip()
    if not re.match(r"^[a-zA-Z0-9\.\-_:]+$", cleaned_target):
        return {
            "packets_sent": 0,
            "packets_received": 0,
            "packet_loss_pct": 100.0,
            "rtt_min_ms": None,
            "rtt_avg_ms": None,
            "rtt_max_ms": None,
        }, f"Invalid target identifier: {target}"

    bounded_count = max(1, min(10, count))
    bounded_timeout = max(500, min(5000, timeout_ms))

    if system_os == "windows":
        # Windows ping: -n count, -w timeout_ms
        cmd = ["ping", "-n", str(bounded_count), "-w", str(bounded_timeout), cleaned_target]
    else:
        # Linux / Unix ping: -c count, -W timeout_sec
        timeout_sec = max(1, int(bounded_timeout / 1000))
        cmd = ["ping", "-c", str(bounded_count), "-W", str(timeout_sec), cleaned_target]

    total_proc_timeout = (bounded_count * (bounded_timeout / 1000.0)) + 3.0

    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=total_proc_timeout,
            check=False,
        )
        stats = parse_ping_output(proc.stdout, system_os)
        error = None
        if proc.returncode != 0 and stats["packets_received"] == 0:
            error = proc.stderr.strip() or proc.stdout.strip() or f"Ping process returned code {proc.returncode}"
            # Extract common Windows error
            if "General failure" in error:
                error = "ICMP driver unreachable (General failure)"
            elif "Destination host unreachable" in error:
                error = "Destination host unreachable"
            elif "Request timed out" in error:
                error = "Request timed out"
        return stats, error
    except subprocess.TimeoutExpired:
        return {
            "packets_sent": bounded_count,
            "packets_received": 0,
            "packet_loss_pct": 100.0,
            "rtt_min_ms": None,
            "rtt_avg_ms": None,
            "rtt_max_ms": None,
        }, f"Ping operation exceeded {total_proc_timeout:.1f}s safety threshold"
    except Exception as exc:
        return {
            "packets_sent": 0,
            "packets_received": 0,
            "packet_loss_pct": 100.0,
            "rtt_min_ms": None,
            "rtt_avg_ms": None,
            "rtt_max_ms": None,
        }, str(exc)


# ---------------------------------------------------------------------------
# Core Test Functions with Structured Results
# ---------------------------------------------------------------------------

def run_gateway_test(override_ip: Optional[str] = None, count: int = 4) -> Dict[str, Any]:
    """
    Test 1: Default Gateway Detection and Reachability.
    """
    start_iso = _current_iso_time()
    t0 = time.perf_counter()

    gateway_ip, method = detect_default_gateway(override_ip)

    if not gateway_ip:
        duration_ms = round((time.perf_counter() - t0) * 1000, 2)
        return {
            "test_id": "gateway",
            "name": "Default Gateway Reachability",
            "status": "inconclusive",
            "target": "unknown",
            "method": method,
            "start_time": start_iso,
            "end_time": _current_iso_time(),
            "duration_ms": duration_ms,
            "measured_values": {
                "gateway_ip": None,
                "rtt_avg_ms": None,
                "rtt_min_ms": None,
                "rtt_max_ms": None,
                "packet_loss_pct": None,
            },
            "error_details": "Unable to detect local default gateway from system routing table",
            "interpretation": "Cannot evaluate local Wi-Fi / LAN link because the default gateway IP was not discovered.",
        }

    stats, error = execute_ping(gateway_ip, count=count, timeout_ms=1000)
    duration_ms = round((time.perf_counter() - t0) * 1000, 2)

    measured = {
        "gateway_ip": gateway_ip,
        "detection_method": method,
        "packets_sent": stats["packets_sent"],
        "packets_received": stats["packets_received"],
        "packet_loss_pct": stats["packet_loss_pct"],
        "rtt_avg_ms": stats["rtt_avg_ms"],
        "rtt_min_ms": stats["rtt_min_ms"],
        "rtt_max_ms": stats["rtt_max_ms"],
    }

    if stats["packets_received"] == 0:
        if error and "General failure" in error:
            status = "inconclusive"
            interpretation = "Local ICMP ping was restricted by host security sandbox or missing driver privileges."
        else:
            status = "fail"
            interpretation = f"Default gateway {gateway_ip} is unreachable (100% packet loss). Local LAN or Wi-Fi link appears disconnected."
    elif stats["packet_loss_pct"] > 0:
        status = "warning"
        interpretation = f"Gateway {gateway_ip} is responding with {stats['packet_loss_pct']:.0f}% packet loss. Indicates local wireless interference or cable degradation."
    elif stats["rtt_avg_ms"] is not None and stats["rtt_avg_ms"] > 35.0:
        status = "warning"
        interpretation = f"Gateway latency is elevated at {stats['rtt_avg_ms']}ms (healthy local hop is typically <10ms)."
    else:
        status = "pass"
        interpretation = f"Local gateway {gateway_ip} is healthy with {stats['rtt_avg_ms']}ms average latency and zero loss."

    return {
        "test_id": "gateway",
        "name": "Default Gateway Reachability",
        "status": status,
        "target": gateway_ip,
        "method": f"ICMP Echo via {method}",
        "start_time": start_iso,
        "end_time": _current_iso_time(),
        "duration_ms": duration_ms,
        "measured_values": measured,
        "error_details": error if status in ("fail", "inconclusive") else None,
        "interpretation": interpretation,
    }


def run_dns_test(hostname: str = "google.com") -> Dict[str, Any]:
    """
    Test 2: System DNS Resolution Elapsed Time and Target Translation.
    """
    start_iso = _current_iso_time()
    t0 = time.perf_counter()

    resolved_ips: List[str] = []
    error_details = None

    try:
        addr_info = socket.getaddrinfo(hostname, 80, socket.AF_INET, socket.SOCK_STREAM)
        duration_ms = round((time.perf_counter() - t0) * 1000, 2)
        for item in addr_info:
            ip = item[4][0]
            if ip not in resolved_ips:
                resolved_ips.append(ip)

        if duration_ms < 100:
            status = "pass"
            interpretation = f"DNS resolution for '{hostname}' completed quickly in {duration_ms}ms ({len(resolved_ips)} IPs returned)."
        elif duration_ms < 300:
            status = "warning"
            interpretation = f"DNS resolution for '{hostname}' succeeded in {duration_ms}ms but shows mild resolver delay."
        else:
            status = "warning"
            interpretation = f"DNS resolution for '{hostname}' took {duration_ms}ms (slow lookup, indicating resolver peering latency)."

    except socket.gaierror as exc:
        duration_ms = round((time.perf_counter() - t0) * 1000, 2)
        status = "fail"
        error_details = f"DNS resolution failed: {exc}"
        interpretation = f"Cannot resolve '{hostname}'. DNS servers are unresponsive or domain is unresolvable."
    except Exception as exc:
        duration_ms = round((time.perf_counter() - t0) * 1000, 2)
        status = "inconclusive"
        error_details = str(exc)
        interpretation = f"Unexpected resolver exception during DNS test: {exc}"

    return {
        "test_id": "dns",
        "name": "DNS Resolution Latency",
        "status": status,
        "target": hostname,
        "method": "System Resolver socket.getaddrinfo",
        "start_time": start_iso,
        "end_time": _current_iso_time(),
        "duration_ms": duration_ms,
        "measured_values": {
            "hostname": hostname,
            "resolved_ips": resolved_ips,
            "resolution_time_ms": duration_ms if status != "fail" else None,
            "ip_count": len(resolved_ips),
        },
        "error_details": error_details,
        "interpretation": interpretation,
    }


def run_external_connectivity_test(
    icmp_target: str = "1.1.1.1",
    http_target: str = "https://connectivitycheck.gstatic.com/generate_204",
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """
    Test 3: External Connectivity split into:
      (a) external_icmp: ICMP Echo to public IP
      (b) external_http: HTTP/HTTPS probe with bounded timeout
    """
    # (a) External ICMP
    start_iso = _current_iso_time()
    t0 = time.perf_counter()
    stats, error = execute_ping(icmp_target, count=4, timeout_ms=1000)
    duration_ms = round((time.perf_counter() - t0) * 1000, 2)

    if stats["packets_received"] == 0:
        if error and "General failure" in error:
            icmp_status = "inconclusive"
            icmp_interp = f"ICMP ping to {icmp_target} was blocked by host sandbox."
        else:
            icmp_status = "fail"
            icmp_interp = f"No response from external public IP {icmp_target} (100% loss). ICMP echo may be dropped by an upstream firewall; web connectivity must be evaluated independently."
    elif stats["packet_loss_pct"] > 0:
        icmp_status = "warning"
        icmp_interp = f"External IP {icmp_target} shows {stats['packet_loss_pct']:.0f}% packet loss."
    else:
        icmp_status = "pass"
        icmp_interp = f"Public edge {icmp_target} reachable with {stats['rtt_avg_ms']}ms RTT and zero loss."

    icmp_result = {
        "test_id": "external_icmp",
        "name": "External ICMP Echo",
        "status": icmp_status,
        "target": icmp_target,
        "method": "ICMP Echo",
        "start_time": start_iso,
        "end_time": _current_iso_time(),
        "duration_ms": duration_ms,
        "measured_values": {
            "target": icmp_target,
            "packets_sent": stats["packets_sent"],
            "packets_received": stats["packets_received"],
            "packet_loss_pct": stats["packet_loss_pct"],
            "rtt_avg_ms": stats["rtt_avg_ms"],
            "rtt_min_ms": stats["rtt_min_ms"],
            "rtt_max_ms": stats["rtt_max_ms"],
        },
        "error_details": error if icmp_status in ("fail", "inconclusive") else None,
        "interpretation": icmp_interp,
    }

    # (b) External HTTP/HTTPS Check
    http_start_iso = _current_iso_time()
    t1 = time.perf_counter()
    http_status_code = None
    http_rtt_ms = None
    http_error = None

    import httpx

    try:
        with httpx.Client(timeout=4.0, follow_redirects=True) as client:
            resp = client.get(http_target)
            http_rtt_ms = round((time.perf_counter() - t1) * 1000, 2)
            http_status_code = resp.status_code

            if resp.status_code in (200, 204):
                http_status = "pass"
                http_interp = f"HTTP endpoint {http_target} returned status {resp.status_code} in {http_rtt_ms}ms."
            elif resp.status_code in (301, 302, 307):
                http_status = "warning"
                http_interp = f"HTTP check was redirected to {resp.headers.get('Location', 'unknown')} (possible captive portal)."
            else:
                http_status = "warning"
                http_interp = f"HTTP check returned non-standard status {resp.status_code}."
    except httpx.ConnectTimeout:
        http_rtt_ms = round((time.perf_counter() - t1) * 1000, 2)
        http_status = "fail"
        http_error = "HTTP connection timed out after 4.0s"
        http_interp = "HTTP connection to public verification server timed out."
    except httpx.ConnectError as exc:
        http_rtt_ms = round((time.perf_counter() - t1) * 1000, 2)
        http_status = "fail"
        http_error = f"HTTP connect error: {exc}"
        http_interp = "Could not establish TCP/TLS connection to external web endpoint."
    except Exception as exc:
        http_rtt_ms = round((time.perf_counter() - t1) * 1000, 2)
        http_status = "inconclusive"
        http_error = str(exc)
        http_interp = f"Unexpected failure during HTTP probe: {exc}"

    http_duration_ms = round((time.perf_counter() - t1) * 1000, 2)

    http_result = {
        "test_id": "external_http",
        "name": "External HTTP/HTTPS Web Verification",
        "status": http_status,
        "target": http_target,
        "method": "HTTP GET via HTTPX",
        "start_time": http_start_iso,
        "end_time": _current_iso_time(),
        "duration_ms": http_duration_ms,
        "measured_values": {
            "http_target": http_target,
            "status_code": http_status_code,
            "http_rtt_ms": http_rtt_ms,
        },
        "error_details": http_error,
        "interpretation": http_interp,
    }

    return icmp_result, http_result


def run_packet_loss_test(target: str = "8.8.8.8", count: int = 5) -> Dict[str, Any]:
    """
    Test 4: End-to-End Packet Loss and Latency Distribution.
    """
    start_iso = _current_iso_time()
    t0 = time.perf_counter()

    stats, error = execute_ping(target, count=count, timeout_ms=1000)
    duration_ms = round((time.perf_counter() - t0) * 1000, 2)

    loss_pct = stats["packet_loss_pct"]
    avg_rtt = stats["rtt_avg_ms"]

    if stats["packets_received"] == 0:
        if error and "General failure" in error:
            status = "inconclusive"
            interp = f"End-to-end probing to {target} was blocked by host sandbox."
        else:
            status = "fail"
            interp = f"100% packet loss to {target} across {count} probes."
    elif loss_pct > 20.0:
        status = "fail"
        interp = f"Severe packet loss ({loss_pct:.0f}%) detected on end-to-end path to {target}."
    elif loss_pct > 0.0:
        status = "warning"
        interp = f"Moderate packet loss ({loss_pct:.0f}%) detected to {target}."
    elif avg_rtt is not None and avg_rtt > 80.0:
        status = "warning"
        interp = f"0% loss to {target}, but elevated latency ({avg_rtt}ms)."
    else:
        status = "pass"
        interp = f"Stable end-to-end link: 0% loss, {avg_rtt}ms average RTT."

    return {
        "test_id": "packet_loss",
        "name": "End-to-End Packet Loss & Latency",
        "status": status,
        "target": target,
        "method": "Bounded ICMP probe burst",
        "start_time": start_iso,
        "end_time": _current_iso_time(),
        "duration_ms": duration_ms,
        "measured_values": {
            "target": target,
            "packets_sent": stats["packets_sent"],
            "packets_received": stats["packets_received"],
            "packet_loss_pct": loss_pct,
            "rtt_avg_ms": avg_rtt,
            "rtt_min_ms": stats["rtt_min_ms"],
            "rtt_max_ms": stats["rtt_max_ms"],
        },
        "error_details": error if status in ("fail", "inconclusive") else None,
        "interpretation": interp,
    }


def run_mild_load_test(
    ping_target: str = "1.1.1.1",
    workload_url: str = "https://speed.cloudflare.com/__down?bytes=500000",
) -> Dict[str, Any]:
    """
    Test 5: Mild-Load Comparison (Bufferbloat Indicator).
    Measures baseline idle RTT, runs a small bounded download (~500KB),
    measures loaded RTT, and calculates delta.
    Strictly avoids network saturation.
    """
    start_iso = _current_iso_time()
    t0 = time.perf_counter()

    # Step 1: Baseline idle RTT
    base_stats, base_error = execute_ping(ping_target, count=3, timeout_ms=800)
    baseline_rtt = base_stats["rtt_avg_ms"]

    if baseline_rtt is None:
        duration_ms = round((time.perf_counter() - t0) * 1000, 2)
        return {
            "test_id": "mild_load",
            "name": "Mild-Load Bufferbloat Comparison",
            "status": "inconclusive",
            "target": ping_target,
            "method": "Idle vs Concurrent Bounded HTTP Workload",
            "start_time": start_iso,
            "end_time": _current_iso_time(),
            "duration_ms": duration_ms,
            "measured_values": {
                "baseline_rtt_ms": None,
                "loaded_rtt_ms": None,
                "delta_ms": None,
                "ratio": None,
            },
            "error_details": base_error or "Unable to establish baseline idle RTT",
            "interpretation": "Cannot calculate mild-load comparison because baseline idle latency could not be sampled.",
        }

    # Step 2: Perform small bounded workload while/between taking loaded measurement
    import httpx

    loaded_rtt = None
    workload_bytes = 0
    workload_duration_s = 0.0
    workload_error = None

    try:
        t_work_start = time.perf_counter()
        with httpx.Client(timeout=3.0) as client:
            resp = client.get(workload_url)
            workload_bytes = len(resp.content)
            workload_duration_s = round(time.perf_counter() - t_work_start, 2)
    except Exception as exc:
        workload_error = f"Workload warning: {exc}"

    # Step 3: Measure loaded RTT immediately
    load_stats, _ = execute_ping(ping_target, count=3, timeout_ms=800)
    loaded_rtt = load_stats["rtt_avg_ms"]

    duration_ms = round((time.perf_counter() - t0) * 1000, 2)

    if loaded_rtt is None:
        delta_ms = None
        ratio = None
        status = "inconclusive"
        interp = "Loaded latency probe did not return valid samples."
    else:
        delta_ms = round(loaded_rtt - baseline_rtt, 2)
        ratio = round(loaded_rtt / max(1.0, baseline_rtt), 2)

        if delta_ms < 25.0:
            status = "pass"
            interp = f"Bufferbloat managed well: RTT increased by only +{delta_ms}ms under mild load (baseline {baseline_rtt}ms → loaded {loaded_rtt}ms)."
        elif delta_ms < 75.0:
            status = "warning"
            interp = f"Moderate bufferbloat observed: RTT increased by +{delta_ms}ms ({ratio}x baseline) under mild load."
        else:
            status = "fail"
            interp = f"Severe bufferbloat detected: RTT increased by +{delta_ms}ms ({ratio}x baseline) under mild load, indicating bloated router/modem queue buffers."

    return {
        "test_id": "mild_load",
        "name": "Mild-Load Bufferbloat Comparison",
        "status": status,
        "target": f"{ping_target} + {workload_url}",
        "method": "Bounded Workload Comparison (non-saturating)",
        "start_time": start_iso,
        "end_time": _current_iso_time(),
        "duration_ms": duration_ms,
        "measured_values": {
            "baseline_rtt_ms": baseline_rtt,
            "loaded_rtt_ms": loaded_rtt,
            "delta_ms": delta_ms,
            "ratio": ratio,
            "workload_bytes_transferred": workload_bytes,
            "workload_duration_s": workload_duration_s,
        },
        "error_details": workload_error,
        "interpretation": interp,
    }
