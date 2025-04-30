# **Manual de Estructura de Datos y Uso - Metro System v3.0**

---

## **1. Estructura de Datos Principal**
Todos los transformadores devuelven este formato:

```typescript
{
  stations: { [id: string]: Station };  // Estaciones indexadas por ID
  lines: { [id: string]: Line };       // Líneas indexadas por ID
  systemMetadata: SystemMetadata;      // Metadatos del sistema
}
```

---

## **2. Estructura de Estaciones (`Station`)**
### **Campos Básicos**
| Campo       | Tipo       | Descripción                          | Ejemplo                  |
|-------------|------------|--------------------------------------|--------------------------|
| `id`        | `string`   | ID normalizado (minúsculas)          | `"vim"`                  |
| `code`      | `string`   | Código original                      | `"VIM"`                  |
| `name`      | `string`   | Nombre completo                      | `"Vicuña Mackenna L4A"`  |
| `line`      | `string`   | Línea asociada (minúsculas)          | `"l4a"`                  |
| `status`    | `string`   | Estado operacional                   | `"operational"`          |
| `transfers` | `object`   | Conexiones a otras líneas            | `{ "l4": true }`         |
| `details`   | `object`   | Detalles extendidos (*ver abajo*)     |                          |
| `metadata`  | `object`   | Metadatos técnicos                   |                          |

### **Detalles Extendidos (`details`)**
```typescript
{
  // Amenities (solo si existen)
  amenities?: Array<{
    type: string;       // Tipo de servicio
    status?: string;    // Estado (opcional)
    [key: string]: any; // Campos adicionales
  }>;

  // Ubicación
  municipality?: string;
  zone?: string;
  coordinates?: [number, number];

  // Características físicas
  platformCount?: number;
  hasParking?: boolean;

  // Custom fields
  [key: string]: any;
}
```

---

## **3. Estructura de Líneas (`Line`)**
| Campo       | Tipo       | Descripción                          | Ejemplo                  |
|-------------|------------|--------------------------------------|--------------------------|
| `id`        | `string`   | ID normalizado (minúsculas)          | `"l4a"`                  |
| `name`      | `string`   | Nombre para mostrar                  | `"Línea 4A"`             |
| `status`    | `string`   | Estado operacional                   | `"operational"`          |
| `stations`  | `string[]` | IDs de estaciones                    | `["vim", "sju"]`         |
| `color`?    | `string`   | Color (solo DB)                      | `"#00FF00"`              |

---

## **4. Metadatos del Sistema (`systemMetadata`)**
```typescript
{
  source: 'api' | 'database';  // Origen de los datos
  lastSync: string;            // ISO-8601 timestamp
  databaseVersion?: string;    // Versión de DB (opcional)
}
```

---

## **5. Ejemplos Prácticos**

### **Ejemplo API**
```javascript
{
  "stations": {
    "vim": {
      "id": "vim",
      "code": "VIM",
      "name": "Vicuña Mackenna L4A",
      "line": "l4a",
      "status": "operational",
      "transfers": { "l4": true },
      "details": {
        "amenities": [
          { "type": "wifi" }
        ]
      },
      "metadata": {
        "source": "api",
        "updatedAt": "2023-11-21T08:00:00Z"
      }
    }
  }
}
```

### **Ejemplo Base de Datos**
```javascript
{
  "stations": {
    "vim": {
      "id": "vim",
      "code": "VIM",
      "name": "Vicuña Mackenna L4A",
      "line": "l4a",
      "status": "operational",
      "transfers": { "l4": true },
      "details": {
        "amenities": [
          { 
            "type": "elevator",
            "location": "Platform B",
            "lastMaintenance": "2023-11-01"
          }
        ],
        "municipality": "Santiago",
        "platformCount": 2
      },
      "metadata": {
        "source": "database",
        "databaseId": 42,
        "updatedAt": "2023-11-21T07:30:00Z"
      }
    }
  }
}
```

---

## **6. Guía de Uso**

### **Acceso a Datos**
```javascript
// Obtener estación específica
const station = data.stations["vim"];

// Verificar conexiones
const hasL4Transfer = station.transfers.l4; // true/false

// Listar amenities
const amenities = station.details.amenities || [];
```

### **Búsquedas Comunes**
```javascript
// Todas estaciones operacionales
const operationalStations = Object.values(data.stations)
  .filter(s => s.status === "operational");

// Estaciones con ascensor
const stationsWithElevator = Object.values(data.stations)
  .filter(s => s.details.amenities?.some(a => a.type === "elevator"));
```

### **Manejo de Campos Opcionales**
```javascript
// Forma segura de acceder a campos anidados
const municipality = station.details.municipality || "Desconocido";
const wifiSpeed = station.details.amenities?.[0]?.speed || "N/A";
```

---

## **7. Reglas de Validación**
1. **IDs**: Siempre en minúsculas
2. **Transfers**: Objeto con claves normalizadas (`{ "l4": true }`)
3. **Amenities**: Array solo presente si hay datos
4. **Campos obligatorios**: 
   - Stations: `id`, `code`, `name`, `line`, `status`
   - Lines: `id`, `name`, `status`, `stations`

---

## **8. Migración desde Versiones Anteriores**
| Cambio                     | v2 → v3                          |
|----------------------------|----------------------------------|
| `amenities`                | Movido a `details.amenities`     |
| Valores por defecto        | Eliminados (ahora opcionales)    |
| `details.municipality`     | Campo opcional                   |

---

**Última Actualización**: 2023-11-21  
**Equipo**: Ingeniería de Datos - Metro System  

