library ieee;
use ieee.std_logic_1164.all;
entity ss_clock_divider is
  generic (DIVISOR:positive range 2 to 2147483647:=50000000);
  port (clk,rst,en:in std_logic; clk_out,tick:out std_logic);
end entity;
architecture rtl of ss_clock_divider is
  constant LOW_CYCLES:positive:=DIVISOR-DIVISOR/2;
  signal count:natural range 0 to DIVISOR-1:=0;
  signal level,event_tick:std_logic:='0';
begin
  clk_out <= level; tick <= event_tick;
  process(clk) begin
    if rising_edge(clk) then
      event_tick<='0';
      if rst='1' then count<=0; level<='0';
      elsif en='1' then
        if count=LOW_CYCLES-1 then level<='1'; end if;
        if count=DIVISOR-1 then count<=0; level<='0'; event_tick<='1';
        else count<=count+1; end if;
      end if;
    end if;
  end process;
end architecture;
