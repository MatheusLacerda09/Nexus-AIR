CREATE DATABASE EMPRESA_NEXUS_AIR;
USE EMPRESA_NEXUS_AIR;

CREATE TABLE Departamento (
    idDepartamento INT PRIMARY KEY IDENTITY(1,1),
    nome VARCHAR(100) NOT NULL,
    departamento VARCHAR(100),
    cargo VARCHAR(100),
    custo_hora INT
);

CREATE TABLE Analista (
    id INT PRIMARY KEY IDENTITY(1,1),
    nome VARCHAR(100) NOT NULL,
    departamento VARCHAR(100),
    cargo VARCHAR(100),
    custo_hora INT,
    idDepartamento INT,
    CONSTRAINT FK_Analista_Departamento FOREIGN KEY (idDepartamento) REFERENCES Departamento(idDepartamento)
);

CREATE TABLE Template_Relatorio (
    id INT PRIMARY KEY IDENTITY(1,1),
    titulo VARCHAR(150) NOT NULL,
    SQL_Query TEXT NOT NULL,
    tempo_manual_estimado INT,
    layout_config FLOAT,
    id_analista INT,
    CONSTRAINT FK_Template_Analista FOREIGN KEY (id_analista) REFERENCES Analista(id)
);

CREATE TABLE Maquina_Virtual (
    id INT PRIMARY KEY IDENTITY(1,1),
    host_name VARCHAR(100) NOT NULL,
    ip VARCHAR(45) NOT NULL,
    status_OLVM VARCHAR(50),
    Consumo_CPU FLOAT,
    Consumo_RAM FLOAT
);

CREATE TABLE Execucao_Job (
    id INT PRIMARY KEY IDENTITY(1,1),
    timestamp DATETIME NOT NULL,
    status BIT NOT NULL, -- Boolean (0 ou 1)
    log_erro TEXT,
    VM_relacionada VARCHAR(100),
    id_template INT,
    id_analista INT,
    id_vm INT,
    CONSTRAINT FK_Execucao_Template FOREIGN KEY (id_template) REFERENCES Template_Relatorio(id),
    CONSTRAINT FK_Execucao_Analista FOREIGN KEY (id_analista) REFERENCES Analista(id),
    CONSTRAINT FK_Execucao_VM FOREIGN KEY (id_vm) REFERENCES Maquina_Virtual(id)
);

CREATE TABLE Metrica_ROI (
    id INT PRIMARY KEY IDENTITY(1,1),
    horas_recuperadas VARCHAR(50),
    valor_monetario_salvo INT,
    id_execucao INT,
    id_departamento INT,
    id_vm INT,
    CONSTRAINT FK_Metrica_Execucao FOREIGN KEY (id_execucao) REFERENCES Execucao_Job(id),
    CONSTRAINT FK_Metrica_Departamento FOREIGN KEY (id_departamento) REFERENCES Departamento(idDepartamento),
    CONSTRAINT FK_Metrica_VM FOREIGN KEY (id_vm) REFERENCES Maquina_Virtual(id)
);
