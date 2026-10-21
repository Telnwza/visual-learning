library ieee;
use ieee.std_logic_1164.all;
entity ss_input_debounce is
  generic (STABLE_CYCLES:positive range 1 to 2147483647:=500000; CLOCK_HZ:positive range 1 to 2147483647:=50000000; ACTIVE_LOW:natural range 0 to 1:=0);
  port (clk,rst,d:in std_logic; q,pressed,released:out std_logic);
end entity;
architecture rtl of ss_input_debounce is
  signal level:std_logic:='0';
  signal sample:std_logic;
  signal count:natural range 0 to STABLE_CYCLES-1:=0;
  signal press_event,release_event:std_logic:='0';
begin
  sample <= not d when ACTIVE_LOW=1 else d;
  q <= level; pressed <= press_event; released <= release_event;
  process(clk) begin
    if rising_edge(clk) then
      press_event <= '0'; release_event <= '0';
      if rst='1' then level <= '0'; count <= 0;
      elsif sample=level then count <= 0;
      elsif sample='0' or sample='1' then
        if count=STABLE_CYCLES-1 then
          level <= sample; count <= 0;
          if sample='1' then press_event <= '1'; else release_event <= '1'; end if;
        else count <= count+1;
        end if;
      else count <= 0;
      end if;
    end if;
  end process;
end architecture;
