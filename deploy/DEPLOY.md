# Lightsail Deploy Talimatı

LoveLog'u `lovelog-sude.duckdns.org` üzerinden, mevcut `mvp-api` ile aynı sunucuda
(18.185.38.217) yayına almak için adım adım talimat.

## Mimari özet

```
İnternet
   │
   ▼ port 80/443
┌────────────────────────────────┐
│  HOST nginx (Lightsail VM)     │
│  ┌──────────────────────────┐  │
│  │ default_server (IP ile)  │──┼──► 127.0.0.1:8000 (mvp-api Docker)
│  │ lovelog-sude.duckdns.org │──┼──► 127.0.0.1:8080 (lovelog Docker)
│  └──────────────────────────┘  │
└────────────────────────────────┘
```

- mvp-api → host port 80'i bırakır, sadece localhost'ta dinler (override.yml ile)
- lovelog Docker container'ı 127.0.0.1:8080'de dinler, içinde basit nginx + statik build
- HOST nginx hostname-based routing yapar, SSL'i certbot host'ta yönetir

## Önkoşullar (ELDE ETMEN GEREKEN)

1. ☐ **DuckDNS IP'sini güncelle**: `lovelog-sude.duckdns.org` → `18.185.38.217`
   - https://www.duckdns.org → giriş → `current ip` → `18.185.38.217` → update
   - Veya tek komutla: `curl "https://www.duckdns.org/update?domains=lovelog-sude&token=$DUCKDNS_TOKEN&ip=18.185.38.217"`
   - Doğrula: `dig +short lovelog-sude.duckdns.org` → `18.185.38.217` döndürmeli

2. ☐ **Lightsail firewall'da 443 portunu aç** (HTTPS için)
   - AWS Lightsail Console → instance → Networking → IPv4 Firewall → Add rule → Custom TCP 443

3. ☐ Repo'da `.env` dosyasında `GEMINI_API_KEY` doğru ve dolu olduğundan emin ol

## Lokal makinede: deploy paketini hazırla

```bash
cd ~/Desktop/projects/lovelog

# Build artifact'larıyla birlikte tarball oluştur
tar --exclude='node_modules' --exclude='dist' --exclude='.git' \
    --exclude='certbot' --exclude='*.pem' \
    -czf /tmp/lovelog-deploy.tar.gz .
```

## Sunucuya kopyala

```bash
KEY=~/Desktop/projects/lovelog/LightsailDefaultKey-eu-central-1.pem
chmod 600 "$KEY"

# Tarball'ı yükle
scp -i "$KEY" /tmp/lovelog-deploy.tar.gz ubuntu@18.185.38.217:/tmp/

# Site config'lerini de ayrıca kopyalayalım (sudo gerektiren yerlere konacak)
scp -i "$KEY" deploy/nginx-host-lovelog.conf  ubuntu@18.185.38.217:/tmp/
scp -i "$KEY" deploy/nginx-host-default.conf  ubuntu@18.185.38.217:/tmp/
scp -i "$KEY" deploy/mvp-api-override.yml     ubuntu@18.185.38.217:/tmp/
```

## Sunucuda çalıştır

```bash
ssh -i "$KEY" ubuntu@18.185.38.217
```

Sunucudaki shell'de:

### 1. nginx kur (mvp-api host'ta nginx YOK)

```bash
sudo apt-get update
sudo apt-get install -y nginx certbot python3-certbot-nginx
sudo systemctl status nginx --no-pager   # active olmalı, ama henüz port 80 mvp-api'de
```

> ⚠️ nginx şu an başlamayabilir çünkü port 80'i mvp-api tutuyor. Sıralama önemli — önce site
> configleri hazırla, mvp-api rebind'ini son anda yap, sonra nginx'i başlat.

### 2. Site config'lerini yerleştir

```bash
sudo cp /tmp/nginx-host-default.conf  /etc/nginx/sites-available/default
sudo cp /tmp/nginx-host-lovelog.conf  /etc/nginx/sites-available/lovelog-sude.duckdns.org

sudo ln -sf /etc/nginx/sites-available/lovelog-sude.duckdns.org /etc/nginx/sites-enabled/lovelog-sude.duckdns.org
# default zaten /etc/nginx/sites-enabled/default olarak link'li (varsayılan kurulum)

sudo nginx -t   # syntax OK olmalı
```

### 3. mvp-api'yi rebind et (override.yml ile, orijinal compose dosyası DEĞİŞMEZ)

