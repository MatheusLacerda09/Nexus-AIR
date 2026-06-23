CREATE DATABASE nexus_air;

USE nexus_air;

CREATE TABLE usuario (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL
);

CREATE TABLE departamento (
    idDepartamento INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    departamento VARCHAR(100),
    cargo VARCHAR(100),
    custo_hora INT
);

CREATE TABLE analista (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    departamento VARCHAR(100),
    cargo VARCHAR(100),
    custo_hora INT,
    idDepartamento INT,
    FOREIGN KEY (idDepartamento)
        REFERENCES Departamento(idDepartamento)
);

CREATE TABLE maquina_virtual (
    id INT AUTO_INCREMENT PRIMARY KEY,
    host_name VARCHAR(100),
    ip VARCHAR(45),
    status_OLVM VARCHAR(50),
    consumo_CPU FLOAT,
    consumo_RAM FLOAT,
    idDepartamento INT,
    FOREIGN KEY (idDepartamento)
        REFERENCES Departamento(idDepartamento)
);

CREATE TABLE template_relatorio (
    id INT AUTO_INCREMENT PRIMARY KEY,
    titulo VARCHAR(100),
    SQL_Query TEXT,
    tempo_manual_estimado INT,
    layout_config FLOAT,
    idAnalista INT,
    FOREIGN KEY (idAnalista)
        REFERENCES Analista(id)
);

CREATE TABLE execucao_job (
    id INT AUTO_INCREMENT PRIMARY KEY,
    timestamp DATETIME,
    status BOOLEAN,
    log_erro TEXT,
    VM_relacionada VARCHAR(100),
    idTemplate INT,
    idAnalista INT,
    idMaquina INT,
    FOREIGN KEY (idTemplate)
        REFERENCES Template_Relatorio(id),
    FOREIGN KEY (idAnalista)
        REFERENCES Analista(id),
    FOREIGN KEY (idMaquina)
        REFERENCES Maquina_Virtual(id)
);

CREATE TABLE metrica_roi (
    id INT AUTO_INCREMENT PRIMARY KEY,
    horas_recuperadas VARCHAR(50),
    valor_monetario_salvo INT,
    idExecucaoJob INT,
    idMaquina INT,
    FOREIGN KEY (idExecucaoJob)
        REFERENCES Execucao_Job(id),
    FOREIGN KEY (idMaquina)
        REFERENCES Maquina_Virtual(id)
);
