# Health Vault — Deployment for Absolute Beginners (Free Forever)

This guide assumes you have never deployed anything before, and that this is a personal project — so every piece of infrastructure here costs **$0, forever**, not a free trial that starts charging later. Every step is spelled out — what to click, what to type, and *why*.

You're working from a Windows machine with PowerShell — every command below is written for that.

---

## Part 0 — What are we actually doing, and how is this free?

A few concepts first:

- **Server / VPS**: a computer in a data center, always on, reachable from the internet. Right now Health Vault only runs on *your* laptop — nobody else can reach it. Deploying means moving it onto a computer like this.
- **SSH**: how you remotely control that server from your laptop — you type commands in your own terminal, but they run *on the server*.
- **Docker / "container"**: a way of packaging an app so it runs identically anywhere. Each piece of Health Vault (database, backend, gateway, frontend...) runs in its own container. You already have this working locally — we're running the exact same containers, just on a free always-on server instead of your laptop.

**How this stays free:** we're using **Oracle Cloud's "Always Free" tier**. Unlike AWS/Google/Azure's "free for 12 months, then billed," Oracle's Always Free compute tier genuinely never expires and never auto-charges you — as long as you stay within its limits (which are generous: up to 4 CPU cores and 24 GB RAM, shared across up to 4 instances, forever, for free). This is the one mainstream cloud provider whose free tier is actually large enough to run this whole stack (Postgres + Redis + MinIO + Kafka + 2 Java services + Angular frontend) — most other "free tiers" only give you 1 GB of RAM, which isn't enough for even the database and backend alone.

> **Alternative, zero-signup option:** if you'd rather not create any cloud account at all, you can run this exact same Docker setup on your own PC and expose it to the internet for free using [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) instead of a cloud server — no port forwarding, no static IP needed, works around most home ISPs. The tradeoff is your PC must stay on and connected whenever you want the app reachable. Say the word if you'd rather go this route and I'll write that version of the guide instead — the rest of this document assumes Oracle Cloud, which behaves much more like a "real" always-on deployment.

---

## Part 1 — Create your free Oracle Cloud server

### 1a. Sign up

