import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import StationMap from "@/components/StationMap";
import StationPanel from "@/components/StationPanel";
import AddStationDialog from "@/components/AddStationDialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/hooks/use-theme";
import { BRAND_LIST, BRAND_COLORS, DEFAULT_CENTER } from "@/lib/constants";
import type { Station } from "@shared/schema";
import { Search, Plus, Moon, Sun, Shield, X, Filter, Fuel, MapPin } from "lucide-react";
import { Link } from "wouter";
import { PerplexityAttribution } from "@/components/PerplexityAttribution";

export default function Home() {
  const { theme, toggleTheme } = useTheme();
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const { data: stations = [], isLoading } = useQuery<Station[]>({
    queryKey: ["/api/stations"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/stations");
      return res.json();
    },
  });

  // Filter stations
  const filteredStations = useMemo(() => {
    let filtered = stations;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (s) => s.name.toLowerCase().includes(q) || s.brand.toLowerCase().includes(q) || (s.address || "").toLowerCase().includes(q)
      );
    }
    if (selectedBrands.length > 0) {
      filtered = filtered.filter((s) => selectedBrands.includes(s.brand));
    }
    return filtered;
  }, [stations, searchQuery, selectedBrands]);

  const toggleBrand = (brand: string) => {
    setSelectedBrands((prev) =>
      prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand]
    );
  };

  return (
    <div className="h-screen flex flex-col relative">
      {/* Top bar */}
      <header className="absolute top-0 left-0 right-0 z-[1002] pointer-events-none">
        <div className="flex items-center justify-between p-3 gap-2">
          {/* Logo area */}
          <div className="pointer-events-auto flex items-center gap-2 bg-background/90 backdrop-blur-md rounded-xl px-3 py-2 shadow-md border border-border">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Fuel className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-bold leading-none tracking-tight">Where's My Fuel</h1>
              <p className="text-[10px] text-muted-foreground leading-none mt-0.5">เช็คน้ำมันทั่วไทย</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pointer-events-auto flex items-center gap-1.5">
            <button
              onClick={() => { setShowSearch(!showSearch); setShowFilters(false); }}
              className="p-2.5 rounded-xl bg-background/90 backdrop-blur-md shadow-md border border-border hover:bg-muted transition-colors"
              data-testid="btn-toggle-search"
              aria-label="ค้นหา"
            >
              <Search className="w-4 h-4" />
            </button>
            <button
              onClick={() => { setShowFilters(!showFilters); setShowSearch(false); }}
              className={`p-2.5 rounded-xl bg-background/90 backdrop-blur-md shadow-md border border-border hover:bg-muted transition-colors ${selectedBrands.length > 0 ? "ring-2 ring-primary" : ""}`}
              data-testid="btn-toggle-filter"
              aria-label="กรองแบรนด์"
            >
              <Filter className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowAddDialog(true)}
              className="p-2.5 rounded-xl bg-primary text-primary-foreground shadow-md hover:opacity-90 transition-opacity"
              data-testid="btn-add-station"
              aria-label="เพิ่มปั๊ม"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl bg-background/90 backdrop-blur-md shadow-md border border-border hover:bg-muted transition-colors"
              data-testid="btn-toggle-theme"
              aria-label="สลับธีม"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <Link href="/admin" className="p-2.5 rounded-xl bg-background/90 backdrop-blur-md shadow-md border border-border hover:bg-muted transition-colors" data-testid="btn-admin" aria-label="Admin">
              <Shield className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Search bar */}
        {showSearch && (
          <div className="pointer-events-auto mx-3 mb-2 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาปั๊ม ชื่อ แบรนด์ หรือจังหวัด..."
                className="pl-9 pr-9 bg-background/95 backdrop-blur-md shadow-md"
                autoFocus
                data-testid="input-search"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
            </div>
            {searchQuery && (
              <p className="text-xs text-muted-foreground mt-1 px-1 bg-background/80 rounded inline-block">
                พบ {filteredStations.length.toLocaleString()} ปั๊ม
              </p>
            )}
          </div>
        )}

        {/* Brand filter */}
        {showFilters && (
          <div className="pointer-events-auto mx-3 mb-2 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex flex-wrap gap-1.5 bg-background/95 backdrop-blur-md rounded-xl p-2.5 shadow-md border border-border">
              {BRAND_LIST.map((brand) => (
                <button
                  key={brand}
                  onClick={() => toggleBrand(brand)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                    selectedBrands.includes(brand)
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                  data-testid={`btn-brand-${brand}`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: BRAND_COLORS[brand] }} />
                  {brand}
                </button>
              ))}
              {selectedBrands.length > 0 && (
                <button onClick={() => setSelectedBrands([])} className="text-xs text-muted-foreground hover:text-foreground px-2">
                  ล้าง
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Map */}
      <main className="flex-1 relative">
        {isLoading ? (
          <div className="flex items-center justify-center h-full bg-muted">
            <div className="text-center">
              <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">กำลังโหลดข้อมูลปั๊ม...</p>
              <p className="text-xs text-muted-foreground mt-1">ปั๊มทั่วประเทศกว่า 8,500 แห่ง</p>
            </div>
          </div>
        ) : (
          <StationMap
            stations={filteredStations}
            onStationClick={setSelectedStation}
          />
        )}

        {/* Station detail panel */}
        {selectedStation && (
          <StationPanel station={selectedStation} onClose={() => setSelectedStation(null)} />
        )}
      </main>

      {/* Station count badge */}
      <div className="absolute bottom-4 left-4 z-[1002]">
        <div className="bg-background/90 backdrop-blur-md rounded-full px-3 py-1.5 shadow-md border border-border text-xs text-muted-foreground flex items-center gap-1.5">
          <MapPin className="w-3 h-3" />
          {filteredStations.length.toLocaleString()} ปั๊ม
          {selectedBrands.length > 0 && (
            <span className="text-primary font-medium">({selectedBrands.join(", ")})</span>
          )}
        </div>
      </div>

      <AddStationDialog open={showAddDialog} onClose={() => setShowAddDialog(false)} mapCenter={DEFAULT_CENTER} />

      {/* Attribution */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1002]">
        <PerplexityAttribution />
      </div>
    </div>
  );
}
