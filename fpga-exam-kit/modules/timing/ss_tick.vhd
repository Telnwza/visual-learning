library ieee;
use ieee.std_logic_1164.all;
entity ss_tick is
  generic (DIVISOR:positive range 1 to 2147483647:=50000000);
  port (clk,rst,en:in std_logic; tick:out std_logic);
end entity;
architecture rtl of ss_tick is
  signal count:natural range 0 to DIVISOR-1:=0;
  signal event_tick:std_logic:='0';
begin
  tick <= event_tick;
  process(clk) begin
    if rising_edge(clk) then
      event_tick<='0';
      if rst='1' then count<=0;
      elsif en='1' then
        if count=DIVISOR-1 then count<=0; event_tick<='1';
        else count<=count+1; end if;
      end if;
    end if;
  end process;
end architecture;
