### **Guía Completa para Migrar y Añadir Embeds en el Sistema de Plantillas**

---

## **📌 1. Pasos para Migrar un Embed Existente**
Sigue este flujo para cada embed que necesites migrar:

### **A. Preparación**
1. **Identifica el tipo de embed**:
   - ¿Muestra información estática? → `BaseEmbed`
   - ¿Requiere paginación? → `PaginatedEmbed`
   - ¿Tiene botones/selectores? → `InteractiveEmbed`

2. **Revisa dependencias**:
   - Mueve assets compartidos (colores, íconos) a `baseEmbed.js`
   - Extrae lógica de formato/estilo a métodos helpers

### **B. Migración Paso a Paso**
1. **Crea el archivo** en `/templates/embeds/`:
   ```bash
   /templates/embeds/
   ├── MiNuevoEmbed.js  # Nuevo embed
   └── baseEmbed.js     # Plantilla base
   ```

2. **Estructura básica**:
   ```javascript
   const BaseEmbed = require('./baseEmbed');

   class MiNuevoEmbed extends BaseEmbed {
       constructor() {
           super(); // Hereda config de baseEmbed
       }

       async create(data, interaction = null) {
           // Lógica principal aquí
           return this.createEmbed({ ... });
       }

       // Helpers privados
       _formatCustomData(data) { ... }
   }

   module.exports = MiNuevoEmbed;
   ```

3. **Ejemplo con `CommandEmbed`**:
   ```javascript
   // templates/embeds/CommandEmbed.js
   const BaseEmbed = require('./baseEmbed');

   class CommandEmbed extends BaseEmbed {
       generate(command, userId, interactionId) {
           return {
               embed: this.createEmbed({
                   title: `📄 **/${command.name}**`,
                   description: command.description,
                   fields: this._buildFields(command),
                   color: '#4CAF50'
               }),
               components: [this._createBackButton(userId, interactionId)]
           };
       }

       _buildFields(command) {
           return [
               { name: 'Categoría', value: command.category, inline: true },
               { name: 'Uso', value: `\`${command.usage}\``, inline: true }
           ];
       }
   }
   ```

---

## **📌 2. Cómo Añadir un Nuevo Tipo de Embed**
Para crear un embed desde cero:

### **A. Define el Propósito**
| Tipo                | Características                          | Ejemplo                |
|---------------------|------------------------------------------|------------------------|
| **Estático**        | Sin interacción                          | `BootupEmbed`          |
| **Paginado**        | Navegación entre páginas                 | `RouteEmbed`           |
| **Interactivo**     | Con botones/selectores                   | `HelpEmbed`            |

### **B. Implementación**
1. **Para embeds simples** (solo información):
   ```javascript
   // templates/embeds/SimpleEmbed.js
   class SimpleEmbed extends BaseEmbed {
       create(title, description, color = '#5865F2') {
           return this.createEmbed({ title, description, color });
       }
   }
   ```

2. **Para embeds paginados**:
   ```javascript
   // templates/embeds/PaginatedEmbed.js
   class PaginatedEmbed extends BaseEmbed {
       async create(dataList, page, itemsPerPage) {
           const { items, totalPages } = this.paginateContent(dataList, page, itemsPerPage);

           return {
               embed: this.createEmbed({
                   title: `Página ${page + 1}/${totalPages}`,
                   description: items.join('\n')
               }),
               components: this._createPaginationButtons(page, totalPages)
           };
       }
   }
   ```

3. **Para embeds con botones**:
   ```javascript
   // templates/embeds/InteractiveEmbed.js
   class InteractiveEmbed extends BaseEmbed {
       createWithButtons(data, userId, interactionId) {
           return {
               embed: this.createEmbed({ ...data }),
               components: [
                   new ActionRowBuilder().addComponents(
                       new ButtonBuilder()
                           .setCustomId(`action_${userId}_${interactionId}`)
                           .setLabel('Ejemplo')
                           .setStyle(ButtonStyle.Primary)
                   )
               ]
           };
       }
   }
   ```

---

## **📌 3. Integración con Comandos**
### **A. Uso Básico**
```javascript
const HelpEmbed = require('../templates/embeds/HelpEmbed');
const helpEmbed = new HelpEmbed();

