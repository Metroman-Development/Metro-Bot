INSERT INTO `operational_status_types` (`status_type_id`, `status_name`, `status_description`, `is_operational`, `severity_level`, `display_color`, `icon_name`, `emoji`, `discordem`, `requires_notification`, `created_at`, `updated_at`) VALUES
(1, 'abierta', 'Estación Abierta', 1, 1, 'green', 'check-circle', '✅', '<:operativa:1348394413357010984>', 0, NOW(), NOW()),
(2, 'combinación', 'Estación con combinación', 1, 1, 'blue', 'transfer', '🔄', '🔄', 0, NOW(), NOW()),
(3, 'accesos controlados', 'Accesos controlados', 0, 2, 'yellow', 'alert-circle', '⚠️', '<:parcial:1348400125005008977>', 1, NOW(), NOW()),
(4, 'accesos parciales', 'Accesos parciales', 0, 2, 'yellow', 'alert-triangle', '⚠️', '<:parcial:1348400125005008977>', 1, NOW(), NOW()),
(5, 'cerrada', 'Estación Cerrada', 0, 4, 'red', 'x-circle', '❌', '<:cerrada:1348394347045064766>', 1, NOW(), NOW()),
(7, 'contención', 'Contención', 0, 3, 'orange', 'shield', '🛡️', '🛡️', 1, NOW(), NOW());

INSERT INTO `js_status_mapping` (`js_code`, `status_type_id`, `severity_level`) VALUES ('1', 1, 1);
