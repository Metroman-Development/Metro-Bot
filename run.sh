#!/bin/bash

# Define la ruta al archivo JSON de configuración
CONFIG_JSON_PATH="config.json"
KSON_CONFIG_PATH="config.kson"

# Verifica si se proporciona un argumento
if [ -n "$1" ]; then
    # Si se proporciona un argumento, úsalo como la ruta al archivo JSON de configuración
    CONFIG_JSON_PATH="$1"
fi

# Pasa la ruta del archivo JSON de configuración como una variable de entorno al script de Node.js
# Esto permite que el script de Node.js sepa qué archivo de configuración cargar
if [ -f "$KSON_CONFIG_PATH" ]; then
    # Si existe un config.kson, conviértelo a JSON
    # y pásalo al script de Node.js.
    # El script de Node.js debe poder manejar la entrada JSON desde stdin.
    json_config=$(kson "$KSON_CONFIG_PATH")
    export KSON_CONFIG="$json_config"
elif [ -f "$CONFIG_JSON_PATH" ]; then
    # Si no hay un config.kson pero sí un config.json,
    # lee el contenido del archivo y pásalo como una variable de entorno.
    json_config=$(cat "$CONFIG_JSON_PATH")
    export JSON_CONFIG="$json_config"
fi

# Ejecuta el script de Node.js
node src/index.js
