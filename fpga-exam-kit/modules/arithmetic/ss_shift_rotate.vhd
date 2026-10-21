library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
entity ss_shift_rotate is
  generic (WIDTH:positive range 1 to 64:=8; OPERATION:natural range 0 to 4:=0);
  port (d:in std_logic_vector(WIDTH-1 downto 0); amount:in std_logic_vector(6 downto 0);
    y:out std_logic_vector(WIDTH-1 downto 0); zero:out std_logic);
end entity;
architecture rtl of ss_shift_rotate is begin
  process(d,amount)
    variable result:std_logic_vector(WIDTH-1 downto 0);
    variable count:natural range 0 to 127;
  begin
    result:=(others=>'0'); zero<='0';
    if not is_x(amount) then
      count:=to_integer(unsigned(amount));
      case OPERATION is
        when 0=>result:=std_logic_vector(shift_left(unsigned(d),count));
        when 1=>result:=std_logic_vector(shift_right(unsigned(d),count));
        when 2=>result:=std_logic_vector(shift_right(signed(d),count));
        when 3=>result:=std_logic_vector(rotate_left(unsigned(d),count));
        when others=>result:=std_logic_vector(rotate_right(unsigned(d),count));
      end case;
      if unsigned(result)=0 then zero<='1'; end if;
    else result:=(others=>'X'); end if;
    y<=result;
  end process;
end architecture;
