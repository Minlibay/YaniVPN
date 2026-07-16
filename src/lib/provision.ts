import { Client, type ConnectConfig } from "ssh2";
import { readFileSync } from "fs";
import path from "path";
import { prisma } from "./db";
import type { Protocol } from "./vless";

// Автоустановка выбранного протокола на новую ноду по SSH.
// Панель один раз подключается под root, ставит протокол (WireGuard или
// Xray/VLESS) и агента, после чего возвращает ключи для клиентских конфигов.
// SSH-учётные данные нигде не сохраняются.

export type SshCredentials = {
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
};

const PROVISION_TIMEOUT_MS = 8 * 60 * 1000;

function agentScriptBase64(): string {
  const file = path.join(process.cwd(), "agent", "yanivpn-agent.sh");
  return readFileSync(file).toString("base64");
}

// Общий хвост: разворачивает агента как systemd-сервис с заданным окружением.
function agentUnitBlock(envLines: string, afterUnit: string): string {
  return `echo "[agent] Установка агента..."
echo '${agentScriptBase64()}' | base64 -d > /usr/local/bin/yanivpn-agent
chmod +x /usr/local/bin/yanivpn-agent

cat > /etc/yanivpn-agent.env <<ENVEOF
${envLines}
ENVEOF
chmod 600 /etc/yanivpn-agent.env

cat > /etc/systemd/system/yanivpn-agent.service <<'UNITEOF'
[Unit]
Description=YaniVPN node agent
After=network-online.target ${afterUnit}

[Service]
EnvironmentFile=/etc/yanivpn-agent.env
ExecStart=/usr/local/bin/yanivpn-agent
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
UNITEOF

systemctl daemon-reload
systemctl enable yanivpn-agent >/dev/null 2>&1
systemctl restart yanivpn-agent`;
}

