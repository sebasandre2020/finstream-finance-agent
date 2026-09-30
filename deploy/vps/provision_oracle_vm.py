"""Automated Oracle Cloud Infrastructure (OCI) Always-Free VM Provisioner.

Provisions VCN, Internet Gateway, Subnet, Security List, and an Ampere A1.Flex VM
(4 OCPU, 24 GB RAM, Ubuntu 24.04 ARM64, $0.00 Always Free) with zero manual console steps.
"""

import json
import os
import subprocess
import sys
import time

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

OCI_CLI = r"C:\Program Files (x86)\Oracle\oci_cli\oci.exe"
COMPARTMENT_ID = "ocid1.tenancy.oc1..aaaaaaaasolj5fqddy4sj3ncyzyqspgj7wdd4lc3tva6k3y65slznwgd362q"
SSH_PUB_KEY = r"C:\Repositories\GHProjects\OracleKeys\ssh-key-2026-09-30.key.pub"
SSH_PRIV_KEY = r"C:\Repositories\GHProjects\OracleKeys\ssh-key-2026-09-30.key"
UBUNTU_IMAGE_ID = "ocid1.image.oc1.phx.aaaaaaaa5dapc7tqpoa4tpchrrtcyhgogpwgvgl6hvqypxqbgm3sa7agvsqq"  # Ubuntu 24.04 ARM64


def run_oci(args: list[str]) -> dict | list | None:
    cmd = [OCI_CLI] + args
    print(f"  [OCI CLI] Running: {' '.join(args[:4])} ...")
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        err = res.stderr or res.stdout
        raise RuntimeError(f"OCI CLI Error: {err}")
    out = res.stdout.strip()
    if not out:
        return None
    try:
        data = json.loads(out)
        return data.get("data", data)
    except json.JSONDecodeError:
        return out


