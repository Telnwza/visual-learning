library ieee;
use ieee.std_logic_1164.all;
entity ss_button_input is
  generic (STAGES:positive range 2 to 64:=2;
    STABLE_CYCLES:positive range 1 to 2147483647:=500000;
    CLOCK_HZ:positive range 1 to 2147483647:=50000000;
    ACTIVE_LOW:natural range 0 to 1:=0; MODE:natural range 0 to 2:=0);
  port (clk,rst,d:in std_logic; q,pressed,released,pulse:out std_logic);
end entity;
architecture rtl of ss_button_input is
  signal sampled,level:std_logic;
begin
  synchronizer:entity work.ss_input_sync generic map(STAGES=>STAGES,RESET_LEVEL=>ACTIVE_LOW)
    port map(clk=>clk,rst=>rst,d=>d,q=>sampled);
  debounce:entity work.ss_input_debounce generic map(STABLE_CYCLES=>STABLE_CYCLES,CLOCK_HZ=>CLOCK_HZ,ACTIVE_LOW=>ACTIVE_LOW)
    port map(clk=>clk,rst=>rst,d=>sampled,q=>level,pressed=>open,released=>open);
  edges:entity work.ss_input_edge generic map(MODE=>MODE)
    port map(clk=>clk,rst=>rst,d=>level,rise=>pressed,fall=>released,pulse=>pulse);
  q<=level;
end architecture;
