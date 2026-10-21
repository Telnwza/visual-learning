library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
entity ss_clamp is
  generic (WIDTH:positive range 1 to 64:=8; SIGNED_MODE:natural range 0 to 1:=0);
  port (d,minimum,maximum:in std_logic_vector(WIDTH-1 downto 0);
    y:out std_logic_vector(WIDTH-1 downto 0); valid,clipped:out std_logic);
end entity;
architecture rtl of ss_clamp is begin
  process(d,minimum,maximum)
    variable ordered,below,above:boolean;
  begin
    if SIGNED_MODE=1 then
      ordered:=signed(minimum)<=signed(maximum); below:=signed(d)<signed(minimum); above:=signed(d)>signed(maximum);
    else
      ordered:=unsigned(minimum)<=unsigned(maximum); below:=unsigned(d)<unsigned(minimum); above:=unsigned(d)>unsigned(maximum);
    end if;
    y<=d; valid<='0'; clipped<='0';
    if ordered then
      valid<='1';
      if below then y<=minimum; clipped<='1'; elsif above then y<=maximum; clipped<='1'; end if;
    end if;
  end process;
end architecture;