// En un comando:
await interaction.reply(
    helpEmbed.generateInitial(categories, userId, interactionId)
);
```

### **B. Para Handlers de Botones**
```javascript
const RouteEmbed = require('../templates/embeds/RouteEmbed');
const routeEmbed = new RouteEmbed();

// En un interactionCreate:
if (interaction.isButton() && interaction.customId.startsWith('route_')) {
    const embed = await routeEmbed.create(lineData, page);
    await interaction.update(embed);
}
```

---

## **📌 4. Buenas Prácticas**
1. **Métodos claros**:
   - Usa `create()` para embeds simples
   - Usa `generateX()` para versiones más complejas (ej: `generateInitial()`)

2. **Separación de lógica**:
   ```javascript
   // Bien
   class ProductEmbed extends BaseEmbed {
       create(product) {
           return this.createEmbed({
               title: product.name,
               fields: this._buildProductFields(product)
           });
       }

       _buildProductFields(product) { ... }
   }
   ```

3. **Documentación interna**:
   ```javascript
   /**
    * Crea un embed para productos
    * @param {Object} product - Datos del producto
    * @param {?Discord.Interaction} interaction - Interacción opcional
    * @returns {EmbedBuilder}
    */
   ```

---

## **📌 5. Ejemplo Completo: Migrando `disambiguationEmbed.js`**
### **Paso 1: Analizar el Original**
- Propósito: Mostrar opciones de estaciones ambiguas
- Componentes:
  - Embed con lista
  - Botones de selección

### **Paso 2: Crear la Plantilla**
```javascript
// templates/embeds/DisambiguationEmbed.js
const BaseEmbed = require('./baseEmbed');

class DisambiguationEmbed extends BaseEmbed {
    create(query, matches, interaction) {
        const options = matches.slice(0, 4);

        return {
            embed: this._createEmbed(query, options),
            components: [this._createButtons(interaction, options)]
        };
    }

    _createEmbed(query, options) {
        return this.createEmbed({
            title: `Disambiguation: ${query}`,
            description: options.map((opt, i) =>
                `**${i + 1}.** 🚉 ${opt.original} (Línea ${opt.line})`
            ).join('\n'),
            color: 0x0099FF
        });
    }

    _createButtons(interaction, options) {
        return new ActionRowBuilder().addComponents(
            options.map((_, i) =>
                new ButtonBuilder()
                    .setCustomId(`station_${interaction.user.id}_${interaction.id}_${i}`)
                    .setLabel(`${i + 1}️⃣`)
                    .setStyle(ButtonStyle.Primary)
            )
        );
    }
}
```

### **Paso 3: Uso en el Código**
```javascript
// Original:
const { createDisambiguationEmbed } = require('../config/defaultEmbeds/disambiguationEmbed');
const { embed, actionRows } = createDisambiguationEmbed(query, matches, interaction);

// Nuevo:
const DisambiguationEmbed = require('../templates/embeds/DisambiguationEmbed');
const disambiguationEmbed = new DisambiguationEmbed();
const { embed, components } = disambiguationEmbed.create(query, matches, interaction);
```

---

## **📌 6. Plantillas Adicionales Recomendadas**
Si necesitas más funcionalidad, añade estas plantillas:

### **A. `ModalEmbed.js`**
Para interacciones con modals:
```javascript
class ModalEmbed extends BaseEmbed {
    createWithForm(data, formId) {
        return {
            embed: this.createEmbed({ ...data }),
            components: [this._createModalTrigger(formId)]
        };
    }
}
```

### **B. `TimedEmbed.js`**
Para embeds que expiran:
```javascript
class TimedEmbed extends BaseEmbed {
    createTemporary(content, timeout = 30000) {
        const embed = this.createEmbed(content);
        setTimeout(() => embed.delete(), timeout);
        return embed;
    }
}
```

---

## **📌 7. Checklist para Migración**
1. [ ] Crear clase extendiendo `BaseEmbed`
2. [ ] Mover lógica de construcción al método `create()` o `generateX()`
3. [ ] Extraer helpers a métodos privados (`_buildFields()`)
4. [ ] Actualizar imports en los comandos
5. [ ] Documentar parámetros y retornos
6. [ ] Probar interacciones (botones/paginación)

---

Con este sistema tendrás:
✅ **Código más organizado**
✅ **Reutilización máxima**
✅ **Mantenimiento simplificado**
✅ **Escalabilidad para nuevos features**

¿Necesitas que desarrolle alguna plantilla adicional o ajustar las existentes?
