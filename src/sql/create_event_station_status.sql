CREATE TABLE IF NOT EXISTS `event_station_status` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `event_id` int(11) NOT NULL,
  `station_code` varchar(10) NOT NULL,
  `status` enum('normal','closed','ingress_only','egress_only','no_combination','delayed','special_hours') NOT NULL DEFAULT 'normal',
  `special_notes` text,
  `start_time` time DEFAULT NULL,
  `end_time` time DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_event_station` (`event_id`,`station_code`),
  CONSTRAINT `event_station_status_ibfk_1` FOREIGN KEY (`event_id`) REFERENCES `metro_events` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
