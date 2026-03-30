import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, 
  Trash2, 
  Moon, 
  Sun, 
  Cpu, 
  Settings, 
  ChevronDown,
  Zap,
  ZapOff,
  Brain,
  Shield,
  Activity,
  Square,
  Loader2,
  LogOut,
  User,
  RefreshCw
} from 'lucide-react';
import { ChatMessage } from './components/ChatMessage';
import { Message, ChatState, ModelProfile } from './types';
import { auth } from './firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { Auth } from './components/Auth';
import { ErrorBoundary } from './components/ErrorBoundary';
import { signOut } from 'firebase/auth';

import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';

const STORAGE_KEY = 'ai_ops_chat_history';

function ChatManager() {
  const [user] = useAuthState(auth);
  const [state, setState] = useState<ChatState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return {
      messages: saved ? JSON.parse(saved) : [],
      isStreaming: true,
      isLoading: false,
      theme: 'light',
      profile: 'fast',
    };
  });

  const [input, setInput] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [profiles, setProfiles] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const getIcon = (id: string) => {
    switch (id) {
      case 'fast': return Zap;
      case 'thinking': return Brain;
      case 'pro': return Shield;
      default: return Cpu;
    }
  };

  const currentProfile = profiles.find(p => p.id === state.profile) || profiles[0] || { id: 'fast', label: 'Fast', model: 'qwen3:1.7b', description: 'Optimized for Latency' };

  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const response = await fetch('/api/profiles');
        const data = await response.json();
        setProfiles(data);
      } catch (error) {
        console.error('Failed to fetch profiles:', error);
        // Fallback
        setProfiles([
          { id: 'fast', label: 'Fast', model: 'qwen3:1.7b', description: 'Optimized for Latency' },
          { id: 'thinking', label: 'Think', model: 'qwen3:4b', description: 'Optimized for Accuracy' },
          { id: 'pro', label: 'Pro', model: 'qwen3-phantomx:1.0', description: 'Infrastructure & Coding' }
        ]);
      }
    };
    fetchProfiles();
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.messages));
  }, [state.messages]);

  useEffect(() => {
    scrollToBottom();
  }, [state.messages]);

  useEffect(() => {
    if (state.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [state.theme]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    if (!input.trim() || state.isLoading) return;

    // Create new abort controller for this request
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now(),
    };

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isLoading: true,
    }));
    setInput('');

    if (state.isStreaming) {
      await handleStreamingResponse(input, [...state.messages, userMessage], state.profile, controller.signal);
    } else {
      await handleNormalResponse(input, [...state.messages, userMessage], state.profile, controller.signal);
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const cleanAIResponse = (content: string) => {
    return content
      .replace(/^(Assistant|Assistant:|Assistant\s*:)\s*/i, '')
      .replace(/^response:\s*/i, '')
      .replace(/^I am an AI assistant\.\s*/i, '')
      .replace(/^I am a large language model\.\s*/i, '')
      .trim();
  };

  const handleNormalResponse = async (prompt: string, history: Message[], profile: ModelProfile, signal: AbortSignal) => {
    const assistantId = (Date.now() + 1).toString();
    
    // Add placeholder assistant message for thinking state
    setState(prev => ({
      ...prev,
      messages: [...prev.messages, {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
      }],
      isLoading: true,
    }));

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, stream: false, history, profile }),
        signal,
      });

      const data = await response.json();
      
      if (data.error) throw new Error(data.error);

      const cleanContent = cleanAIResponse(data.response || "");

      setState(prev => ({
        ...prev,
        messages: prev.messages.map(m => 
          m.id === assistantId ? { ...m, content: cleanContent } : m
        ),
        isLoading: false,
      }));
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Request aborted');
        return;
      }
      console.error(error);
      setState(prev => ({
        ...prev,
        messages: prev.messages.map(m => 
          m.id === assistantId ? { ...m, content: `⚠️ Error: ${error.message || "Failed to connect to the AI model."}` } : m
        ),
        isLoading: false,
      }));
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handleStreamingResponse = async (prompt: string, history: Message[], profile: ModelProfile, signal: AbortSignal) => {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, stream: true, history, profile }),
        signal,
      });

      if (!response.ok) {
        let errorMessage = 'Network response was not ok';
        try {
          const data = await response.json();
          errorMessage = data.error || errorMessage;
        } catch (e) {
          // If not JSON, use default
        }
        throw new Error(errorMessage);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      let assistantContent = '';
      const assistantId = (Date.now() + 1).toString();

      // Add initial empty assistant message
      setState(prev => ({
        ...prev,
        messages: [...prev.messages, {
          id: assistantId,
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
        }],
      }));

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            if (dataStr === '[DONE]') continue;

            try {
              const data = JSON.parse(dataStr);
              if (data.error) {
                setState(prev => ({
                  ...prev,
                  messages: prev.messages.map(m => 
                    m.id === assistantId ? { ...m, content: `⚠️ Error: ${data.error}` } : m
                  ),
                }));
                continue;
              }
              if (data.token) {
                assistantContent += data.token;

                const displayContent = cleanAIResponse(assistantContent);
                setState(prev => ({
                  ...prev,
                  messages: prev.messages.map(m => 
                    m.id === assistantId ? { ...m, content: displayContent } : m
                  ),
                }));
              }
            } catch (e) {
              // Ignore parse errors for partial chunks
            }
          }
        }
      }

      setState(prev => ({ ...prev, isLoading: false }));
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Streaming aborted');
        return;
      }
      console.error(error);
      setState(prev => ({ ...prev, isLoading: false }));
    } finally {
      abortControllerRef.current = null;
    }
  };

  const clearHistory = () => {
    setState(prev => ({ ...prev, messages: [] }));
    setShowClearConfirm(false);
  };

  const toggleTheme = () => {
    setState(prev => ({ ...prev, theme: prev.theme === 'light' ? 'dark' : 'light' }));
  };

  const toggleStreaming = () => {
    setState(prev => ({ ...prev, isStreaming: !prev.isStreaming }));
  };

  const setProfile = (profile: ModelProfile) => {
    setState(prev => ({ ...prev, profile }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleRetry = async () => {
    const lastUserMessage = [...state.messages].reverse().find(m => m.role === 'user');
    if (lastUserMessage && !state.isLoading) {
      const index = state.messages.indexOf(lastUserMessage);
      const newMessages = state.messages.slice(0, index + 1);
      
      setState(prev => ({
        ...prev,
        messages: newMessages,
        isLoading: true,
      }));
      
      const controller = new AbortController();
      abortControllerRef.current = controller;
      
      if (state.isStreaming) {
        await handleStreamingResponse(lastUserMessage.content, newMessages, state.profile, controller.signal);
      } else {
        await handleNormalResponse(lastUserMessage.content, newMessages, state.profile, controller.signal);
      }
    }
  };

  if (!user) return null;

  return (
    <div className="flex flex-col h-screen bg-background transition-colors duration-300">
      {/* Header */}
      <header className="flex items-center justify-between px-4 md:px-6 py-4 border-b bg-card/50 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3 md:gap-4">
          <h1 className="text-lg md:text-xl font-bold tracking-tight">
            ai.<span className="text-primary">ops</span>
          </h1>
          
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-secondary/20 rounded-full border border-border/50">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Secure Session</span>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          {/* User Profile */}
          <div className="flex items-center gap-2 md:gap-3 pr-2 md:pr-3 border-r border-border/50">
            <div className="flex flex-col items-end hidden sm:flex">
              <span className="text-xs font-bold text-foreground truncate max-w-[100px]">{user.displayName}</span>
              <span className="text-[10px] text-muted-foreground opacity-60 truncate max-w-[100px]">{user.email}</span>
            </div>
            <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center overflow-hidden shrink-0">
              {user.photoURL ? (
                <img src={user.photoURL} alt="Avatar" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <User size={16} className="text-primary" />
              )}
            </div>
            <button
              onClick={() => signOut(auth)}
              className="p-1.5 md:p-2 rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
              title="Sign Out"
            >
              <LogOut size={16} />
            </button>
          </div>

          <button
            onClick={toggleStreaming}
            className={`p-2 rounded-full transition-colors ${
              state.isStreaming ? 'text-primary bg-primary/10 dark:bg-primary/20' : 'text-muted-foreground bg-secondary/20 dark:bg-secondary/40'
            }`}
            title={state.isStreaming ? "Streaming Enabled" : "Streaming Disabled"}
          >
            {state.isStreaming ? <Zap size={16} fill="currentColor" /> : <ZapOff size={16} />}
          </button>
          
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full bg-secondary/20 dark:bg-secondary/40 text-muted-foreground hover:bg-secondary/30 dark:hover:bg-secondary/50 transition-colors"
          >
            {state.theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>

          <button
            onClick={() => setShowClearConfirm(true)}
            className="p-2 rounded-full bg-secondary/20 dark:bg-secondary/40 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            title="Clear History"
          >
            <Trash2 size={18} />
          </button>

          {state.messages.length > 0 && (
            <button
              onClick={handleRetry}
              disabled={state.isLoading}
              className="p-2 rounded-full bg-secondary/20 dark:bg-secondary/40 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors disabled:opacity-50"
              title="Retry Last Message"
            >
              <RefreshCw size={18} className={state.isLoading ? "animate-spin" : ""} />
            </button>
          )}
        </div>
      </header>

      <AnimatePresence>
        {showClearConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card p-6 rounded-2xl shadow-xl max-w-sm w-full border border-border"
            >
              <h3 className="text-lg font-bold mb-2">Clear History?</h3>
              <p className="text-muted-foreground mb-6">
                This will permanently delete all messages in this conversation.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="px-4 py-2 rounded-xl bg-secondary/20 dark:bg-secondary/40 hover:bg-secondary/30 dark:hover:bg-secondary/50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={clearHistory}
                  className="px-4 py-2 rounded-xl bg-destructive text-destructive-foreground hover:opacity-90 transition-colors shadow-md"
                >
                  Clear All
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto px-4 py-8 md:px-0">
        <div className="max-w-3xl mx-auto">
          {state.messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center">
              <h2 className="text-2xl font-bold mb-2">Welcome to ai.ops</h2>
              <p className="text-muted-foreground max-w-md">
                Your personal AI assistant powered by Qwen3. Start a conversation below.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-10 w-full max-w-lg">
                {[
                  "Explain quantum computing simply",
                  "Write a poem about a lonely robot",
                  "How do I make a perfect omelette?",
                  "What are some fun things to do in Tokyo?"
                ].map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(suggestion)}
                    className="p-4 text-left text-sm border rounded-2xl hover:bg-secondary/10 dark:hover:bg-secondary/20 transition-colors border-border"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col">
              {state.messages.map((msg, idx) => (
                <ChatMessage 
                  key={msg.id} 
                  message={msg} 
                  isStreaming={state.isLoading && idx === state.messages.length - 1 && msg.role === 'assistant'}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </main>

      {/* Input Area */}
      <footer className="p-4 md:p-6 bg-background/80 backdrop-blur-md border-t">
        <div className="max-w-3xl mx-auto relative">
          {state.isLoading && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute -top-12 left-0 flex items-center gap-3 px-4 py-2 bg-card/90 backdrop-blur-sm border border-border/50 rounded-full shadow-sm"
            >
              <div className="flex gap-1">
                <motion.div 
                  animate={{ scale: [1, 1.2, 1], opacity: [0.4, 1, 0.4] }}
                  transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut", delay: 0 }}
                  className="w-1.5 h-1.5 bg-primary rounded-full" 
                />
                <motion.div 
                  animate={{ scale: [1, 1.2, 1], opacity: [0.4, 1, 0.4] }}
                  transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut", delay: 0.2 }}
                  className="w-1.5 h-1.5 bg-primary rounded-full" 
                />
                <motion.div 
                  animate={{ scale: [1, 1.2, 1], opacity: [0.4, 1, 0.4] }}
                  transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut", delay: 0.4 }}
                  className="w-1.5 h-1.5 bg-primary rounded-full" 
                />
              </div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">
                ai.ops is thinking
              </span>
            </motion.div>
          )}
          <div className="relative flex items-end gap-2 bg-card border rounded-2xl p-1.5 md:p-2 shadow-lg focus-within:ring-2 ring-primary/20 transition-all">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message ai.ops..."
              className="flex-1 max-h-40 min-h-[44px] p-3 bg-transparent border-0 outline-none focus:ring-0 resize-none text-foreground placeholder:text-muted-foreground appearance-none"
              rows={1}
              style={{ height: 'auto' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = `${target.scrollHeight}px`;
              }}
            />

            {/* Profile Selector Dropdown */}
            <div className="relative mb-1" ref={profileMenuRef}>
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-2 p-2.5 rounded-xl bg-secondary/20 dark:bg-secondary/40 hover:bg-secondary/30 dark:hover:bg-secondary/50 transition-all border border-transparent hover:border-border/50"
                title={`Current Profile: ${currentProfile.label}`}
              >
                {(() => {
                  const Icon = getIcon(currentProfile.id);
                  return <Icon size={18} className="text-primary" />;
                })()}
                <ChevronDown size={12} className={`transition-transform duration-200 ${showProfileMenu ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {showProfileMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    className="absolute bottom-full right-0 mb-3 w-64 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden z-50"
                  >
                    <div className="p-2">
                      <div className="px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border/50 mb-1">
                        Select AI Profile
                      </div>
                      {profiles.map((p) => {
                        const Icon = getIcon(p.id);
                        return (
                          <button
                            key={p.id}
                            onClick={() => {
                              setProfile(p.id as ModelProfile);
                              setShowProfileMenu(false);
                            }}
                            className={`w-full flex items-start gap-3 p-3 rounded-xl transition-all ${
                              state.profile === p.id 
                                ? 'bg-primary/10 text-primary' 
                                : 'hover:bg-secondary/20 text-foreground'
                            }`}
                          >
                            <div className={`mt-0.5 p-2 rounded-lg ${state.profile === p.id ? 'bg-primary/20' : 'bg-secondary/40'}`}>
                              <Icon size={16} />
                            </div>
                            <div className="flex flex-col items-start text-left">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm">{p.label}</span>
                                {state.profile === p.id && (
                                  <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                                )}
                              </div>
                              <span className="text-[10px] font-mono opacity-60 mb-1">{p.model}</span>
                              <span className="text-[10px] text-muted-foreground leading-tight">{p.description}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {state.isLoading ? (
              <button
                onClick={handleStop}
                className="p-3 rounded-xl bg-secondary/40 dark:bg-secondary/60 text-foreground hover:bg-secondary/50 transition-all shadow-sm flex items-center justify-center"
                title="Stop Generation"
              >
                <Square size={18} fill="currentColor" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className={`p-3 rounded-xl transition-all ${
                  input.trim() 
                    ? 'bg-primary text-white hover:opacity-90 shadow-md' 
                    : 'bg-secondary/20 dark:bg-secondary/40 text-muted-foreground cursor-not-allowed'
                }`}
              >
                <Send size={20} />
              </button>
            )}
          </div>
          <p className="text-[10px] text-center mt-3 text-muted-foreground uppercase tracking-[0.2em] font-bold opacity-40">
            Powered by Qwen3 • phantomx 2026
          </p>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/login" element={<Auth />} />
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <ChatManager />
            </ProtectedRoute>
          } 
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}
