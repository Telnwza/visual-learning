library ieee;
use ieee.std_logic_1164.all;
entity ss_adc_sample_valid is
  generic (WIDTH:positive range 1 to 64:=12);
  port (clk,clear_valid,cs:in std_logic; sample_in:in std_logic_vector(WIDTH-1 downto 0);
    sample:out std_logic_vector(WIDTH-1 downto 0); sample_valid,valid:out std_logic);
end entity;
architecture rtl of ss_adc_sample_valid is
  signal seen_high:std_logic:='0'; signal result:std_logic_vector(WIDTH-1 downto 0):=(others=>'0');
  signal result_valid,event:std_logic:='0';
begin
  sample<=result; valid<=result_valid; sample_valid<=event;
  process(clk)
  begin
    if rising_edge(clk) then
      event<='0';
      if clear_valid='1' then seen_high<='0'; result<=(others=>'0'); result_valid<='0';
      elsif cs='1' then seen_high<='1';
      elsif cs='0' and seen_high='1' then seen_high<='0'; result<=sample_in; event<='1'; result_valid<='1'; end if;
    end if;
  end process;
end architecture;
