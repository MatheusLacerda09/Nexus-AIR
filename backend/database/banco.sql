CREATE DATABASE IF NOT EXISTS nexus_air;

USE nexus_air;

CREATE TABLE IF NOT EXISTS empresa (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    cnpjs VARCHAR(18) NOT NULL,
    endereco VARCHAR(200) NOT NULL,
    telefone VARCHAR(20) NOT NULL,
    email VARCHAR(200) NOT NULL,
    ceos VARCHAR(200),
    setores VARCHAR(200),
    departamentos VARCHAR(200)
);

CREATE TABLE IF NOT EXISTS banco (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ip VARCHAR(15) NOT NULL UNIQUE,
    status_zabbix VARCHAR(50) NOT NULL,
    status_olvm VARCHAR(50) NOT NULL,
    log_erro TEXT,
    consumo_memoria DECIMAL(10,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS maquinas_virtuais (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hostname VARCHAR(100) NOT NULL,
    ip VARCHAR(15) NOT NULL UNIQUE,
    status_olvm VARCHAR(50) NOT NULL,
    consumo_cpu DECIMAL(5,2) NOT NULL,
    consumo_ram DECIMAL(10,2) NOT NULL,
    status_zabbix VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS usuario (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cliente VARCHAR(100) DEFAULT 'Nexus Air',
    nome VARCHAR(100) NOT NULL,
    senha VARCHAR(255) NOT NULL,
    email VARCHAR(200) NOT NULL UNIQUE,
    cargo VARCHAR(100),
    departamento VARCHAR(100),
    setor VARCHAR(100),
    telefone VARCHAR(20),
    cpf VARCHAR(11),
    data_nascimento DATE,
    sexo VARCHAR(20),
    tipo_acesso VARCHAR(50) NOT NULL DEFAULT 'padrao',
    horario_trabalho VARCHAR(100),
    curriculo TEXT,
    data_ferias DATE,
    faltas INT DEFAULT 0,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS usuario_suporte (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    departamento VARCHAR(100) NOT NULL,
    email VARCHAR(200) NOT NULL,
    telefone VARCHAR(20) NOT NULL,
    cpf VARCHAR(11) NOT NULL,
    data_nascimento DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS alerta (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ip_maquina VARCHAR(15) NOT NULL,
    ip_banco VARCHAR(15) NOT NULL,
    tipo_alerta VARCHAR(100) NOT NULL,
    status_alerta VARCHAR(200) NOT NULL,
    contexto VARCHAR(100),
    horario DATETIME NOT NULL,
    origem VARCHAR(50),
    CONSTRAINT fk_alerta_ip_maquina
        FOREIGN KEY (ip_maquina)
        REFERENCES maquinas_virtuais(ip),
    CONSTRAINT fk_alerta_ip_banco
        FOREIGN KEY (ip_banco)
        REFERENCES banco(ip)
);

CREATE TABLE IF NOT EXISTS relatorio_alerta (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ip_maquina VARCHAR(15) NOT NULL,
    ip_banco VARCHAR(15) NOT NULL,
    tipo_alerta VARCHAR(100) NOT NULL,
    status_alerta VARCHAR(200) NOT NULL,
    origem_alerta VARCHAR(80) NOT NULL,
    resolucao_alerta VARCHAR(150) NOT NULL,
    nome_empresa VARCHAR(100) NOT NULL,
    departamento_resolucao VARCHAR(100) NOT NULL,
    id_usuario_suporte INT NOT NULL,
    horario_suporte DATETIME NOT NULL,
    CONSTRAINT fk_relatorio_alerta_ip_maquina
        FOREIGN KEY (ip_maquina)
        REFERENCES maquinas_virtuais(ip),
    CONSTRAINT fk_relatorio_alerta_ip_banco
        FOREIGN KEY (ip_banco)
        REFERENCES banco(ip),
    CONSTRAINT fk_relatorio_alerta_usuario_suporte
        FOREIGN KEY (id_usuario_suporte)
        REFERENCES usuario_suporte(id)
);

CREATE TABLE IF NOT EXISTS relatorio (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ip_maquina VARCHAR(15) NOT NULL,
    ip_banco VARCHAR(15) NOT NULL,
    email_envio VARCHAR(100) NOT NULL,
    consumo_cpu SMALLINT NOT NULL,
    consumo_ram SMALLINT NOT NULL,
    alertas VARCHAR(200),
    assunto VARCHAR(50),
    status VARCHAR(50) NOT NULL,
    cliente VARCHAR(100) NOT NULL,
    problemas_resolvidos VARCHAR(200),
    data_envio DATETIME NOT NULL,
    frequencia VARCHAR(100) NOT NULL,
    CONSTRAINT fk_relatorio_ip_maquina
        FOREIGN KEY (ip_maquina)
        REFERENCES maquinas_virtuais(ip),
    CONSTRAINT fk_relatorio_ip_banco
        FOREIGN KEY (ip_banco)
        REFERENCES banco(ip)
);



