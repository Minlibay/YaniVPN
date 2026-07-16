import 'dart:convert';
import 'package:cryptography/cryptography.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Пара ключей WireGuard (base64). Приватный ключ хранится только на устройстве.
class WgKeyPair {
  WgKeyPair(this.privateKey, this.publicKey);
  final String privateKey;
  final String publicKey;
}

/// Генерирует и кеширует пару ключей WireGuard для конкретного сервера.
/// Ключи X25519 (Curve25519), как требует WireGuard. Одно устройство держит
/// стабильную пару на сервер, чтобы переподключение не меняло личность пира.
class WireguardKeys {
  static final _x25519 = X25519();

  static String _privKeyPref(String serverId) => 'wg_priv_$serverId';
  static String _pubKeyPref(String serverId) => 'wg_pub_$serverId';

  static Future<WgKeyPair> forServer(String serverId) async {
    final prefs = await SharedPreferences.getInstance();
    final priv = prefs.getString(_privKeyPref(serverId));
    final pub = prefs.getString(_pubKeyPref(serverId));
    if (priv != null && pub != null) {
      return WgKeyPair(priv, pub);
    }

    final keyPair = await _x25519.newKeyPair();
    final privBytes = await keyPair.extractPrivateKeyBytes();
    final pubBytes = (await keyPair.extractPublicKey()).bytes;
    final pair = WgKeyPair(base64.encode(privBytes), base64.encode(pubBytes));

    await prefs.setString(_privKeyPref(serverId), pair.privateKey);
    await prefs.setString(_pubKeyPref(serverId), pair.publicKey);
    return pair;
  }
}
