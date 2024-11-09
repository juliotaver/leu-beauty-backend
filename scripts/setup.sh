#!/bin/bash

# Crear directorios
mkdir -p certificates templates

# Copiar certificados y recursos
cp -r /opt/render/project/src/certs/* certificates/
cp -r /opt/render/project/src/assets/* templates/

# Establecer permisos
chmod 600 certificates/pass.key
chmod 644 certificates/pass.pem certificates/WWDR.pem
chmod 644 templates/*.png