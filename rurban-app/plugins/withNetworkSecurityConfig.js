const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

const withNetworkSecurityConfig = (config) => {
  // Allow cleartext (HTTP) traffic to local development IPs (192.168.x.x, 10.0.x.x).
  // Production traffic always uses HTTPS via the base-config.
  config = withDangerousMod(config, [
    'android',
    (cfg) => {
      const xmlDir = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'xml');
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.writeFileSync(
        path.join(xmlDir, 'network_security_config.xml'),
        `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <!-- Allow cleartext (HTTP) traffic to all hosts.
       Android <domain> elements do not support raw IP addresses.
       Switch to HTTPS + a domain name to re-enable restrictions. -->
  <base-config cleartextTrafficPermitted="true">
    <trust-anchors>
      <certificates src="system" />
    </trust-anchors>
  </base-config>
</network-security-config>`
      );
      return cfg;
    },
  ]);

  // Reference the config in AndroidManifest.xml
  config = withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application[0];
    app.$['android:networkSecurityConfig'] = '@xml/network_security_config';
    return cfg;
  });

  return config;
};

module.exports = withNetworkSecurityConfig;
