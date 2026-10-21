library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
entity ss_counter_skip is
  generic (WIDTH:positive range 1 to 64:=8; WRAP:natural range 0 to 1:=1;
    SKIP_COUNT:natural range 0 to 4:=0);
  port (clk,rst,en,load,down:in std_logic;
    minimum,maximum,load_value:in std_logic_vector(WIDTH-1 downto 0);
    skip_0,skip_1,skip_2,skip_3:in std_logic_vector(WIDTH-1 downto 0);
    q:out std_logic_vector(WIDTH-1 downto 0);
    valid,wrapped,blocked:out std_logic);
end entity;
architecture rtl of ss_counter_skip is
  type value_list is array(0 to 3) of unsigned(WIDTH-1 downto 0);
  type search_result is record
    value:unsigned(WIDTH-1 downto 0);
    found,crossed:boolean;
  end record;
  signal exclusions:value_list;
  signal value:unsigned(WIDTH-1 downto 0):=(others=>'0');
  signal wrap_event,blocked_event:std_logic:='0';
  function excluded(v:unsigned; values:value_list) return boolean is
  begin
    for i in 0 to SKIP_COUNT-1 loop if v=values(i) then return true; end if; end loop;
    return false;
  end function;
  function search(first,lo,hi:unsigned; values:value_list; backwards,can_wrap:boolean) return search_result is
    variable result:search_result;
    variable candidate:unsigned(WIDTH-1 downto 0):=first;
  begin
    result.value:=first; result.found:=false; result.crossed:=false;
    -- Four exclusions can block at most four distinct candidates.
    for attempt in 0 to 4 loop
      if not excluded(candidate,values) then result.value:=candidate; result.found:=true; exit; end if;
      if (not backwards and candidate=hi) or (backwards and candidate=lo) then
        if not can_wrap then exit; end if;
        result.crossed:=true;
        candidate:=lo; if backwards then candidate:=hi; end if;
      elsif backwards then candidate:=candidate-1;
      else candidate:=candidate+1; end if;
    end loop;
    return result;
  end function;
begin
  exclusions <= (unsigned(skip_0),unsigned(skip_1),unsigned(skip_2),unsigned(skip_3));
  q <= std_logic_vector(value); wrapped <= wrap_event; blocked <= blocked_event;
  valid <= '1' when unsigned(minimum)<=unsigned(maximum) and value>=unsigned(minimum) and
    value<=unsigned(maximum) and not excluded(value,exclusions) else '0';
  process(clk)
    variable lo,hi,first,candidate:unsigned(WIDTH-1 downto 0);
    variable result:search_result;
    variable crossing,can_search:boolean;
  begin
    if rising_edge(clk) then
      lo:=unsigned(minimum); hi:=unsigned(maximum);
      first:=lo; if down='1' then first:=hi; end if;
      wrap_event<='0';
      if rst='1' then
        value<=first; blocked_event<='1';
        if lo<=hi then
          result:=search(first,lo,hi,exclusions,down='1',true);
          if result.found then value<=result.value; blocked_event<='0'; end if;
        end if;
      elsif load='1' or en='1' then
        blocked_event<='1'; crossing:=false; can_search:=lo<=hi; candidate:=first;
        if lo<=hi then
          if load='1' then
            candidate:=unsigned(load_value);
            if candidate<lo then candidate:=lo; elsif candidate>hi then candidate:=hi; end if;
          elsif value>=lo and value<=hi and not excluded(value,exclusions) then
            if (down='0' and value=hi) or (down='1' and value=lo) then
              can_search:=WRAP=1; crossing:=WRAP=1;
            elsif down='1' then candidate:=value-1;
            else candidate:=value+1; end if;
          end if;
          if can_search then
            result:=search(candidate,lo,hi,exclusions,down='1',WRAP=1);
            if result.found then
              value<=result.value; blocked_event<='0';
              if crossing or result.crossed then wrap_event<='1'; end if;
            end if;
          end if;
        end if;
      end if;
    end if;
  end process;
end architecture;
