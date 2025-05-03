# **Documentación Completa de Chronos**  
*(Sistema de Gestión de Horarios y Eventos para Metro)*  
**Versión 2.2.0**  

---

## **1. Visión General**  
Chronos es el módulo central para:  
✅ **Gestión inteligente de horarios** (pico/valle/festivos)  
✅ **Programación de eventos especiales** (conciertos, mantenimiento)  
✅ **Ajustes automáticos de servicio** (freuencias, estaciones afectadas)  
✅ **Integración con Discord** para notificaciones en tiempo real  

---

## **2. Configuración Básica**

### **2.1. Archivos Clave**  
```bash
config/
├── chronosConfig.js       # Horarios base y días festivos
├── events.json            # Eventos especiales
└── metroConfig.js         # Colores/emoji de líneas
```

### **2.2. Estructura de `chronosConfig.js`**  
```javascript
module.exports = {
  // Días festivos (formato YYYY-MM-DD)
  festiveDays: ["2025-01-01", "2025-05-01"],
  
  // Horarios operacionales
  schedule: {
    weekday: ["06:00", "23:00"],      // Lunes-Viernes
    saturday: ["06:30", "23:00"],     // Sábados
    sunday: ["07:30", "23:00"],       // Domingos
    
    // Periodos pico (array de objetos)
    peak: [
      { start: "07:00", end: "09:00" },
      { start: "18:00", end: "20:00" }
    ]
  }
};
```

---

## **3. Gestión de Eventos (`events.json`)**

### **3.1. Estructura Completa**  
```json
{
  "events": [
    {
      "name": "Concierto en Plaza Maipú",
      "date": "2025-11-15",
      "startTime": "18:00",
      "endTime": "23:00",
      "inStations": ["Del Sol L5"],
      "outStations": ["Ñuble L5"],
      "affectedLines": ["L5"],
      "alertChannel": "ID_CANAL_DISCORD",
      "customMessage": "🚧 Servicio reducido por evento"
    }
  ]
}
```

### **3.2. Campos Requeridos**  
| Campo           | Ejemplo              | Descripción                                  |
|-----------------|----------------------|----------------------------------------------|
| `name`          | "Mantenimiento L1"   | Nombre identificable del evento              |
| `date`          | "2025-09-30"         | Fecha en formato ISO                         |
| `startTime`     | "22:00"              | Hora de inicio (24h)                         |
| `endTime`       | "06:00"              | Hora de término                              |
| `inStations`    | ["San Pablo L1"]     | Estaciones OPERATIVAS durante el evento      |
| `outStations`   | ["Pajaritos L1"]     | Estaciones INHABILITADAS                     |

---

## **4. Clases Principales**

### **4.1. `ScheduleManager` (Núcleo)**  
**Métodos Esenciales:**  
```javascript
class ScheduleManager {
  async init() {}          // Inicia todos los schedulers
  clearAll() {}           // Detiene jobs programados
  scheduleDailyReload() {}// Reinicio diario a las 3AM
}
```

### **4.2. `EventScheduler`**  
**Flujo de Eventos:**  
1. Verifica eventos para la fecha actual  
2. Programa notificaciones de inicio/fin  
3. Ajusta servicios en estaciones afectadas  

**Ejemplo de Uso:**  
```javascript
// En ready.js
const metro = new MetroCore();
await metro.initialize();

const chronos = require('./modules/chronos');
await chronos.init(client, metro);
```

---

## **5. Integración con Discord**

### **5.1. Eventos Emitidos**  
Chronos envía estos eventos a Discord:  

| Evento                  | Ejemplo de Payload                      |
|-------------------------|-----------------------------------------|
| `eventStart`            | `{ name: "Concierto", start: "18:00" }` |
| `serviceAdjustment`     | `{ line: "L5", freq: "10min" }`        |
| `stationStatusChange`   | `{ station: "Ñuble", status: "closed" }`|

### **5.2. Ejemplo de Embed**  
```javascript
client.on('eventStart', (event) => {
  const embed = new EmbedBuilder()
    .setTitle(`⚠️ Evento: ${event.name}`)
    .addFields(
      { name: "Horario", value: `${event.start} - ${event.end}` },
      { name: "Estaciones cerradas", value: event.outStations.join(", ") }
    );
  
  channel.send({ embeds: [embed] });
});
```

---

## **6. Manejo de Horarios**

### **6.1. Periodos Automáticos**  
Chronos detecta automáticamente:  
- **Horas Pico** (aumenta frecuencia de trenes)  
- **Festivos** (usa horario dominical)  
- **Mantenimiento** (cierre parcial de estaciones)  

### **6.2. Reglas de Prioridad**  
1. Eventos especiales > Horario regular  
2. Festivos > Horario de fin de semana  

---

## **7. Ejecución en Producción**  
```bash
# Inicialización recomendada
node ready.js
```

**Variables de Entorno**  
```ini
TIMEZONE="America/Santiago"
METRO_DATA_VERSION="3.2.0"
```

---

## **8. Solución de Problemas**  

| Error                     | Causa Probable               | Solución                          |
|---------------------------|------------------------------|-----------------------------------|
| `Invalid time format`     | HH:mm vs h:mm A              | Usar formato 24h en configs       |
| `Event not scheduled`     | Fecha en pasado              | Verificar `events.json`           |
| `Missing station data`    | ID incorrecto                | Usar formato "Nombre Línea" (ej: "Ñuble L5") |

--- 

📌 **¿Preguntas?**  
Consulte la [wiki interna](https://github.com/tu-repo/docs/wiki/Chronos) para detalles avanzados.