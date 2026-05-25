# Power BI → AWS RDS connection (explained)

This document describes how **Power BI Desktop** connects to the **private PostgreSQL database** on AWS for Puncher Manager, using the path you set up successfully:

```text
Power BI Desktop
       ↓
     ODBC
       ↓
  SSH Tunnel
       ↓
  EC2 Gateway (bastion)
       ↓
Private AWS RDS PostgreSQL
```

---

## Why this chain exists

Your RDS instance is **not on the public internet**. Terraform creates it with:

- `publicly_accessible = false`
- Database subnets in the **private** part of the VPC
- Security group `puncher-manager-rds` that only allows PostgreSQL (**5432**) from the **ECS** security group (the running app)

So your laptop cannot connect to RDS directly. Something inside the VPC must relay the connection. The **EC2 gateway** (bastion) plays that role; the **SSH tunnel** carries traffic from your PC to that gateway and through to RDS.

---

## Layer-by-layer

### 1. Power BI Desktop

- You build reports and connect to data sources here.
- For PostgreSQL, you use **Get data** and load tables (often **Import** mode).
- Power BI does not talk to AWS networks by itself; it only opens a connection to what you configure on your machine (usually `localhost` when using a tunnel).

### 2. ODBC

- **ODBC** (Open Database Connectivity) is a standard Windows API for databases.
- Power BI can use an ODBC driver for PostgreSQL (or the built-in PostgreSQL connector, which uses similar settings).
- On your PC, ODBC is configured to connect to:
  - **Host:** `localhost` (or `127.0.0.1`)
  - **Port:** `5432` (local end of the tunnel)
  - **Database:** `puncher_db`
  - **User:** `postgres`
  - **Password:** the RDS master password from `deploy/aws/terraform/terraform.tfvars` (`db_password`)

So from Power BI’s point of view, the database “lives” on your computer at port 5432. The tunnel makes that true.

### 3. SSH tunnel

- An **SSH tunnel** (port forwarding) maps a port on your laptop to a remote host and port reachable from the EC2 instance.
- Typical command shape:

```bash
ssh -i your-key.pem -L 5432:RDS_ENDPOINT:5432 ec2-user@EC2_PUBLIC_IP
```

- **`-L 5432:RDS_ENDPOINT:5432`** means:
  - Listen on **your PC** port `5432`
  - Forward traffic through SSH to **RDS** port `5432` (as seen from the EC2 host)
- The SSH session must stay **open** while you use Power BI.

### 4. EC2 gateway (bastion)

- A small **EC2** virtual machine in the **same VPC** as RDS (e.g. Amazon Linux in a public subnet).
- It has a **public IP** so your PC can SSH to it.
- Its security group allows **outbound** traffic to RDS.
- RDS security group has an **inbound** rule: PostgreSQL **5432** from the **bastion security group** (not from the whole internet).

The gateway is only a **jump host** — it does not store your data; it forwards encrypted traffic.

### 5. Private AWS RDS PostgreSQL

- **Amazon RDS** runs PostgreSQL 16 for Puncher Manager.
- **Endpoint** (example): `puncher-manager-postgres.xxxxx.eu-west-1.rds.amazonaws.com`
- **Database name:** `puncher_db` (from Terraform `db_name`)
- **Master user:** `postgres` (from Terraform `db_username`)
- Only trusted sources in the VPC (ECS app + bastion) may connect on 5432.

---

## End-to-end flow (one query)

```text
┌─────────────────┐
│ Power BI Desktop│  "Connect to localhost:5432"
└────────┬────────┘
         │ ODBC / PostgreSQL driver
         ▼
┌─────────────────┐
│  Your PC        │  localhost:5432  ◄── tunnel entry
│  (Windows)      │
└────────┬────────┘
         │ SSH encrypted tunnel (-L 5432:...)
         ▼
┌─────────────────┐
│  EC2 gateway    │  Same VPC, public subnet
│  (bastion)      │
└────────┬────────┘
         │ TCP 5432 (private VPC)
         ▼
┌─────────────────┐
│  RDS PostgreSQL │  puncher_db (private)
│  (private)      │
└─────────────────┘
```

---

## Connection settings reference

| Setting | Typical value |
|---------|----------------|
| Power BI server | `localhost` |
| Port | `5432` |
| Database | `puncher_db` |
| Username | `postgres` |
| Password | `db_password` from `terraform.tfvars` |
| RDS endpoint (tunnel target) | `terraform output rds_endpoint` |
| EC2 host (SSH) | Bastion public IP or DNS |
| AWS region | `eu-west-1` (or your `aws_region`) |

Get RDS endpoint from project root:

```powershell
cd deploy\aws\terraform
terraform output rds_endpoint
```

---

## Security notes

| Good practice | Why |
|---------------|-----|
| RDS stays **private** | Database not exposed to `0.0.0.0/0` |
| Bastion SG allows **SSH only from your IP** | Limits who can open a tunnel |
| RDS allows **5432 only from bastion SG** | Not from the whole internet |
| Use a **strong** `db_password` | Master DB credential |
| Do **not** commit `terraform.tfvars` | Contains secrets |
| Close SSH tunnel when done | Closes access from your PC |

---

## ODBC vs built-in PostgreSQL connector

Both can work with the same tunnel:

| Approach | Notes |
|----------|--------|
| **PostgreSQL database** (Power BI native) | Simplest; server = `localhost` |
| **ODBC** | Uses a DSN or connection string; same host/port/user/password |

Your stack uses **ODBC** on top of the same tunnel — the important part is still **localhost:5432** pointing at the SSH forward.

---

## Troubleshooting

| Problem | Likely cause |
|---------|----------------|
| Timeout connecting to `localhost` | SSH tunnel not running or wrong local port |
| Timeout to RDS endpoint from PC | Normal — use tunnel, not direct RDS host in Power BI |
| Password authentication failed | Wrong `db_password`; not app login email |
| Tunnel drops | SSH session closed; restart tunnel |
| Works once, then fails | VPN/IP change; check bastion SSH rule |

---

## Related project docs

| File | Topic |
|------|--------|
| [README.md](./README.md) | AWS deploy overview |
| [terraform/](./terraform/) | VPC, RDS, ECS (private RDS) |
| [../accessDB04.md](../../accessDB04.md) | Local Docker Postgres access |
| [../../cicd-explained.md](../../cicd-explained.md) | CI/CD to AWS |

---

## Summary

Power BI thinks it connects to a local PostgreSQL server. **ODBC** sends that traffic to **localhost:5432**. The **SSH tunnel** forwards it to the **EC2 gateway**, which forwards to **private RDS** inside the VPC. That is the correct and secure way to analyze live Puncher Manager data in Power BI without making RDS public on the internet.
