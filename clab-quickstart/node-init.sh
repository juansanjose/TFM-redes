#!/usr/bin/env bash
# DO NOT set -e here; we want to handle errors gracefully
set -u

log() { echo "[init] $*"; }

# 1) Make sure we have a shell + package manager
PKG=""
if command -v apt-get >/dev/null 2>&1; then
  PKG="apt"
elif command -v apk >/dev/null 2>&1; then
  PKG="apk"
else
  log "No apt-get or apk found (unexpected for this image). Printing /etc/os-release:"
  cat /etc/os-release || true
fi

# Ensure basic FRR config scaffolding exists before daemons start
if [ ! -f /etc/frr/vtysh.conf ]; then
  log "Creating default /etc/frr/vtysh.conf"
  cat <<'EOF' >/etc/frr/vtysh.conf
service integrated-vtysh-config
!
EOF
fi
chown frr:frr /etc/frr/vtysh.conf 2>/dev/null || chown root:root /etc/frr/vtysh.conf 2>/dev/null || true
chmod 644 /etc/frr/vtysh.conf 2>/dev/null || true

chown frr:frr /etc/frr/frr.conf 2>/dev/null || true
chmod 644 /etc/frr/frr.conf 2>/dev/null || true

# 2) Start FRR using image-provided startup
#    Official images provide docker-start wrapper; fall back to frrinit.sh if present
if [ -x /usr/lib/frr/docker-start ]; then
  log "Starting FRR via /usr/lib/frr/docker-start"
  /usr/lib/frr/docker-start &
elif [ -x /usr/lib/frr/frrinit.sh ]; then
  log "Starting FRR via frrinit.sh"
  /usr/lib/frr/frrinit.sh start || true
else
  log "FRR start scripts not found; printing tree:"
  (command -v tree >/dev/null 2>&1 && tree -L 2 /usr/lib/frr) || ls -la /usr/lib/frr || true
fi

# 3) Ensure SSH server is present and running (for your frontend)
if ! command -v sshd >/dev/null 2>&1; then
  case "$PKG" in
    apt)
      log "Installing openssh-server (apt)"
      apt-get update -y || true
      DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends openssh-server || true
      ;;
    apk)
      log "Installing openssh-server (apk)"
      apk add --no-cache openssh || true
      ;;
    *)
      log "No package manager available; skipping SSH install"
      ;;
  esac
fi

# Configure and start sshd if present
if command -v sshd >/dev/null 2>&1; then
  log "Configuring SSH"
  if ! id -u clab >/dev/null 2>&1; then
    if command -v useradd >/dev/null 2>&1; then
      useradd -m -s /bin/bash clab
    elif command -v adduser >/dev/null 2>&1; then
      adduser -D -s /bin/sh clab
    else
      log "No useradd/adduser available; unable to create clab user"
    fi
  fi
  if id -u clab >/dev/null 2>&1; then
    if command -v usermod >/dev/null 2>&1; then
      usermod -aG frrvty clab || true
    elif command -v adduser >/dev/null 2>&1; then
      adduser clab frrvty >/dev/null 2>&1 || true
    fi
    if command -v chpasswd >/dev/null 2>&1; then
      echo "clab:clab" | chpasswd
    else
      printf "clab\nclab\n" | passwd clab
    fi
  fi
  mkdir -p /var/run/sshd
  sed -i 's/^#\?PasswordAuthentication .*/PasswordAuthentication yes/' /etc/ssh/sshd_config 2>/dev/null || true
  sed -i 's/^#\?PermitRootLogin .*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config 2>/dev/null || true
  ssh-keygen -A
  log "Starting sshd"
  /usr/sbin/sshd -D &
else
  log "sshd not available, skipping"
fi

# 4) Show versions for sanity
vtysh -c 'show version' 2>/dev/null || true
bgpd -v 2>/dev/null || true

log "Init complete; keeping container in foreground"
# 5) Keep container alive forever
tail -F /var/log/frr/* /var/log/syslog 2>/dev/null || exec sleep infinity
