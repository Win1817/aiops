import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { User, Bot, Copy, Check, Code, Terminal } from 'lucide-react';
import { Message } from '../types';
import { CodeBlock } from './CodeBlock';
import { cn } from '../lib/utils';

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, isStreaming }) => {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderContent = () => {
    if (!message.content && !isStreaming) {
      return (
        <div className="flex items-center gap-3 py-1 px-0.5">
          <div className="flex items-center gap-2">
            <Bot size={14} className="text-primary animate-pulse" />
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.15em]">
              Thinking
            </span>
          </div>
          <div className="flex gap-1">
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.4, 1, 0.4] }}
              transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut", delay: 0 }}
              className="w-1 h-1 bg-primary rounded-full"
            />
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.4, 1, 0.4] }}
              transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut", delay: 0.2 }}
              className="w-1 h-1 bg-primary rounded-full"
            />
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.4, 1, 0.4] }}
              transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut", delay: 0.4 }}
              className="w-1 h-1 bg-primary rounded-full"
            />
          </div>
        </div>
      );
    }

    return (
      <div className={cn(
        "markdown-body prose prose-slate dark:prose-invert max-w-none",
        isUser ? "text-white prose-invert" : "text-foreground"
      )}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            pre: ({ children }) => <>{children}</>,
            code({ node, inline, className, children, ...props }: any) {
              const match = /language-(\w+)/.exec(className || '');
              const language = match ? match[1] : undefined;
              const value = String(children).replace(/\n$/, '');

              if (!inline && (match || value.includes('\n'))) {
                return (
                  <CodeBlock
                    language={language}
                    value={value}
                  />
                );
              }

              return (
                <code className={cn(
                  "px-1.5 py-0.5 rounded-md text-xs font-mono",
                  isUser ? "bg-white/20 text-white" : "bg-secondary/30 text-primary",
                  className
                )} {...props}>
                  {children}
                </code>
              );
            },
            p: ({ children }) => (
              <p className={cn(
                "mb-4 last:mb-0 leading-relaxed",
                isUser ? "text-white" : "text-foreground/90"
              )}>
                {children}
              </p>
            ),
            ul: ({ children }) => (
              <ul className={cn(
                "list-disc pl-6 mb-4 space-y-1",
                isUser ? "text-white" : "text-foreground/90"
              )}>
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol className={cn(
                "list-decimal pl-6 mb-4 space-y-1",
                isUser ? "text-white" : "text-foreground/90"
              )}>
                {children}
              </ol>
            ),
            li: ({ children }) => (
              <li className={cn(
                "text-sm leading-relaxed",
                isUser ? "text-white" : "text-foreground/90"
              )}>
                {children}
              </li>
            ),
            h1: ({ children }) => (
              <h1 className={cn(
                "text-2xl font-bold mb-4 mt-6 first:mt-0",
                isUser ? "text-white" : "text-foreground"
              )}>
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className={cn(
                "text-xl font-bold mb-3 mt-5",
                isUser ? "text-white" : "text-foreground"
              )}>
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className={cn(
                "text-lg font-bold mb-2 mt-4",
                isUser ? "text-white" : "text-foreground"
              )}>
                {children}
              </h3>
            ),
            blockquote: ({ children }) => (
              <blockquote className={cn(
                "border-l-4 pl-4 italic my-4",
                isUser ? "border-white/30 text-white/80" : "border-primary/30 text-muted-foreground"
              )}>
                {children}
              </blockquote>
            ),
            table: ({ children }) => (
              <div className={cn(
                "overflow-x-auto my-4 rounded-xl border",
                isUser ? "border-white/20" : "border-border/50"
              )}>
                <table className="w-full text-sm text-left border-collapse">
                  {children}
                </table>
              </div>
            ),
            th: ({ children }) => (
              <th className={cn(
                "p-3 font-bold border-b",
                isUser ? "bg-white/10 border-white/20 text-white" : "bg-secondary/20 border-border/50 text-foreground"
              )}>
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className={cn(
                "p-3 border-b",
                isUser ? "border-white/10 text-white/90" : "border-border/50 text-foreground/80"
              )}>
                {children}
              </td>
            ),
            a: ({ children, href }) => (
              <a 
                href={href} 
                target="_blank" 
                rel="noopener noreferrer" 
                className={cn(
                  "font-medium hover:underline",
                  isUser ? "text-white underline" : "text-primary"
                )}
              >
                {children}
              </a>
            ),
          }}
        >
          {message.content}
        </ReactMarkdown>
        {isStreaming && (
          <motion.span
            animate={{ opacity: [0, 1, 0] }}
            transition={{ repeat: Infinity, duration: 0.8 }}
            className="inline-block w-1.5 h-4 bg-primary ml-1 translate-y-0.5"
          />
        )}
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={cn("flex w-full mb-6", isUser ? "justify-end" : "justify-start")}
    >
      <div className={cn("flex max-w-[90%] md:max-w-[80%]", isUser ? "flex-row-reverse" : "flex-row")}>
        <div 
          className={cn(
            "flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center mt-1 shadow-sm",
            isUser ? "ml-3 bg-primary" : "mr-3 bg-secondary/20 dark:bg-secondary/40"
          )}
        >
          {isUser ? (
            <User size={18} className="text-white" />
          ) : (
            <Bot size={18} className="text-primary dark:text-white" />
          )}
        </div>

        <div
          className={cn(
            "relative p-4 rounded-2xl shadow-sm border transition-all duration-200",
            isUser
              ? "bg-primary text-white border-primary rounded-tr-none"
              : "bg-white dark:bg-card text-foreground border-border rounded-tl-none"
          )}
        >
          <div className="markdown-body">
            {renderContent()}
          </div>
          <div 
            className={cn(
              "text-[9px] mt-2 opacity-40 font-bold uppercase tracking-wider",
              isUser ? "text-right" : "text-left"
            )}
          >
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
