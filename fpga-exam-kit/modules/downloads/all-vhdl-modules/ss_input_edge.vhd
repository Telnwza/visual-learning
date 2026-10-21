library ieee;
use ieee.std_logic_1164.all;
entity ss_input_edge is
  generic (MODE:natural range 0 to 2:=0);
  port (clk,rst,d:in std_logic; pulse,rise,fall:out std_logic);
end entity;
architecture rtl of ss_input_edge is
  signal previous,armed:std_logic:='0';
  signal event_selected,event_rise,event_fall:std_logic:='0';
begin
  pulse <= event_selected; rise <= event_rise; fall <= event_fall;
  process(clk) begin
    if rising_edge(clk) then
      event_selected <= '0'; event_rise <= '0'; event_fall <= '0';
      if rst='1' then previous <= '0'; armed <= '0';
      elsif d='0' or d='1' then
        if armed='1' then
          if previous='0' and d='1' then
            event_rise <= '1'; if MODE=0 or MODE=2 then event_selected <= '1'; end if;
          elsif previous='1' and d='0' then
            event_fall <= '1'; if MODE=1 or MODE=2 then event_selected <= '1'; end if;
          end if;
        end if;
        previous <= d; armed <= '1';
      end if;
    end if;
  end process;
end architecture;
