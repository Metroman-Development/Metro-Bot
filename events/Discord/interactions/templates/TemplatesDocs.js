Aquí tienes las plantillas listas para implementar, junto con una guía clara para reemplazar tus botones existentes:

---

## **📂 Plantillas Esenciales**  
*(Ubicación: `/src/templates/buttons/`)*

### **1. Plantilla de Paginación** (`pagination.js`)
```javascript
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

class PaginationTemplate {
    static create(options) {
        return {
            customId: `${options.idPrefix}_pagination`,
            async execute(interaction) {
                const [_, action, userId, page] = interaction.customId.split('_');
                const currentPage = parseInt(page) || 0;
                
                // Validación de usuario
                if (userId !== interaction.user.id) {
                    return interaction.reply({ content: '❌ Acción no permitida', ephemeral: true });
                }

                // Lógica de páginas
                const newPage = action === 'next' ? currentPage + 1 : Math.max(0, currentPage - 1);
                const data = await options.fetchData(newPage);

                // Construir respuesta
                await interaction.update({
                    embeds: [options.buildEmbed(data, newPage)],
                    components: [this._buildButtons(options.idPrefix, userId, newPage, data.totalPages)]
                });
            },
            _buildButtons(prefix, userId, currentPage, totalPages) {
                return new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`${prefix}_prev_${userId}_${currentPage}`)
                        .setLabel('◀')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(currentPage <= 0),
                    new ButtonBuilder()
                        .setCustomId(`${prefix}_next_${userId}_${currentPage}`)
                        .setLabel('▶')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(currentPage >= totalPages - 1)
                );
            }
        };
    }
}

module.exports = PaginationTemplate;
```

---

### **2. Plantilla de Navegación** (`navigation.js`)
```javascript
class NavigationTemplate {
    static backButton(idPrefix) {
        return {
            customId: `${idPrefix}_back`,
            async execute(interaction) {
                const [_, __, userId, contextId] = interaction.customId.split('_');
                
                const history = await BridgeManager.getHistory(contextId);
                if (!history.length) {
                    return interaction.reply({ content: '❌ No hay historial', ephemeral: true });
                }

                const previousState = history.pop();
                await BridgeManager.update(contextId, { history });

                await interaction.update({
                    embeds: [previousState.embed],
                    components: [previousState.buttons]
                });
            }
        };
    }
}

module.exports = NavigationTemplate;
```

---

### **3. Plantilla de Selección** (`selection.js`)
```javascript
class SelectionTemplate {
    static create(options) {
        return {
            customId: `${options.idPrefix}_select`,
            async execute(interaction) {
                const [_, selectedId, userId, contextId] = interaction.customId.split('_');
                
                const selection = await SelectionManager.get(contextId);
                const selectedItem = selection.items.find(i => i.id === selectedId);

                await interaction.update({
                    embeds: [options.buildEmbed(selectedItem)],
                    components: [options.buildActions(selectedItem)]
                });
            }
        };
    }
}

module.exports = SelectionTemplate;
```

---

## **🔧 Guía de Reemplazo Paso a Paso**

### **Para Botones de Paginación** (como `expressButtons.js`)
1. **Elimina** tu handler antiguo
2. **Implementa**:
```javascript
// En tu archivo de comandos:
const pagination = PaginationTemplate.create({
    idPrefix: 'express_route',
    fetchData: async (page) => {
        return {
            items: await RouteAPI.getRoutes(page),
            totalPages: await RouteAPI.getTotalPages()
        };
    },
    buildEmbed: (data, page) => {
        return new EmbedBuilder()
            .setTitle(`Rutas - Página ${page + 1}`)
            .setDescription(data.items.map(r => `• ${r.name}`).join('\n'));
    }
});

client.buttons.set(pagination.customId, pagination);
```

---

### **Para Botones de Atrás** (como `ayudaVolver.js`)
1. **Reemplaza** todo el archivo con:
```javascript
module.exports = NavigationTemplate.backButton('ayuda');
```

---

### **Para Botones de Selección** (como `disambiguationButton.js`)
1. **Adapta** usando:
```javascript
const selectionHandler = SelectionTemplate.create({
    idPrefix: 'station',
    buildEmbed: (station) => {
        return new EmbedBuilder()
            .setTitle(station.name)
            .addFields(
                { name: 'Línea', value: station.line },
                { name: 'Estado', value: station.status }
            );
    }
});

client.buttons.set(selectionHandler.customId, selectionHandler);
```

