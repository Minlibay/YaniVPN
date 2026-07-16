import { Client, type ConnectConfig } from "ssh2";
import { readFileSync } from "fs";
import path from "path";
import { prisma } from "./db";

// Автоустановка WireGuard на новую ноду по SSH.
// Панель один раз подключается под root, ставит wireguard + агента,
// поднимает wg0 и возвращает публичный ключ интерфейса.
// SSH-учётные данные нигде не сохраняются.

export type SshCredentials = {
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
};

const PROVISION_TIMEOUT_MS = 5 * 60 * 1000;

function agentScriptBase64(): string {
  const file = path.join(process.cwd(), "agent", "yanivpn-agent.sh");
  return readFileSync(file).toString("base64");
}

export function buildProvisionScript(opts: {
  wgPort: number;
  panelUrl: string;
  apiToken: string;
}): string {
  return `#!/usr/bin/env bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

WG_PORT=${opts.wgPort}
PANEL_URL='${opts.panelUrl}'
API_TOKEN='${opts.apiToken}'

if ! command -v apt-get >/dev/null; then
  echo "YANIVPN_ERROR: поддерживаются только Debian/Ubuntu (нужен apt-get)" >&2
  exit 1
fi

echo "[1/5] Установка пакетов..."
apt-get update -y -qq
apt-get install -y -qq wireguard curl jq iptables >/dev/null

echo "[2/5] Включение IP-форвардинга..."
echo 'net.ipv4.ip_forward = 1' > /etc/sysctl.d/99-yanivpn.conf
sysctl -q -p /etc/sysctl.d/99-yanivpn.conf

echo "[3/5] Настройка WireGuard..."
mkdir -p /etc/wireguard
umask 077
if [ ! -f /etc/wireguard/wg0.key ]; then
  wg genkey > /etc/wireguard/wg0.key
fi
PRIVKEY=$(cat /etc/wireguard/wg0.key)
PUBKEY=$(wg pubkey < /etc/wireguard/wg0.key)
OUT_IFACE=$(ip route show default | awk '{for(i=1;i<NF;i++) if($i=="dev") print $(i+1)}' | head -n1)

cat > /etc/wireguard/wg0.conf <<WGEOF
[Interface]
Address = 10.8.0.1/24
ListenPort = $WG_PORT
PrivateKey = $PRIVKEY
PostUp = iptables -t nat -A POSTROUTING -o $OUT_IFACE -j MASQUERADE; iptables -A FORWARD -i wg0 -j ACCEPT; iptables -A FORWARD -o wg0 -j ACCEPT
PostDown = iptables -t nat -D POSTROUTING -o $OUT_IFACE -j MASQUERADE; iptables -D FORWARD -i wg0 -j ACCEPT; iptables -D FORWARD -o wg0 -j ACCEPT
WGEOF

systemctl enable wg-quick@wg0 >/dev/null 2>&1
systemctl restart wg-quick@wg0

echo "[4/5] Установка агента..."
echo '${agentScriptBase64()}' | base64 -d > /usr/local/bin/yanivpn-agent
chmod +x /usr/local/bin/yanivpn-agent

cat > /etc/yanivpn-agent.env <<ENVEOF
PANEL_URL=$PANEL_URL
API_TOKEN=$API_TOKEN
WG_IFACE=wg0
ENVEOF
chmod 600 /etc/yanivpn-agent.env

cat > /etc/systemd/system/yanivpn-agent.service <<'UNITEOF'
[Unit]
Description=YaniVPN node agent
After=network-online.target wg-quick@wg0.service

[Service]
EnvironmentFile=/etc/yanivpn-agent.env
ExecStart=/usr/local/bin/yanivpn-agent
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
UNITEOF

echo "[5/5] Запуск агента..."
systemctl daemon-reload
systemctl enable yanivpn-agent >/dev/null 2>&1
systemctl restart yanivpn-agent

echo "YANIVPN_PUBKEY=$PUBKEY"
echo "YANIVPN_DONE"
`;
}

function sshExec(
  ssh: SshCredentials & { host: string },
  script: string
): Promise<{ code: number; output: string }> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let output = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        conn.end();
        reject(new Error("Превышено время установки (5 минут)"));
      }
    }, PROVISION_TIMEOUT_MS);

    const finish = (fn: () => void) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        fn();
      }
    };

    const config: ConnectConfig = {
      host: ssh.host,
      port: ssh.port,
      username: ssh.username,
      readyTimeout: 20_000,
      ...(ssh.privateKey ? { privateKey: ssh.privateKey } : { password: ssh.password }),
    };

    conn
      .on("ready", () => {
        conn.exec("bash -s", (err, stream) => {
          if (err) {
            finish(() => reject(err));
            conn.end();
            return;
          }
          stream
            .on("data", (d: Buffer) => (output += d.toString()))
            .stderr.on("data", (d: Buffer) => (output += d.toString()));
          stream.on("close", (code: number) => {
            conn.end();
            finish(() => resolve({ code: code ?? 1, output }));
          });
          stream.end(script);
        });
      })
      .on("error", (err) => finish(() => reject(err)))
      .connect(config);
  });
}

// Запускается без await из POST /api/servers: статус пишется в БД,
// интерфейс опрашивает её, пока установка не завершится.
export async function provisionServer(
  serverId: string,
  ssh: SshCredentials & { host: string },
  wgPort: number,
  panelUrl: string,
  apiToken: string
): Promise<void> {
  try {
    const script = buildProvisionScript({ wgPort, panelUrl, apiToken });
    const { code, output } = await sshExec(ssh, script);

    const pubkeyMatch = output.match(/YANIVPN_PUBKEY=([A-Za-z0-9+/=]+)/);
    if (code !== 0 || !output.includes("YANIVPN_DONE") || !pubkeyMatch) {
      await prisma.server.update({
        where: { id: serverId },
        data: { status: "error", provisionError: output.slice(-2000) || "Пустой вывод установки" },
      });
      return;
    }

    await prisma.server.update({
      where: { id: serverId },
      data: { status: "active", publicKey: pubkeyMatch[1], provisionError: null },
    });
  } catch (e) {
    await prisma.server
      .update({
        where: { id: serverId },
        data: {
          status: "error",
          provisionError: e instanceof Error ? e.message : String(e),
        },
      })
      .catch(() => {
        // сервер могли удалить, пока шла установка
      });
  }
}