```bash
# /opt/mvp-api'ye yazmak için sudo gerekebilir
sudo cp /tmp/mvp-api-override.yml /opt/mvp-api/docker-compose.override.yml

# ÖNEMLİ: Override içindeki servis adı 'mvp-api'. Asıl compose'da farklı bir isim
# (api, web, vs.) kullanılıyorsa override'daki servis adını ona uydur.
sudo grep -E '^  [a-z_-]+:' /opt/mvp-api/docker-compose.prod.yml   # servis adlarını gör
# Gerekirse:
# sudo nano /opt/mvp-api/docker-compose.override.yml

# Servisi yeniden yarat → port artık 127.0.0.1:8000'e bağlı
cd /opt/mvp-api
sudo docker compose -f docker-compose.prod.yml up -d --force-recreate

# Doğrula: port 80 artık serbest, 8000 sadece localhost'ta
sudo ss -tlnp | grep -E ':(80|8000) '
# Beklenen: 127.0.0.1:8000 → docker-proxy; :80 hiçbir yerde değil
```

### 4. nginx'i başlat — artık 80 boş

```bash
sudo systemctl restart nginx
sudo systemctl status nginx --no-pager
```

Test:
```bash
curl -sS -H 'Host: anything' http://127.0.0.1/         # → mvp-api yanıtı
curl -sS -H 'Host: lovelog-sude.duckdns.org' http://127.0.0.1/   # → 502 (henüz lovelog up değil)
```

### 5. LoveLog'u deploy et

```bash
sudo mkdir -p /opt/lovelog
sudo chown $USER:$USER /opt/lovelog
cd /opt/lovelog
tar -xzf /tmp/lovelog-deploy.tar.gz

# Docker yoksa kur (mvp-api varsa zaten kurulu olmalı)
docker --version || curl -fsSL https://get.docker.com | sudo sh

# .env dosyası tarball'da var (GEMINI_API_KEY içerir)
docker compose -f docker-compose.lightsail.yml up -d --build

# Doğrula
docker ps | grep lovelog
curl -sS http://127.0.0.1:8080/ | head -20   # → HTML yanıt
```

### 6. SSL: Let's Encrypt sertifikası al

```bash
# certbot --nginx otomatik olarak nginx config'ini günceller, 443 server bloğu ekler
sudo certbot --nginx \
  -d lovelog-sude.duckdns.org \
  --non-interactive --agree-tos \
  --email kadirm1953a@gmail.com \
  --redirect

# Otomatik yenileme test
sudo certbot renew --dry-run
```

certbot kurulumu otomatik bir cron/systemd timer ekler, sertifika 60-90 gün arası kendiliğinden yenilenir.

### 7. Son testler

```bash
# Yerel
curl -I https://lovelog-sude.duckdns.org/    # → 200 OK
curl -I http://18.185.38.217/                # → mvp-api 200 (veya kendi default response'u)

# Tarayıcıda:
#   https://lovelog-sude.duckdns.org    → LoveLog
#   http://18.185.38.217                 → mvp-api (eskisi gibi)
```

## Geri Alma (Rollback)

mvp-api'yi eski haline döndürmek için:

```bash
sudo rm /opt/mvp-api/docker-compose.override.yml
cd /opt/mvp-api && sudo docker compose -f docker-compose.prod.yml up -d --force-recreate
# → mvp-api yine 0.0.0.0:80 dinler (ama nginx 80'de olduğu için çakışacak — önce nginx'i kapat)
sudo systemctl stop nginx
```

LoveLog'u kapatmak için:

```bash
cd /opt/lovelog && docker compose -f docker-compose.lightsail.yml down
sudo rm /etc/nginx/sites-enabled/lovelog-sude.duckdns.org
sudo systemctl reload nginx
```

## Sorun giderme

- **502 lovelog'da**: `docker logs lovelog` → container down mu? Port 8080 dinliyor mu?
  `sudo ss -tlnp | grep 8080`
- **mvp-api 502**: `docker ps | grep mvp` → container ayakta mı?
  `sudo ss -tlnp | grep 8000`
- **DNS yanıt yok**: `dig +short lovelog-sude.duckdns.org` → 18.185.38.217 mi? DuckDNS'i güncellemen lazım.
- **Let's Encrypt başarısız**: 80 portu dışarıdan ulaşılabilir mi? Lightsail firewall + DNS doğru mu?
  `curl -v http://lovelog-sude.duckdns.org/` (haricî bir yerden) ile dene.
