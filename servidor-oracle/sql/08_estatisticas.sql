set lines 200 pages 999 feedback off
col owner for a30
col ultima_analise for a20
select owner,
       nvl(to_char(max(last_analyzed),'DD/MM/YYYY HH24:MI'),'Sem estatisticas') as ultima_analise
  from dba_tables
 where owner not in (select username from dba_users where oracle_maintained = 'Y')
   and owner not in ('ANONYMOUS','APEX_040200','APEX_PUBLIC_USER','BI','DIP','DVF','EXFSYS',
                     'FLOWS_FILES','HR','IX','MDDATA','OE','ORDPLUGINS','PM','SCOTT','SH',
                     'SI_INFORMTN_SCHEMA','SPATIAL_CSW_ADMIN_USR','SPATIAL_WFS_ADMIN_USR',
                     'A00200','BACKUP')
   -- Acrescente aqui outros schemas que voce nao quer ver no relatorio:
   -- and owner not in ('MEU_SCHEMA_1','MEU_SCHEMA_2')
 group by owner
 order by max(last_analyzed) desc nulls last
/
exit
