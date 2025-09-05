# Documentación de Datos

Este documento describe el flujo de datos de la aplicación, desde la obtención de datos de la API hasta su salida final. Incluye detalles sobre la fuente de datos, el esquema, el procesamiento y el uso.

## 1. Flujo de Datos

Esta sección describe el flujo de datos de la aplicación, desde la obtención de datos de la API hasta su almacenamiento y procesamiento.

### 1.1. Obtención de Datos

El servicio `ApiService.js`, ubicado en `src/core/metro/core/services/`, es responsable de obtener los datos del estado de la red de Metro. Este servicio utiliza el siguiente endpoint de la API:

- **URL:** `https://www.metro.cl/api/estadoRedDetalle.php`

El `ApiService.js` también gestiona una caché local de los datos para evitar solicitudes innecesarias a la API y para proporcionar datos de respaldo en caso de que la API no esté disponible.

La obtención de datos se realiza cada 1 minuto a través del planificador (`scheduler.js`).

### 1.2. Procesamiento y Transformación

El `ApiService.js` recibe los datos brutos de la API y realiza los siguientes pasos:

1.  **Traducción de Datos:** Los datos brutos de la API son pasados al método `translateData`, que utiliza la tabla `js_status_mapping` para mapear los códigos de estado de la API a los códigos de estado internos de la aplicación.
2.  **Actualización de `MetroInfoProvider`:** Los datos traducidos se utilizan para actualizar los campos `lines` y `network_status` en `MetroInfoProvider`.

### 1.3. Obtención de Datos de la Base de Datos

El planificador (`scheduler.js`) también se encarga de obtener los datos de la base de datos cada 30 segundos. Esta información se utiliza para actualizar el `MetroInfoProvider`.

### 1.4. Cálculo del Estado de la Red

Cada 30 segundos, con un retraso de 2 segundos para dar tiempo a la obtención de datos de la API, el planificador calcula el estado general de la red y lo almacena en el campo `network_status` de `MetroInfoProvider`.

## 2. Estructura de Datos

### 2.1. `estadoredjson`

El `MetroInfoProvider` almacena los datos en una estructura llamada `estadoredjson`, que tiene el siguiente formato:

```json
{
  "lines": {
    "l1": {
      "estado": "1",
      "mensaje": "",
      "mensaje_app": "Línea disponible",
      "estaciones": [
        {
          "nombre": "San Pablo L1",
          "codigo": "SP",
          "estado": "1",
          "combinacion": "L5",
          "descripcion": "Estación Operativa",
          "descripcion_app": "Habilitada",
          "mensaje": ""
        }
      ]
    }
  },
  "network_status": {
    "status": "operational",
    "timestamp": "2025-08-23T09:00:00.000Z"
  },
  "stations": {
    "L1_SP": {
      "id": "L1_SP",
      "name": "San Pablo",
      "line": "L1",
      "status": "operational"
    }
  },
  "lastChange": "2025-08-23T09:00:00.000Z"
}
```

### 2.2. `js_status_mapping`

Esta tabla se utiliza para traducir los códigos de estado de la API a los códigos de estado internos de la aplicación.

| js_code | status_type_id | severity_level | station_t | line_t |
|---|---|---|---|---|
| 0 | 15 | 0 | 15 | 15 |
| 1 | 16 | 0 | 1 | 10 |
| 2 | 17 | 4 | 5 | 14 |
| 3 | 18 | 3 | 4 | 18 |
| 4 | 19 | 1 | 4 | 12 |

## 3. Eventos Especiales

El sistema puede manejar eventos especiales que anulan el flujo de datos normal. Estos eventos se gestionan a través de la tabla `special_events`. Cuando un evento especial está activo, el planificador no obtendrá ni procesará datos de la API ni de la base de datos.
