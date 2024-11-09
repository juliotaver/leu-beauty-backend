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

# Create necessary directories
log "Creating directories..."
mkdir -p certificates templates public/passes temp
check_status "Failed to create directories"

# Install dependencies including type definitions
log "Installing dependencies..."
npm install
npm install --save-dev @types/cors @types/fs-extra @types/express @types/node
check_status "Failed to install dependencies"

# Install type declarations
log "Installing type declarations..."
npm install --save-dev @types/fs-extra @types/cors
check_status "Failed to install type declarations"

# Verify installed type declaration files
log "Listing contents of node_modules/@types..."
ls -l node_modules/@types

# Verify type declaration installation
log "Verifying type declaration installation..."
if [ -d "node_modules/@types/fs-extra" ] && [ -d "node_modules/@types/cors" ]; then
    log "Type declarations installed successfully"
else
    log "Error: Type declarations not installed correctly"
    exit 1
fi

# Get PASS_CERT_PEM value from file
log "Getting PASS_CERT_PEM value from file..."
PASS_CERT_PEM=$(cat pass_pem_b64.txt)
log "First 10 chars of PASS_CERT_PEM: ${PASS_CERT_PEM:0:10}..."

# Verify PASS_CERT_PEM value
log "Verifying PASS_CERT_PEM value..."
if [ -z "$PASS_CERT_PEM" ]; then
    log "Error: PASS_CERT_PEM value is empty"
    exit 1
fi

# Get PASS_KEY value from file
log "Getting PASS_KEY value from file..."
PASS_KEY=$(cat pass_key_b64.txt)
log "First 10 chars of PASS_KEY: ${PASS_KEY:0:10}..."

# Verify PASS_KEY value
log "Verifying PASS_KEY value..."
if [ -z "$PASS_KEY" ]; then
    log "Error: PASS_KEY value is empty"
    exit 1
fi

# Get WWDR_PEM value from file
log "Getting WWDR_PEM value from file..."
WWDR_PEM=$(cat wwdr_pem_b64.txt)
log "First 10 chars of WWDR_PEM: ${WWDR_PEM:0:10}..."

# Verify WWDR_PEM value
log "Verifying WWDR_PEM value..."
if [ -z "$WWDR_PEM" ]; then
    log "Error: WWDR_PEM value is empty"
    exit 1
fi

# Create certificates from loaded values
log "Creating certificates..."
# Remove any existing certificate files
rm -f certificates/pass.pem certificates/pass.key certificates/WWDR.pem

# Create certificate files with error checking
echo "$PASS_CERT_PEM" | base64 -d > certificates/pass.pem 2>/tmp/pass_pem_error
if [ $? -ne 0 ]; then
    log "Error creating pass.pem: $(cat /tmp/pass_pem_error)"
    exit 1
fi

echo "$PASS_KEY" | base64 -d > certificates/pass.key 2>/tmp/pass_key_error
if [ $? -ne 0 ]; then
    log "Error creating pass.key: $(cat /tmp/pass_key_error)"
    exit 1
fi

echo "$WWDR_PEM" | base64 -d > certificates/WWDR.pem 2>/tmp/wwdr_pem_error
if [ $? -ne 0 ]; then
    log "Error creating WWDR.pem: $(cat /tmp/wwdr_pem_error)"
    exit 1
fi

# Verify certificate files
log "Verifying certificate files..."
for cert in "pass.pem" "pass.key" "WWDR.pem"; do
    if [ ! -s "certificates/$cert" ]; then
        log "Error: $cert is empty or not created"
        exit 1
    fi
    log "Certificate $cert size: $(wc -c < "certificates/$cert") bytes"
done

# Clone templates repository
log "Cloning templates repository..."
if [ -d "assets-temp" ]; then
    rm -rf assets-temp
fi

log "Cloning repository: https://github.com/juliotaver/leu-beauty-certs.git"
git clone --depth 1 https://github.com/juliotaver/leu-beauty-certs.git assets-temp
check_status "Failed to clone assets repository"

# Verify cloned repository contents
log "Verifying cloned repository contents..."
if [ -d "assets-temp/templates" ]; then
    log "Templates directory found"
else
    log "Error: Templates directory not found in cloned repository"
fi

if [ -f "assets-temp/icon.png" ] && [ -f "assets-temp/logo.png" ] && [ -f "assets-temp/strip.png" ]; then
    log "Required asset files found"
else
    log "Error: Required asset files not found in cloned repository"
fi

# Copy templates and assets
log "Copying templates and assets..."
cp -r assets-temp/templates/* templates/ 2>/dev/null || log "No templates found to copy"
mkdir -p public/images
cp -r assets-temp/*.png public/images/ 2>/dev/null || log "No images found to copy"

# Verify templates and assets were copied
if [ -z "$(ls -A templates)" ]; then
    log "Error: No templates were copied"
    exit 1
fi

if [ -z "$(ls public/images)" ]; then
    log "Error: No images were copied"
    exit 1
fi

# Log copied templates and assets
log "Copied templates:"
ls -1 templates

log "Copied images:"
ls -1 public/images

# Clean up
log "Cleaning up..."
rm -rf assets-temp

# Run TypeScript build
log "Building TypeScript..."
npm run build
check_status "TypeScript build failed"

log "Build completed successfully"