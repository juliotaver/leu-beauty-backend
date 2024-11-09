#!/bin/bash

# Crear directorios
mkdir -p certs assets

# Decodificar certificados
echo "$PASS_CERT_PEM" | base64 -d > certs/pass.pem
echo "$PASS_KEY" | base64 -d > certs/pass.key
echo "$WWDR_PEM" | base64 -d > certs/WWDR.pem

# Decodificar recursos
echo "$ICON_PNG" | base64 -d > assets/icon.png
echo "$LOGO_PNG" | base64 -d > assets/logo.png
echo "$STRIP_PNG" | base64 -d > assets/strip.png

# Instalar dependencias y construir
npm install
npm run setup
npm run build