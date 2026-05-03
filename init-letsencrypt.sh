#!/usr/bin/env bash
# Bootstrap Let's Encrypt certificates for lovelog.
# Bunu SADECE bir kere çalıştır (sertifika ilk kez alınırken). Sonrasında
# docker-compose içindeki certbot servisi 12 saatte bir otomatik yeniler.
#
# Önkoşul:
#   - 80 ve 443 portları router'da bu makineye yönlendirilmiş olmalı
#   - lovelog-sude.duckdns.org doğru public IP'ye işaret ediyor olmalı
#   - .env dosyası dolu olmalı
#
# Kullanım:
#   chmod +x init-letsencrypt.sh
#   ./init-letsencrypt.sh
#
# --staging: Let's Encrypt'in test ortamını kullanır (rate-limit'e takılmamak için
# önce bunu deneyebilirsin). Gerçek sertifika için staging=0 yap.

set -euo pipefail

# .env'i yükle
if [ -f .env ]; then
  # shellcheck disable=SC1091
  set -a; . ./.env; set +a
else
  echo "Error: .env not found"; exit 1
fi

DOMAIN="${DUCKDNS_DOMAIN}.duckdns.org"
EMAIL="${LETSENCRYPT_EMAIL:-}"
DATA_PATH="./certbot"
STAGING="${STAGING:-0}"   # 1 yaparsan staging cert alır (test için)
RSA_KEY_SIZE=4096

if [ -z "$EMAIL" ]; then
  echo "Error: LETSENCRYPT_EMAIL is not set in .env"; exit 1
fi

if [ -d "$DATA_PATH/conf/live/$DOMAIN" ]; then
  read -r -p "Existing data found for $DOMAIN. Continue and replace existing certificate? (y/N) " decision
  if [ "$decision" != "Y" ] && [ "$decision" != "y" ]; then
    exit
  fi
fi

# TLS recommended params (options-ssl-nginx.conf, ssl-dhparams.pem) — certbot bunları normalde kendisi koyar
if [ ! -e "$DATA_PATH/conf/options-ssl-nginx.conf" ] || [ ! -e "$DATA_PATH/conf/ssl-dhparams.pem" ]; then
  echo "### Downloading recommended TLS parameters ..."
  mkdir -p "$DATA_PATH/conf"
  curl -sSL https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf > "$DATA_PATH/conf/options-ssl-nginx.conf"
  curl -sSL https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem > "$DATA_PATH/conf/ssl-dhparams.pem"
fi

echo "### Creating dummy certificate for $DOMAIN ..."
PATH_LIVE="/etc/letsencrypt/live/$DOMAIN"
mkdir -p "$DATA_PATH/conf/live/$DOMAIN"
docker compose run --rm --entrypoint "\
  openssl req -x509 -nodes -newkey rsa:$RSA_KEY_SIZE -days 1 \
    -keyout '$PATH_LIVE/privkey.pem' \
    -out '$PATH_LIVE/fullchain.pem' \
    -subj '/CN=localhost'" certbot

echo "### Starting nginx ..."
docker compose up --force-recreate -d web

echo "### Deleting dummy certificate for $DOMAIN ..."
docker compose run --rm --entrypoint "\
  rm -Rf /etc/letsencrypt/live/$DOMAIN && \
  rm -Rf /etc/letsencrypt/archive/$DOMAIN && \
  rm -Rf /etc/letsencrypt/renewal/$DOMAIN.conf" certbot

echo "### Requesting Let's Encrypt certificate for $DOMAIN ..."
STAGING_ARG=""
if [ "$STAGING" != "0" ]; then STAGING_ARG="--staging"; fi

docker compose run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    $STAGING_ARG \
    --email $EMAIL \
    -d $DOMAIN \
    --rsa-key-size $RSA_KEY_SIZE \
    --agree-tos \
    --non-interactive \
    --force-renewal" certbot

echo "### Reloading nginx ..."
docker compose exec web nginx -s reload

echo
echo "### Done. https://$DOMAIN should now serve a real certificate."
echo "### Tüm servisleri başlatmak için: docker compose up -d"
