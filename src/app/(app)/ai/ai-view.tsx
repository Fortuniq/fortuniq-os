"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, Send, User } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

type Message = { role: "user" | "assistant"; content: string };

const EXAMPLE_PROMPTS = [
  "Create a quotation for 20,000L diesel to a mining client",
  "Summarise this tender in three bullet points",
  "Write a follow-up email to a customer with an overdue invoice",
  "Generate an onboarding programme for a Sales Executive",
  "Prepare meeting minutes for a supplier review",
  "Create an SOP for depot loading safety checks",
  "Generate a 5-question training quiz on POPIA",
  "Review this supplier's payment terms and flag risks",
];

export function AIView() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    setError(null);
    const nextMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
      } else {
        setMessages([...nextMessages, { role: "assistant", content: data.reply }]);
      }
    } catch {
      setError("Couldn't reach the AI service. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <PageHeader title="FortunIQ Intelligence" description="Ask FortunIQ Intelligence to draft, summarise, or prepare anything." />

      {messages.length === 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
          {EXAMPLE_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => send(p)}
              className="text-left text-sm text-navy bg-white border border-border rounded-lg px-4 py-3 hover:border-orange hover:bg-orange/5 transition-colors"
            >
              &ldquo;{p}&rdquo;
            </button>
          ))}
        </div>
      )}

      <Card className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
              {m.role === "assistant" && (
                <div className="w-8 h-8 rounded-full bg-navy flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-orange" />
                </div>
              )}
              <div
                className={`max-w-[75%] rounded-xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                  m.role === "user" ? "bg-navy text-white" : "bg-surface text-navy"
                }`}
              >
                {m.content}
              </div>
              {m.role === "user" && (
                <div className="w-8 h-8 rounded-full bg-orange/15 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-orange" />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-navy flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-orange animate-pulse" />
              </div>
              <div className="bg-surface text-light-grey rounded-xl px-4 py-2.5 text-sm">Thinking…</div>
            </div>
          )}
          {error && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="border-t border-border p-3 flex items-center gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask FortunIQ Intelligence anything…"
            className="flex-1 px-4 py-2.5 rounded-lg bg-surface border border-border text-sm focus:outline-none focus:ring-2 focus:ring-orange/40 focus:border-orange"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="w-10 h-10 rounded-lg bg-navy text-white flex items-center justify-center hover:bg-orange transition-colors disabled:opacity-40"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </Card>
    </div>
  );
}
