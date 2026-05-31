-- ========================================================
-- ESTRUCTURA COMPLETA: SCRIPT REY DE LA PISTA / OPTIMIZADO
-- ========================================================
CREATE DATABASE IF NOT EXISTS friendcup CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE friendcup;
-- 3. TABLA DE JUGADORES 
CREATE TABLE players (
    IDPlayer INT AUTO_INCREMENT PRIMARY KEY,
    NamePlayer VARCHAR(100) NOT NULL,
    Email VARCHAR(100) UNIQUE NOT NULL,
    Password VARCHAR(255) NOT NULL
) ENGINE=InnoDB;
-- 4. TABLA DE LIGAS
CREATE TABLE leagues (
    IDLeague INT AUTO_INCREMENT PRIMARY KEY,
    NameLeague VARCHAR(100) NOT NULL,
    IDSport INT NOT NULL,
    InvitationCode VARCHAR(10) UNIQUE NOT NULL,
    NameSport VARCHAR(50) NOT NULL,
    PlayerTeam INT NOT NULL,
    Estado ENUM('Abierta', 'En Curso', 'Finalizada') DEFAULT 'Abierta'
) ENGINE=InnoDB;
-- 5. TABLA INTERMEDIA DE INSCRIPCIONES (CLASIFICACIÓN INDIVIDUAL)
CREATE TABLE leaguePlayer (
    IDLeague INT NOT NULL,
    IDPlayer INT NOT NULL,
    Points INT DEFAULT 0,
    Matches INT DEFAULT 0,
    Victories INT DEFAULT 0,
    Defeats INT DEFAULT 0,
    PRIMARY KEY (IDLeague, IDPlayer),
    CONSTRAINT FK_Inscripcion_Liga FOREIGN KEY (IDLeague)
        REFERENCES leagues(IDLeague) ON DELETE CASCADE,
    CONSTRAINT FK_Inscripcion_Jugador FOREIGN KEY (IDPlayer)
        REFERENCES players(IDPlayer) ON DELETE CASCADE
) ENGINE=InnoDB;
-- 6. TABLA DE PARTIDOS (FORMATO APLANADO)
CREATE TABLE matches (
    IDMatch INT AUTO_INCREMENT PRIMARY KEY,
    IDLeague INT NOT NULL,
    DayTrip INT NOT NULL,
    JugadoresLocal VARCHAR(255) NOT NULL,
    JugadoresVisitante VARCHAR(255) NOT NULL,
    ResultadoLocal INT DEFAULT NULL,
    ResultadoVisitante INT DEFAULT NULL,
    Estado ENUM('Pendiente', 'Jugado') DEFAULT 'Pendiente',
    Winner BOOLEAN DEFAULT NULL,
    CONSTRAINT FK_Partido_Liga FOREIGN KEY (IDLeague)
        REFERENCES leagues(IDLeague) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE matchPlayer (
    IDMatch INT NOT NULL,
    IDPlayer INT NOT NULL,
    Bando ENUM('Local', 'Visitante') NOT NULL,
    PRIMARY KEY (IDMatch, IDPlayer),
    CONSTRAINT FK_Alineacion_Partido FOREIGN KEY (IDMatch)
        REFERENCES matches(IDMatch) ON DELETE CASCADE,
    CONSTRAINT FK_Alineacion_Jugador FOREIGN KEY (IDPlayer)
        REFERENCES players(IDPlayer) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ÍNDICES PARA ROCKET-SPEED EN CONSULTAS SEMANALES Y FILTRADOS
ALTER TABLE matches ADD INDEX idx_matches_league_day (IDLeague, DayTrip);
ALTER TABLE matchPlayer ADD INDEX idx_lineup_team (IDMatch, Bando);



DELIMITER //

CREATE PROCEDURE CrearBotsComodin()
BEGIN
    DECLARE i INT DEFAULT 1;
    WHILE i <= 50 DO
        -- Solo inserta el bot si no existe ya uno con ese nombre exacto
        IF NOT EXISTS (SELECT 1 FROM players WHERE NamePlayer = CONCAT('Bot Comodín ', i)) THEN
            INSERT INTO players (NamePlayer, Email, Password) 
            VALUES (CONCAT('Bot Comodín ', i), NULL, NULL);
        END IF;
        SET i = i + 1;
    END WHILE;
END //

DELIMITER ;

-- Ejecutamos el procedimiento para crear los 50 bots
CALL CrearBotsComodin();

-- Borramos el procedimiento para no dejar basura en la BBDD
DROP PROCEDURE CrearBotsComodin;