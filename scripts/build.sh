#!/bin/bash

# Instalar tipos primero
echo "Installing type definitions..."
npm install --save-dev @types/cors @types/fs-extra @types/express @types/node

# Crear directorios necesarios
echo "Creating directories..."
mkdir -p certificates templates

# Clonar repositorio de assets
echo "Cloning assets repository..."
git clone --depth 1 https://github.com/juliotaver/leu-beauty-certs.git assets-temp
if [ $? -eq 0 ]; then
    echo "Successfully cloned assets repository"
    # Mostrar contenido del directorio clonado
    ls -la assets-temp
    ls -la assets-temp/templates
else
    echo "Failed to clone assets repository"
    exit 1
fi

# Copiar templates
echo "Copying templates..."
cp -rv assets-temp/templates/* templates/ || echo "Warning: No templates found"

# Verificar las variables de entorno
echo "Checking environment variables..."
if [ -z "$PASS_CERT_PEM" ]; then
    echo "Error: PASS_CERT_PEM is not set"
    exit 1
fi

if [ -z "$PASS_KEY" ]; then
    echo "Error: PASS_KEY is not set"
    exit 1
fi

if [ -z "$WWDR_PEM" ]; then
    echo "Error: WWDR_PEM is not set"
    exit 1
fi

# Crear certificados desde variables de entorno
echo "Creating certificates..."
echo "$PASS_CERT_PEM" | base64 --decode > certificates/pass.pem || echo "Warning: Could not create pass.pem"
echo "$PASS_KEY" | base64 --decode > certificates/pass.key || echo "Warning: Could not create pass.key"
echo "$WWDR_PEM" | base64 --decode > certificates/WWDR.pem || echo "Warning: Could not create WWDR.pem"

# Verificar que los archivos se crearon
echo "Verifying files..."
ls -la certificates/
ls -la templates/

# Limpiar
echo "Cleaning up..."
rm -rf assets-temp

# Instalar dependencias
echo "Installing dependencies..."
npm install

# Construir
echo "Building..."
npm run build