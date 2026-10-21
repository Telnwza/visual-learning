library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
entity ss_alu is
  generic (WIDTH:positive range 1 to 64:=8; SIGNED_MODE:natural range 0 to 1:=0);
  port (clk,rst,en,start:in std_logic; opcode:in std_logic_vector(2 downto 0);
    a,b:in std_logic_vector(WIDTH-1 downto 0); cin:in std_logic;
    y,result_hi:out std_logic_vector(WIDTH-1 downto 0);
    busy,done,valid,carry,borrow,overflow,divide_by_zero,zero,negative,invalid_op:out std_logic);
end entity;
architecture rtl of ss_alu is
  type words is array(0 to 7) of std_logic_vector(WIDTH-1 downto 0);
  signal values:words;
  signal add_carry,add_overflow,add_zero,add_negative:std_logic;
  signal sub_borrow,sub_overflow,sub_zero,sub_negative:std_logic;
  signal mul_hi:std_logic_vector(WIDTH-1 downto 0);
  signal mul_overflow,mul_zero,mul_negative:std_logic;
  signal div_a,div_b,div_q,div_r:std_logic_vector(WIDTH-1 downto 0):=(others=>'0');
  signal div_start,div_done,div_valid,div_error,div_overflow,div_zero,div_negative:std_logic:='0';
  signal active,event_done,result_valid,flag_carry,flag_borrow,flag_overflow,flag_divide,flag_negative,flag_invalid:std_logic:='0';
  signal flag_zero:std_logic:='1';
  signal result_value,result_upper:std_logic_vector(WIDTH-1 downto 0):=(others=>'0');
begin
  addition:entity work.ss_add_sub generic map(WIDTH=>WIDTH,SIGNED_MODE=>SIGNED_MODE,SUBTRACT=>0)
    port map(a=>a,b=>b,cin=>cin,y=>values(0),carry=>add_carry,borrow=>open,overflow=>add_overflow,zero=>add_zero,negative=>add_negative);
  subtraction:entity work.ss_add_sub generic map(WIDTH=>WIDTH,SIGNED_MODE=>SIGNED_MODE,SUBTRACT=>1)
    port map(a=>a,b=>b,cin=>cin,y=>values(1),carry=>open,borrow=>sub_borrow,overflow=>sub_overflow,zero=>sub_zero,negative=>sub_negative);
  multiplication:entity work.ss_multiply generic map(WIDTH=>WIDTH,SIGNED_MODE=>SIGNED_MODE)
    port map(a=>a,b=>b,result_lo=>values(2),result_hi=>mul_hi,overflow=>mul_overflow,zero=>mul_zero,negative=>mul_negative);
  division:entity work.ss_divide generic map(WIDTH=>WIDTH,SIGNED_MODE=>SIGNED_MODE)
    port map(clk=>clk,rst=>rst,en=>en,start=>div_start,a=>div_a,b=>div_b,quotient=>div_q,remainder=>div_r,
      busy=>open,done=>div_done,valid=>div_valid,divide_by_zero=>div_error,overflow=>div_overflow,zero=>div_zero,negative=>div_negative);
  values(3)<=div_q;
  logic_and:entity work.ss_bitwise generic map(WIDTH=>WIDTH,OPERATION=>0) port map(a=>a,b=>b,y=>values(4),zero=>open);
  logic_or:entity work.ss_bitwise generic map(WIDTH=>WIDTH,OPERATION=>1) port map(a=>a,b=>b,y=>values(5),zero=>open);
  logic_xor:entity work.ss_bitwise generic map(WIDTH=>WIDTH,OPERATION=>2) port map(a=>a,b=>b,y=>values(6),zero=>open);
  logic_not:entity work.ss_bitwise generic map(WIDTH=>WIDTH,OPERATION=>6) port map(a=>a,b=>b,y=>values(7),zero=>open);
  y<=result_value; result_hi<=result_upper; busy<=active; done<=event_done; valid<=result_valid;
  carry<=flag_carry; borrow<=flag_borrow; overflow<=flag_overflow; divide_by_zero<=flag_divide;
  zero<=flag_zero; negative<=flag_negative; invalid_op<=flag_invalid;
  process(clk)
    variable operation:natural range 0 to 7;
  begin
    if rising_edge(clk) then
      event_done<='0'; div_start<='0';
      if rst='1' then
        active<='0'; result_valid<='0'; result_value<=(others=>'0'); result_upper<=(others=>'0');
        div_a<=(others=>'0'); div_b<=(others=>'0');
        flag_carry<='0'; flag_borrow<='0'; flag_overflow<='0'; flag_divide<='0'; flag_negative<='0'; flag_invalid<='0'; flag_zero<='1';
      elsif active='1' then
        if div_done='1' then
          active<='0'; event_done<='1'; result_valid<=div_valid; result_value<=div_q; result_upper<=div_r;
          flag_overflow<=div_overflow; flag_divide<=div_error; flag_zero<=div_zero; flag_negative<=div_negative;
        end if;
      elsif start='1' and en='1' then
        result_valid<='0'; flag_carry<='0'; flag_borrow<='0'; flag_overflow<='0'; flag_divide<='0'; flag_invalid<='0';
        if is_x(opcode) then flag_invalid<='1'; event_done<='1';
        else
          operation:=to_integer(unsigned(opcode));
          if operation=3 then div_a<=a; div_b<=b; div_start<='1'; active<='1';
          else
            result_value<=values(operation); result_upper<=(others=>'0'); result_valid<='1'; event_done<='1';
            flag_zero<='0'; if unsigned(values(operation))=0 then flag_zero<='1'; end if;
            flag_negative<='0'; if SIGNED_MODE=1 then flag_negative<=values(operation)(WIDTH-1); end if;
            case operation is
              when 0 => flag_carry<=add_carry; flag_overflow<=add_overflow; flag_zero<=add_zero; flag_negative<=add_negative;
              when 1 => flag_borrow<=sub_borrow; flag_overflow<=sub_overflow; flag_zero<=sub_zero; flag_negative<=sub_negative;
              when 2 => result_upper<=mul_hi; flag_overflow<=mul_overflow; flag_zero<=mul_zero; flag_negative<=mul_negative;
              when others => null;
            end case;
          end if;
        end if;
      end if;
    end if;
  end process;
end architecture;
