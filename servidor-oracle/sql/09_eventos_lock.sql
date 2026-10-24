set pages 5000 lines 200 feedback off
col TIPO for a6
col DESCRICAO for a110 trunc
select count(*) as QUANTIDADE,
       l.type   as TIPO,
       nvl(t.name || ' - ' || t.description, l.type) as DESCRICAO
  from gv$lock l
  left join v$lock_type t on t.type = l.type
 group by l.type, t.name, t.description
 order by 1 desc
/
exit
