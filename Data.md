# Documentación de Datos

Este documento describe el flujo de datos de la aplicación, desde la obtención de datos de la API hasta su salida final. Incluye detalles sobre la fuente de datos, el esquema, el procesamiento y el uso.

## 1. Fuente de Datos

Esta sección describe cómo la aplicación obtiene los datos de la API de Metro.

La configuración para la API de Metro se encuentra en `src/core/metro/apiConfig.js`. Este archivo exporta un objeto `metroApiConfig` que construye la URL para las solicitudes a la API.

### Configuración de la API

El objeto `metroApiConfig` tiene la siguiente estructura:

- `baseUrl`: La URL base de la API, obtenida de la variable de entorno `METRO_API_BASE_URL`.
- `path`: La ruta de la API, obtenida de la variable de entorno `METRO_API_PATH`.
- `defaultDay`: El día predeterminado para la consulta, obtenido de la variable de entorno `METRO_API_DEFAULT_DAY`.
- `paramOrder`: Un array con el orden de los parámetros, obtenido de la variable de entorno `METRO_API_PARAMS`.

### Construcción de la URL

La URL se construye utilizando la función `buildUrl(startCode, endCode, farePeriod)`. Esta función toma los siguientes parámetros:

- `startCode`: El código de la estación de inicio.
- `endCode`: El código de la estación de fin.
- `farePeriod`: El período tarifario.

La función construye la URL con los parámetros en el orden especificado en `paramOrder`.

**Ejemplo de URL:**

```
https://api.metro.cl/v1/ruta?estacion_inicio=SP&estacion_fin=LD&dia=L&periodo=P
```

## 2. Esquema de Datos

Esta sección proporciona una descripción detallada de la estructura de los datos, incluido el formato JSON de la API y el esquema de la base de datos correspondiente.

### Esquema del JSON `estadoRed.json`

El archivo `estadoRed.json` contiene el estado de la red de metro. La estructura principal es un objeto donde cada clave es el ID de una línea (por ejemplo, "l1", "l2", etc.).

Cada objeto de línea tiene la siguiente estructura:

- `estado`: El estado de la línea.
  - `1`: Operativa.
  - `0`: No operativa.
- `mensaje`: Un mensaje descriptivo del estado.
- `mensaje_app`: Un mensaje para la aplicación.
- `estaciones`: Un array de objetos, donde cada objeto representa una estación de la línea.

Cada objeto de estación tiene la siguiente estructura:

- `nombre`: El nombre de la estación.
- `codigo`: El código de la estación.
- `estado`: El estado de la estación.
  - `1`: Operativa.
  - `0`: No operativa.
- `combinacion`: El ID de la línea con la que tiene combinación.
- `descripcion`: Una descripción del estado de la estación.
- `descripcion_app`: Una descripción para la aplicación.
- `mensaje`: Un mensaje adicional.

### Esquema de la Base de Datos

La base de datos `MetroDB` contiene varias tablas para almacenar la información de la red de metro. A continuación, se describen las tablas más relevantes.

#### Tabla `metro_lines`

Esta tabla almacena información sobre las líneas de metro.

| Columna | Tipo | Descripción |
| --- | --- | --- |
| `line_id` | `varchar(10)` | El ID de la línea (ej. "L1"). |
| `line_name` | `varchar(50)` | El nombre de la línea. |
| `line_color` | `varchar(20)` | El color de la línea. |
| `status_code` | `varchar(20)` | El código de estado de la línea. |
| `status_message` | `varchar(500)` | El mensaje de estado. |
| `app_message` | `varchar(500)` | El mensaje para la aplicación. |

#### Tabla `metro_stations`

Esta tabla almacena información sobre las estaciones de metro.

| Columna | Tipo | Descripción |
| --- | --- | --- |
| `station_id` | `int(11)` | El ID de la estación. |
| `line_id` | `varchar(10)` | El ID de la línea a la que pertenece la estación. |
| `station_code` | `varchar(255)` | El código de la estación. |
| `station_name` | `varchar(100)` | El nombre de la estación. |
| `display_name` | `varchar(100)` | El nombre para mostrar de la estación. |

## 3. Procesamiento de Datos

Esta sección explica cómo se procesan y almacenan en la base de datos los datos brutos de la API.

El procesamiento de datos implica tomar el JSON `estadoRed.json` y actualizar las tablas `metro_lines` y `metro_stations` en la base de datos.

### Mapeo de Datos de Líneas

El objeto de cada línea en el JSON se mapea a la tabla `metro_lines` de la siguiente manera:

- `estado` se mapea a `status_code`.
- `mensaje` se mapea a `status_message`.
- `mensaje_app` se mapea a `app_message`.

### Mapeo de Datos de Estaciones

El array de estaciones de cada línea en el JSON se itera y cada objeto de estación se mapea a la tabla `metro_stations` de la siguiente manera:

- `nombre` se mapea a `station_name`.
- `codigo` se mapea a `station_code`.
- `estado` se mapea a un campo de estado en la tabla (no definido en el esquema actual).
- `combinacion` se utiliza para establecer relaciones entre estaciones.

## 4. Salida de Datos

Esta sección detalla cómo se utilizan los datos procesados dentro de la aplicación, como en los comandos y embeds del bot.

La aplicación utiliza los datos de la base de datos para proporcionar información sobre el estado de la red de metro a los usuarios a través de un bot de Discord.

### Comandos del Bot

El bot tiene comandos que permiten a los usuarios consultar el estado de las líneas y estaciones. Por ejemplo, un comando `!estado L1` podría devolver el estado de la Línea 1.

### Embeds de Discord

El bot utiliza embeds de Discord para mostrar la información de estado de una manera visualmente atractiva. Los embeds pueden incluir:

- El nombre y el color de la línea.
- El estado de la línea (operativa, no operativa, etc.).
- Mensajes de estado.
- Información sobre las estaciones, incluido su estado.
