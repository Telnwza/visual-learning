library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
entity ss_add_sub is
  generic (WIDTH:positive range 1 to 64:=8; SUBTRACT:natural range 0 to 1:=0; SIGNED_MODE:natural range 0 to 1:=0);
  port (a,b:in std_logic_vector(WIDTH-1 downto 0); cin:in std_logic;
    y:out std_logic_vector(WIDTH-1 downto 0); carry,borrow,overflow,zero,negative:out std_logic);
end entity;
architecture rtl of ss_add_sub is begin
  process(a,b,cin)
    variable u:unsigned(WIDTH downto 0);
    variable s:signed(WIDTH+1 downto 0);
    variable result:std_logic_vector(WIDTH-1 downto 0);
  begin
    carry<='0'; borrow<='0'; overflow<='0'; negative<='0';
    if SUBTRACT=0 then
      u:=resize(unsigned(a),WIDTH+1)+resize(unsigned(b),WIDTH+1);
      s:=resize(signed(a),WIDTH+2)+resize(signed(b),WIDTH+2);
      if cin='1' then u:=u+1; s:=s+1; end if;
      carry<=u(WIDTH);
    else
      u:=resize(unsigned(a),WIDTH+1)-resize(unsigned(b),WIDTH+1);
      s:=resize(signed(a),WIDTH+2)-resize(signed(b),WIDTH+2);
      if cin='1' then u:=u-1; s:=s-1; end if;
      borrow<=u(WIDTH);
    end if;
    result:=std_logic_vector(u(WIDTH-1 downto 0)); y<=result;
    if SIGNED_MODE=1 then
      negative<=result(WIDTH-1);
      if s/=resize(signed(result),WIDTH+2) then overflow<='1'; end if;
    end if;
    zero<='0'; if unsigned(result)=0 then zero<='1'; end if;
  end process;
end architecture;
