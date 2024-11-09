#!/bin/bash

# Crear directorios necesarios
mkdir -p certificates templates

# Clonar repositorio de assets
git clone https://github.com/juliotaver/leu-beauty-certs.git assets-temp

# Copiar templates
cp -r assets-temp/templates/* templates/

# Crear certificados desde variables de entorno
echo "$PASS_CERT_PEM" | base64 -d > certificates/pass.pem
echo "$PASS_KEY" | base64 -d > certificates/pass.key
echo "$WWDR_PEM" | base64 -d > certificates/WWDR.pem

# Limpiar
rm -rf assets-temp

# Instalar dependencias y construir
npm install
npm run build