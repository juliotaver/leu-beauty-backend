#!/bin/bash

# Crear directorios necesarios
echo "Creating directories..."
mkdir -p certificates templates

# Clonar repositorio de assets
echo "Cloning assets repository..."
git clone https://github.com/juliotaver/leu-beauty-certs.git assets-temp || exit 1

# Copiar templates
echo "Copying templates..."
cp -r assets-temp/templates/* templates/ || echo "Warning: No templates found"

# Crear certificados desde variables de entorno
echo "Creating certificates..."
echo "$PASS_CERT_PEM" | base64 -d > certificates/pass.pem || echo "Warning: Could not create pass.pem"
echo "$PASS_KEY" | base64 -d > certificates/pass.key || echo "Warning: Could not create pass.key"
echo "$WWDR_PEM" | base64 -d > certificates/WWDR.pem || echo "Warning: Could not create WWDR.pem"

# Limpiar
echo "Cleaning up..."
rm -rf assets-temp

# Instalar dependencias y tipos
echo "Installing dependencies..."
npm install
npm install --save-dev @types/cors @types/fs-extra @types/express @types/node

# Construir
echo "Building..."
npm run build
