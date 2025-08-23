CREATE TABLE IF NOT EXISTS `js_status_mapping` (
  `js_code` varchar(20) NOT NULL,
  `status_type_id` int(11) NOT NULL,
  `severity_level` tinyint(4) DEFAULT 1,
  `station_t` int(11) DEFAULT NULL,
  `line_t` int(11) DEFAULT NULL,
  PRIMARY KEY (`js_code`),
  KEY `status_type_id` (`status_type_id`),
  CONSTRAINT `js_status_mapping_ibfk_1` FOREIGN KEY (`status_type_id`) REFERENCES `operational_status_types` (`status_type_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

INSERT INTO `js_status_mapping` (`js_code`, `status_type_id`, `severity_level`, `station_t`, `line_t`) VALUES
('0', 15, 0, 5, 14),
('1', 1, 1, 1, 10),
('2', 5, 4, 5, 13),
('3', 4, 2, 4, 13),
('4', 12, 3, 3, 12);
