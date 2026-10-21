library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
entity ss_text_overlay is
  port (base_0,base_1,base_2,base_3,field_0,field_1,field_2,field_3:in std_logic_vector(63 downto 0);
    offset,length:in std_logic_vector(4 downto 0); en,field_valid:in std_logic;
    text_0,text_1,text_2,text_3:out std_logic_vector(63 downto 0); valid,clipped:out std_logic);
end entity;
architecture rtl of ss_text_overlay is begin
  process(base_0,base_1,base_2,base_3,field_0,field_1,field_2,field_3,offset,length,en,field_valid)
    variable text_value,field:std_logic_vector(255 downto 0);
    variable first,count:natural range 0 to 31;
  begin
    text_value:=base_3 & base_2 & base_1 & base_0; field:=field_3 & field_2 & field_1 & field_0;
    valid<='0'; clipped<='0';
    if en='0' then valid<='1';
    elsif en='1' and field_valid='1' and not is_x(offset) and not is_x(length) then
      first:=to_integer(unsigned(offset)); count:=to_integer(unsigned(length)); valid<='1';
      if first+count>32 then clipped<='1'; end if;
      for i in 0 to 30 loop
        if i<count and first+i<32 then text_value(8*(first+i)+7 downto 8*(first+i)):=field(8*i+7 downto 8*i); end if;
      end loop;
    end if;
    text_0<=text_value(63 downto 0); text_1<=text_value(127 downto 64);
    text_2<=text_value(191 downto 128); text_3<=text_value(255 downto 192);
  end process;
end architecture;
