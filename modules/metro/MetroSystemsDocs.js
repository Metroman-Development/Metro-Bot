# **Documentación del Sistema Metro Modular**

## **1. Estructura del Directorio**
```
modules/
  metro/
    index.js             # Interfaz principal
    MetroCore.js         # Núcleo de caché
    legacyBridge.js      # Compatibilidad con sistemas heredados
    queries/
      lines.js          # Operaciones con líneas
      stations.js       # Operaciones con estaciones
      express.js       # Manejo de rutas expreso
      details.js        # Información detallada
    utils/
      stationData.js    # Datos de estaciones
      expressHandlers.js # Utilidades para Discord
      validators.js     # Validación de datos
```

---

## **2. Componentes Principales**

### **`MetroCore.js`**
**Responsabilidad**:  
- Almacena y gestiona los datos en tiempo real del metro.
- Construye índices para búsquedas rápidas.

**Métodos Clave**:
| Método | Descripción |
|--------|-------------|
| `update(data)` | Actualiza los datos del metro y reconstruye índices. |
| `getLine(lineId)` | Devuelve datos de una línea específica. |
| `getStation(identifier)` | Busca una estación por nombre o código. |
| `_buildIndexes()` | Crea índices para búsquedas rápidas. |

---

### **`queries/lines.js`**
**Funcionalidades**:
- Información técnica de líneas (longitud, estaciones, etc.).
- Gestión de rutas expreso.

**Ejemplo de Uso**:
```javascript
const infoLinea1 = metro.lines.getLineInfo('l1');
const lineasExpreso = metro.lines.getAllExpressLines();
```

**Métodos**:
| Método | Descripción |
|--------|-------------|
| `getLineInfo(lineId)` | Devuelve datos estáticos y dinámicos de una línea. |
| `getExpressSchedule(lineId)` | Obtiene horarios de rutas expreso. |

---

### **`queries/stations.js`**
**Funcionalidades**:
- Búsqueda de estaciones con filtros avanzados.
- Información sobre conexiones y accesibilidad.

**Ejemplo de Uso**:
```javascript
const estacionesAccesibles = metro.stations.searchStations({
  accessibility: 'completa',
  status: 'activa'
});
```

**Métodos**:
| Método | Descripción |
|--------|-------------|
| `getStationWithFilters()` | Busca estaciones aplicando filtros. |
| `getStationConnections()` | Devuelve líneas de conexión. |

---

### **`queries/express.js`**
**Funcionalidades**:
- Identificación de líneas expreso.
- Filtrado por tipo de ruta (verde/roja).
- Conteo de estaciones entre puntos con filtros.

**Ejemplo de Uso**:
```javascript
const estacionesExpreso = metro.express.getStationsByRoute('l2', 'roja');
const conteo = metro.express.countStationsBetween('El Llano', 'Cristóbal Colón', 'l4', { routeType: 'comun' });
```

**Métodos**:
| Método | Descripción |
|--------|-------------|
| `isExpressLine(lineId)` | Verifica si una línea tiene rutas expreso. |
| `resolveRouteCombination()` | Normaliza combinaciones de rutas. |

---

### **`utils/expressHandlers.js`**
**Funcionalidades**:
- Generación de mensajes embed para Discord.
- Creación de botones interactivos.

**Ejemplo de Uso**:
```javascript
const { embed } = metro.handlers.createRouteEmbed('l2', 'roja', estaciones);
const botones = metro.handlers.createRouteButtons(...);
```

---

## **3. Filtros Disponibles**
Se pueden combinar múltiples filtros en búsquedas:

| Parámetro | Valores | Descripción |
|-----------|---------|-------------|
| `status` | `activa`, `inactiva` | Filtra por estado operativo. |
| `routeType` | `comun`, `verde`, `roja` | Tipo de ruta expreso. |
| `accessibility` | `completa`, `parcial` | Nivel de accesibilidad. |
| `hasTransfer` | `true`/`false` | Estaciones con combinaciones. |

---

## **4. Ejemplos de Uso**

### **Obtener información de una línea**
```javascript
const linea2 = metro.lines.getLineInfo('l2');
console.log(linea2);
// Output: { nombre: "Línea 2", estaciones: [...], ... }
```

### **Buscar estaciones con filtros**
```javascript
const filtros = {
  status: 'activa',
  routeType: 'verde',
  accessibility: 'completa'
};
const estacionesFiltradas = metro.stations.searchStations(filtros);
```

### **Manejar rutas expreso en Discord**
```javascript
const { embed, buttons } = metro.handlers.createRouteEmbed('l5', 'roja', estaciones);
interaction.reply({ embeds: [embed], components: [buttons] });
```

---

## **5. Notas Importantes**
- **Independencia total**: No requiere sistemas heredados.
- **Eficiencia**: Índices en memoria para búsquedas rápidas.
- **Extensible**: Fácil añadir nuevos filtros o datos.

Este sistema unifica toda la funcionalidad original y añade capacidades avanzadas para manejo de rutas expreso y filtrado complejo.