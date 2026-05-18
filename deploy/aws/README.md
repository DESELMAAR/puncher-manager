# Deploy Puncher Manager on AWS

This folder contains everything to run **Puncher Manager** on AWS using images from **Docker Hub**.

| Path | Purpose |
|------|---------|
| `terraform/` | **Recommended** — ECS Fargate + RDS PostgreSQL + Application Load Balancer |
| `docker-compose.prod.yml` | Simpler option — run on one **EC2** instance + RDS |
| `env.example` | Environment variables template |

## Architecture (Terraform / ECS)

```text
Internet
    │
    ▼
Application Load Balancer (HTTP :80)
    ├── /api/*  ──► ECS Fargate (backend :8080)
    └── /*      ──► ECS Fargate (frontend :3000)
                           │
                           ▼
                    RDS PostgreSQL (private)
```

One public URL serves the UI and API (`/api/...` routes to Spring Boot).

---

## Before you start

1. **AWS account** with permissions for VPC, ECS, RDS, ALB, IAM.
2. **AWS CLI** installed and configured: `aws configure`
3. **Terraform** 1.5+: [terraform.io/downloads](https://www.terraform.io/downloads)
4. **Docker Hub** images already pushed from CI:
   - `<user>/puncher-manager-backend:latest`
   - `<user>/puncher-manager-frontend:latest`
5. **GitHub secrets** for CI are set (`DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`).

---

## Step-by-step: ECS + Terraform (recommended)

### 1. Configure variables

```powershell
cd deploy/aws/terraform
copy terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars`:

- `dockerhub_username` — your Docker Hub user
- `db_password` — strong RDS password (8+ chars)
- `jwt_secret` — long random string (32+ chars)
- `aws_region` — e.g. `eu-west-1`

Do **not** commit `terraform.tfvars` (it is gitignored).

### 2. Create infrastructure

```powershell
terraform init
terraform plan
terraform apply
```

Type `yes` when prompted. First apply takes **15–25 minutes** (RDS is slow).

### 3. Note the outputs

```powershell
terraform output app_url
terraform output frontend_rebuild_hint
```

Example: `http://puncher-manager-alb-123456789.eu-west-1.elb.amazonaws.com`

### 4. Rebuild the frontend for production (required)

CI bakes `NEXT_PUBLIC_API_URL=http://localhost:8080` into the frontend. On AWS the browser must call the **ALB URL**.

From the **repo root** (replace `USER` and `APP_URL`):

```powershell
docker build -t USER/puncher-manager-frontend:aws `
  --build-arg NEXT_PUBLIC_API_URL=http://YOUR-ALB-DNS.elb.amazonaws.com `
  ./frontend

docker push USER/puncher-manager-frontend:aws
```

Then redeploy the frontend service:

```powershell
cd deploy/aws/terraform
# In terraform.tfvars set: image_tag = "aws"  OR use a second apply:
terraform apply -var="image_tag=aws"
```

Or update only the frontend task in the AWS Console (ECS → task definition → new revision → update service).

### 5. Open the app

1. Open `app_url` from Terraform output in a browser.
2. Wait 2–5 minutes if tasks are still starting (ECS + health checks).
3. Log in with seeded users (first backend start): `superadmin@puncher.com` / `admin123` — **change passwords in production**.

### 6. Logs and debugging

- **ECS** → Clusters → `puncher-manager-cluster` → Services → Logs
- **RDS** — only reachable from ECS (not from your laptop)
- **ALB** → Target groups — targets must be **healthy**

---

## Alternative: EC2 + Docker Compose

Cheaper for demos; you manage the server yourself.

1. Create **RDS PostgreSQL 16** (same VPC as EC2, security group allows 5432 from EC2).
2. Launch **Amazon Linux 2023** EC2 (t3.small), install Docker:

   ```bash
   sudo dnf update -y
   sudo dnf install -y docker
   sudo systemctl enable --now docker
   sudo usermod -aG docker ec2-user
   # log out and back in
   ```

3. Copy `deploy/aws/env.example` → `.env.prod` on the server; fill in RDS + secrets + public EC2 URL.
4. Set `NEXT_PUBLIC_API_URL` to `http://<EC2_PUBLIC_IP>:8080` and **rebuild/push** the frontend image (same as step 4 above).
5. From repo on EC2:

   ```bash
   docker compose -f deploy/aws/docker-compose.prod.yml --env-file deploy/aws/.env.prod up -d
   ```

6. Security group: allow inbound **3000** (and **8080** if the browser calls the API on that port).

---

## HTTPS (optional, recommended for real use)

1. Register a domain (Route 53 or elsewhere).
2. Request an **ACM certificate** for `app.yourdomain.com`.
3. Add an **HTTPS listener (443)** on the ALB with the certificate.
4. Redirect HTTP → HTTPS.
5. Rebuild frontend with `NEXT_PUBLIC_API_URL=https://app.yourdomain.com`.
6. Set `CORS_ORIGINS` and `APP_PUBLIC_URL` to the same HTTPS URL (Terraform `local.app_url` is HTTP-only today — extend variables or update task env in the console).

---

## Estimated monthly cost (rough)

| Service | Approx. |
|---------|---------|
| RDS `db.t4g.micro` | ~$12–15 |
| ECS Fargate (2 tasks) | ~$25–40 |
| ALB | ~$18–22 |
| **Total** | **~$55–80** / month |

Use [AWS Pricing Calculator](https://calculator.aws/) for your region. Stop resources when not needed: `terraform destroy`.

---

## Tear down

```powershell
cd deploy/aws/terraform
terraform destroy
```

This deletes RDS (no final snapshot by default in this template), ECS, ALB, and VPC.

---

## Checklist

| Step | Done |
|------|------|
| CI pushes images to Docker Hub | ☐ |
| `terraform.tfvars` created with secrets | ☐ |
| `terraform apply` succeeded | ☐ |
| Frontend rebuilt with ALB `NEXT_PUBLIC_API_URL` | ☐ |
| Frontend service uses new image tag | ☐ |
| ALB target groups healthy | ☐ |
| Login works in browser | ☐ |

---

## Files reference

| File | Description |
|------|-------------|
| `terraform/*.tf` | VPC, RDS, ECS, ALB, security groups |
| `terraform/terraform.tfvars.example` | Variable template |
| `docker-compose.prod.yml` | EC2: backend + frontend only |
| `env.example` | Env template for EC2 compose |
