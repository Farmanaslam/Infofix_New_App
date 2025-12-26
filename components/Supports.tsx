import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Bot,
  Send,
  Book,
  MessageSquare,
  Search,
  Plus,
  Settings as SettingsIcon,
  ChevronRight,
  User,
  AlertCircle,
  Laptop,
  Smartphone,
  Check,
  Edit2,
  Trash2,
  X,
  FileText,
  BrainCircuit,
  Save,
  Clock,
  Sparkles,
  Zap,
  RotateCcw,
  Wrench,
  Stethoscope,
  Mail,
  ListChecks,
  Lightbulb,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import {
  Ticket,
  AppSettings,
  SupportGuideline,
  Customer,
  Task,
} from "../types";
import { generateAIResponse } from "../services/geminiService";

interface SupportsProps {
  tickets: Ticket[];
  customers: Customer[];
  tasks: Task[];
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  canBeSaved?: boolean;
}

// Helper to find patterns in closed tickets
interface DiscoveredPattern {
  id: string;
  title: string;
  count: number;
  description: string;
  relatedTickets: Ticket[];
}

export default function Supports({
  tickets,
  customers,
  tasks,
  settings,
  onUpdateSettings,
}: SupportsProps) {
  // Layout State
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [showKnowledgeBase, setShowKnowledgeBase] = useState(true); // Default open for desktop
  const [ticketSearch, setTicketSearch] = useState("");
  const [kbTab, setKbTab] = useState<"protocols" | "insights">("insights"); // New Tab State

  // Chat State
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hello! I am your Advanced Service Agent. I have analyzed your entire workspace.\n\nI can help you diagnose issues, draft customer updates, or identifying recurring defects from your history.",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Knowledge Base State
  const [editingGuideline, setEditingGuideline] =
    useState<SupportGuideline | null>(null);
  const [isGuidelineModalOpen, setIsGuidelineModalOpen] = useState(false);
  const [kbSearch, setKbSearch] = useState("");

  const activeTicket = tickets.find((t) => t.id === selectedTicketId);

  // --- AUTO-LEARNING ENGINE ---
  // Analyzes resolved tickets to find frequent issues
  const insights = useMemo(() => {
    const resolved = tickets.filter((t) => t.status === "Resolved");
    const patterns: Record<string, Ticket[]> = {};

    // Keywords to cluster by
    const keywords = [
      "screen",
      "display",
      "battery",
      "charging",
      "water",
      "dead",
      "software",
      "keyboard",
      "hinge",
      "heat",
    ];

    resolved.forEach((t) => {
      const text = (
        t.issueDescription +
        " " +
        (t.deviceType || "")
      ).toLowerCase();
      let matchedKey = "general";

      for (const k of keywords) {
        if (text.includes(k)) {
          matchedKey = `${t.deviceType} - ${
            k.charAt(0).toUpperCase() + k.slice(1)
          }`;
          break;
        }
      }

      if (!patterns[matchedKey]) patterns[matchedKey] = [];
      patterns[matchedKey].push(t);
    });

    // Convert to array and filter for significance (at least 2 occurrences)
    const results: DiscoveredPattern[] = Object.entries(patterns)
      .filter(([key, list]) => list.length >= 2 && key !== "general")
      .map(([key, list], idx) => ({
        id: `pattern-${idx}`,
        title: `${key} Issues`,
        count: list.length,
        description: `Found ${list.length} resolved cases matching this pattern.`,
        relatedTickets: list,
      }))
      .sort((a, b) => b.count - a.count);

    return results;
  }, [tickets]);

  // --- SYSTEM CONTEXT BUILDER ---
  const systemContext = useMemo(() => {
    const totalTickets = tickets.length;
    const openTickets = tickets.filter(
      (t) => t.status !== "Resolved" && t.status !== "Rejected"
    ).length;

    // Schedule Load
    const today = new Date().toISOString().split("T")[0];
    const todaysTasks = tasks.filter((t) => t.date === today);
    const scheduleStatus =
      todaysTasks.length > 3 ? "HEAVY WORKLOAD" : "LIGHT WORKLOAD";

    return {
      stats: `Total Tickets: ${totalTickets}, Open: ${openTickets}. Shop Load: ${scheduleStatus} (${todaysTasks.length} tasks today).`,
      customerCount: customers.length,
    };
  }, [tickets, tasks, customers]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // --- HISTORICAL CONTEXT INJECTION ---
  useEffect(() => {
    if (activeTicket) {
      const cust = customers.find((c) => c.id === activeTicket.customerId);
      const custHistory = tickets.filter(
        (t) =>
          t.customerId === activeTicket.customerId && t.id !== activeTicket.id
      );

      // Find similar tickets (same device, similar issue keywords)
      const issueWords = activeTicket.issueDescription
        .split(" ")
        .filter((w) => w.length > 3)
        .slice(0, 3);
      const similar = tickets
        .filter(
          (t) =>
            t.status === "Resolved" &&
            t.deviceType === activeTicket.deviceType &&
            t.id !== activeTicket.id &&
            issueWords.some((w) =>
              t.issueDescription.toLowerCase().includes(w.toLowerCase())
            )
        )
        .slice(0, 3);

      const similarMsg =
        similar.length > 0
          ? `\n\n**Historical Intelligence:** I found ${similar.length} similar resolved tickets.\nExample: Ticket ${similar[0].ticketId} ("${similar[0].issueDescription}") was resolved on ${similar[0].date}.`
          : "";

      setMessages((prev) => [
        ...prev,
        {
          id: `context-${Date.now()}`,
          role: "assistant",
          content: `**Active Context: ${activeTicket.ticketId}**\nDevice: ${activeTicket.deviceType} - ${activeTicket.brand} ${activeTicket.model}\nIssue: ${activeTicket.issueDescription}\nCustomer: ${activeTicket.name} (${custHistory.length} prev visits)${similarMsg}`,
          timestamp: new Date(),
        },
      ]);
    }
  }, [selectedTicketId]);

  const handleSendMessage = async (text: string = inputValue) => {
    if (!text.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setIsTyping(true);

    // 1. Build Knowledge Base Context
    const kbContext = settings.supportGuidelines
      .map(
        (g) => `[PROTOCOL: ${g.title}]\nCategory: ${g.category}\n${g.content}`
      )
      .join("\n\n");

    // 2. Build Active Ticket Context
    let specificContext = "";
    if (activeTicket) {
      specificContext = `
            CURRENT ACTIVE TICKET:
            ID: ${activeTicket.ticketId}
            Device: ${activeTicket.brand} ${activeTicket.model} (${
        activeTicket.deviceType
      })
            Issue: ${activeTicket.issueDescription}
            Priority: ${activeTicket.priority}
            Status: ${activeTicket.status}
            Internal Notes: ${activeTicket.progressNote || "None"}
        `;

      // Inject History of this specific ticket
      if (activeTicket.history) {
        specificContext += `\nTICKET HISTORY LOGS:\n${activeTicket.history
          .map((h) => `- ${h.date}: ${h.action} (${h.details})`)
          .join("\n")}`;
      }
    } else {
      specificContext =
        "NO ACTIVE TICKET SELECTED. User is asking general questions.";
    }

    const systemPrompt = `
        You are a Self-Improving AI Service Manager for "INFOFIX SERVICES".
        
        SYSTEM STATS: ${systemContext.stats}
        
        INTERNAL KNOWLEDGE BASE (Your primary source of truth):
        ${kbContext}

        ${specificContext}

        GOAL:
        1. If a Protocol exists in the Knowledge Base, follow it.
        2. If discussing a specific ticket, use its details and history.
        3. If the user asks to "Draft a message", write a polite SMS/Email for the customer.
        4. If providing a technical solution not in the Knowledge Base, label it as "Suggested Fix".
        
        Tone: Professional, Data-Driven, Concise.
    `;

    try {
      const aiResponse = await generateAIResponse(text, systemPrompt);

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: aiResponse,
        timestamp: new Date(),
        canBeSaved: true,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content:
            "I'm having trouble connecting to the AI service right now. Please check your internet connection.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  // --- AUTO-GENERATE PROTOCOL FROM PATTERN ---
  const handleFormalizePattern = async (pattern: DiscoveredPattern) => {
    setIsGuidelineModalOpen(true);
    // Temporary loading state in modal inputs could be better, but we'll pre-fill

    const prompt = `
        Based on these ${pattern.count} resolved tickets about "${
      pattern.title
    }", draft a standard service protocol.
        
        Ticket Examples:
        ${pattern.relatedTickets
          .slice(0, 5)
          .map((t) => `- ${t.issueDescription} (Status: ${t.status})`)
          .join("\n")}
        
        Format:
        1. Diagnosis Steps
        2. Repair Solution
        3. Testing Verification
      `;

    const aiDraft = await generateAIResponse(
      prompt,
      "Drafting a Standard Operating Procedure (SOP)."
    );

    // Update the modal (using refs or state propagation)
    setTimeout(() => {
      const inputTitle = document.getElementById("g-title") as HTMLInputElement;
      const inputContent = document.getElementById(
        "g-content"
      ) as HTMLTextAreaElement;
      const inputCat = document.getElementById(
        "g-category"
      ) as HTMLInputElement;

      if (inputTitle) inputTitle.value = `SOP: ${pattern.title}`;
      if (inputContent) inputContent.value = aiDraft;
      if (inputCat) inputCat.value = "AI-Learned";
    }, 100);
  };

  const handleAddToKnowledgeBase = (content: string) => {
    setEditingGuideline(null);
    setTimeout(() => {
      const inputTitle = document.getElementById("g-title") as HTMLInputElement;
      const inputContent = document.getElementById(
        "g-content"
      ) as HTMLTextAreaElement;
      const inputCat = document.getElementById(
        "g-category"
      ) as HTMLInputElement;

      if (inputTitle)
        inputTitle.value = `Learned Solution: ${new Date().toLocaleDateString()}`;
      if (inputContent) inputContent.value = content;
      if (inputCat) inputCat.value = "General";
    }, 100);
    setIsGuidelineModalOpen(true);
  };

  const handleSaveGuideline = (g: SupportGuideline) => {
    let newGuidelines;
    if (settings.supportGuidelines.find((item) => item.id === g.id)) {
      newGuidelines = settings.supportGuidelines.map((item) =>
        item.id === g.id ? g : item
      );
    } else {
      newGuidelines = [...settings.supportGuidelines, g];
    }
    onUpdateSettings({ ...settings, supportGuidelines: newGuidelines });
    setIsGuidelineModalOpen(false);
    setEditingGuideline(null);
  };

  const handleDeleteGuideline = (id: string) => {
    const newGuidelines = settings.supportGuidelines.filter((g) => g.id !== id);
    onUpdateSettings({ ...settings, supportGuidelines: newGuidelines });
  };

  // --- QUICK ACTIONS ---
  const quickActions = activeTicket
    ? [
        {
          label: "Diagnose",
          icon: Stethoscope,
          prompt: `Diagnose the issue: "${activeTicket.issueDescription}" for ${activeTicket.brand} ${activeTicket.model}. Check if we have similar past tickets.`,
        },
        {
          label: "Draft Update",
          icon: Mail,
          prompt: `Draft a short, polite WhatsApp message for ${activeTicket.name} about their ${activeTicket.deviceType}. Status: ${activeTicket.status}.`,
        },
        {
          label: "Check Warranty",
          icon: FileText,
          prompt:
            "Does this repair look like a warranty case? What should I verify?",
        },
        {
          label: "Parts List",
          icon: ListChecks,
          prompt: `List potential spare parts needed for "${activeTicket.issueDescription}".`,
        },
      ]
    : [
        {
          label: "Shop Summary",
          icon: Clock,
          prompt:
            "Give me a summary of the shop's current workload, including open tickets and pending tasks.",
        },
        {
          label: "Identify Trends",
          icon: TrendingUp,
          prompt:
            "Analyze the resolved tickets and tell me what the top 3 most common repair issues are this month.",
        },
        {
          label: "Search KB",
          icon: Search,
          prompt:
            "Search the knowledge base for 'Screen Replacement' protocols.",
        },
      ];

  const filteredTickets = tickets
    .filter((t) => t?.status !== "Resolved" && t?.status !== "Rejected")
    .filter(
      (t) =>
        t?.ticketId?.toLowerCase().includes(ticketSearch?.toLowerCase()) ||
        t?.name?.toLowerCase().includes(ticketSearch?.toLowerCase())
    );

  const filteredKB = settings.supportGuidelines.filter(
    (g) =>
      g.title.toLowerCase().includes(kbSearch.toLowerCase()) ||
      g.category.toLowerCase().includes(kbSearch.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-140px)] flex gap-6">
      {/* LEFT COLUMN: Ticket Selector */}
      <div className="w-80 flex-shrink-0 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-3">
            <MessageSquare size={18} className="text-indigo-600" /> Ticket
            Context
          </h3>
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={ticketSearch}
              onChange={(e) => setTicketSearch(e.target.value)}
              placeholder="Search active tickets..."
              className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400 transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar bg-slate-50/30">
          {selectedTicketId && (
            <button
              onClick={() => setSelectedTicketId(null)}
              className="w-full mb-2 p-2 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold flex items-center justify-center gap-2 hover:bg-indigo-100 transition-colors"
            >
              <RotateCcw size={12} /> Reset to Global View
            </button>
          )}

          {filteredTickets.map((ticket) => (
            <button
              key={ticket.id}
              onClick={() => setSelectedTicketId(ticket.id)}
              className={`w-full text-left p-3 rounded-xl border transition-all group relative overflow-hidden ${
                selectedTicketId === ticket.id
                  ? "bg-white border-indigo-500 shadow-md ring-1 ring-indigo-500 z-10"
                  : "bg-white border-slate-100 hover:border-indigo-200 hover:shadow-sm"
              }`}
            >
              {selectedTicketId === ticket.id && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500"></div>
              )}
              <div className="flex justify-between items-start mb-1">
                <span
                  className={`text-xs font-bold ${
                    selectedTicketId === ticket.id
                      ? "text-indigo-600"
                      : "text-slate-500"
                  }`}
                >
                  {ticket.ticketId}
                </span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                    ticket.priority === "High"
                      ? "bg-red-50 text-red-600"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {ticket.priority}
                </span>
              </div>
              <div className="font-semibold text-slate-800 text-sm mb-0.5 truncate flex items-center gap-2">
                {ticket.deviceType === "Laptop" ? (
                  <Laptop size={12} className="text-slate-400" />
                ) : (
                  <Smartphone size={12} className="text-slate-400" />
                )}
                {ticket.brand} {ticket.model}
              </div>
              <div className="text-xs text-slate-500 line-clamp-2">
                {ticket.issueDescription}
              </div>
            </button>
          ))}
          {filteredTickets.length === 0 && (
            <div className="p-8 text-center text-slate-400 text-xs italic">
              <div className="bg-slate-100 w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2">
                <Search size={16} />
              </div>
              No matching active tickets.
            </div>
          )}
        </div>
      </div>

      {/* MIDDLE COLUMN: AI Agent Chat */}
      <div className="flex-1 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden relative">
        {/* Chat Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white z-10 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <BrainCircuit size={20} />
            </div>
            <div>
              <h2 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                INFOFIX AI{" "}
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                  PRO
                </span>
              </h2>
              <p className="text-xs text-slate-500 flex items-center gap-1">
                {activeTicket
                  ? `Active: ${activeTicket.ticketId}`
                  : "Global Operations Mode"}
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse ml-1"></span>
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowKnowledgeBase(!showKnowledgeBase)}
            className={`p-2 rounded-xl border transition-all flex items-center gap-2 text-xs font-bold ${
              showKnowledgeBase
                ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Book size={16} />
            {showKnowledgeBase ? "Hide Brain" : "Show Brain"}
          </button>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-slate-50/50 custom-scrollbar">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`flex flex-col gap-1 max-w-[85%] ${
                  msg.role === "user" ? "items-end" : "items-start"
                }`}
              >
                <div
                  className={`flex gap-3 ${
                    msg.role === "user" ? "flex-row-reverse" : ""
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center mt-1 shadow-sm ${
                      msg.role === "user"
                        ? "bg-slate-200 text-slate-600"
                        : "bg-indigo-100 text-indigo-600"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <User size={16} />
                    ) : (
                      <Bot size={16} />
                    )}
                  </div>
                  <div
                    className={`p-4 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${
                      msg.role === "user"
                        ? "bg-indigo-600 text-white rounded-tr-none"
                        : "bg-white text-slate-700 rounded-tl-none border border-slate-200"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>

                {/* SELF LEARNING ACTION */}
                {msg.role === "assistant" && msg.canBeSaved && (
                  <button
                    onClick={() => handleAddToKnowledgeBase(msg.content)}
                    className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-600 bg-white border border-indigo-100 px-3 py-1.5 rounded-full hover:bg-indigo-50 transition-colors ml-11 shadow-sm group"
                  >
                    <Sparkles
                      size={12}
                      className="text-amber-500 group-hover:scale-110 transition-transform"
                    />{" "}
                    Save this solution
                  </button>
                )}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="flex gap-3 max-w-[85%]">
                <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center mt-1 bg-indigo-100 text-indigo-600">
                  <Bot size={16} />
                </div>
                <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-slate-200 shadow-sm flex gap-1">
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></span>
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-100"></span>
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-200"></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Footer: Quick Actions + Input */}
        <div className="p-4 bg-white border-t border-slate-200">
          {/* Quick Actions Scroll */}
          <div className="flex gap-2 overflow-x-auto pb-3 mb-1 no-scrollbar">
            {quickActions.map((action, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(action.prompt)}
                className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 whitespace-nowrap hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors"
              >
                <action.icon size={14} /> {action.label}
              </button>
            ))}
          </div>

          <div className="relative flex items-center gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              placeholder={
                activeTicket
                  ? "Ask about current ticket, history, or protocols..."
                  : "Ask about business trends, schedule, or search info..."
              }
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-inner"
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={!inputValue.trim() || isTyping}
              className="p-3.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-200 active:scale-95"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Knowledge Base Manager (Collapsible) */}
      {showKnowledgeBase && (
        <div className="w-96 flex-shrink-0 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in slide-in-from-right-4 duration-300">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Book size={18} className="text-amber-500" /> System Brain
              </h3>
              <button
                onClick={() => {
                  setEditingGuideline(null);
                  setIsGuidelineModalOpen(true);
                }}
                className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
                title="Add Pipeline"
              >
                <Plus size={16} />
              </button>
            </div>

            {/* TABS */}
            <div className="flex bg-slate-200/50 p-1 rounded-xl mb-3">
              <button
                onClick={() => setKbTab("insights")}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  kbTab === "insights"
                    ? "bg-white shadow-sm text-indigo-600"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Insights {insights.length > 0 && `(${insights.length})`}
              </button>
              <button
                onClick={() => setKbTab("protocols")}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  kbTab === "protocols"
                    ? "bg-white shadow-sm text-indigo-600"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Protocols
              </button>
            </div>

            {kbTab === "protocols" && (
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={kbSearch}
                  onChange={(e) => setKbSearch(e.target.value)}
                  placeholder="Search protocols..."
                  className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-amber-400 transition-all"
                />
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {/* TAB CONTENT: INSIGHTS */}
            {kbTab === "insights" && (
              <div className="space-y-3">
                <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100 text-[10px] text-indigo-800 leading-relaxed font-medium">
                  <Lightbulb
                    size={14}
                    className="inline mr-1 mb-0.5 fill-current"
                  />
                  I analyze resolved tickets to find recurring issues. Click on
                  a pattern to generate a standardized protocol.
                </div>

                {insights.map((pattern) => (
                  <div
                    key={pattern.id}
                    className="p-4 bg-white border border-slate-200 rounded-xl hover:shadow-md transition-all group"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-slate-700 text-sm">
                        {pattern.title}
                      </h4>
                      <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {pattern.count} Cases
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mb-3">
                      {pattern.description}
                    </p>
                    <button
                      onClick={() => handleFormalizePattern(pattern)}
                      className="w-full py-2 bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 border border-slate-200 hover:border-indigo-200 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2"
                    >
                      <Sparkles size={12} /> Generate Protocol
                    </button>
                  </div>
                ))}
                {insights.length === 0 && (
                  <div className="text-center py-10 text-slate-400 text-xs">
                    No significant patterns detected yet. Resolve more tickets
                    to see insights.
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: PROTOCOLS */}
            {kbTab === "protocols" && (
              <>
                {filteredKB.map((g) => (
                  <div
                    key={g.id}
                    className="p-3 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 hover:shadow-sm transition-all group cursor-default"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[9px] font-bold uppercase tracking-wide text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {g.category}
                      </span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setEditingGuideline(g);
                            setIsGuidelineModalOpen(true);
                          }}
                          className="text-slate-400 hover:text-indigo-600"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          onClick={() => handleDeleteGuideline(g.id)}
                          className="text-slate-400 hover:text-red-600"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    <h4 className="font-bold text-slate-700 text-xs mb-1 line-clamp-1">
                      {g.title}
                    </h4>
                    <p className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed">
                      {g.content}
                    </p>
                  </div>
                ))}

                {filteredKB.length === 0 && (
                  <div className="text-center py-10 text-slate-400 border border-dashed border-slate-200 rounded-xl">
                    <p className="text-xs">No matching protocols.</p>
                    <button
                      onClick={() => setIsGuidelineModalOpen(true)}
                      className="text-indigo-600 text-xs font-bold mt-2 hover:underline"
                    >
                      Add New
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* GUIDELINE MODAL */}
      {isGuidelineModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800">
                {editingGuideline ? "Edit Knowledge" : "Teach System"}
              </h3>
              <button onClick={() => setIsGuidelineModalOpen(false)}>
                <X size={20} className="text-slate-400 hover:text-slate-600" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Title
                </label>
                <input
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  placeholder="e.g. Broken Screen SOP"
                  defaultValue={editingGuideline?.title}
                  id="g-title"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Category
                </label>
                <input
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  placeholder="e.g. Hardware"
                  defaultValue={editingGuideline?.category}
                  id="g-category"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Protocol Content
                </label>
                <textarea
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none h-40 resize-none font-mono"
                  placeholder="1. Check physical damage...&#10;2. Verify warranty..."
                  defaultValue={editingGuideline?.content}
                  id="g-content"
                />
              </div>
              <button
                onClick={() => {
                  const title = (
                    document.getElementById("g-title") as HTMLInputElement
                  ).value;
                  const category = (
                    document.getElementById("g-category") as HTMLInputElement
                  ).value;
                  const content = (
                    document.getElementById("g-content") as HTMLTextAreaElement
                  ).value;

                  if (title && content) {
                    handleSaveGuideline({
                      id: editingGuideline?.id || Date.now().toString(),
                      title,
                      category,
                      content,
                    });
                  }
                }}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-indigo-200"
              >
                Save to Memory
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
