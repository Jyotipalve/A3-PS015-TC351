"""
NetExplain Evidence-to-Action Rule Engine
Deterministic, testable inference engine.
Synthesizes multi-hop diagnostic metrics into plain-language explanations,
evidence logs, hypotheses testing, and actionable remediation steps.
Strictly avoids claiming Wi-Fi interference without dedicated RF telemetry.
"""

from typing import Any, Dict, List


def evaluate_diagnostic_evidence(test_results: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    """
    Evaluates observed diagnostic measurements against deterministic network failure signatures.
    Returns structured diagnosis, evidence breakdown, tested hypotheses, confidence rating,
    alternative explanations, and resolution steps.
    """
    gateway_res = test_results.get("gateway", {})
    dns_res = test_results.get("dns", {})
    icmp_res = test_results.get("external_icmp", {})
    http_res = test_results.get("external_http", {})
    loss_res = test_results.get("packet_loss", {})
    load_res = test_results.get("mild_load", {})

    gw_status = gateway_res.get("status", "skipped")
    dns_status = dns_res.get("status", "skipped")
    icmp_status = icmp_res.get("status", "skipped")
    http_status = http_res.get("status", "skipped")
    loss_status = loss_res.get("status", "skipped")
    load_status = load_res.get("status", "skipped")

    gw_vals = gateway_res.get("measured_values", {})
    dns_vals = dns_res.get("measured_values", {})
    icmp_vals = icmp_res.get("measured_values", {})
    http_vals = http_res.get("measured_values", {})
    loss_vals = loss_res.get("measured_values", {})
    load_vals = load_res.get("measured_values", {})

    # Build concrete observed evidence statements
    observed_evidence: List[str] = []

    if gw_status != "skipped":
        gw_ip = gw_vals.get("gateway_ip") or "Gateway"
        rtt = gw_vals.get("rtt_avg_ms")
        loss = gw_vals.get("packet_loss_pct")
        if rtt is not None and loss is not None:
            observed_evidence.append(
                f"Default gateway {gw_ip} responded with {rtt}ms average RTT and {loss:.0f}% packet loss."
            )
        else:
            observed_evidence.append(f"Default gateway {gw_ip} reachability status is '{gw_status}'.")

    if dns_status != "skipped":
        dns_time = dns_vals.get("resolution_time_ms")
        host = dns_vals.get("hostname", "target")
        if dns_time is not None:
            observed_evidence.append(f"DNS lookup for {host} resolved in {dns_time}ms.")
        else:
            observed_evidence.append(f"DNS lookup for {host} failed ({dns_res.get('error_details', 'lookup error')}).")

    if icmp_status != "skipped":
        icmp_target = icmp_vals.get("target", "Public IP")
        icmp_rtt = icmp_vals.get("rtt_avg_ms")
        icmp_loss = icmp_vals.get("packet_loss_pct")
        if icmp_rtt is not None and icmp_loss is not None:
            observed_evidence.append(
                f"External ICMP destination {icmp_target} replied with {icmp_rtt}ms RTT and {icmp_loss:.0f}% loss."
            )
        else:
            observed_evidence.append(f"External ICMP probe to {icmp_target} failed.")

    if http_status != "skipped":
        status_code = http_vals.get("status_code")
        http_rtt = http_vals.get("http_rtt_ms")
        if status_code is not None:
            observed_evidence.append(
                f"External HTTP endpoint returned HTTP {status_code} in {http_rtt}ms."
            )
        else:
            observed_evidence.append(f"External HTTP web probe failed: {http_res.get('error_details')}")

    if loss_status != "skipped":
        pkt_loss = loss_vals.get("packet_loss_pct")
        loss_target = loss_vals.get("target", "Public probe")
        if pkt_loss is not None:
            observed_evidence.append(f"End-to-end packet loss to {loss_target} measured at {pkt_loss:.0f}%.")

    if load_status != "skipped":
        delta = load_vals.get("delta_ms")
        base = load_vals.get("baseline_rtt_ms")
        loaded = load_vals.get("loaded_rtt_ms")
        if delta is not None and base is not None and loaded is not None:
            observed_evidence.append(
                f"Mild-load bufferbloat check showed baseline {base}ms shifting to {loaded}ms (delta: {delta:+}ms)."
            )

    # Hypotheses evaluation
    hypotheses: List[Dict[str, Any]] = []

    # 1. Local Link / Gateway Outage
    if gw_status == "fail":
        h_local = {
            "hypothesis": "Local Physical Link or Gateway Outage",
            "state": "supported",
            "reason": "100% packet loss to the local default gateway indicates the immediate local connection (Wi-Fi association or Ethernet cable) is broken.",
        }
    elif gw_status == "pass":
        h_local = {
            "hypothesis": "Local Physical Link or Gateway Outage",
            "state": "contradicted",
            "reason": "Default gateway responded consistently with zero packet loss.",
        }
    else:
        h_local = {
            "hypothesis": "Local Physical Link or Gateway Outage",
            "state": "untested",
            "reason": "Gateway reachability test was inconclusive or skipped.",
        }
    hypotheses.append(h_local)

    # 2. Last-Mile Bufferbloat / Queue Saturation
    if load_status == "fail":
        h_load = {
            "hypothesis": "Last-Mile Bufferbloat / Queue Buildup Under Load",
            "state": "supported",
            "reason": f"Latency ballooned by {load_vals.get('delta_ms')}ms under non-saturating mild workload, consistent with unmanaged buffer bloat.",
        }
    elif load_status == "pass":
        h_load = {
            "hypothesis": "Last-Mile Bufferbloat / Queue Buildup Under Load",
            "state": "contradicted",
            "reason": "Latency remained stable (delta <25ms) under mild workload.",
        }
    else:
        h_load = {
            "hypothesis": "Last-Mile Bufferbloat / Queue Buildup Under Load",
            "state": "untested",
            "reason": "Mild-load bufferbloat test was inconclusive or skipped.",
        }
    hypotheses.append(h_load)

    # 3. DNS Resolver Outage
    if dns_status == "fail" and (gw_status == "pass" or icmp_status == "pass"):
        h_dns = {
            "hypothesis": "DNS Resolver Infrastructure Failure",
            "state": "supported",
            "reason": "Underlying IP routing to gateway/external is functional, but name resolution failed completely.",
        }
    elif dns_status == "pass":
        h_dns = {
            "hypothesis": "DNS Resolver Infrastructure Failure",
            "state": "contradicted",
            "reason": "System resolver successfully mapped target hostname within expected thresholds.",
        }
    else:
        h_dns = {
            "hypothesis": "DNS Resolver Infrastructure Failure",
            "state": "untested",
            "reason": "DNS resolution could not be isolated from upstream connectivity.",
        }
    hypotheses.append(h_dns)

    # 4. Upstream ISP Backbone Outage
    if gw_status == "pass" and icmp_status == "fail" and http_status == "fail":
        h_isp = {
            "hypothesis": "Upstream ISP or Transit Link Outage",
            "state": "supported",
            "reason": "Local gateway is fully reachable, but zero external IP or HTTP traffic is exiting the local subnet.",
        }
    elif icmp_status == "pass" or http_status == "pass":
        h_isp = {
            "hypothesis": "Upstream ISP or Transit Link Outage",
            "state": "contradicted",
            "reason": "Public external endpoints responded successfully.",
        }
    else:
        h_isp = {
            "hypothesis": "Upstream ISP or Transit Link Outage",
            "state": "untested",
            "reason": "External endpoints could not be tested.",
        }
    hypotheses.append(h_isp)

    # 5. Captive Portal / Walled Garden
    if http_vals.get("status_code") in (301, 302, 307) or (http_status == "warning" and icmp_status == "pass"):
        h_portal = {
            "hypothesis": "Captive Portal / Walled Garden Interception",
            "state": "supported",
            "reason": "HTTP probes were redirected to an authentication or ISP billing portal.",
        }
    else:
        h_portal = {
            "hypothesis": "Captive Portal / Walled Garden Interception",
            "state": "contradicted",
            "reason": "HTTP verification probe completed without captive redirect.",
        }
    hypotheses.append(h_portal)

    # Deterministic Classification Rules
    if gw_status == "fail":
        primary = "Local Gateway Unreachable"
        severity = "critical"
        summary = "Your device cannot communicate with the local home router or gateway. The connection between your computer and your local router is severed."
        confidence = "High"
        confidence_explanation = "Confirmed by 100% packet loss to the detected default gateway address."
        alternative_explanations = [
            "Ethernet cable unseated or defective.",
            "Wi-Fi interface associated with an access point that is powering cycling.",
            "Host firewall or anti-virus blocking outbound ARP/ICMP requests.",
        ]
        next_test = "Verify physical Wi-Fi connection or inspect Ethernet link LED status."
        resolutions = [
            "Check that your Wi-Fi is toggled on and connected to your primary home network (not a guest or dead SSID).",
            "If using Ethernet, reseat both ends of the cable into the router LAN port.",
            "Reboot your local router by cycling power for 30 seconds.",
        ]

    elif gw_status == "pass" and icmp_status == "fail" and http_status == "fail":
        primary = "Upstream ISP Broadband Outage"
        severity = "critical"
        summary = "Your local home network is working properly, but internet traffic cannot pass through your ISP. This indicates a last-mile broadband outage or disconnected modem WAN line."
        confidence = "High"
        confidence_explanation = "Gateway answered with 0% loss, but all external ICMP and HTTP endpoints failed."
        alternative_explanations = [
            "Modem optical fiber or DSL cable disconnected.",
            "ISP DHCP lease expired or account provisioning suspension.",
            "Widespread fiber cut or node maintenance in your neighborhood.",
        ]
        next_test = "Inspect router WAN status page to confirm whether external public IP is assigned."
        resolutions = [
            "Inspect the WAN / Internet LED on your optical ONT or broadband modem (it should be solid green, not red/flashing).",
            "Power-cycle the broadband modem and router.",
            "Contact your Internet Service Provider with this diagnostic session ID as verification of local LAN integrity.",
        ]

    elif gw_status == "pass" and icmp_status == "fail" and http_status == "pass":
        primary = "ICMP Ping Filtered (Internet Access Active)"
        severity = "healthy"
        summary = "Public ICMP ping did not respond, but HTTPS web connectivity is functioning normally. Many firewalls and ISPs filter or drop ICMP echo packets; a failed public ping alone does not indicate an internet outage."
        confidence = "High"
        confidence_explanation = "HTTP/HTTPS verification endpoint responded successfully and DNS resolved, proving active internet egress despite filtered ICMP echo."
        alternative_explanations = [
            "ISP middlebox or upstream firewall dropping ICMP echo requests.",
            "Target anycast address rate-limiting ICMP packets from your IP block.",
        ]
        next_test = "No remediation needed. Web services and applications are operating normally."
        resolutions = [
            "Your internet connection is working properly. Web traffic and DNS are intact.",
            "If specialized applications require ICMP, inspect local router or firewall ICMP pass-through settings.",
        ]

    elif gw_status == "pass" and (icmp_status == "pass" or http_status == "pass") and dns_status == "fail":
        primary = "DNS Resolution Infrastructure Failure"
        severity = "warning"
        summary = "Direct IP routing to the internet works, but domain names cannot be resolved. Websites will appear offline even though your underlying connection is active."
        confidence = "High"
        confidence_explanation = "External IPs are reachable via ICMP/HTTP, while socket name resolution timed out or failed."
        alternative_explanations = [
            "ISP default DNS servers experiencing denial of service or maintenance.",
            "Incorrect DNS server configured in local network adapter settings.",
            "Local DNS proxy or ad-blocker container crashed.",
        ]
        next_test = "Execute a direct DNS query against public resolver 1.1.1.1 and 8.8.8.8."
        resolutions = [
            "Configure your router or device DNS settings to use redundant public resolvers: 1.1.1.1 (Cloudflare) or 8.8.8.8 (Google).",
            "Flush your local OS DNS cache: `ipconfig /flushdns` (Windows) or `systemd-resolve --flush-caches` (Linux).",
        ]

    elif load_status == "fail":
        delta = load_vals.get("delta_ms", 0)
        primary = "Last-Mile Bufferbloat Under Load"
        severity = "warning"
        summary = f"Your connection experiences excessive latency spikes (+{delta}ms) whenever data is actively transferring. This explains stutter during video calls and gaming while downloads occur."
        confidence = "Moderate"
        confidence_explanation = "Measured significant RTT degradation during bounded concurrent workload compared to baseline idle latency."
        alternative_explanations = [
            "Router queue memory buffers are sized too large without Active Queue Management (AQM).",
            "Background cloud backups or game updates saturating upload bandwidth.",
        ]
        next_test = "Run continuous loaded stream test while adjusting router Quality of Service (QoS)."
        resolutions = [
            "Enable Smart Queue Management (SQM) on your router with algorithms such as Cake or FQ-CoDel.",
            "Cap upload bandwidth in router QoS settings to 90-95% of your measured ISP upload limit.",
            "Avoid running unthrottled large file uploads during sensitive video conferences.",
        ]

    elif loss_status == "warning" or loss_status == "fail":
        loss_pct = loss_vals.get("packet_loss_pct", 0)
        primary = "Intermittent Last-Mile Packet Loss"
        severity = "warning"
        summary = f"Detected {loss_pct:.0f}% packet loss along the path to the internet. Packet drops cause audio dropouts, website stalling, and retransmissions."
        confidence = "Moderate"
        confidence_explanation = f"Consistent packet loss ({loss_pct:.0f}%) recorded across bounded ICMP burst samples."
        alternative_explanations = [
            "Upstream ISP line noise, degraded fiber splitter, or coaxial cable ingress.",
            "Router CPU overload under heavy session count.",
        ]
        next_test = "Hop-by-hop traceroute to pinpoint the exact hop where packet drops begin."
        resolutions = [
            "Test over a wired Ethernet cable to verify if packet drops occur on physical media.",
            "Check for loose coaxial or fiber connector couplings on your wall jack.",
            "Escalate to your ISP providing the packet loss percentage observed outside the local gateway.",
        ]

    elif gw_status == "pass" and dns_status == "pass" and icmp_status == "pass" and http_status == "pass":
        primary = "Healthy Home & Last-Mile Connection"
        severity = "healthy"
        summary = "All diagnostic probes passed within healthy operating parameters. Gateway latency is low, DNS resolves promptly, and external connectivity is stable with zero packet loss."
        confidence = "High"
        confidence_explanation = "All 5 diagnostic probe stages completed successfully with 0% packet loss and acceptable RTT."
        alternative_explanations = [
            "If experiencing application-specific lag, the issue is likely on the remote application server, not your local connection.",
        ]
        next_test = "No immediate remediation required. Run periodic baselines to track long-term stability."
        resolutions = [
            "Your link is operating normally. No changes required.",
            "Save this diagnostic report as an optimal baseline benchmark for future comparison.",
        ]

    else:
        primary = "Inconclusive Connectivity Profile"
        severity = "inconclusive"
        summary = "One or more diagnostic stages could not collect sufficient telemetry (due to host sandbox restrictions, timeout, or missing privileges)."
        confidence = "Low"
        confidence_explanation = "Incomplete telemetry prevents high-confidence deterministic fault isolation."
        alternative_explanations = [
            "Operating system restricted raw ICMP execution.",
            "Transient network interface reconfiguration during test run.",
        ]
        next_test = "Rerun diagnosis with administrative or bypass-sandbox permissions."
        resolutions = [
            "Rerun the diagnostic suite.",
            "Verify network cable or Wi-Fi status in Windows Settings.",
        ]

    return {
        "primary_diagnosis": primary,
        "severity": severity,
        "summary": summary,
        "observed_evidence": observed_evidence,
        "hypotheses": hypotheses,
        "confidence": confidence,
        "confidence_explanation": confidence_explanation,
        "alternative_explanations": alternative_explanations,
        "next_recommended_test": next_test,
        "resolution_steps": resolutions,
    }
