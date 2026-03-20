import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { FUEL_TYPES, FUEL_STATUS, BRAND_COLORS } from "@/lib/constants";
import type { Station, FuelReport, StationComment } from "@shared/schema";
import { X, MapPin, Clock, Fuel, MessageCircle, ThumbsUp, Send, ChevronDown, AlertTriangle, Flag } from "lucide-react";

interface StationPanelProps {
  station: Station;
  onClose: () => void;
}

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "เมื่อสักครู่";
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ชม.ที่แล้ว`;
  return `${Math.floor(hrs / 24)} วันที่แล้ว`;
}

function StatusBadge({ status }: { status: string }) {
  const s = FUEL_STATUS[status];
  if (!s) return null;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.color} ${s.bg}`}>
      {s.label}
    </span>
  );
}

export default function StationPanel({ station, onClose }: StationPanelProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"reports" | "comment" | "report">("reports");
  const [selectedFuelType, setSelectedFuelType] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [commentText, setCommentText] = useState("");
  const [showRemovalForm, setShowRemovalForm] = useState(false);
  const [removalReason, setRemovalReason] = useState("");

  const { data, isLoading } = useQuery<{
    station: Station;
    reports: FuelReport[];
    comments: StationComment[];
  }>({
    queryKey: ["/api/stations", station.placeId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/stations/${station.placeId}`);
      return res.json();
    },
  });

  const reportMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/reports", {
        placeId: station.placeId,
        stationName: station.name,
        lat: station.lat,
        lng: station.lng,
        brand: station.brand,
        fuelType: selectedFuelType,
        status: selectedStatus,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stations", station.placeId] });
      toast({ title: "รายงานสำเร็จ", description: "ขอบคุณที่แจ้งข้อมูล" });
      setSelectedFuelType("");
      setSelectedStatus("");
      setActiveTab("reports");
    },
    onError: (err: any) => {
      toast({ title: "ไม่สำเร็จ", description: err.message, variant: "destructive" });
    },
  });

  const commentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/comments", {
        placeId: station.placeId,
        stationName: station.name,
        message: commentText,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stations", station.placeId] });
      toast({ title: "ส่งความคิดเห็นแล้ว" });
      setCommentText("");
      setActiveTab("reports");
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async (reportId: string) => {
      await apiRequest("POST", `/api/reports/${reportId}/confirm`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stations", station.placeId] });
    },
  });

  const removalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/removal-requests", {
        placeId: station.placeId,
        stationName: station.name,
        reason: removalReason,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "ส่งคำขอลบแล้ว", description: "ทีมงานจะตรวจสอบ" });
      setShowRemovalForm(false);
      setRemovalReason("");
    },
  });

  const brandColor = BRAND_COLORS[station.brand] || BRAND_COLORS["อื่นๆ"];

  return (
    <div className="absolute inset-y-0 right-0 w-full sm:w-[420px] z-[1001] bg-background border-l border-border shadow-xl flex flex-col animate-in slide-in-from-right duration-200" data-testid="station-panel">
      {/* Header */}
      <div className="flex items-start gap-3 p-4 border-b border-border">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: brandColor }}>
          <Fuel className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-sm leading-tight truncate" data-testid="text-station-name">{station.name}</h2>
          <div className="flex items-center gap-1.5 mt-1">
            <Badge variant="secondary" className="text-xs">{station.brand}</Badge>
            {station.isOpen24h && <Badge variant="outline" className="text-xs">24 ชม.</Badge>}
          </div>
          {station.address && (
            <p className="text-xs text-muted-foreground mt-1 flex items-start gap-1">
              <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
              <span className="line-clamp-2">{station.address}</span>
            </p>
          )}
        </div>
        <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors" data-testid="btn-close-panel">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tab navigation */}
      <div className="flex border-b border-border">
        {[
          { key: "reports" as const, label: "สถานะ", icon: Fuel },
          { key: "report" as const, label: "รายงาน", icon: Send },
          { key: "comment" as const, label: "ความคิดเห็น", icon: MessageCircle },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid={`tab-${tab.key}`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-16 rounded-lg" />
            ))}
          </div>
        ) : activeTab === "reports" ? (
          <div className="space-y-2">
            {data?.reports && data.reports.length > 0 ? (
              data.reports.map((report) => (
                <div key={report.reportId} className="flex items-center justify-between p-3 rounded-lg bg-card border border-card-border" data-testid={`report-${report.reportId}`}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge status={report.status} />
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-muted">
                        {FUEL_TYPES[report.fuelType] || report.fuelType}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {timeAgo(report.timestamp)}
                      {report.votesConfirm && report.votesConfirm > 0 && (
                        <span className="ml-2">• {report.votesConfirm} ยืนยัน</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => confirmMutation.mutate(report.reportId)}
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-xs hover:bg-muted transition-colors"
                    data-testid={`btn-confirm-${report.reportId}`}
                  >
                    <ThumbsUp className="w-3 h-3" />
                    <span>{report.votesConfirm || 0}</span>
                  </button>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Fuel className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">ยังไม่มีรายงาน</p>
                <p className="text-xs text-muted-foreground mt-1">เป็นคนแรกที่แจ้งสถานะ</p>
                <Button size="sm" className="mt-3" onClick={() => setActiveTab("report")} data-testid="btn-first-report">
                  รายงานสถานะ
                </Button>
              </div>
            )}

            {/* Comments section */}
            {data?.comments && data.comments.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                  <MessageCircle className="w-3 h-3" />
                  ความคิดเห็น ({data.comments.length})
                </h3>
                {data.comments.map((comment) => (
                  <div key={comment.commentId} className="p-2.5 rounded-lg bg-muted/50 mb-2" data-testid={`comment-${comment.commentId}`}>
                    <p className="text-sm">{comment.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">{timeAgo(comment.timestamp)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === "report" ? (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">ประเภทน้ำมัน</label>
              <Select value={selectedFuelType} onValueChange={setSelectedFuelType}>
                <SelectTrigger data-testid="select-fuel-type">
                  <SelectValue placeholder="เลือกประเภทน้ำมัน" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FUEL_TYPES).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">สถานะ</label>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(FUEL_STATUS).map(([key, info]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedStatus(key)}
                    className={`p-3 rounded-lg text-center text-xs font-medium border-2 transition-all ${
                      selectedStatus === key
                        ? `${info.bg} ${info.color} border-current`
                        : "border-border hover:border-muted-foreground/30"
                    }`}
                    data-testid={`btn-status-${key}`}
                  >
                    {key === "available" ? "✅" : key === "out" ? "❌" : "⏳"}
                    <div className="mt-1">{info.label}</div>
                  </button>
                ))}
              </div>
            </div>
            <Button
              onClick={() => reportMutation.mutate()}
              disabled={!selectedFuelType || !selectedStatus || reportMutation.isPending}
              className="w-full"
              data-testid="btn-submit-report"
            >
              {reportMutation.isPending ? "กำลังส่ง..." : "ส่งรายงาน"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="แสดงความคิดเห็นเกี่ยวกับปั๊มนี้..."
              maxLength={500}
              className="min-h-[100px]"
              data-testid="input-comment"
            />
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">{commentText.length}/500</span>
              <Button
                onClick={() => commentMutation.mutate()}
                disabled={!commentText.trim() || commentMutation.isPending}
                size="sm"
                data-testid="btn-submit-comment"
              >
                <Send className="w-3.5 h-3.5 mr-1.5" />
                {commentMutation.isPending ? "กำลังส่ง..." : "ส่ง"}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Footer: removal request */}
      <div className="p-3 border-t border-border">
        {showRemovalForm ? (
          <div className="space-y-2">
            <Textarea
              value={removalReason}
              onChange={(e) => setRemovalReason(e.target.value)}
              placeholder="เหตุผล (เช่น ปิดถาวร, ซ้ำ)"
              className="min-h-[60px] text-xs"
              data-testid="input-removal-reason"
            />
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" onClick={() => removalMutation.mutate()} disabled={!removalReason.trim()} className="flex-1" data-testid="btn-confirm-removal">
                ส่งคำขอลบ
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowRemovalForm(false)} className="flex-1">
                ยกเลิก
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowRemovalForm(true)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
            data-testid="btn-request-removal"
          >
            <Flag className="w-3 h-3" />
            แจ้งปัญหาหรือขอลบปั๊มนี้
          </button>
        )}
      </div>
    </div>
  );
}
