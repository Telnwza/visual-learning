library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
entity ss_divide is
  generic (WIDTH:positive range 1 to 64:=8; SIGNED_MODE:natural range 0 to 1:=0);
  port (clk,rst,en,start:in std_logic; a,b:in std_logic_vector(WIDTH-1 downto 0);
    quotient,remainder:out std_logic_vector(WIDTH-1 downto 0);
    busy,done,valid,divide_by_zero,overflow,zero,negative:out std_logic);
end entity;
architecture rtl of ss_divide is
  signal active,event_done,result_valid,error_zero,error_overflow:std_logic:='0';
  signal q_work,divisor,q_result,r_result:unsigned(WIDTH-1 downto 0):=(others=>'0');
  signal r_work:unsigned(WIDTH downto 0):=(others=>'0');
  signal negate_q,negate_r:std_logic:='0';
  signal step:natural range 0 to WIDTH-1:=0;
begin
  quotient<=std_logic_vector(q_result); remainder<=std_logic_vector(r_result);
  busy<=active; done<=event_done; valid<=result_valid; divide_by_zero<=error_zero; overflow<=error_overflow;
  zero<='1' when q_result=0 else '0'; negative<=q_result(WIDTH-1) when SIGNED_MODE=1 else '0';
  process(clk)
    variable next_r:unsigned(WIDTH downto 0);
    variable next_q,final_q,final_r,mag_a,mag_b,min_value:unsigned(WIDTH-1 downto 0);
  begin
    if rising_edge(clk) then
      event_done<='0';
      if rst='1' then
        active<='0'; result_valid<='0'; error_zero<='0'; error_overflow<='0';
        q_work<=(others=>'0'); divisor<=(others=>'0'); r_work<=(others=>'0');
        q_result<=(others=>'0'); r_result<=(others=>'0'); negate_q<='0'; negate_r<='0'; step<=0;
      elsif start='1' and active='0' then
        result_valid<='0'; error_zero<='0'; error_overflow<='0';
        mag_a:=unsigned(a); mag_b:=unsigned(b); min_value:=(others=>'0'); min_value(WIDTH-1):='1';
        if unsigned(b)=0 then
          q_result<=(others=>'0'); r_result<=unsigned(a); error_zero<='1'; event_done<='1';
        elsif SIGNED_MODE=1 and unsigned(a)=min_value and signed(b)=-1 then
          q_result<=unsigned(a); r_result<=(others=>'0'); error_overflow<='1'; event_done<='1';
        else
          negate_q<='0'; negate_r<='0';
          if SIGNED_MODE=1 then
            negate_q<=a(WIDTH-1) xor b(WIDTH-1); negate_r<=a(WIDTH-1);
            if a(WIDTH-1)='1' then mag_a:=unsigned(-signed(a)); end if;
            if b(WIDTH-1)='1' then mag_b:=unsigned(-signed(b)); end if;
          end if;
          q_work<=mag_a; divisor<=mag_b; r_work<=(others=>'0'); step<=0; active<='1';
        end if;
      elsif active='1' and en='1' then
        next_r:=shift_left(r_work,1); next_r(0):=q_work(WIDTH-1); next_q:=shift_left(q_work,1);
        if next_r>=resize(divisor,WIDTH+1) then next_r:=next_r-resize(divisor,WIDTH+1); next_q(0):='1'; end if;
        q_work<=next_q; r_work<=next_r;
        if step=WIDTH-1 then
          final_q:=next_q; final_r:=next_r(WIDTH-1 downto 0);
          if negate_q='1' then final_q:=unsigned(-signed(final_q)); end if;
          if negate_r='1' then final_r:=unsigned(-signed(final_r)); end if;
          q_result<=final_q; r_result<=final_r; active<='0'; event_done<='1'; result_valid<='1';
        else step<=step+1; end if;
      end if;
    end if;
  end process;
end architecture;
