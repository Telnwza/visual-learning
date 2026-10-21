library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
entity ss_range_check is
  generic (WIDTH:positive range 1 to 64:=8; SIGNED_MODE:natural range 0 to 1:=0;
    INCLUDE_MIN:natural range 0 to 1:=1; INCLUDE_MAX:natural range 0 to 1:=1);
  port (d,minimum,maximum:in std_logic_vector(WIDTH-1 downto 0); within,bounds_valid:out std_logic);
end entity;
architecture rtl of ss_range_check is begin
  process(d,minimum,maximum)
    variable ordered,above,below:boolean;
  begin
    if SIGNED_MODE=1 then
      ordered:=signed(minimum)<=signed(maximum); above:=signed(d)>signed(minimum); below:=signed(d)<signed(maximum);
    else
      ordered:=unsigned(minimum)<=unsigned(maximum); above:=unsigned(d)>unsigned(minimum); below:=unsigned(d)<unsigned(maximum);
    end if;
    above:=above or (INCLUDE_MIN=1 and d=minimum); below:=below or (INCLUDE_MAX=1 and d=maximum);
    within<='0'; bounds_valid<='0';
    if ordered then bounds_valid<='1'; if above and below then within<='1'; end if; end if;
  end process;
end architecture;
