library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
entity ss_bitwise is
  generic (WIDTH:positive range 1 to 64:=8; OPERATION:natural range 0 to 6:=0);
  port (a,b:in std_logic_vector(WIDTH-1 downto 0); y:out std_logic_vector(WIDTH-1 downto 0); zero:out std_logic);
end entity;
architecture rtl of ss_bitwise is begin
  process(a,b)
    variable result:std_logic_vector(WIDTH-1 downto 0);
  begin
    case OPERATION is
      when 0=>result:=a and b; when 1=>result:=a or b; when 2=>result:=a xor b;
      when 3=>result:=a nand b; when 4=>result:=a nor b; when 5=>result:=a xnor b;
      when others=>result:=not a;
    end case;
    y<=result; zero<='0'; if unsigned(result)=0 then zero<='1'; end if;
  end process;
end architecture;