export function buildWireguardScript(opts: {
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

echo "[1/4] Установка пакетов..."
apt-get update -y -qq
apt-get install -y -qq wireguard curl jq iptables >/dev/null

echo "[2/4] Включение IP-форвардинга..."
echo 'net.ipv4.ip_forward = 1' > /etc/sysctl.d/99-yanivpn.conf
sysctl -q -p /etc/sysctl.d/99-yanivpn.conf

echo "[3/4] Настройка WireGuard..."
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

echo "[4/4] Установка агента..."
${agentUnitBlock("PANEL_URL=$PANEL_URL\nAPI_TOKEN=$API_TOKEN\nPROTOCOL=wireguard\nWG_IFACE=wg0", "wg-quick@wg0.service")}

echo "YANIVPN_PUBKEY=$PUBKEY"
echo "YANIVPN_DONE"
`;
}

export function buildVlessScript(opts: {
  vlessPort: number;
  panelUrl: string;
  apiToken: string;
  shortId: string;
  sni: string;
}): string {
  return `#!/usr/bin/env bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

VLESS_PORT=${opts.vlessPort}
PANEL_URL='${opts.panelUrl}'
API_TOKEN='${opts.apiToken}'
SHORT_ID='${opts.shortId}'
SNI='${opts.sni}'
XRAY_CONFIG=/usr/local/etc/xray/config.json

if ! command -v apt-get >/dev/null; then
  echo "YANIVPN_ERROR: поддерживаются только Debian/Ubuntu (нужен apt-get)" >&2
  exit 1
fi

echo "[1/4] Установка пакетов и Xray..."
apt-get update -y -qq
apt-get install -y -qq curl jq >/dev/null
# Официальный установщик Xray-core (создаёт systemd-сервис xray)
bash -c "$(curl -L https://github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install >/dev/null

echo "[2/4] Генерация ключей Reality..."
KEYS=$(xray x25519)
PRIVKEY=$(echo "$KEYS" | sed -n 's/.*[Pp]rivate key:[[:space:]]*//p' | head -n1)
PUBKEY=$(echo "$KEYS" | sed -n 's/.*[Pp]ublic key:[[:space:]]*//p' | head -n1)
if [ -z "$PRIVKEY" ] || [ -z "$PUBKEY" ]; then
  echo "YANIVPN_ERROR: не удалось сгенерировать ключи Reality" >&2
  exit 1
fi

echo "[3/4] Настройка Xray (VLESS + Reality)..."
mkdir -p /usr/local/etc/xray
cat > "$XRAY_CONFIG" <<XRAYEOF
{
  "log": { "loglevel": "warning" },
  "stats": {},
  "api": { "tag": "api", "services": ["StatsService"] },
  "policy": {
    "levels": { "0": { "statsUserUplink": true, "statsUserDownlink": true } },
    "system": { "statsInboundUplink": true, "statsInboundDownlink": true }
  },
  "inbounds": [
    {
      "tag": "vless-in",
      "listen": "0.0.0.0",
      "port": $VLESS_PORT,
      "protocol": "vless",
      "settings": { "clients": [], "decryption": "none" },
      "streamSettings": {
        "network": "tcp",
        "security": "reality",
        "realitySettings": {
          "show": false,
          "dest": "$SNI:443",
          "xver": 0,
          "serverNames": ["$SNI"],
          "privateKey": "$PRIVKEY",
          "shortIds": ["$SHORT_ID"]
        }
      },
      "sniffing": { "enabled": true, "destOverride": ["http", "tls", "quic"] }
    },
    {
      "tag": "api",
      "listen": "127.0.0.1",
      "port": 10085,
      "protocol": "dokodemo-door",
      "settings": { "address": "127.0.0.1" }
    }
  ],
  "outbounds": [
    { "protocol": "freedom", "tag": "direct" },
    { "protocol": "blackhole", "tag": "block" }
  ],
  "routing": {
    "rules": [{ "type": "field", "inboundTag": ["api"], "outboundTag": "api" }]
  }
}
XRAYEOF

# Открываем порт VLESS, если включён ufw
if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow "$VLESS_PORT"/tcp >/dev/null 2>&1 || true
fi

systemctl enable xray >/dev/null 2>&1
systemctl restart xray

echo "[4/4] Установка агента..."
${agentUnitBlock(
  "PANEL_URL=$PANEL_URL\nAPI_TOKEN=$API_TOKEN\nPROTOCOL=vless\nXRAY_CONFIG=$XRAY_CONFIG\nXRAY_API=127.0.0.1:10085",
  "xray.service"
)}

echo "YANIVPN_REALITY_PUBKEY=$PUBKEY"
echo "YANIVPN_REALITY_PRIVKEY=$PRIVKEY"
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
        reject(new Error("Превышено время установки"));
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

export type ProvisionParams = {
  protocol: Protocol;
  port: number;
  panelUrl: string;
  apiToken: string;
  shortId: string; // только VLESS
  sni: string; // только VLESS
};

// Запускается без await из POST /api/servers: статус пишется в БД,
// интерфейс опрашивает её, пока установка не завершится.
export async function provisionServer(
  serverId: string,
  ssh: SshCredentials & { host: string },
  params: ProvisionParams
): Promise<void> {
  try {
    const script =
      params.protocol === "vless"
        ? buildVlessScript({
            vlessPort: params.port,
            panelUrl: params.panelUrl,
            apiToken: params.apiToken,
            shortId: params.shortId,
            sni: params.sni,
          })
        : buildWireguardScript({
            wgPort: params.port,
            panelUrl: params.panelUrl,
            apiToken: params.apiToken,
          });

    const { code, output } = await sshExec(ssh, script);
    const failed = (msg: string) =>
      prisma.server.update({
        where: { id: serverId },
        data: { status: "error", provisionError: msg.slice(-2000) || "Пустой вывод установки" },
      });

    if (code !== 0 || !output.includes("YANIVPN_DONE")) {
      await failed(output);
      return;
    }

    if (params.protocol === "vless") {
      const pub = output.match(/YANIVPN_REALITY_PUBKEY=([A-Za-z0-9_-]+)/);
      const priv = output.match(/YANIVPN_REALITY_PRIVKEY=([A-Za-z0-9_-]+)/);
      if (!pub || !priv) {
        await failed(output);
        return;
      }
      await prisma.server.update({
        where: { id: serverId },
        data: {
          status: "active",
          publicKey: pub[1],
          realityPrivateKey: priv[1],
          provisionError: null,
        },
      });
    } else {
      const pub = output.match(/YANIVPN_PUBKEY=([A-Za-z0-9+/=]+)/);
      if (!pub) {
        await failed(output);
        return;
      }
      await prisma.server.update({
        where: { id: serverId },
        data: { status: "active", publicKey: pub[1], provisionError: null },
      });
    }
  } catch (e) {
    await prisma.server
      .update({
        where: { id: serverId },
        data: { status: "error", provisionError: e instanceof Error ? e.message : String(e) },
      })
      .catch(() => {
        // сервер могли удалить, пока шла установка
      });
  }
}
