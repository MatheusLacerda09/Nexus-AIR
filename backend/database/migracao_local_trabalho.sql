-- Rode UMA vez no seu MySQL, se preferir aplicar à mão (o backend já faz
-- isso sozinho ao subir). Corrige: "Unknown column 'local_trabalho_id'"
-- e "Table 'nexus_air.empresa' doesn't exist".
CREATE DATABASE IF NOT EXISTS nexus_air;
USE nexus_air;

CREATE TABLE IF NOT EXISTS empresa (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    cnpjs VARCHAR(14) NOT NULL UNIQUE,
    endereco VARCHAR(200) NOT NULL,
    telefone VARCHAR(20) NOT NULL,
    email VARCHAR(200) NOT NULL UNIQUE,
    ceos VARCHAR(200),
    setores VARCHAR(200),
    departamentos VARCHAR(200)
);

CREATE TABLE IF NOT EXISTS local_trabalho (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(150) NOT NULL UNIQUE,
    cnpj VARCHAR(20)
);

-- Se der "Duplicate column name", a coluna já existe: ignore este comando.
ALTER TABLE usuario ADD COLUMN local_trabalho_id INT;

-- Se der "Duplicate ... constraint", já existe: ignore.
ALTER TABLE usuario ADD CONSTRAINT fk_usuario_local_trabalho
    FOREIGN KEY (local_trabalho_id) REFERENCES local_trabalho(id)
    ON DELETE SET NULL;