---

## **📌 Beneficios Clave del Reemplazo**
| **Antes** | **Ahora** |
|-----------|-----------|
| Lógica duplicada | Código centralizado |
| Validaciones manuales | Seguridad automática |
| Estado en caché crudo | Gestión con `BridgeManager` |
| Dificil mantenimiento | Actualizaciones en un solo lugar |

---

## **⚡ Casos Especiales**
Para botones con **lógica muy específica** (ej: cálculo de tarifas):
1. Mantén tu archivo original
2. Importa sólo las utilidades necesarias:
```javascript
const { validateUser } = require('../../templates/utils');

module.exports = {
    customId: 'fare_calculate',
    async execute(interaction) {
        if (!validateUser(interaction)) return;
        // ... lógica única de tarifas
    }
};
```

---

## **🚀 Siguientes Pasos**
1. **Prueba los templates** con tus botones más simples
2. **Migra gradualmente** los componentes
3. **Personaliza** las plantillas según necesites

¿Quieres que adaptemos alguna plantilla en específico para un caso de uso complejo?

Aquí tienes una **plantilla de selección ultra flexible** que puedes adaptar para cualquier tipo de interacción (botones, menús desplegables, o incluso modales):

---

## **🛠️ Plantilla de Selección Flexible**  

*(`/src/templates/selection/FlexibleSelector.js`)*

```javascript

const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder } = require('discord.js');

class FlexibleSelector {

    /**

     * @param {Object} config

     * @param {String} config.idPrefix - Prefijo para IDs (ej: 'station_select')

     * @param {Function} config.fetchOptions - Async fn() => [{label, value, description?, emoji?}]

     * @param {Function} config.onSelect - Async fn(interaction, selectedValue, context)

     * @param {String} [config.style='menu'] - 'menu' | 'buttons' | 'tabs'

     * @param {Number} [config.maxOptions=25] - Máximo opciones para menús

     */

    static create(config) {

        return {

            customId: `${config.idPrefix}_flex`,

            async execute(interaction, client) {

                // 1. Obtener contexto

                const context = {

                    userId: interaction.user.id,

                    guildId: interaction.guild?.id,

                    messageId: interaction.message?.id

                };

                // 2. Manejar diferentes estilos

                switch(config.style) {

                    case 'menu':

                        await this._handleMenu(interaction, config, context);

                        break;

                    case 'buttons':

                        await this._handleButtons(interaction, config, context);

                        break;

                    case 'tabs':

                        await this._handleTabs(interaction, config, context);

                        break;

                }

            },

            async _handleMenu(interaction, config, context) {

                const options = await config.fetchOptions(context);

                const selectMenu = new StringSelectMenuBuilder()

                    .setCustomId(`${config.idPrefix}_menu`)

                    .setPlaceholder(config.placeholder || 'Selecciona una opción')

                    .addOptions(options.slice(0, config.maxOptions));

                await interaction.reply({

                    components: [new ActionRowBuilder().addComponents(selectMenu)],

                    ephemeral: config.ephemeral || false

                });

            },

            async _handleButtons(interaction, config, context) {

                const options = await config.fetchOptions(context);

                const rows = this._chunkArray(options, 5).map(group => {

                    return new ActionRowBuilder().addComponents(

                        group.map(opt => 

                            new ButtonBuilder()

                                .setCustomId(`${config.idPrefix}_btn_${opt.value}`)

                                .setLabel(opt.label)

                                .setStyle(config.buttonStyle || ButtonStyle.Primary)

                                .setEmoji(opt.emoji || '')

                        )

                    );

                });

                await interaction.reply({

                    content: config.prompt || 'Elige una opción:',

                    components: rows,

                    ephemeral: config.ephemeral || false

                });

            },

            async _handleTabs(interaction, config, context) {

                // Implementación para pestañas (ej: info/recorridos/horarios)

                const tabs = await config.fetchTabs(context);

                const row = new ActionRowBuilder().addComponents(

                    tabs.map(tab => 

                        new ButtonBuilder()

                            .setCustomId(`${config.idPrefix}_tab_${tab.id}`)

                            .setLabel(tab.label)

                            .setStyle(ButtonStyle.Secondary)

                            .setEmoji(tab.emoji || '')

                    )

                );

                const initialTab = tabs[0];

                await interaction.reply({

                    embeds: [await config.buildTabEmbed(initialTab, context)],

                    components: [row]

                });

            },

            _chunkArray(arr, size) {

                return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>

                    arr.slice(i * size, i * size + size)

                );

            }

        };

    }

}

module.exports = FlexibleSelector;

```