def main():
    print("=" * 60)
    print("🚀 AUTOMATED ORACLE CLOUD ALWAYS FREE PROVISIONER")
    print("=" * 60)

    # 1. Check or Create VCN
    print("\n📦 Step 1: Checking Virtual Cloud Network (VCN)...")
    vcns = run_oci(["network", "vcn", "list", "--compartment-id", COMPARTMENT_ID]) or []
    finance_vcn = next((v for v in vcns if v.get("display-name") == "finance-vcn"), None)

    if not finance_vcn:
        print("  -> Creating 'finance-vcn' (10.0.0.0/16)...")
        finance_vcn = run_oci([
            "network", "vcn", "create",
            "--compartment-id", COMPARTMENT_ID,
            "--cidr-block", "10.0.0.0/16",
            "--display-name", "finance-vcn",
            "--dns-label", "financevcn"
        ])
        print("  ✅ VCN created:", finance_vcn["id"])
    else:
        print("  ✅ Using existing VCN:", finance_vcn["id"])

    vcn_id = finance_vcn["id"]
    default_rt_id = finance_vcn["default-route-table-id"]
    default_sl_id = finance_vcn["default-security-list-id"]

    # 2. Check or Create Internet Gateway
    print("\n🌐 Step 2: Configuring Internet Gateway & Routes...")
    igws = run_oci(["network", "internet-gateway", "list", "--compartment-id", COMPARTMENT_ID, "--vcn-id", vcn_id]) or []
    igw = next((i for i in igws if i.get("display-name") == "finance-igw"), None)

    if not igw:
        print("  -> Creating 'finance-igw'...")
        igw = run_oci([
            "network", "internet-gateway", "create",
            "--compartment-id", COMPARTMENT_ID,
            "--vcn-id", vcn_id,
            "--is-enabled", "true",
            "--display-name", "finance-igw"
        ])
        print("  ✅ Internet Gateway created:", igw["id"])
    else:
        print("  ✅ Using existing Internet Gateway:", igw["id"])

    igw_id = igw["id"]

    # Update Route Table
    print("  -> Ensuring 0.0.0.0/0 route to Internet Gateway...")
    route_rules = [
        {
            "destination": "0.0.0.0/0",
            "destinationType": "CIDR_BLOCK",
            "networkEntityId": igw_id
        }
    ]
    run_oci([
        "network", "route-table", "update",
        "--rt-id", default_rt_id,
        "--route-rules", json.dumps(route_rules),
        "--force"
    ])
    print("  ✅ Route table configured for internet access.")

    # 3. Update Security List (Allow SSH 22, HTTP 80, HTTPS 443, App 3000, Langfuse 3001, API 8000)
    print("\n🔒 Step 3: Configuring Security Rules...")
    ingress_rules = [
        {"protocol": "6", "source": "0.0.0.0/0", "tcpOptions": {"destinationPortRange": {"max": 22, "min": 22}}, "description": "SSH"},
        {"protocol": "6", "source": "0.0.0.0/0", "tcpOptions": {"destinationPortRange": {"max": 80, "min": 80}}, "description": "HTTP"},
        {"protocol": "6", "source": "0.0.0.0/0", "tcpOptions": {"destinationPortRange": {"max": 443, "min": 443}}, "description": "HTTPS"},
        {"protocol": "6", "source": "0.0.0.0/0", "tcpOptions": {"destinationPortRange": {"max": 3000, "min": 3000}}, "description": "Frontend Dashboard"},
        {"protocol": "6", "source": "0.0.0.0/0", "tcpOptions": {"destinationPortRange": {"max": 3001, "min": 3001}}, "description": "Langfuse"},
        {"protocol": "6", "source": "0.0.0.0/0", "tcpOptions": {"destinationPortRange": {"max": 8000, "min": 8000}}, "description": "FastAPI"},
    ]
    run_oci([
        "network", "security-list", "update",
        "--security-list-id", default_sl_id,
        "--ingress-security-rules", json.dumps(ingress_rules),
        "--force"
    ])
    print("  ✅ Ingress firewall rules updated (22, 80, 443, 3000, 3001, 8000 open).")

    # 4. Check or Create Public Subnet
    print("\n🔌 Step 4: Configuring Public Subnet...")
    subnets = run_oci(["network", "subnet", "list", "--compartment-id", COMPARTMENT_ID, "--vcn-id", vcn_id]) or []
    subnet = next((s for s in subnets if s.get("display-name") == "finance-subnet"), None)

    if not subnet:
        print("  -> Creating 'finance-subnet' (10.0.1.0/24)...")
        subnet = run_oci([
            "network", "subnet", "create",
            "--compartment-id", COMPARTMENT_ID,
            "--vcn-id", vcn_id,
            "--cidr-block", "10.0.1.0/24",
            "--display-name", "finance-subnet",
            "--dns-label", "financesubnet"
        ])
        print("  ✅ Subnet created:", subnet["id"])
    else:
        print("  ✅ Using existing Subnet:", subnet["id"])

    subnet_id = subnet["id"]

    # 5. Check or Launch Compute Instance
    print("\n⚡ Step 5: Checking Compute Instance...")
    instances = run_oci(["compute", "instance", "list", "--compartment-id", COMPARTMENT_ID]) or []
    inst = next((i for i in instances if i.get("display-name") == "finance-agent-server" and i.get("lifecycle-state") not in ("TERMINATED", "TERMINATING")), None)

    if not inst:
        print("  -> Searching available Availability Domains...")
        ads = run_oci(["iam", "availability-domain", "list", "--compartment-id", COMPARTMENT_ID]) or []
        ad_names = [a["name"] for a in ads]

        shape_config = json.dumps({"ocpus": 4, "memoryInGBs": 24})
        launched = False

        for ad in ad_names:
            print(f"  -> Attempting instance launch in {ad} (Always Free: 4 OCPU, 24 GB RAM, Ubuntu 24.04 ARM64)...")
            try:
                inst = run_oci([
                    "compute", "instance", "launch",
                    "--compartment-id", COMPARTMENT_ID,
                    "--availability-domain", ad,
                    "--shape", "VM.Standard.A1.Flex",
                    "--shape-config", shape_config,
                    "--image-id", UBUNTU_IMAGE_ID,
                    "--subnet-id", subnet_id,
                    "--assign-public-ip", "true",
                    "--display-name", "finance-agent-server",
                    "--ssh-authorized-keys-file", SSH_PUB_KEY,
                    "--boot-volume-size-in-gbs", "50"
                ])
                launched = True
                print(f"  🎉 Successfully launched instance in {ad}!")
                break
            except RuntimeError as e:
                print(f"  ⚠️  Launch in {ad} unavailable ({e}). Trying next domain...")
                time.sleep(2)

        if not launched:
            print("❌ Failed to launch instance across all availability domains.")
            sys.exit(1)
    else:
        print(f"  ✅ Instance already exists: {inst['id']} (State: {inst['lifecycle-state']})")

    instance_id = inst["id"]

    # 6. Wait for Instance to be RUNNING
    print("\n⏳ Step 6: Waiting for instance to become RUNNING...")
    while True:
        curr = run_oci(["compute", "instance", "get", "--instance-id", instance_id])
        state = curr.get("lifecycle-state")
        print(f"  Status: {state} ...")
        if state == "RUNNING":
            break
        if state in ("TERMINATED", "FAILED"):
            raise RuntimeError(f"Instance entered terminal state: {state}")
        time.sleep(10)

    # 7. Get Public IP Address
    print("\n🔍 Step 7: Retrieving Public IP Address...")
    vnic_attachments = run_oci(["compute", "vnic-attachment", "list", "--compartment-id", COMPARTMENT_ID, "--instance-id", instance_id]) or []
    if not vnic_attachments:
        time.sleep(5)
        vnic_attachments = run_oci(["compute", "vnic-attachment", "list", "--compartment-id", COMPARTMENT_ID, "--instance-id", instance_id]) or []

    vnic_id = vnic_attachments[0]["vnic-id"]
    vnic_info = run_oci(["network", "vnic", "get", "--vnic-id", vnic_id])
    public_ip = vnic_info.get("public-ip")

    print("\n" + "=" * 60)
    print("🎉 DEPLOYMENT READY!")
    print("=" * 60)
    print(f"Public IP Address:   {public_ip}")
    print(f"Username:            ubuntu")
    print(f"Private Key:         {SSH_PRIV_KEY}")
    print(f"SSH Command:         ssh -i \"{SSH_PRIV_KEY}\" ubuntu@{public_ip}")
    print(f"Application URL:     http://{public_ip}:3000")
    print(f"Swagger API Docs:    http://{public_ip}:3000/docs")
    print(f"Langfuse Monitoring: http://{public_ip}:3001")
    print("=" * 60)

    # Save details to file
    out_file = r"C:\Repositories\GHProjects\OracleKeys\server_info.json"
    with open(out_file, "w") as f:
        json.dump({
            "public_ip": public_ip,
            "instance_id": instance_id,
            "user": "ubuntu",
            "ssh_key": SSH_PRIV_KEY,
            "created_at": time.time()
        }, f, indent=2)
    print(f"Credentials saved to: {out_file}\n")


if __name__ == "__main__":
    main()
