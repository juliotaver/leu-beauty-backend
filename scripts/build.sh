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
mkdir -p certificates templates public/passes
check_status "Failed to create directories"

# Install dependencies including type definitions
log "Installing dependencies..."
npm install
npm install --save-dev @types/cors @types/fs-extra @types/express @types/node
check_status "Failed to install dependencies"

# Verify environment variables
log "Verifying environment variables..."
for var in "PASS_CERT_PEM" "PASS_KEY" "WWDR_PEM"; do
    if [ -z "${!var}" ]; then
        log "Error: $var is not set"
        exit 1
    fi
    
    # Print the first 10 characters of each variable for debugging
    log "First 10 chars of $var: ${!var:0:10}..."
    
    # Verify base64 format
    if ! echo "${!var}" | base64 -d >/dev/null 2>&1; then
        log "Error: $var is not valid base64"
        exit 1
    fi
done

# Create certificates from environment variables
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

git clone --depth 1 https://github.com/juliotaver/leu-beauty-certs.git assets-temp
check_status "Failed to clone assets repository"

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
# Copy templates and assets
log "Copying templates and assets..."
cp -r assets-temp/templates/* templates/ 2>/dev/null || log "No templates found to copy"
mkdir -p public/images
cp -r assets-temp/*.png public/images/ 2>/dev/null
if [ -z "$(ls public/images)" ]; then
    log "Warning: No images found to copy"
fi
# Run TypeScript build
log "Building TypeScript..."
npm run build
check_status "TypeScript build failed"

log "Build completed successfully"