# Documentación de Datos

Este documento describe el flujo de datos de la aplicación, desde la obtención de datos de la API hasta su salida final. Incluye detalles sobre la fuente de datos, el esquema, el procesamiento y el uso.

## 1. Flujo de Datos

Esta sección describe el flujo de datos de la aplicación, desde la obtención de datos de la API hasta su almacenamiento y procesamiento.

### 1.1. Obtención de Datos

El servicio `EstadoRedService.js`, ubicado en `src/core/metro/core/services/`, es responsable de obtener los datos del estado de la red de Metro. Este servicio utiliza el siguiente endpoint de la API:

- **URL:** `https://www.metro.cl/api/estadoRedDetalle.php`

El `EstadoRedService.js` también gestiona una caché local de los datos para evitar solicitudes innecesarias a la API y para proporcionar datos de respaldo en caso de que la API no esté disponible.

### 1.2. Procesamiento y Transformación

El `ApiService.js` (`src/core/metro/core/services/`) orquesta el procesamiento de los datos. Recibe los datos brutos de `EstadoRedService.js` y realiza los siguientes pasos:

1.  **Traducción de Datos:** Los datos brutos de la API son pasados al `dataTranslator.js` (`src/core/metro/data/`). Este traductor mapea los códigos de estado de la API a los códigos de estado internos de la aplicación.
2.  **Procesamiento de Estado:** Los datos traducidos son procesados por el `StatusProcessor` para determinar el estado general de la red y de cada componente.
3.  **Actualización de la Base de Datos:** Los datos procesados se utilizan para actualizar las tablas `metro_lines` y `metro_stations` en la base de datos.

### 1.3. Almacenamiento en Base de Datos

Los datos del estado de la red se almacenan en la base de datos `MetroDB` para su consulta y persistencia. Las tablas principales involucradas son:

-   `metro_lines`: Almacena el estado de cada línea.
-   `metro_stations`: Almacena el estado de cada estación.

## 2. Esquema y Códigos de Estado

### 2.1. Esquema del JSON de la API (`estadoRedDetalle.php`)

El JSON devuelto por la API tiene la siguiente estructura:

-   **Claves de Línea:** El objeto principal contiene claves para cada línea (ej. `l1`, `l2`).
-   **Objeto de Línea:** Cada línea tiene un `estado`, `mensaje`, `mensaje_app`, y un array de `estaciones`.
-   **Objeto de Estación:** Cada estación tiene `nombre`, `codigo`, `estado`, `combinacion`, `descripcion`, y `descripcion_app`.

### 2.2. Códigos de Estado de la API

La API de `estadoRed` utiliza los siguientes códigos de estado:

#### Estaciones

| Código | Significado |
| :----: | ----------- |
| `1` | Abierta |
| `2` | Cerrada |
| `3` | Accesos controlados |
| `4` | Accesos parciales |

#### Líneas

| Código | Significado |
| :----: | ----------- |
| `1` | Operacional |
| `2` | Algunas estaciones cerradas |
| `3` | Servicio parcial |
| `4` | Retrasos |

### 2.3. Mapeo de Códigos de Estado

Los códigos de estado de la API son mapeados a códigos de estado internos de la aplicación a través del `dataTranslator.js`. A continuación se muestra el mapeo:

#### Estaciones

| Código API | Código Interno | Significado |
| :--------: | :------------: | ----------- |
| `1` | `1` | Abierta |
| `2` | `5` | Cerrada |
| `3` | `4` | Accesos parciales |

#### Líneas

| Código API | Código Interno | Significado |
| :--------: | :------------: | ----------- |
| `1` | `10` | Operativa |
| `2` | `13` | Parcial |
| `3` | `13` | Parcial |
| `4` | `12` | Retrasos |

Los códigos de estado internos se definen en `src/config/metro/metroConfig.js`.

### 2.4. Esquema de la Base de Datos

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
