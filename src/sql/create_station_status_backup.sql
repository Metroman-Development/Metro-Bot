CREATE TABLE IF NOT EXISTS `station_status_backup` (
  `backup_id` int(11) NOT NULL AUTO_INCREMENT,
  `event_id` int(11) NOT NULL,
  `station_id` int(11) NOT NULL,
  `status_type_id` int(11) NOT NULL,
  `status_description` varchar(255) DEFAULT NULL,
  `status_message` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`backup_id`),
  KEY `event_id` (`event_id`),
  KEY `station_id` (`station_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
