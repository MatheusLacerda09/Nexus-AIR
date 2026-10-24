set pages 9999 lines 200 feedback off
col table_name for a30
col owner for a20
with excl as (select username from dba_users where oracle_maintained = 'Y'),
tab as (
  select owner, segment_name table_name, sum(bytes) b
    from dba_segments
   where segment_type in ('TABLE','TABLE PARTITION','TABLE SUBPARTITION')
     and owner not in (select username from excl)
   group by owner, segment_name),
idx as (
  select i.table_owner owner, i.table_name, sum(s.bytes) b
    from dba_indexes i
    join dba_segments s on s.owner = i.owner and s.segment_name = i.index_name
   where i.table_owner not in (select username from excl)
   group by i.table_owner, i.table_name),
lob as (
  select l.owner, l.table_name, sum(s.bytes) b
    from dba_lobs l
    join dba_segments s on s.owner = l.owner
                       and s.segment_name in (l.segment_name, l.index_name)
   where l.owner not in (select username from excl)
   group by l.owner, l.table_name)
select * from (
  select t.table_name,
         nvl(d.num_rows,0)                                          num_rows,
         round(t.b/1024/1024/1024,2)                                data_gb,
         round(nvl(i.b,0)/1024/1024/1024,2)                         indx_gb,
         round(nvl(l.b,0)/1024/1024/1024,2)                         lob_gb,
         round((t.b+nvl(i.b,0)+nvl(l.b,0))/1024/1024/1024,2)        total_gb,
         t.owner
    from tab t
    left join idx i on i.owner = t.owner and i.table_name = t.table_name
    left join lob l on l.owner = t.owner and l.table_name = t.table_name
    left join dba_tables d on d.owner = t.owner and d.table_name = t.table_name
   order by (t.b+nvl(i.b,0)+nvl(l.b,0)) desc)
 where rownum <= 15
/
exit
