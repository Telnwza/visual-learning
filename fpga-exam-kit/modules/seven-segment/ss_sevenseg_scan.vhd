library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
entity ss_sevenseg_scan is
  generic (DIGITS:positive range 1 to 16:=4; SLOT_CYCLES:positive range 3 to 2147483647:=50000;
    SEG_ACTIVE_LOW:natural range 0 to 1:=0; DIGIT_ACTIVE_LOW:natural range 0 to 1:=0);
  port (clk,rst,en:in std_logic; patterns_lo,patterns_hi:in std_logic_vector(63 downto 0);
    segment:out std_logic_vector(6 downto 0); dp:out std_logic; digit:out std_logic_vector(DIGITS-1 downto 0);
    index:out std_logic_vector(3 downto 0); slot_tick,frame_tick:out std_logic);
end entity;
architecture rtl of ss_sevenseg_scan is
  signal frame:std_logic_vector(127 downto 0):=(others=>'0');
  signal pattern:std_logic_vector(7 downto 0):=(others=>'0');
  signal running:std_logic:='0';
  signal cell:natural range 0 to DIGITS-1:=0;
  signal phase:natural range 0 to SLOT_CYCLES-1:=0;
begin
  index<=std_logic_vector(to_unsigned(cell,4));
  process(pattern,running,cell,phase,en,rst)
    variable common:std_logic_vector(DIGITS-1 downto 0); variable p:std_logic_vector(7 downto 0);
  begin
    common:=(others=>'0'); p:=(others=>'0');
    if running='1' and en='1' and rst='0' then
      p:=pattern;
      if phase>=2 then common(cell):='1'; end if;
    end if;
    if SEG_ACTIVE_LOW=1 then segment<=not p(6 downto 0); dp<=not p(7); else segment<=p(6 downto 0); dp<=p(7); end if;
    if DIGIT_ACTIVE_LOW=1 then digit<=not common; else digit<=common; end if;
  end process;
  process(clk)
  begin
    if rising_edge(clk) then
      slot_tick<='0'; frame_tick<='0';
      if rst='1' or en/='1' then running<='0'; cell<=0; phase<=0; pattern<=(others=>'0');
      elsif running='0' then
        frame<=patterns_hi & patterns_lo; running<='1'; cell<=0; phase<=0; slot_tick<='1'; frame_tick<='1';
      elsif phase=SLOT_CYCLES-1 then
        phase<=0; slot_tick<='1';
        if cell=DIGITS-1 then cell<=0; frame<=patterns_hi & patterns_lo; frame_tick<='1'; else cell<=cell+1; end if;
      else
        if phase=0 then pattern<=frame(8*cell+7 downto 8*cell); end if;
        phase<=phase+1;
      end if;
    end if;
  end process;
end architecture;
