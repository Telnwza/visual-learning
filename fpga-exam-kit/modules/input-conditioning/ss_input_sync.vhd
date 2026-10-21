library ieee;
use ieee.std_logic_1164.all;
entity ss_input_sync is
  generic (STAGES:positive range 2 to 64:=2; RESET_LEVEL:natural range 0 to 1:=0);
  port (clk,rst,d:in std_logic; q:out std_logic);
end entity;
architecture rtl of ss_input_sync is
  constant levels:std_logic_vector(0 to 1):="01";
  signal pipe:std_logic_vector(STAGES-1 downto 0):=(others=>levels(RESET_LEVEL));
  attribute ASYNC_REG:string;
  attribute ASYNC_REG of pipe:signal is "TRUE";
begin
  q <= pipe(STAGES-1);
  process(clk) begin
    if rising_edge(clk) then
      if rst='1' then pipe <= (others=>levels(RESET_LEVEL));
      else pipe <= pipe(STAGES-2 downto 0) & d;
      end if;
    end if;
  end process;
end architecture;
