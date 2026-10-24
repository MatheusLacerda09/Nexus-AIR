set lines 300 pages 999 feedback off
col STATUS for a25
col TEMPO_H format 999.99
-- Diferente da secao 11: mostra TODOS os status (inclui FAILED / RUNNING / COMPLETED WITH ERRORS).
select input_type as TIPO_BACKUP,
       status,
       to_char(start_time,'DD/MM/YYYY HH24:MI:SS') as HORA_INICIO,
       to_char(end_time,'DD/MM/YYYY HH24:MI:SS')   as HORA_TERMINO,
       elapsed_seconds/3600 as TEMPO_H,
       round(output_bytes/1024/1024/1024,2) as TAMANHO_BACKUP_GB
  from v$rman_backup_job_details
 where start_time > sysdate-1
 order by start_time
/
exit
