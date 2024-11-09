#!/bin/bash

# Crear directorios
mkdir -p certificates templates

# Decodificar y guardar certificados
echo "$PASS_CERT_PEM" | base64 -d > certificates/pass.pem
echo "$PASS_KEY" | base64 -d > certificates/pass.key
echo "$WWDR_PEM" | base64 -d > certificates/WWDR.pem

# Decodificar y guardar imágenes
echo "$ICON_PNG" | base64 -d > templates/icon.png
echo "$LOGO_PNG" | base64 -d > templates/logo.png
echo "$STRIP_PNG" | base64 -d > templates/strip.png

# Establecer permisos
chmod 600 certificates/pass.key
chmod 644 certificates/pass.pem certificates/WWDR.pem
chmod 644 templates/*.png