---

### **📌 Componentes Adicionales Necesarios**

#### **1. Manejador de Selección**  

*(`/src/templates/selection/SelectionHandler.js`)*  

```javascript

module.exports = {

    handleMenuSelection: async (interaction, idPrefix, onSelect) => {

        const selected = interaction.values[0];

        const context = {

            userId: interaction.user.id,

            guildId: interaction.guild?.id

        };

        await onSelect(interaction, selected, context);

    },

    handleButtonSelection: async (interaction, idPrefix, onSelect) => {

        const selected = interaction.customId.split('_')[3]; // Format: prefix_btn_VALUE

        const context = {

            userId: interaction.user.id,

            messageId: interaction.message.id

        };

        await onSelect(interaction, selected, context);

    }

};

```

---

## **🚀 Ejemplos de Uso**

### **Ejemplo 1: Menú de Selección de Estaciones**

```javascript

const stationSelector = FlexibleSelector.create({

    idPrefix: 'station_select',

    style: 'menu',

    fetchOptions: async () => {

        const stations = await StationAPI.getAll();

        return stations.map(s => ({

            label: s.name,

            value: s.id,

            description: `Línea ${s.line}`,

            emoji: '🚇'

        }));

    },

    onSelect: async (interaction, stationId, context) => {

        const station = await StationAPI.getDetails(stationId);

        await interaction.update({

            embeds: [StationEmbed.build(station)],

            components: []

        });

    }

});

// Registrar en el cliente

client.buttons.set(stationSelector.customId, stationSelector);

client.selectMenus.set('station_select_menu', {

    execute: (interaction) => 

        SelectionHandler.handleMenuSelection(

            interaction, 

            'station_select', 

            stationSelector.config.onSelect

        )

});

```

### **Ejemplo 2: Botones para Elegir Rol**

```javascript

const roleSelector = FlexibleSelector.create({

    idPrefix: 'role_choose',

    style: 'buttons',

    fetchOptions: async (context) => {

        return [

            { label: 'Developer', value: 'dev', emoji: '💻' },

            { label: 'Designer', value: 'design', emoji: '🎨' }

        ];

    },

    onSelect: async (interaction, roleValue) => {

        await interaction.member.roles.add(roleValue);

        await interaction.update({

            content: `✅ Rol asignado: ${roleValue}`,

            components: []

        });

    }

});

```

### **Ejemplo 3: Pestañas de Información**

```javascript

const infoTabs = FlexibleSelector.create({

    idPrefix: 'info_tabs',

    style: 'tabs',

    fetchTabs: async () => [

        { id: 'general', label: 'General', emoji: '📝' },

        { id: 'schedule', label: 'Horarios', emoji: '⏰' }

    ],

    buildTabEmbed: async (tab, context) => {

        const data = await InfoAPI.get(tab.id, context.guildId);

        return new EmbedBuilder()

            .setTitle(tab.label)

            .setDescription(data.content);

    }

});

```

---

## **🔧 Cómo Migrar Tus Botones Existentes**

### **Paso a Paso:**

1. **Identifica** el tipo de selección:

   - Menús → `style: 'menu'`

   - Botones → `style: 'buttons'`

   - Pestañas → `style: 'tabs'`

2. **Extrae** tu lógica actual:

   - Mueve `fetchOptions` a una función independiente

   - Convierte `onSelect` en una función pura

3. **Reemplaza** el handler original:

```javascript

// Antes

module.exports = {

    customId: 'old_select',

    async execute(interaction) {

        // Lógica compleja aquí...

    }

};

// Después

module.exports = FlexibleSelector.create({

    idPrefix: 'new_select',

    style: 'menu',

    fetchOptions: fetchStationOptions, // Función importada

    onSelect: handleStationSelection  // Función importada

});

```

---

## **🌟 Beneficios Clave**

✅ **Unifica** todos los tipos de selección en un mismo sistema  

✅ **Reutilizable** para cualquier contexto (roles, estaciones, etc.)  

✅ **Extensible** añadiendo nuevos `styles`  

✅ **Mantenible** lógica centralizada  

¿Quieres que desarrolle algún ejemplo adicional específico para tu caso de uso?