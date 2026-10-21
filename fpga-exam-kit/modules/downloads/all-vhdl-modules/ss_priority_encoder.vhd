library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
entity ss_priority_encoder is
  generic (INPUTS:positive range 1 to 64:=8; PRIORITY_HIGH:natural range 0 to 1:=1; ONE_HOT_ONLY:natural range 0 to 1:=0);
  port (d:in std_logic_vector(INPUTS-1 downto 0); en:in std_logic;
    code:out std_logic_vector(5 downto 0); valid,multiple:out std_logic);
end entity;
architecture rtl of ss_priority_encoder is begin
  process(d,en)
    variable count:natural range 0 to 2;
    variable index:natural range 0 to 63;
  begin
    count:=0; index:=0; code<=(others=>'0'); valid<='0'; multiple<='0';
    if en='1' then
      for i in 0 to INPUTS-1 loop
        if d(i)='1' then
          if count=0 or PRIORITY_HIGH=1 then index:=i; end if;
          if count<2 then count:=count+1; end if;
        end if;
      end loop;
      if count=2 then multiple<='1'; end if;
      if count>0 and (ONE_HOT_ONLY=0 or count=1) then code<=std_logic_vector(to_unsigned(index,6)); valid<='1'; end if;
    end if;
  end process;
end architecture;
