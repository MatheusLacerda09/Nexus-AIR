set pages 999 lines 200 feedback off
col EVENT for a60
select * from (
  select event,
         sum(total_waits)                      as total_waits,
         round(sum(time_waited_micro)/1000000) as tempo_total_seg
    from gv$system_event
   where wait_class <> 'Idle'
   group by event
   order by 2 desc)
 where rownum <= 10
/
exit
