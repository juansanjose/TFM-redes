#!/bin/bash
set -e

# This script is executed by the postgres container on its first run.
# It downloads the Guacamole SQL schema and applies it to the database.

export PGPASSWORD="$POSTGRES_PASSWORD"
GUAC_VERSION="1.5.3"

# Download and apply the schema
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Create the schema
    CREATE SCHEMA guacamole;
    
    -- Grant usage to the user
    GRANT USAGE ON SCHEMA guacamole TO $POSTGRES_USER;

    -- Set the search path
    ALTER USER $POSTGRES_USER SET search_path TO guacamole, public;
EOSQL

# Download, decompress, and apply the Guacamole schema
apk add --no-cache curl
curl -L "https://apache.org/dyn/closer.lua/guacamole/${GUAC_VERSION}/binary/guacamole-auth-jdbc-${GUAC_VERSION}.tar.gz?action=download" \
    | tar -xzO \
    --wildcards '*/postgresql/schema/*.sql' \
    | psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB"

echo "Guacamole database initialization complete."
