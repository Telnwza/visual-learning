library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
entity ss_rom is
  generic (DATA_WIDTH:positive range 1 to 64:=8;
    ADDR_WIDTH:positive range 1 to 6:=3;
    ENTRY_COUNT:positive range 1 to 2**ADDR_WIDTH:=8;
    CLOCKED:natural range 0 to 1:=0);
  port (clk,rst:in std_logic;
    addr:in std_logic_vector(ADDR_WIDTH-1 downto 0);
    data:out std_logic_vector(DATA_WIDTH-1 downto 0); valid:out std_logic);
end entity;
architecture rtl of ss_rom is
  type rom_table is array(0 to 63) of std_logic_vector(63 downto 0);
  -- Edit these entries, then use Change source in Studio to update the imported box.
  constant TABLE_DATA:rom_table:=(
    0=>x"0000000000000000", 1=>x"0000000000000001",
    2=>x"0000000000000002", 3=>x"0000000000000003",
    4=>x"0000000000000004", 5=>x"0000000000000005",
    6=>x"0000000000000006", 7=>x"0000000000000007",
    others=>(others=>'0'));
  signal value:std_logic_vector(DATA_WIDTH-1 downto 0):=(others=>'0');
  signal address_valid:std_logic:='0';
begin
  entries:for i in 0 to ENTRY_COUNT-1 generate
    assert resize(resize(unsigned(TABLE_DATA(i)),DATA_WIDTH),64)=unsigned(TABLE_DATA(i))
      report "ROM entry does not fit DATA_WIDTH" severity failure;
  end generate;
  process(addr)
    variable index:natural range 0 to 63;
  begin
    value<=(others=>'0'); address_valid<='0';
    if not is_x(addr) then
      index:=to_integer(unsigned(addr));
      if index<ENTRY_COUNT then value<=TABLE_DATA(index)(DATA_WIDTH-1 downto 0); address_valid<='1'; end if;
    end if;
  end process;
  combinational:if CLOCKED=0 generate data<=value; valid<=address_valid; end generate;
  registered:if CLOCKED=1 generate
    process(clk) begin
      if rising_edge(clk) then
        if rst='1' then data<=(others=>'0'); valid<='0';
        else data<=value; valid<=address_valid; end if;
      end if;
    end process;
  end generate;
end architecture;
