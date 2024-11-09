#!/bin/bash

# Function to log steps
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Function to check exit status
check_status() {
    if [ $? -ne 0 ]; then
        log "Error: $1"
        exit 1
    fi
}

log "==> Creando directorios necesarios..."
mkdir -p certificates templates public/passes temp dist/types
check_status "No se pudieron crear los directorios"

log "==> Configurando variables de entorno para certificados..."
export PASS_CERT_PEM=$(cat pass_pem_b64.txt)
export PASS_KEY=$(cat pass_key_b64.txt)
export WWDR_PEM=$(cat wwdr_pem_b64.txt)

# Verificar valores de los certificados
for VAR in "PASS_CERT_PEM" "PASS_KEY" "WWDR_PEM"; do
    if [ -z "${!VAR}" ]; then
        log "Error: La variable $VAR está vacía"
        exit 1
    fi
    log "Primero 10 caracteres de $VAR: ${!VAR:0:10}..."
done

# Crear archivos de certificados
log "==> Creando archivos de certificados desde las variables de entorno..."
echo "$PASS_CERT_PEM" | base64 -d > certificates/pass.pem || { log "Error al crear pass.pem"; exit 1; }
echo "$PASS_KEY" | base64 -d > certificates/pass.key || { log "Error al crear pass.key"; exit 1; }
echo "$WWDR_PEM" | base64 -d > certificates/WWDR.pem || { log "Error al crear WWDR.pem"; exit 1; }

log "==> Instalando dependencias..."
npm install
npm install --save-dev @types/cors @types/fs-extra @types/express @types/node
check_status "No se pudieron instalar las dependencias"

log "==> Compilando TypeScript..."
npx tsc
check_status "Falló la compilación de TypeScript"

log "==> Ejecutando API Extractor..."
npx api-extractor run --local
check_status "API Extractor falló"

log "==> Clonando repositorio de plantillas..."
if [ -d "assets-temp" ]; then
    rm -rf assets-temp
fi
git clone --depth 1 https://github.com/juliotaver/leu-beauty-certs.git assets-temp
check_status "Falló la clonación del repositorio de plantillas"

# Verificación y copia de plantillas y activos
log "==> Verificando y copiando plantillas y activos..."
if [ -d "assets-temp/templates" ]; then
    cp -r assets-temp/templates/* templates/
    mkdir -p public/images
    cp -r assets-temp/*.png public/images/
else
    log "Error: No se encontraron las plantillas necesarias en el repositorio clonado"
    exit 1
fi

# Verificación de archivos copiados
for TEMPLATE in templates public/images; do
    if [ -z "$(ls -A $TEMPLATE)" ]; then
        log "Error: No se copiaron archivos en $TEMPLATE"
        exit 1
    fi
done

log "==> Limpiando archivos temporales..."
rm -rf assets-temp

log "==> Build completado exitosamente"