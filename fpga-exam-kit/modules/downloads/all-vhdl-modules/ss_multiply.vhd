library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
entity ss_multiply is
  generic (WIDTH:positive range 1 to 64:=8; SIGNED_MODE:natural range 0 to 1:=0);
  port (a,b:in std_logic_vector(WIDTH-1 downto 0);
    result_lo,result_hi:out std_logic_vector(WIDTH-1 downto 0); overflow,zero,negative:out std_logic);
end entity;
architecture rtl of ss_multiply is begin
  process(a,b)
    variable product:std_logic_vector(2*WIDTH-1 downto 0);
  begin
    overflow<='0'; negative<='0';
    if SIGNED_MODE=1 then
      product:=std_logic_vector(signed(a)*signed(b)); negative<=product(2*WIDTH-1);
      if signed(product)/=resize(signed(product(WIDTH-1 downto 0)),2*WIDTH) then overflow<='1'; end if;
    else
      product:=std_logic_vector(unsigned(a)*unsigned(b));
      if unsigned(product(2*WIDTH-1 downto WIDTH))/=0 then overflow<='1'; end if;
    end if;
    result_lo<=product(WIDTH-1 downto 0); result_hi<=product(2*WIDTH-1 downto WIDTH);
    zero<='0'; if unsigned(product)=0 then zero<='1'; end if;
  end process;
end architecture;
