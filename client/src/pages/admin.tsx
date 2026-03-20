import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/hooks/use-theme";
import { useAdmin } from "@/hooks/use-admin";
import { FUEL_TYPES, FUEL_STATUS } from "@/lib/constants";
import { Link } from "wouter";
import { PerplexityAttribution } from "@/components/PerplexityAttribution";
import {
  BarChart3, Fuel, MessageCircle, Trash2, CheckCircle, XCircle, Sun, Moon, Home,
  Shield, AlertTriangle, RefreshCw, Clock, MapPin, Plus, Flag,
} from "lucide-react";

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "เมื่อสักครู่";
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ชม.ที่แล้ว`;
  return `${Math.floor(hrs / 24)} วันที่แล้ว`;
}

function LoginForm({ onLogin }: { onLogin: (pw: string) => Promise<boolean> }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(false);
    const ok = await onLogin(password);
    if (!ok) setError(true);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mx-auto mb-3">
            <Shield className="w-6 h-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-lg">Admin Login</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">ใส่รหัสผ่านเพื่อเข้าสู่ระบบ</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="รหัสผ่าน Admin"
              autoFocus
              data-testid="input-admin-password"
            />
            {error && <p className="text-xs text-destructive">รหัสผ่านไม่ถูกต้อง</p>}
            <Button type="submit" className="w-full" disabled={loading} data-testid="btn-admin-login">
              {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminPage() {
  const { theme, toggleTheme } = useTheme();
  const { isAuthenticated, token, login, logout, adminFetch } = useAdmin();
  const { toast } = useToast();

  if (!isAuthenticated) {
    return <LoginForm onLogin={login} />;
  }

  return <AdminDashboard token={token} adminFetch={adminFetch} logout={logout} theme={theme} toggleTheme={toggleTheme} />;
}

interface AdminDashboardProps {
  token: string;
  adminFetch: (url: string, opts?: RequestInit) => Promise<Response>;
  logout: () => void;
  theme: string;
  toggleTheme: () => void;
}

function AdminDashboard({ token, adminFetch, logout, theme, toggleTheme }: AdminDashboardProps) {
  const { toast } = useToast();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/admin/stats"],
    queryFn: async () => {
      const res = await adminFetch("/api/admin/stats");
      return res.json();
    },
  });

  const { data: comments = [] } = useQuery({
    queryKey: ["/api/admin/comments"],
    queryFn: async () => {
      const res = await adminFetch("/api/admin/comments");
      return res.json();
    },
  });

  const { data: pendingStations = [] } = useQuery({
    queryKey: ["/api/admin/pending-stations"],
    queryFn: async () => {
      const res = await adminFetch("/api/admin/pending-stations");
      return res.json();
    },
  });

  const { data: removalRequests = [] } = useQuery({
    queryKey: ["/api/admin/removal-requests"],
    queryFn: async () => {
      const res = await adminFetch("/api/admin/removal-requests");
      return res.json();
    },
  });

  const { data: reports = [] } = useQuery({
    queryKey: ["/api/admin/reports"],
    queryFn: async () => {
      const res = await adminFetch("/api/admin/reports");
      return res.json();
    },
  });

  const deleteCommentMut = useMutation({
    mutationFn: async (commentId: string) => {
      await adminFetch(`/api/admin/comments/${commentId}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/comments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "ลบความคิดเห็นแล้ว" });
    },
  });

  const approvePendingMut = useMutation({
    mutationFn: async ({ requestId, note }: { requestId: string; note: string }) => {
      await adminFetch(`/api/admin/pending-stations/${requestId}/approve`, {
        method: "POST",
        body: JSON.stringify({ note }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-stations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "อนุมัติแล้ว" });
    },
  });

  const rejectPendingMut = useMutation({
    mutationFn: async ({ requestId, note }: { requestId: string; note: string }) => {
      await adminFetch(`/api/admin/pending-stations/${requestId}/reject`, {
        method: "POST",
        body: JSON.stringify({ note }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-stations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "ปฏิเสธแล้ว" });
    },
  });

  const approveRemovalMut = useMutation({
    mutationFn: async (requestId: string) => {
      await adminFetch(`/api/admin/removal-requests/${requestId}/approve`, { method: "POST" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/removal-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "อนุมัติลบแล้ว" });
    },
  });

  const rejectRemovalMut = useMutation({
    mutationFn: async (requestId: string) => {
      await adminFetch(`/api/admin/removal-requests/${requestId}/reject`, { method: "POST" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/removal-requests"] });
      toast({ title: "ปฏิเสธคำขอลบ" });
    },
  });

  const clearDataMut = useMutation({
    mutationFn: async (type: string) => {
      await adminFetch(`/api/admin/clear/${type}`, { method: "POST" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast({ title: "ล้างข้อมูลแล้ว" });
    },
  });

  const pendingCount = pendingStations.filter((p: any) => p.status === "pending").length;
  const pendingRemovalCount = removalRequests.filter((r: any) => r.status === "pending").length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-bold leading-none">Where's My Fuel Admin</h1>
              <p className="text-[10px] text-muted-foreground">ระบบจัดการ</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-muted transition-colors" data-testid="btn-admin-theme">
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <Link href="/" className="p-2 rounded-lg hover:bg-muted transition-colors" data-testid="btn-back-home">
              <Home className="w-4 h-4" />
            </Link>
            <Button size="sm" variant="outline" onClick={logout} data-testid="btn-logout">
              ออกจากระบบ
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <Tabs defaultValue="dashboard">
          <TabsList className="mb-6 flex-wrap h-auto gap-1">
            <TabsTrigger value="dashboard" className="text-xs" data-testid="tab-dashboard">
              <BarChart3 className="w-3.5 h-3.5 mr-1" />Dashboard
            </TabsTrigger>
            <TabsTrigger value="pending" className="text-xs" data-testid="tab-pending">
              <Plus className="w-3.5 h-3.5 mr-1" />คำขอเพิ่มปั๊ม
              {pendingCount > 0 && <Badge variant="destructive" className="ml-1 text-[10px] px-1">{pendingCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="removals" className="text-xs" data-testid="tab-removals">
              <Flag className="w-3.5 h-3.5 mr-1" />คำขอลบ
              {pendingRemovalCount > 0 && <Badge variant="destructive" className="ml-1 text-[10px] px-1">{pendingRemovalCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="comments" className="text-xs" data-testid="tab-comments">
              <MessageCircle className="w-3.5 h-3.5 mr-1" />ความคิดเห็น
            </TabsTrigger>
            <TabsTrigger value="tools" className="text-xs" data-testid="tab-tools">
              <RefreshCw className="w-3.5 h-3.5 mr-1" />เครื่องมือ
            </TabsTrigger>
          </TabsList>

          {/* Dashboard */}
          <TabsContent value="dashboard">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: "ปั๊มทั้งหมด", value: stats?.totalStations ?? "-", icon: Fuel, color: "text-primary" },
                { label: "รายงานวันนี้", value: stats?.todayReports ?? "-", icon: BarChart3, color: "text-amber-600" },
                { label: "รายงานทั้งหมด", value: stats?.totalReports ?? "-", icon: Clock, color: "text-blue-600" },
                { label: "คำขอรออนุมัติ", value: stats?.pendingRequests ?? "-", icon: AlertTriangle, color: "text-red-600" },
              ].map((stat) => (
                <Card key={stat.label}>
                  <CardContent className="pt-4 pb-3 px-4">
                    <div className="flex items-center justify-between mb-1">
                      <stat.icon className={`w-4 h-4 ${stat.color}`} />
                    </div>
                    <div className="text-xl font-bold" data-testid={`stat-${stat.label}`}>{stat.value}</div>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Brand stats */}
            {stats?.brandStats && stats.brandStats.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">ปั๊มแยกตามแบรนด์</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {stats.brandStats
                      .sort((a: any, b: any) => b.count - a.count)
                      .map((bs: any) => (
                        <div key={bs.brand} className="flex items-center gap-3">
                          <span className="text-xs w-20 truncate">{bs.brand}</span>
                          <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary/80 rounded-full transition-all"
                              style={{ width: `${(bs.count / stats.totalStations) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium w-10 text-right">{bs.count}</span>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent reports */}
            {reports.length > 0 && (
              <Card className="mt-4">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">รายงานล่าสุด</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {reports.slice(0, 20).map((r: any) => (
                      <div key={r.reportId} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 text-xs">
                        <div>
                          <span className="font-medium">{r.stationName}</span>
                          <span className="text-muted-foreground ml-2">{FUEL_TYPES[r.fuelType] || r.fuelType}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={
                            r.status === "available" ? "text-green-600" :
                            r.status === "out" ? "text-red-600" : "text-amber-600"
                          }>
                            {FUEL_STATUS[r.status]?.label || r.status}
                          </span>
                          <span className="text-muted-foreground">{timeAgo(r.timestamp)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Pending stations */}
          <TabsContent value="pending">
            <div className="space-y-3">
              {pendingStations.length === 0 ? (
                <EmptyState icon={Plus} message="ยังไม่มีคำขอเพิ่มปั๊ม" />
              ) : (
                pendingStations.map((p: any) => (
                  <PendingStationCard
                    key={p.requestId}
                    item={p}
                    onApprove={(note) => approvePendingMut.mutate({ requestId: p.requestId, note })}
                    onReject={(note) => rejectPendingMut.mutate({ requestId: p.requestId, note })}
                  />
                ))
              )}
            </div>
          </TabsContent>

          {/* Removal requests */}
          <TabsContent value="removals">
            <div className="space-y-3">
              {removalRequests.length === 0 ? (
                <EmptyState icon={Flag} message="ยังไม่มีคำขอลบปั๊ม" />
              ) : (
                removalRequests.map((r: any) => (
                  <Card key={r.requestId} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium">{r.stationName}</p>
                          <p className="text-xs text-muted-foreground mt-1">เหตุผล: {r.reason}</p>
                          <p className="text-xs text-muted-foreground">{timeAgo(r.timestamp)}</p>
                        </div>
                        <Badge variant={r.status === "pending" ? "secondary" : r.status === "approved" ? "default" : "outline"}>
                          {r.status === "pending" ? "รอตรวจสอบ" : r.status === "approved" ? "อนุมัติแล้ว" : "ปฏิเสธ"}
                        </Badge>
                      </div>
                      {r.status === "pending" && (
                        <div className="flex gap-2 mt-3">
                          <Button size="sm" onClick={() => approveRemovalMut.mutate(r.requestId)} data-testid={`btn-approve-removal-${r.requestId}`}>
                            <CheckCircle className="w-3.5 h-3.5 mr-1" />อนุมัติ
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => rejectRemovalMut.mutate(r.requestId)} data-testid={`btn-reject-removal-${r.requestId}`}>
                            <XCircle className="w-3.5 h-3.5 mr-1" />ปฏิเสธ
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Comments */}
          <TabsContent value="comments">
            <div className="space-y-3">
              {comments.length === 0 ? (
                <EmptyState icon={MessageCircle} message="ยังไม่มีความคิดเห็น" />
              ) : (
                comments.map((c: any) => (
                  <Card key={c.commentId}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-xs font-medium text-primary">{c.stationName}</p>
                          <p className="text-sm mt-1">{c.message}</p>
                          <p className="text-xs text-muted-foreground mt-1">{timeAgo(c.timestamp)}</p>
                        </div>
                        <button
                          onClick={() => deleteCommentMut.mutate(c.commentId)}
                          className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          data-testid={`btn-delete-comment-${c.commentId}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Tools */}
          <TabsContent value="tools">
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <RefreshCw className="w-4 h-4" />
                    เครื่องมือจัดการ
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      queryClient.invalidateQueries();
                      toast({ title: "รีเฟรชแคชแล้ว" });
                    }}
                    data-testid="btn-refresh-cache"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    รีเฟรชแคช
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-destructive/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-destructive">
                    <AlertTriangle className="w-4 h-4" />
                    Danger Zone
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[
                    { type: "reports", label: "ล้างรายงานทั้งหมด" },
                    { type: "pending", label: "ล้างคำขอเพิ่มปั๊มทั้งหมด" },
                    { type: "removals", label: "ล้างคำขอลบทั้งหมด" },
                    { type: "comments", label: "ล้างความคิดเห็นทั้งหมด" },
                  ].map((item) => (
                    <Button
                      key={item.type}
                      variant="outline"
                      className="w-full justify-start text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        if (confirm(`ยืนยันการ${item.label}? ลบแล้วกู้คืนไม่ได้`)) {
                          clearDataMut.mutate(item.type);
                        }
                      }}
                      data-testid={`btn-clear-${item.type}`}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      {item.label}
                    </Button>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <footer className="mt-12 pb-6 text-center">
          <PerplexityAttribution />
        </footer>
      </main>
    </div>
  );
}

function EmptyState({ icon: Icon, message }: { icon: any; message: string }) {
  return (
    <div className="text-center py-12">
      <Icon className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function PendingStationCard({ item, onApprove, onReject }: { item: any; onApprove: (note: string) => void; onReject: (note: string) => void }) {
  const [note, setNote] = useState("");

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="text-sm font-medium">{item.stationName}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">{item.brand}</Badge>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="w-3 h-3" />{item.lat?.toFixed(4)}, {item.lng?.toFixed(4)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{timeAgo(item.timestamp)}</p>
          </div>
          <Badge variant={item.status === "pending" ? "secondary" : item.status === "approved" ? "default" : "outline"}>
            {item.status === "pending" ? "รอตรวจสอบ" : item.status === "approved" ? "อนุมัติแล้ว" : "ปฏิเสธ"}
          </Badge>
        </div>
        {item.status === "pending" && (
          <>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="หมายเหตุ (ไม่บังคับ)"
              className="mt-2 min-h-[60px] text-xs"
            />
            <div className="flex gap-2 mt-2">
              <Button size="sm" onClick={() => onApprove(note)} data-testid={`btn-approve-pending-${item.requestId}`}>
                <CheckCircle className="w-3.5 h-3.5 mr-1" />อนุมัติ
              </Button>
              <Button size="sm" variant="outline" onClick={() => onReject(note)} data-testid={`btn-reject-pending-${item.requestId}`}>
                <XCircle className="w-3.5 h-3.5 mr-1" />ปฏิเสธ
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
