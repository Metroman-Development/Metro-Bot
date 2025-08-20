-- Populate operational_status_types
INSERT INTO `operational_status_types` (`status_type_id`, `status_name`, `is_operational`, `severity_level`) VALUES
(1, 'Normal', 1, 1),
(2, 'Alerta', 1, 3),
(3, 'Interrumpido', 0, 5);

-- Populate js_status_mapping
-- Map JS code "1" (likely normal) to our 'Normal' status
INSERT INTO `js_status_mapping` (`js_code`, `status_type_id`, `severity_level`) VALUES
('1', 1, 1);
