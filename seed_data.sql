SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS=0;

ALTER TABLE operational_status_types CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;
ALTER TABLE operational_status_types MODIFY COLUMN emoji VARCHAR(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;

TRUNCATE TABLE operational_status_types;

INSERT INTO `operational_status_types` (`status_type_id`, `status_name`, `status_description`, `is_operational`, `severity_level`, `display_color`, `icon_name`, `emoji`, `requires_notification`) VALUES
(1, 'abierta', 'Estación Abierta', 1, 1, 'green', 'check-circle', '✅', 0),
(2, 'combinación', 'Estación con combinación', 1, 1, 'blue', 'transfer', '🔄', 0),
(3, 'accesos controlados', 'Accesos controlados', 0, 2, 'yellow', 'alert-circle', '⚠️', 1),
(4, 'accesos parciales', 'Accesos parciales', 0, 2, 'yellow', 'alert-triangle', '⚠️', 1),
(5, 'cerrada', 'Estación Cerrada', 0, 4, 'red', 'x-circle', '❌', 1),
(7, 'contención', 'Contención', 0, 3, 'orange', 'shield', '🛡️', 1),
(8, 'servicio extendido solo entrada', 'Servicio extendido solo entrada', 1, 2, 'blue', 'log-in', '➡️', 1),
(9, 'servicio extendido solo salida', 'Servicio extendido solo salida', 1, 2, 'blue', 'log-out', '⬅️', 1),
(10, 'operativa', 'Línea Operativa', 1, 1, 'green', 'check-circle', '✅', 0),
(11, 'lenta', 'Línea Lenta', 0, 2, 'yellow', 'clock', '🕰️', 1);

SET FOREIGN_KEY_CHECKS=1;