1. Go to [oracle.com/cloud/free](https://www.oracle.com/cloud/free/) and click **Start for free**.
2. Fill in your email, verify it, then fill in your name/address/phone. You'll get an SMS code to verify your phone.
3. **You will be asked for a credit card.** This is only for identity verification — Oracle does not charge you unless you explicitly upgrade to a paid account later, which requires a separate deliberate action on your part. It may place a temporary $1 authorization hold that disappears within a few days.
4. Choose your **Home Region** carefully when asked — pick one close to you geographically. **You cannot easily change this later**, and Always Free resources are only available in your home region.
5. Wait for the account to finish provisioning (usually a few minutes, occasionally longer) — you'll get an email when it's ready. Then log in to the [Oracle Cloud Console](https://cloud.oracle.com).

### 1b. Create the server (a "Compute Instance")

1. Click the ☰ menu (top-left) → **Compute** → **Instances** → **Create Instance**.
2. **Name**: anything, e.g. `health-vault-server`.
3. Under **Image and shape**, click **Edit**:
   - **Image**: click **Change Image** → select **Canonical Ubuntu** → **22.04** → click **Select Image**.
   - **Shape**: click **Change Shape** → select the **Ampere** series → **VM.Standard.A1.Flex** → set **OCPUs = 4** and **Memory = 24 GB** (the maximum the free tier allows — use all of it, this app needs it).
4. Under **Add SSH keys**: select **Generate a key pair for me**, then click **Save Private Key** — a file downloads (something like `ssh-key-2026-09-09.key`). **This is the only way you'll ever be able to log in — save it somewhere you won't lose it**, e.g. move it into a folder like `C:\Users\<you>\.ssh\`.
5. Leave networking settings at their defaults (Oracle creates a network for you automatically).
6. Click **Create**. Wait 1-2 minutes until the instance's state shows **Running**.
7. On the instance's detail page, copy the **Public IP Address** shown — you'll need it constantly from here on.

> **If you get an "Out of host capacity" error** when creating the instance: this is a well-known, common Oracle free-tier issue — the free Ampere capacity in your region is temporarily exhausted by other users. It is **not** something wrong with what you did. Fixes, in order of ease: (1) just retry the "Create" button every so often — capacity frees up regularly; (2) if your region offers more than one **Availability Domain** in the dropdown, try a different one; (3) as a last resort, try a smaller shape (2 OCPU / 12 GB instead of 4/24) — still enough to run everything, just with less headroom. If it's still failing after a day of retries, tell me and we'll switch to the Cloudflare Tunnel / own-PC option instead.

### 1c. Open the ports (Oracle-specific step — easy to miss)

Oracle blocks all inbound internet traffic by default at the *cloud* network level, separately from the server's own firewall (which we'll set up in Part 4). You need to open ports 80 and 443 here too, or the app will be unreachable even once everything is running correctly.

1. Still on your instance's detail page, find **Primary VNIC** further down, and click the subnet name next to it (something like `subnet-...`).
2. Click the **Default Security List** link on that page.
3. Click **Add Ingress Rules**, and add a rule:
   - **Source CIDR**: `0.0.0.0/0`
   - **IP Protocol**: TCP
   - **Destination Port Range**: `80`
   - Click **Add Ingress Rules**.
4. Click **Add Ingress Rules** again and add a second rule the same way, with **Destination Port Range**: `443`.
5. Confirm there's already a rule allowing port **22** (SSH) — there should be one by default (`0.0.0.0/0`, TCP, port 22). If not, add it the same way.

---

## Part 2 — Connect to your server for the first time

Oracle requires key-based login (no simple password) — that's what the `.key` file from Part 1b is for.

Open **PowerShell** on your Windows machine (a fresh window, not inside any project folder):

```powershell
ssh -i "C:\path\to\your-downloaded-key.key" ubuntu@YOUR_SERVER_IP
```

Replace the key path with wherever you saved the file, and `YOUR_SERVER_IP` with the IP from Part 1b. Note the username is **`ubuntu`**, not `root` — Oracle's Ubuntu images log you in as a regular user named `ubuntu` that has full admin (`sudo`) rights.

- First time, you'll be asked to trust the host's fingerprint — type `yes`, Enter.
- If you get a "Permissions for ... are too open" / "UNPROTECTED PRIVATE KEY FILE" error, run this once from the same PowerShell window, then retry the `ssh` command:
  ```powershell
  icacls "C:\path\to\your-downloaded-key.key" /inheritance:r /grant:r "$($env:USERNAME):(R)"
  ```

If it worked, your prompt now looks like `ubuntu@health-vault-server:~$` — **you are now inside the server**. Everything you type from here runs on the server, not your laptop, until you type `exit`.

> Keep note of the exact `ssh -i "..." ubuntu@...` command — you'll reuse it every time you reconnect.

---

## Part 3 — Survive the Linux terminal (a tiny cheat sheet)

| Command | What it does |
|---|---|
| `pwd` | Show what folder you're currently in |
| `ls` | List files in the current folder |
| `cd foldername` | Move into a folder |
| `cd ..` | Move up one folder |
| `sudo <command>` | Run a command "as administrator" |
| `nano filename` | Open a simple text editor for that file |
| Inside `nano`: `Ctrl+O` then `Enter` | Save the file |
| Inside `nano`: `Ctrl+X` | Exit the editor |
| `Ctrl+C` | Stop/cancel whatever is currently running |
| `exit` | Disconnect from the server |

That's genuinely all you need — everything else below is copy-paste.

---

## Part 4 — Lock the front door (the server's own firewall)

This is in addition to the Oracle cloud-level rule from Part 1c — belt and suspenders. Still connected via SSH:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

Type `y` and Enter when it asks about disrupting the SSH connection. Verify:

```bash
sudo ufw status
```

---

## Part 5 — Install Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
```

Then type `exit`, and reconnect with the same `ssh -i "..." ubuntu@...` command from Part 2 — this refreshes your permissions.

Verify:

```bash
docker --version
docker compose version
```

Both should print version numbers.

> **One Oracle-specific note:** your server's CPU is ARM-based (not the more common Intel/AMD "x86" architecture), because that's what the free Ampere shape uses. Every container image this project uses (Postgres, Redis, MinIO, Java, Node, nginx, Caddy) publishes ARM-compatible versions, and Docker picks the right one automatically — you don't need to do anything differently. The one component worth knowing about if something ever fails to start is `kafka`, which uses a Bitnami-published image; Bitnami has occasionally changed their free image availability. If Kafka specifically fails to pull or start, tell me and we'll swap it for an equivalent image.

---

## Part 6 — Get your code onto the server

From a **second, separate PowerShell window** on your laptop (leave the SSH one connected):

```powershell
scp -i "C:\path\to\your-downloaded-key.key" "D:\iDTC_Project\CPX-SoCK\repos\health-vault-src-<timestamp>.zip" ubuntu@YOUR_SERVER_IP:/home/ubuntu/
```

Replace the key path, the zip filename, and the server IP. (If you don't have a recent zip, ask me to make one — say **"create source zip file"**.)

Back in your **SSH window**:

```bash
cd /home/ubuntu
sudo apt-get update && sudo apt-get install -y unzip
unzip health-vault-src-*.zip -d health-vault
cd health-vault
ls
```

You should see `backend`, `frontend`, `gateway`, `infra` listed.

---

## Part 7 — Generate your real secrets

Never use the placeholder values from local development. Run each command below and **write down each result somewhere safe** (a note on your laptop, a password manager):

```bash
openssl rand -base64 48 | tr -d '='
```
→ `JWT_SECRET`

```bash
openssl rand -base64 32
```
→ `DOCUMENT_ENCRYPTION_KEY` — **critical, back this up outside the server too.** If lost, every uploaded document becomes permanently unreadable, with no recovery.

```bash
openssl rand -base64 24 | tr -d '=+/'
```
→ run this **twice** — first result is `POSTGRES_PASSWORD`, second is `MINIO_SECRET_KEY`

```bash
openssl rand -hex 10
```
→ `MINIO_ACCESS_KEY`

You should now have 5 values noted down.

---

## Part 8 — Create your configuration file

```bash
cp .env.prod.example .env.prod
nano .env.prod
```

Replace each placeholder with your real generated value:

- `POSTGRES_PASSWORD=REPLACE_ME`
- `MINIO_ACCESS_KEY=REPLACE_ME`
- `MINIO_SECRET_KEY=REPLACE_ME`
- `JWT_SECRET=REPLACE_ME`
- `DOCUMENT_ENCRYPTION_KEY=REPLACE_ME`

Leave `DOMAIN=example.com` as-is — not used yet. Save (`Ctrl+O`, Enter) and exit (`Ctrl+X`).

```bash
chmod 600 .env.prod
```

---

## Part 9 — Start everything

```bash
docker compose -f infra/docker/docker-compose.yml -f infra/docker/docker-compose.prod-http.yml --env-file .env.prod up -d --build
```

What this does: `-f` twice loads the infra containers file plus the app-containers file; `--env-file` supplies your secrets; `up -d --build` builds the images from source and starts everything in the background.

**First run takes 5–10 minutes** (downloading images, compiling the Java and Angular code) — lots of scrolling text is normal. Done when you get your prompt back.

Check status:

```bash
docker compose -f infra/docker/docker-compose.yml -f infra/docker/docker-compose.prod-http.yml ps
```

- `Up ... (healthy)` — good
- `Up ... (health: starting)` — still warming up, wait and re-check
- `Restarting` / `Exited` for more than 2-3 minutes — something's wrong

If something's stuck, get its logs and paste them to me:

```bash
docker compose -f infra/docker/docker-compose.yml -f infra/docker/docker-compose.prod-http.yml logs core-api
```

(swap `core-api` for whichever service is unhealthy)

---

## Part 10 — See it live

Once `core-api`, `gateway`, and `frontend` show `(healthy)`, open a browser and go to:

```
http://YOUR_SERVER_IP
```

Log in with `demo@healthvault.local` / `Demo@1234`, and try logging a metric or uploading a document to confirm the full chain works.

---

## Part 11 — Before showing this to anyone else

1. **Delete the demo accounts** (their credentials are public, in this guide):
   ```bash
   docker exec -it healthvault-postgres psql -U healthvault -d healthvault -c "DELETE FROM healthvault.users WHERE email LIKE '%@healthvault.local';"
   ```
   Then register a real account for yourself via the app's Register page.
2. Confirm your `DOCUMENT_ENCRYPTION_KEY` is backed up somewhere off the server.
3. Take an occasional database backup:
   ```bash
   docker exec healthvault-postgres pg_dump -U healthvault healthvault | gzip > /home/ubuntu/backup-$(date +%F).sql.gz
   ```

---

## Day-to-day commands

All from inside `/home/ubuntu/health-vault` (`cd /home/ubuntu/health-vault` if needed):

**Status:**
```bash
docker compose -f infra/docker/docker-compose.yml -f infra/docker/docker-compose.prod-http.yml ps
```

**Logs (live, add `-f`):**
```bash
docker compose -f infra/docker/docker-compose.yml -f infra/docker/docker-compose.prod-http.yml logs -f gateway
```

**Stop (data kept):**
```bash
docker compose -f infra/docker/docker-compose.yml -f infra/docker/docker-compose.prod-http.yml stop
```

**Start again:**
```bash
docker compose -f infra/docker/docker-compose.yml -f infra/docker/docker-compose.prod-http.yml start
```

**Deploy new code** (after uploading a fresh zip, or `git pull` if you set up a repo):
```bash
docker compose -f infra/docker/docker-compose.yml -f infra/docker/docker-compose.prod-http.yml --env-file .env.prod up -d --build
```

---

## What's next (optional, still free)

- **A real domain + HTTPS, still $0**: [DuckDNS](https://www.duckdns.org) gives you a free subdomain (e.g. `yourapp.duckdns.org`) pointed at your server's IP — no purchase needed. Combined with the `docker-compose.prod.yml` file already in this repo (adds a Caddy container that gets free, automatic HTTPS from Let's Encrypt), you get a real `https://` padlock URL for $0/year, not just $0/month. Ask me when you're ready and I'll walk you through it.
- **Automated nightly backups** — I can set up a scheduled task (cron job) for the database dump above.

You don't need either to have a genuinely working, deployed app — Part 10 is the real milestone.
