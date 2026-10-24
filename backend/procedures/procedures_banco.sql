USE nexus_air;

DELIMITER $$

CREATE PROCEDURE sp_obter_alertas_detalhados(IN p_tipo_alerta VARCHAR(100))
BEGIN
    SELECT 
        a.id AS alerta_id,
        a.tipo_alerta,
        a.status_alerta,
        a.horario,
        a.origem,
        mv.hostname AS maquina_hostname,
        mv.ip AS maquina_ip,
        mv.consumo_cpu,
        mv.consumo_ram,
        b.ip AS banco_ip,
        b.consumo_memoria AS banco_memoria
    FROM alerta a
    INNER JOIN maquinas_virtuais mv ON a.ip_maquina = mv.ip
    INNER JOIN banco b ON a.ip_banco = b.ip
    WHERE (p_tipo_alerta IS NULL OR a.tipo_alerta LIKE CONCAT('%', p_tipo_alerta, '%'))
    ORDER BY a.horario DESC;
END $$

CREATE PROCEDURE sp_relatorio_resolucao_suporte(IN p_id_suporte INT)
BEGIN
    SELECT 
        ra.id AS relatorio_id,
        ra.nome_empresa,
        ra.tipo_alerta,
        ra.resolucao_alerta,
        ra.horario_suporte,
        us.nome AS agente_suporte,
        us.departamento AS suporte_departamento,
        mv.hostname AS maquina_afetada
    FROM relatorio_alerta ra
    INNER JOIN usuario_suporte us ON ra.id_usuario_suporte = us.id
    INNER JOIN maquinas_virtuais mv ON ra.ip_maquina = mv.ip
    WHERE (p_id_suporte IS NULL OR ra.id_usuario_suporte = p_id_suporte)
    ORDER BY ra.horario_suporte DESC;
END $$

CREATE PROCEDURE sp_maquinas_alto_consumo(IN p_cpu_limite DECIMAL(5,2))
BEGIN
    SELECT 
        mv.id,
        mv.hostname,
        mv.ip,
        mv.consumo_cpu,
        mv.consumo_ram,
        COUNT(a.id) AS total_alertas
    FROM maquinas_virtuais mv
    LEFT JOIN alerta a ON mv.ip = a.ip_maquina
    WHERE mv.consumo_cpu >= p_cpu_limite
    GROUP BY mv.id, mv.hostname, mv.ip, mv.consumo_cpu, mv.consumo_ram
    ORDER BY mv.consumo_cpu DESC;
END $$

DELIMITER ;
