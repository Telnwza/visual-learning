library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
entity ss_reg_universal is
  generic (WIDTH:positive range 1 to 64:=8;
    EDGE_FALLING:natural range 0 to 1:=0;
    RESET_ASYNC:natural range 0 to 1:=0);
  port (clk,en,rst:in std_logic;
    reset_value:in std_logic_vector(WIDTH-1 downto 0);
    d:in std_logic_vector(WIDTH-1 downto 0);
    mode:in std_logic_vector(1 downto 0);
    si_left,si_right:in std_logic;
    q:out std_logic_vector(WIDTH-1 downto 0);
    so_left,so_right:out std_logic);
end entity;
architecture rtl of ss_reg_universal is
  signal r:std_logic_vector(WIDTH-1 downto 0):=(others=>'0');
begin
  q <= r;
  so_left <= r(WIDTH-1); so_right <= r(0);
  edge_0_reset_0:if EDGE_FALLING=0 and RESET_ASYNC=0 generate
    process(clk) begin
      if rising_edge(clk) then if rst='1' then r <= reset_value; elsif en='1' then case mode is
          when "01" => r <= std_logic_vector(shift_left(unsigned(r),1)); r(0) <= si_left;
          when "10" => r <= std_logic_vector(shift_right(unsigned(r),1)); r(WIDTH-1) <= si_right;
          when "11" => r <= d;
          when others => null;
        end case; end if; end if;
    end process;
  end generate;
  edge_0_reset_1:if EDGE_FALLING=0 and RESET_ASYNC=1 generate
    process(clk,rst,reset_value) begin
      if rst='1' then r <= reset_value; elsif rising_edge(clk) then if en='1' then case mode is
          when "01" => r <= std_logic_vector(shift_left(unsigned(r),1)); r(0) <= si_left;
          when "10" => r <= std_logic_vector(shift_right(unsigned(r),1)); r(WIDTH-1) <= si_right;
          when "11" => r <= d;
          when others => null;
        end case; end if; end if;
    end process;
  end generate;
  edge_1_reset_0:if EDGE_FALLING=1 and RESET_ASYNC=0 generate
    process(clk) begin
      if falling_edge(clk) then if rst='1' then r <= reset_value; elsif en='1' then case mode is
          when "01" => r <= std_logic_vector(shift_left(unsigned(r),1)); r(0) <= si_left;
          when "10" => r <= std_logic_vector(shift_right(unsigned(r),1)); r(WIDTH-1) <= si_right;
          when "11" => r <= d;
          when others => null;
        end case; end if; end if;
    end process;
  end generate;
  edge_1_reset_1:if EDGE_FALLING=1 and RESET_ASYNC=1 generate
    process(clk,rst,reset_value) begin
      if rst='1' then r <= reset_value; elsif falling_edge(clk) then if en='1' then case mode is
          when "01" => r <= std_logic_vector(shift_left(unsigned(r),1)); r(0) <= si_left;
          when "10" => r <= std_logic_vector(shift_right(unsigned(r),1)); r(WIDTH-1) <= si_right;
          when "11" => r <= d;
          when others => null;
        end case; end if; end if;
    end process;
  end generate;
end architecture;
