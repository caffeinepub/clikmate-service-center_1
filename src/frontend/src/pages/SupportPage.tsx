import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "@/utils/router";
import {
  ArrowLeft,
  Headphones,
  Inbox,
  Mail,
  MessageCircle,
  Phone,
  Shield,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type {
  backendInterface as ExtBackend,
  OrderRecord,
  SupportTicket,
} from "../backend.d";
import { useActor } from "../hooks/useActor";

export default function SupportPage() {
  const phone = localStorage.getItem("clikmate_customer_phone") || "";
  const { actor, isFetching } = useActor();

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [complaint, setComplaint] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    if (!actor || !phone) return;
    setLoading(true);
    try {
      const [t, o] = await Promise.all([
        (actor as unknown as ExtBackend).getSupportTickets(phone),
        (actor as unknown as ExtBackend).getOrdersByPhone(phone),
      ]);
      setTickets(t);
      setOrders(o);
    } catch (e) {
      console.error("Support load error:", e);
    } finally {
      setLoading(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: loadData defined in component scope, actor/phone/isFetching are the real deps
  useEffect(() => {
    if (!isFetching && actor && phone) loadData();
    else if (!isFetching) setLoading(false);
  }, [actor, isFetching, phone]);

  const handleSubmit = async () => {
    if (!actor || !phone) return;
    if (!selectedOrderId || !complaint.trim()) {
      toast.error("Please select an order and describe the issue.");
      return;
    }
    setSubmitting(true);
    try {
      await (actor as unknown as ExtBackend).submitSupportTicket(
        selectedOrderId,
        phone,
        complaint.trim(),
      );
      toast.success("Support ticket submitted successfully!");
      setModalOpen(false);
      setSelectedOrderId("");
      setComplaint("");
      const updated = await (actor as unknown as ExtBackend).getSupportTickets(
        phone,
      );
      setTickets(updated);
    } catch (e) {
      console.error("Submit ticket error:", e);
      toast.error("Failed to submit ticket. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Login gate
  if (!phone) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 flex items-center justify-center p-4">
        <Card className="bg-white/10 border-white/20 text-white max-w-sm w-full">
          <CardHeader className="text-center">
            <Shield className="w-12 h-12 text-yellow-400 mx-auto mb-2" />
            <CardTitle className="text-white">Login Required</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-white/70 mb-4 text-sm">
              Please log in to access Help & Support.
            </p>
            <Link to="/">
              <Button className="w-full" data-ocid="support.login.button">
                Go to Login
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900">
      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur-md bg-slate-900/80 border-b border-white/10 shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/vault">
            <Button
              variant="ghost"
              size="sm"
              data-ocid="support.back.button"
              className="text-white hover:bg-white/10 gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </Link>
          <div className="flex items-center gap-2 ml-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-400/20 flex items-center justify-center">
              <Headphones className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-white font-bold text-base leading-none">
                Help & Support
              </h1>
              <p className="text-white/50 text-xs mt-0.5">{phone}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-8">
        {/* Section 1: Contact Cards */}
        <section data-ocid="support.contact.section">
          <h2 className="text-white font-bold text-lg mb-4">
            Need Immediate Assistance?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Call */}
            <a href="tel:9508911400" data-ocid="support.call.link">
              <Card className="bg-white/10 border-white/20 hover:bg-white/15 transition-colors cursor-pointer h-full">
                <CardContent className="p-5 flex flex-col items-center text-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center">
                    <Phone className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">Call the Shop</p>
                    <p className="text-white/60 text-sm mt-1">9508911400</p>
                  </div>
                </CardContent>
              </Card>
            </a>

            {/* Email */}
            <a href="mailto:support@clikmate.in" data-ocid="support.email.link">
              <Card className="bg-white/10 border-white/20 hover:bg-white/15 transition-colors cursor-pointer h-full">
                <CardContent className="p-5 flex flex-col items-center text-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/20 flex items-center justify-center">
                    <Mail className="w-6 h-6 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">Email Us</p>
                    <p className="text-white/60 text-sm mt-1">
                      support@clikmate.in
                    </p>
                  </div>
                </CardContent>
              </Card>
            </a>

            {/* WhatsApp */}
            <Card className="bg-white/10 border-white/20 h-full">
              <CardContent className="p-5 flex flex-col items-center text-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-green-500/20 flex items-center justify-center">
                  <MessageCircle className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <p className="text-white font-semibold">WhatsApp Support</p>
                  <p className="text-white/60 text-sm mt-1">
                    Instant chat help
                  </p>
                </div>
                <a
                  href="https://wa.me/919508911400"
                  target="_blank"
                  rel="noopener noreferrer"
                  data-ocid="support.whatsapp.button"
                >
                  <Button className="bg-green-600 hover:bg-green-700 text-white w-full">
                    Chat with Us
                  </Button>
                </a>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Section 2: Support Tickets */}
        <section data-ocid="support.tickets.section">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-bold text-lg">
              My Support Requests
            </h2>
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700"
                  data-ocid="support.report_issue.button"
                >
                  + Report an Issue
                </Button>
              </DialogTrigger>
              <DialogContent
                className="bg-slate-900 border-white/20 text-white"
                data-ocid="support.report_issue.modal"
              >
                <DialogHeader>
                  <DialogTitle className="text-white">
                    Report an Issue
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div>
                    <label
                      htmlFor="support-order-select"
                      className="text-white/70 text-sm mb-1.5 block"
                    >
                      Related Order ID
                    </label>
                    <Select
                      value={selectedOrderId}
                      onValueChange={setSelectedOrderId}
                    >
                      <SelectTrigger
                        id="support-order-select"
                        className="bg-white/10 border-white/20 text-white"
                        data-ocid="support.order.select"
                      >
                        <SelectValue placeholder="Select an order..." />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-white/20">
                        {orders.map((o) => (
                          <SelectItem
                            key={String(o.id)}
                            value={String(o.id)}
                            className="text-white hover:bg-white/10"
                          >
                            #{String(o.id)} — {o.serviceType || "Order"}
                          </SelectItem>
                        ))}
                        {orders.length === 0 && (
                          <SelectItem
                            value="__none"
                            disabled
                            className="text-white/50"
                          >
                            No past orders found
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label
                      htmlFor="support-complaint"
                      className="text-white/70 text-sm mb-1.5 block"
                    >
                      Complaint / Message
                    </label>
                    <Textarea
                      id="support-complaint"
                      placeholder="Describe your issue in detail..."
                      value={complaint}
                      onChange={(e) => setComplaint(e.target.value)}
                      rows={4}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/40 resize-none"
                      data-ocid="support.complaint.textarea"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="ghost"
                    onClick={() => setModalOpen(false)}
                    className="text-white/70 hover:text-white hover:bg-white/10"
                    data-ocid="support.report_issue.cancel_button"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="bg-indigo-600 hover:bg-indigo-700"
                    data-ocid="support.report_issue.submit_button"
                  >
                    {submitting ? "Submitting..." : "Submit Ticket"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {loading ? (
            <div
              className="flex items-center justify-center py-12"
              data-ocid="support.tickets.loading_state"
            >
              <div className="text-white/50 text-sm">Loading tickets...</div>
            </div>
          ) : tickets.length === 0 ? (
            <Card
              className="bg-white/10 border-white/20"
              data-ocid="support.tickets.empty_state"
            >
              <CardContent className="py-12 flex flex-col items-center text-center gap-3">
                <Inbox className="w-12 h-12 text-white/30" />
                <p className="text-white/60 text-sm">
                  No active issues. Click &lsquo;Report an Issue&rsquo; if you
                  need help with a recent order.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/20">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5">
                    <th className="text-left text-white/60 font-medium px-4 py-3 whitespace-nowrap">
                      Issue ID
                    </th>
                    <th className="text-left text-white/60 font-medium px-4 py-3 whitespace-nowrap">
                      Related Order
                    </th>
                    <th className="text-left text-white/60 font-medium px-4 py-3">
                      Complaint
                    </th>
                    <th className="text-left text-white/60 font-medium px-4 py-3 whitespace-nowrap">
                      Date
                    </th>
                    <th className="text-left text-white/60 font-medium px-4 py-3 whitespace-nowrap">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t, idx) => (
                    <tr
                      key={String(t.id)}
                      className="border-b border-white/10 hover:bg-white/5"
                      data-ocid={`support.ticket.item.${idx + 1}`}
                    >
                      <td className="px-4 py-3 text-white font-mono whitespace-nowrap">
                        #{String(t.id)}
                      </td>
                      <td className="px-4 py-3 text-white/80 whitespace-nowrap">
                        #{t.orderId}
                      </td>
                      <td className="px-4 py-3 text-white/70">
                        {t.complaint.length > 80
                          ? `${t.complaint.slice(0, 80)}...`
                          : t.complaint}
                      </td>
                      <td className="px-4 py-3 text-white/60 whitespace-nowrap">
                        {new Date(
                          Number(t.createdAt / 1_000_000n),
                        ).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        {t.resolved ? (
                          <Badge className="bg-green-500/20 text-green-300 border-green-500/30">
                            Resolved
                          </Badge>
                        ) : (
                          <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30">
                            Open
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="text-center py-6 text-white/30 text-xs">
        © {new Date().getFullYear()}. Built with love using{" "}
        <a
          href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
          className="hover:text-white/60 underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          caffeine.ai
        </a>
      </footer>
    </div>
  );
}
