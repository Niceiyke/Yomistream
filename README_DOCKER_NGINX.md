YomiStream — Docker Compose + Nginx (reverse proxy with SSL)

This file explains how to run the Backend behind an Nginx reverse proxy using Docker Compose and self-signed certificates for local testing.

Files added
- `docker-compose.yml` — defines `backend` (built from `Backend/`) and `nginx`.
- `nginx/conf.d/yomistream.conf` — nginx site config. Proxies `/api/` and `/health` to the backend on port 8001.
- `scripts/start.sh` — convenience script for Ubuntu to run `docker compose up -d --build`.

Quick start (Linux / macOS)

1. Build and start services:

```bash
docker compose up --build
```

2. Visit: https://localhost (or your host IP) — nginx will serve HTTPS (requires certs in `./nginx/certs`). API requests are under `/api/`.

Quick start (Ubuntu EC2 / Linux) — one-liner

```bash
./scripts/start.sh
```

This script will run `docker compose up -d --build` so you can start the stack with one command.

Quick start (Windows PowerShell)

1. Build and start services:

```powershell
docker compose up --build
```

Notes & Next steps
- TLS / certificates

- To enable HTTPS between browsers and the nginx proxy, place your TLS certificate files in `./nginx/certs` on the host. The nginx container expects two files mounted at `/etc/nginx/certs`:

- `fullchain.pem` — the full certificate chain (PEM)
- `privkey.pem`   — the private key (PEM)

- Example (on the host):

```bash
mkdir -p ./nginx/certs
# copy fullchain.pem and privkey.pem into ./nginx/certs
ls -l ./nginx/certs
```

- Cloudflare guidance

- If you're using Cloudflare in front of your EC2 host, prefer one of these options:
	- Option A (recommended): Use a Cloudflare Origin Certificate for the origin and set Cloudflare SSL/TLS to "Full (strict)". Place the origin cert and key as `fullchain.pem`/`privkey.pem` on the host.
	- Option B: Use a trusted certificate on the origin (Let's Encrypt or CA) and keep Cloudflare in proxy mode.
	- Option C (not recommended): Use Cloudflare "Flexible" mode (Cloudflare serves HTTPS to clients but connects to origin over HTTP). Flexible can cause redirect loops if the origin forces HTTPS.

- Other notes

- The Nginx config proxies to `backend:8001` inside the Docker network; the backend container must expose/use the same port (the provided `Backend/Dockerfile` currently starts uvicorn on 8001).
- The nginx container currently returns 404 for non-API routes; if you have a frontend to serve, mount or proxy those routes accordingly.

EC2 (Ubuntu) specific tips
- Make sure the instance security group allows inbound traffic on ports 80 and 443 (and 22 for SSH).
- If your EC2 instance has a public DNS or Elastic IP, use that as the host when generating certs (or generate certs for your domain and place them in `nginx/certs`).
- Run the shortcut script on the instance:

```bash
cd /path/to/Yomistream
./scripts/start.sh
```

Notes: The `./scripts/start.sh` will run `docker compose up -d --build` so you only need that one command on Ubuntu.

Security
- Self-signed certs are suitable for local testing only. For production, use trusted certificates (Let's Encrypt or your CA) and lock down CORS, env vars, and secrets.

Troubleshooting: "permission denied" when running `./scripts/start.sh`
- If you see "permission denied" when running `./scripts/start.sh`, set the executable bit and retry:

```bash
chmod +x ./scripts/start.sh
./scripts/start.sh
```

- Alternatively you can invoke the script with `bash` (no chmod required):

```bash
bash ./scripts/start.sh
```

- On Windows-created repos you may have CRLF line endings that prevent execution on Linux. Convert with:

```bash
sudo apt-get install -y dos2unix    # if not installed
dos2unix ./scripts/start.sh
```

Docker daemon / permission denied troubleshooting
- If you see errors like "permission denied while trying to connect to the Docker daemon socket at unix:///var/run/docker.sock", try the following steps on Ubuntu:

1) Check Docker daemon is running:

```bash
sudo systemctl status docker
```

2) If not running, start it:

```bash
sudo systemctl start docker
```

3) For a one-off run, prefix docker compose with sudo (quick workaround):

```bash
sudo docker compose up -d --build
```

4) For a permanent fix add your user to the `docker` group (then log out/in):

```bash
sudo usermod -aG docker $USER
# then either log out and back in, or run:
newgrp docker
```

After adding the user to the docker group you should be able to run `docker` and `docker compose` without sudo.

Compose file warning
- Recent Docker Compose V2 interprets top-level `version` as obsolete and will ignore it. The `docker-compose.yml` in this repo no longer contains `version:` to avoid that warning.

YomiStream — Docker Compose + Nginx (reverse proxy with SSL)

This file explains how to run the Backend behind an Nginx reverse proxy using Docker Compose and self-signed certificates for local testing.

Files added
- `docker-compose.yml` — defines `backend` (built from `Backend/`) and `nginx`.
- `nginx/conf.d/yomistream.conf` — nginx site config. Proxies `/api/` and `/health` to the backend on port 6000.
- `nginx/generate-self-signed.sh` — POSIX script to create `nginx/certs/fullchain.pem` and `privkey.pem`.
- `nginx/generate-self-signed.ps1` — PowerShell script (Windows) to create a PFX and attempt extraction with openssl.

Quick start (Linux / macOS)

1. Generate self-signed certs:

```bash
# (no cert generation step included)
```

2. Build and start services:

```bash
docker compose up --build
```

3. Visit: https://localhost (your browser will warn about self-signed certs).

Quick start (Windows PowerShell)

1. Run the PowerShell helper (requires openssl to extract PEMs):

```powershell
.\nginx\generate-self-signed.ps1
```

2. Build and start services:

```powershell
docker compose up --build
```

Notes & Next steps
- To use real certificates, replace files in `nginx/certs` with `fullchain.pem` and `privkey.pem` (or mount them as secrets in production).
- The Nginx config expects the backend service to listen on port 6000 inside the container. Ensure `Backend/config.py` PORT matches or adjust the proxy.
- The nginx container currently returns 404 for non-API routes; if you have a frontend to serve, mount or proxy those routes accordingly.

Security
- Self-signed certs are suitable for local testing only. For production, use trusted certificates (Let's Encrypt or your CA) and lock down CORS, env vars, and secrets.
