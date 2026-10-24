set lines 300 pages 200 feedback off
col TABLESPACE format a30
col DATAFILE   format a70
col AUTO       format a5
column TAM_TOTAL_MB for 999,999,999,999.99
select tablespace_name as TABLESPACE,
       file_name       as DATAFILE,
       autoextensible  as AUTO,
       maxbytes/1024/1024 as TAM_TOTAL_MB
  from dba_data_files
 order by 1,2
/
exit
