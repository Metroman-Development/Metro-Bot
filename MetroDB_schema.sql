/*M!999999\- enable the sandbox mode */
-- MariaDB dump 10.19  Distrib 10.11.13-MariaDB, for debian-linux-gnu (x86_64)
--
-- Host: 127.0.0.1    Database: MetroDB
-- ------------------------------------------------------
-- Server version	10.11.13-MariaDB-0ubuntu0.24.04.1

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `incident_types`
--

DROP TABLE IF EXISTS `incident_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `incident_types` (
  `incident_type_id` int(11) NOT NULL AUTO_INCREMENT,
  `type_name` varchar(50) NOT NULL,
  `category` enum('safety','technical','health','operational','facility','security','weather','other') NOT NULL,
  `severity_level` tinyint(1) DEFAULT 1 COMMENT '1-5 scale, 1=minor, 5=critical',
  `default_response_protocol` text DEFAULT NULL,
  `requires_immediate_action` tinyint(1) DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`incident_type_id`),
  UNIQUE KEY `type_name` (`type_name`,`category`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `incident_types`
--

LOCK TABLES `incident_types` WRITE;
/*!40000 ALTER TABLE `incident_types` DISABLE KEYS */;
/*!40000 ALTER TABLE `incident_types` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `incidents`
--

DROP TABLE IF EXISTS `incidents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `incidents` (
  `incident_id` int(11) NOT NULL AUTO_INCREMENT,
  `incident_type_id` int(11) NOT NULL,
  `station_id` int(11) DEFAULT NULL,
  `line_id` varchar(10) DEFAULT NULL,
  `description` text NOT NULL,
  `severity_level` tinyint(1) NOT NULL COMMENT '1-5 scale, 1=minor, 5=critical',
  `status` enum('reported','investigating','resolved','closed') DEFAULT 'reported',
  `photo_url` varchar(255) DEFAULT NULL,
  `reported_by` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `resolved_at` timestamp NULL DEFAULT NULL,
  `resolved_by` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`incident_id`),
  KEY `incident_type_id` (`incident_type_id`),
  KEY `station_id` (`station_id`),
  KEY `line_id` (`line_id`),
  CONSTRAINT `incidents_ibfk_1` FOREIGN KEY (`incident_type_id`) REFERENCES `incident_types` (`incident_type_id`),
  CONSTRAINT `incidents_ibfk_2` FOREIGN KEY (`station_id`) REFERENCES `metro_stations` (`station_id`),
  CONSTRAINT `incidents_ibfk_3` FOREIGN KEY (`line_id`) REFERENCES `metro_lines` (`line_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `incidents`
--

LOCK TABLES `incidents` WRITE;
/*!40000 ALTER TABLE `incidents` DISABLE KEYS */;
/*!40000 ALTER TABLE `incidents` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `js_status_mapping`
--

DROP TABLE IF EXISTS `js_status_mapping`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `js_status_mapping` (
  `js_code` varchar(20) NOT NULL,
  `status_type_id` int(11) NOT NULL,
  `severity_level` tinyint(4) DEFAULT 1,
  PRIMARY KEY (`js_code`),
  KEY `status_type_id` (`status_type_id`),
  CONSTRAINT `js_status_mapping_ibfk_1` FOREIGN KEY (`status_type_id`) REFERENCES `operational_status_types` (`status_type_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `js_status_mapping`
--

LOCK TABLES `js_status_mapping` WRITE;
/*!40000 ALTER TABLE `js_status_mapping` DISABLE KEYS */;
/*!40000 ALTER TABLE `js_status_mapping` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `line_fleet`
--

DROP TABLE IF EXISTS `line_fleet`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `line_fleet` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `line_id` varchar(10) NOT NULL,
  `model_id` varchar(50) NOT NULL,
  `fleet_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`fleet_data`)),
  `last_updated` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_line_model` (`line_id`,`model_id`),
  CONSTRAINT `line_fleet_ibfk_1` FOREIGN KEY (`line_id`) REFERENCES `metro_lines` (`line_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `line_fleet`
--

LOCK TABLES `line_fleet` WRITE;
/*!40000 ALTER TABLE `line_fleet` DISABLE KEYS */;
/*!40000 ALTER TABLE `line_fleet` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `line_status`
--

DROP TABLE IF EXISTS `line_status`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `line_status` (
  `status_id` int(11) NOT NULL AUTO_INCREMENT,
  `line_id` varchar(10) NOT NULL,
  `status_type_id` int(11) NOT NULL,
  `status_description` varchar(255) DEFAULT NULL,
  `status_message` varchar(500) DEFAULT NULL,
  `expected_resolution_time` timestamp NULL DEFAULT NULL,
  `is_planned` tinyint(1) DEFAULT 0,
  `impact_level` enum('none','low','medium','high','critical') DEFAULT 'none',
  `affected_section_start_station_id` int(11) DEFAULT NULL,
  `affected_section_end_station_id` int(11) DEFAULT NULL,
  `last_updated` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `updated_by` varchar(50) DEFAULT NULL COMMENT 'system or admin username',
  PRIMARY KEY (`status_id`),
  KEY `line_id` (`line_id`),
  KEY `affected_section_start_station_id` (`affected_section_start_station_id`),
  KEY `affected_section_end_station_id` (`affected_section_end_station_id`),
  KEY `status_type_id` (`status_type_id`),
  KEY `expected_resolution_time` (`expected_resolution_time`),
  CONSTRAINT `line_status_ibfk_1` FOREIGN KEY (`line_id`) REFERENCES `metro_lines` (`line_id`) ON DELETE CASCADE,
  CONSTRAINT `line_status_ibfk_2` FOREIGN KEY (`status_type_id`) REFERENCES `operational_status_types` (`status_type_id`),
  CONSTRAINT `line_status_ibfk_3` FOREIGN KEY (`affected_section_start_station_id`) REFERENCES `metro_stations` (`station_id`) ON DELETE SET NULL,
  CONSTRAINT `line_status_ibfk_4` FOREIGN KEY (`affected_section_end_station_id`) REFERENCES `metro_stations` (`station_id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `line_status`
--

LOCK TABLES `line_status` WRITE;
/*!40000 ALTER TABLE `line_status` DISABLE KEYS */;
/*!40000 ALTER TABLE `line_status` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `loader_raw_data`
--

DROP TABLE IF EXISTS `loader_raw_data`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `loader_raw_data` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `loader_name` varchar(50) NOT NULL COMMENT 'stationLoader/lineLoader/etc',
  `data_key` varchar(100) NOT NULL COMMENT 'Original filename/key',
  `raw_json` longtext NOT NULL COMMENT 'Full JSON payload',
  `checksum` varchar(64) NOT NULL COMMENT 'SHA-256 of raw_json',
  `ingested_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_loader_checksum` (`loader_name`,`checksum`),
  KEY `idx_loader` (`loader_name`),
  KEY `idx_data_key` (`data_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `loader_raw_data`
--

LOCK TABLES `loader_raw_data` WRITE;
/*!40000 ALTER TABLE `loader_raw_data` DISABLE KEYS */;
/*!40000 ALTER TABLE `loader_raw_data` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `metro_lines`
--

DROP TABLE IF EXISTS `metro_lines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `metro_lines` (
  `line_id` varchar(10) NOT NULL,
  `line_name` varchar(50) NOT NULL,
  `line_color` varchar(20) DEFAULT NULL,
  `display_order` int(11) DEFAULT NULL,
  `line_description` varchar(500) DEFAULT NULL,
  `opening_date` date DEFAULT NULL,
  `total_stations` int(11) DEFAULT NULL,
  `total_length_km` decimal(6,2) DEFAULT NULL,
  `avg_daily_ridership` int(11) DEFAULT NULL,
  `operating_hours_start` time DEFAULT NULL,
  `operating_hours_end` time DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `display_name` varchar(100) GENERATED ALWAYS AS (concat('Línea ',ucase(`line_id`))) VIRTUAL,
  `fleet_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`fleet_data`)),
  `status_code` varchar(20) DEFAULT NULL COMMENT 'Matches JavaScript status.code',
  `status_message` varchar(500) DEFAULT NULL COMMENT 'Matches JavaScript status.message',
  `app_message` varchar(500) DEFAULT NULL COMMENT 'Matches JavaScript status.appMessage',
  `infrastructure` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`infrastructure`)),
  `status_code_str` varchar(20) GENERATED ALWAYS AS (ifnull(`status_code`,'')) VIRTUAL,
  PRIMARY KEY (`line_id`),
  KEY `display_order` (`display_order`),
  KEY `idx_line_id_ci` (`line_id`) USING HASH,
  KEY `idx_line_status_code` (`status_code_str`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `metro_lines`
--

LOCK TABLES `metro_lines` WRITE;
/*!40000 ALTER TABLE `metro_lines` DISABLE KEYS */;
/*!40000 ALTER TABLE `metro_lines` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `metro_stations`
--

DROP TABLE IF EXISTS `metro_stations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `metro_stations` (
  `station_id` int(11) NOT NULL AUTO_INCREMENT,
  `line_id` varchar(10) NOT NULL,
  `station_code` varchar(10) NOT NULL,
  `station_name` varchar(100) NOT NULL,
  `display_order` int(11) DEFAULT NULL,
  `commune` varchar(100) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL,
  `location` point NOT NULL,
  `opened_date` date DEFAULT NULL,
  `last_renovation_date` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `display_name` varchar(100) DEFAULT NULL,
  `transports` text DEFAULT NULL COMMENT 'From stationData[0]',
  `services` text DEFAULT NULL COMMENT 'From stationData[1]',
  `accessibility` text DEFAULT NULL COMMENT 'From stationData[2]',
  `commerce` text DEFAULT NULL COMMENT 'From stationData[3]',
  `amenities` text DEFAULT NULL COMMENT 'From stationData[4]',
  `image_url` varchar(255) DEFAULT NULL COMMENT 'From stationData[5]',
  `access_details` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`access_details`)),
  PRIMARY KEY (`station_id`),
  UNIQUE KEY `line_id` (`line_id`,`station_code`),
  KEY `station_name` (`station_name`),
  KEY `commune` (`commune`),
  SPATIAL KEY `location` (`location`),
  KEY `idx_station_display_name` (`display_name`),
  CONSTRAINT `metro_stations_ibfk_1` FOREIGN KEY (`line_id`) REFERENCES `metro_lines` (`line_id`)
) ENGINE=InnoDB AUTO_INCREMENT=701 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `metro_stations`
--

LOCK TABLES `metro_stations` WRITE;
/*!40000 ALTER TABLE `metro_stations` DISABLE KEYS */;
/*!40000 ALTER TABLE `metro_stations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `operational_status_types`
--

DROP TABLE IF EXISTS `operational_status_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `operational_status_types` (
  `status_type_id` int(11) NOT NULL AUTO_INCREMENT,
  `status_name` varchar(50) NOT NULL,
  `status_description` varchar(255) DEFAULT NULL,
  `is_operational` tinyint(1) DEFAULT 0,
  `severity_level` tinyint(1) DEFAULT 1 COMMENT '1-5 scale, 1=normal, 5=severe',
  `display_color` varchar(20) DEFAULT NULL,
  `icon_name` varchar(50) DEFAULT NULL,
  `requires_notification` tinyint(1) DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`status_type_id`),
  UNIQUE KEY `status_name` (`status_name`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `operational_status_types`
--

LOCK TABLES `operational_status_types` WRITE;
/*!40000 ALTER TABLE `operational_status_types` DISABLE KEYS */;
/*!40000 ALTER TABLE `operational_status_types` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `station_status`
--

DROP TABLE IF EXISTS `station_status`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `station_status` (
  `status_id` int(11) NOT NULL AUTO_INCREMENT,
  `station_id` int(11) NOT NULL,
  `status_type_id` int(11) NOT NULL,
  `status_description` varchar(255) DEFAULT NULL,
  `status_message` varchar(500) DEFAULT NULL,
  `expected_resolution_time` timestamp NULL DEFAULT NULL,
  `is_planned` tinyint(1) DEFAULT 0,
  `impact_level` enum('none','low','medium','high','critical') DEFAULT 'none',
  `last_updated` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `updated_by` varchar(50) DEFAULT NULL COMMENT 'system or admin username',
  PRIMARY KEY (`status_id`),
  UNIQUE KEY `idx_unique_station` (`station_id`),
  KEY `status_type_id` (`status_type_id`),
  KEY `expected_resolution_time` (`expected_resolution_time`),
  CONSTRAINT `station_status_ibfk_1` FOREIGN KEY (`station_id`) REFERENCES `metro_stations` (`station_id`) ON DELETE CASCADE,
  CONSTRAINT `station_status_ibfk_2` FOREIGN KEY (`status_type_id`) REFERENCES `operational_status_types` (`status_type_id`)
) ENGINE=InnoDB AUTO_INCREMENT=830 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `station_status`
--

LOCK TABLES `station_status` WRITE;
/*!40000 ALTER TABLE `station_status` DISABLE KEYS */;
/*!40000 ALTER TABLE `station_status` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `station_status_history`
--

DROP TABLE IF EXISTS `station_status_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `station_status_history` (
  `history_id` int(11) NOT NULL AUTO_INCREMENT,
  `status_id` int(11) NOT NULL,
  `station_id` int(11) NOT NULL,
  `status_type_id` int(11) NOT NULL,
  `status_description` varchar(255) DEFAULT NULL,
  `status_message` varchar(500) DEFAULT NULL,
  `expected_resolution_time` timestamp NULL DEFAULT NULL,
  `is_planned` tinyint(1) DEFAULT 0,
  `impact_level` enum('none','low','medium','high','critical') DEFAULT 'none',
  `last_updated` timestamp NOT NULL,
  `updated_by` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`history_id`),
  KEY `station_id` (`station_id`),
  KEY `status_type_id` (`status_type_id`),
  CONSTRAINT `station_status_history_ibfk_1` FOREIGN KEY (`station_id`) REFERENCES `metro_stations` (`station_id`),
  CONSTRAINT `station_status_history_ibfk_2` FOREIGN KEY (`status_type_id`) REFERENCES `operational_status_types` (`status_type_id`)
) ENGINE=InnoDB AUTO_INCREMENT=1024 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `station_status_history`
--

LOCK TABLES `station_status_history` WRITE;
/*!40000 ALTER TABLE `station_status_history` DISABLE KEYS */;
/*!40000 ALTER TABLE `station_status_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `status_change_log`
--

DROP TABLE IF EXISTS `status_change_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `status_change_log` (
  `log_id` int(11) NOT NULL AUTO_INCREMENT,
  `station_id` int(11) DEFAULT NULL,
  `line_id` varchar(10) DEFAULT NULL,
  `old_status_type_id` int(11) DEFAULT NULL,
  `new_status_type_id` int(11) NOT NULL,
  `change_description` text DEFAULT NULL,
  `is_planned` tinyint(1) DEFAULT 0,
  `expected_duration_minutes` int(11) DEFAULT NULL,
  `changed_by` varchar(50) DEFAULT NULL COMMENT 'system or admin username',
  `changed_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`log_id`),
  KEY `new_status_type_id` (`new_status_type_id`),
  KEY `changed_at` (`changed_at`),
  KEY `station_id` (`station_id`),
  KEY `line_id` (`line_id`),
  KEY `old_status_type_id` (`old_status_type_id`),
  CONSTRAINT `status_change_log_ibfk_1` FOREIGN KEY (`station_id`) REFERENCES `metro_stations` (`station_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `status_change_log_ibfk_2` FOREIGN KEY (`line_id`) REFERENCES `metro_lines` (`line_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `status_change_log_ibfk_3` FOREIGN KEY (`old_status_type_id`) REFERENCES `operational_status_types` (`status_type_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `status_change_log_ibfk_4` FOREIGN KEY (`new_status_type_id`) REFERENCES `operational_status_types` (`status_type_id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=830 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `status_change_log`
--

LOCK TABLES `status_change_log` WRITE;
/*!40000 ALTER TABLE `status_change_log` DISABLE KEYS */;
/*!40000 ALTER TABLE `status_change_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Temporary table structure for view `vw_lines_with_jsdata`
--

DROP TABLE IF EXISTS `vw_lines_with_jsdata`;
/*!50001 DROP VIEW IF EXISTS `vw_lines_with_jsdata`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8mb4;
/*!50001 CREATE VIEW `vw_lines_with_jsdata` AS SELECT
 1 AS `line_id`,
  1 AS `line_name`,
  1 AS `line_color`,
  1 AS `display_order`,
  1 AS `line_description`,
  1 AS `opening_date`,
  1 AS `total_stations`,
  1 AS `total_length_km`,
  1 AS `avg_daily_ridership`,
  1 AS `operating_hours_start`,
  1 AS `operating_hours_end`,
  1 AS `created_at`,
  1 AS `updated_at`,
  1 AS `display_name`,
  1 AS `fleet_data`,
  1 AS `status_code`,
  1 AS `status_message`,
  1 AS `app_message`,
  1 AS `infrastructure`,
  1 AS `effective_status_code`,
  1 AS `effective_status_message`,
  1 AS `infrastructure_data` */;
SET character_set_client = @saved_cs_client;

--
-- Temporary table structure for view `vw_station_status_history`
--

DROP TABLE IF EXISTS `vw_station_status_history`;
/*!50001 DROP VIEW IF EXISTS `vw_station_status_history`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8mb4;
/*!50001 CREATE VIEW `vw_station_status_history` AS SELECT
 1 AS `history_id`,
  1 AS `station_id`,
  1 AS `station_name`,
  1 AS `line_id`,
  1 AS `status_type_id`,
  1 AS `status_name`,
  1 AS `status_message`,
  1 AS `last_updated`,
  1 AS `updated_by` */;
SET character_set_client = @saved_cs_client;

--
-- Temporary table structure for view `vw_stations_with_jsdata`
--

DROP TABLE IF EXISTS `vw_stations_with_jsdata`;
/*!50001 DROP VIEW IF EXISTS `vw_stations_with_jsdata`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8mb4;
/*!50001 CREATE VIEW `vw_stations_with_jsdata` AS SELECT
 1 AS `station_id`,
  1 AS `line_id`,
  1 AS `station_code`,
  1 AS `station_name`,
  1 AS `effective_display_name`,
  1 AS `status_type_id`,
  1 AS `status_name`,
  1 AS `status_message`,
  1 AS `expected_resolution_time`,
  1 AS `is_planned`,
  1 AS `impact_level`,
  1 AS `access_details`,
  1 AS `transports`,
  1 AS `services`,
  1 AS `accessibility`,
  1 AS `commerce`,
  1 AS `amenities`,
  1 AS `image_url`,
  1 AS `line_color` */;
SET character_set_client = @saved_cs_client;

--
-- Final view structure for view `vw_lines_with_jsdata`
--

/*!50001 DROP VIEW IF EXISTS `vw_lines_with_jsdata`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb3 */;
/*!50001 SET character_set_results     = utf8mb3 */;
/*!50001 SET collation_connection      = utf8mb3_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `vw_lines_with_jsdata` AS select `ml`.`line_id` AS `line_id`,`ml`.`line_name` AS `line_name`,`ml`.`line_color` AS `line_color`,`ml`.`display_order` AS `display_order`,`ml`.`line_description` AS `line_description`,`ml`.`opening_date` AS `opening_date`,`ml`.`total_stations` AS `total_stations`,`ml`.`total_length_km` AS `total_length_km`,`ml`.`avg_daily_ridership` AS `avg_daily_ridership`,`ml`.`operating_hours_start` AS `operating_hours_start`,`ml`.`operating_hours_end` AS `operating_hours_end`,`ml`.`created_at` AS `created_at`,`ml`.`updated_at` AS `updated_at`,`ml`.`display_name` AS `display_name`,`ml`.`fleet_data` AS `fleet_data`,`ml`.`status_code` AS `status_code`,`ml`.`status_message` AS `status_message`,`ml`.`app_message` AS `app_message`,`ml`.`infrastructure` AS `infrastructure`,coalesce(`ml`.`status_code`,`sm`.`js_code`) AS `effective_status_code`,coalesce(`ml`.`status_message`,`ost`.`status_description`) AS `effective_status_message`,json_unquote(json_extract(`ml`.`infrastructure`,'$.name')) AS `infrastructure_data` from ((`metro_lines` `ml` left join `js_status_mapping` `sm` on(`ml`.`status_code` = `sm`.`js_code`)) left join `operational_status_types` `ost` on(`sm`.`status_type_id` = `ost`.`status_type_id`)) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `vw_station_status_history`
--

/*!50001 DROP VIEW IF EXISTS `vw_station_status_history`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb3 */;
/*!50001 SET character_set_results     = utf8mb3 */;
/*!50001 SET collation_connection      = utf8mb3_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `vw_station_status_history` AS select `h`.`history_id` AS `history_id`,`s`.`station_id` AS `station_id`,`s`.`station_name` AS `station_name`,`s`.`line_id` AS `line_id`,`t`.`status_type_id` AS `status_type_id`,`t`.`status_name` AS `status_name`,`h`.`status_message` AS `status_message`,`h`.`last_updated` AS `last_updated`,`h`.`updated_by` AS `updated_by` from ((`station_status_history` `h` join `metro_stations` `s` on(`h`.`station_id` = `s`.`station_id`)) join `operational_status_types` `t` on(`h`.`status_type_id` = `t`.`status_type_id`)) order by `h`.`last_updated` desc */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `vw_stations_with_jsdata`
--

/*!50001 DROP VIEW IF EXISTS `vw_stations_with_jsdata`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb3 */;
/*!50001 SET character_set_results     = utf8mb3 */;
/*!50001 SET collation_connection      = utf8mb3_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `vw_stations_with_jsdata` AS select `ms`.`station_id` AS `station_id`,`ms`.`line_id` AS `line_id`,`ms`.`station_code` AS `station_code`,`ms`.`station_name` AS `station_name`,coalesce(`ms`.`display_name`,`ms`.`station_name`) AS `effective_display_name`,`ss`.`status_type_id` AS `status_type_id`,`ost`.`status_name` AS `status_name`,`ss`.`status_message` AS `status_message`,`ss`.`expected_resolution_time` AS `expected_resolution_time`,`ss`.`is_planned` AS `is_planned`,`ss`.`impact_level` AS `impact_level`,`ms`.`access_details` AS `access_details`,`ms`.`transports` AS `transports`,`ms`.`services` AS `services`,`ms`.`accessibility` AS `accessibility`,`ms`.`commerce` AS `commerce`,`ms`.`amenities` AS `amenities`,`ms`.`image_url` AS `image_url`,`ml`.`line_color` AS `line_color` from (((`metro_stations` `ms` left join `station_status` `ss` on(`ms`.`station_id` = `ss`.`station_id`)) left join `operational_status_types` `ost` on(`ss`.`status_type_id` = `ost`.`status_type_id`)) left join `metro_lines` `ml` on(`ms`.`line_id` = `ml`.`line_id`)) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-08-13 20:13:32
