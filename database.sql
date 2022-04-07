-- phpMyAdmin SQL Dump
-- version 4.9.4
-- https://www.phpmyadmin.net/
--
-- Anamakine: localhost
-- Üretim Zamanı: 07 Nis 2022, 10:17:55
-- Sunucu sürümü: 8.0.28
-- PHP Sürümü: 5.6.40-57+ubuntu18.04.1+deb.sury.org+1

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Veritabanı: `nft`
--

-- --------------------------------------------------------

--
-- Tablo için tablo yapısı `collections`
--

CREATE TABLE `collections` (
  `id` int NOT NULL,
  `token_id` tinytext NOT NULL,
  `name` text NOT NULL,
  `supply` bigint NOT NULL,
  `version` int NOT NULL,
  `metadata` json DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

-- --------------------------------------------------------

--
-- Tablo için tablo yapısı `orders`
--

CREATE TABLE `orders` (
  `id` int NOT NULL,
  `token_id` tinytext CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL,
  `nft_id` int NOT NULL,
  `metadata` json DEFAULT NULL,
  `hash` tinytext CHARACTER SET utf8 COLLATE utf8_general_ci,
  `nout` int NOT NULL,
  `new_hash` tinytext CHARACTER SET utf8 COLLATE utf8_general_ci,
  `nft_order` json NOT NULL,
  `verification_date` datetime NOT NULL,
  `invalidated_date` datetime DEFAULT NULL,
  `is_valid` tinyint(1) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

-- --------------------------------------------------------

--
-- Tablo için tablo yapısı `proofs`
--

CREATE TABLE `proofs` (
  `id` int NOT NULL,
  `project_id` int DEFAULT NULL,
  `private_address` tinytext CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL,
  `token_id` tinytext CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL,
  `nft_id` int NOT NULL,
  `hash` tinytext CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL,
  `nout` int NOT NULL,
  `new_hash` tinytext CHARACTER SET utf8 COLLATE utf8_general_ci,
  `verification_date` datetime DEFAULT NULL,
  `invalidated_date` datetime DEFAULT NULL,
  `is_valid` tinyint(1) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

--
-- Dökümü yapılmış tablolar için indeksler
--

--
-- Tablo için indeksler `collections`
--
ALTER TABLE `collections`
  ADD PRIMARY KEY (`id`);

--
-- Tablo için indeksler `orders`
--
ALTER TABLE `orders`
  ADD PRIMARY KEY (`id`);

--
-- Tablo için indeksler `proofs`
--
ALTER TABLE `proofs`
  ADD PRIMARY KEY (`id`);

--
-- Dökümü yapılmış tablolar için AUTO_INCREMENT değeri
--

--
-- Tablo için AUTO_INCREMENT değeri `collections`
--
ALTER TABLE `collections`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- Tablo için AUTO_INCREMENT değeri `orders`
--
ALTER TABLE `orders`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- Tablo için AUTO_INCREMENT değeri `proofs`
--
ALTER TABLE `proofs`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
