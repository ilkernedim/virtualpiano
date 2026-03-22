#!/bin/bash
cd "$(dirname "$0")"
echo "Sanal Piyano sunucusu başlatılıyor..."
echo "Lütfen tarayıcınızda şu adresi açın: http://localhost:8080"
python3 -m http.server 8080
