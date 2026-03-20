import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { BRAND_LIST } from "@/lib/constants";

interface AddStationDialogProps {
  open: boolean;
  onClose: () => void;
  mapCenter: [number, number];
}

export default function AddStationDialog({ open, onClose, mapCenter }: AddStationDialogProps) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("อื่นๆ");
  const [lat, setLat] = useState(mapCenter[0].toString());
  const [lng, setLng] = useState(mapCenter[1].toString());

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/pending-stations", {
        stationName: name,
        brand,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "ส่งคำขอแล้ว", description: "ทีมงานจะตรวจสอบและเพิ่มปั๊มให้" });
      setName("");
      setBrand("อื่นๆ");
      onClose();
    },
    onError: () => {
      toast({ title: "ไม่สำเร็จ", description: "กรุณาลองใหม่", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>แจ้งเพิ่มปั๊มน้ำมัน</DialogTitle>
          <DialogDescription>กรอกข้อมูลปั๊มที่ต้องการเพิ่มเข้าระบบ</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">ชื่อปั๊ม</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น ปั๊ม ปตท. สาขา..." data-testid="input-station-name" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">แบรนด์</label>
            <Select value={brand} onValueChange={setBrand}>
              <SelectTrigger data-testid="select-brand">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BRAND_LIST.map((b) => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Latitude</label>
              <Input type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)} data-testid="input-lat" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Longitude</label>
              <Input type="number" step="any" value={lng} onChange={(e) => setLng(e.target.value)} data-testid="input-lng" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">ใช้พิกัดจาก Google Maps หรือ GPS</p>
          <Button onClick={() => mutation.mutate()} disabled={!name.trim() || mutation.isPending} className="w-full" data-testid="btn-submit-station">
            {mutation.isPending ? "กำลังส่ง..." : "ส่งคำขอเพิ่มปั๊ม"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
