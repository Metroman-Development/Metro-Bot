CREATE TABLE IF NOT EXISTS `event_details` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `event_id` int(11) NOT NULL,
  `detail_type` enum('ingress','egress','combination','transfer','closure','delay','note') NOT NULL,
  `station_code` varchar(10) DEFAULT NULL,
  `line_code` varchar(3) DEFAULT NULL,
  `start_time` time DEFAULT NULL,
  `end_time` time DEFAULT NULL,
  `description` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `event_id` (`event_id`),
  CONSTRAINT `event_details_ibfk_1` FOREIGN KEY (`event_id`) REFERENCES `metro_events` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
