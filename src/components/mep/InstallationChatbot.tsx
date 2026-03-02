/**
 * Installation Chatbot
 * 
 * AI-powered chat interface for plumbing installation assistance.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import {
  MessageCircle,
  Send,
  Loader2,
  Trash2,
  RefreshCw,
  Bot,
  User,
  Sparkles,
  X,
  Wrench,
  AlertTriangle,
  ShoppingCart,
  HelpCircle,
} from 'lucide-react';
import { useInstallationChat, type ChatMessage as ChatMessageType } from '@/contexts/InstallationChatContext';

// =============================================================================
// QUICK ACTION BUTTONS
// =============================================================================

interface QuickActionsProps {
  onAction: (message: string) => void;
  disabled?: boolean;
}

const QuickActions: React.FC<QuickActionsProps> = ({ onAction, disabled }) => {
  const actions = [
    { icon: HelpCircle, label: 'Explain this step', message: 'Can you explain the current installation step in more detail?' },
    { icon: ShoppingCart, label: 'Product alternatives', message: 'What are some alternative products I could use that are more cost-effective or higher quality?' },
    { icon: AlertTriangle, label: 'Safety tips', message: 'What safety precautions should I take for this installation?' },
    { icon: Wrench, label: 'Tool alternatives', message: 'What tools do I need and are there any alternatives if I don\'t have the exact ones?' },
  ];
  
  return (
    <div className="flex flex-wrap gap-1.5">
      {actions.map((action, idx) => (
        <Button
          key={idx}
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1"
          onClick={() => onAction(action.message)}
          disabled={disabled}
        >
          <action.icon className="h-3 w-3" />
          {action.label}
        </Button>
      ))}
    </div>
  );
};

// =============================================================================
// CHAT MESSAGE
// =============================================================================

interface ChatMessageProps {
  message: ChatMessageType;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';
  
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`
        w-8 h-8 rounded-full flex items-center justify-center shrink-0
        ${isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'}
      `}>
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      
      <div className={`
        flex-1 p-3 rounded-lg max-w-[80%]
        ${isUser ? 'bg-primary text-primary-foreground ml-auto' : 'bg-muted'}
      `}>
        <div className="text-sm whitespace-pre-wrap leading-relaxed">
          {message.content}
          {message.isStreaming && (
            <span className="inline-block w-1.5 h-4 bg-current ml-0.5 animate-pulse" />
          )}
        </div>
        {!message.isStreaming && (
          <p className={`text-xs mt-1 ${isUser ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>
    </div>
  );
};

// =============================================================================
// MAIN CHATBOT COMPONENT
// =============================================================================

interface InstallationChatbotProps {
  isOpen: boolean;
  onClose: () => void;
  stepContext?: string;
}

export const InstallationChatbot: React.FC<InstallationChatbotProps> = ({
  isOpen,
  onClose,
  stepContext,
}) => {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
    retryLastMessage,
  } = useInstallationChat();
  
  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);
  
  // Focus input on mount
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);
  
  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const message = input;
    setInput('');
    await sendMessage(message, stepContext ? { stepId: stepContext } : undefined);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  const handleQuickAction = async (message: string) => {
    await sendMessage(message, stepContext ? { stepId: stepContext } : undefined);
  };
  
  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-[450px] sm:max-w-[450px] p-0">
        <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b p-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold">Plumbing AI Assistant</h2>
            <p className="text-xs text-muted-foreground">Ask anything about your installation</p>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <Button size="sm" variant="ghost" onClick={clearMessages}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          {onClose && (
            <Button size="icon" variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      
      {/* Messages */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-8">
              <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium mb-2">How can I help?</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
                I'm a master plumber AI assistant. Ask me about pipe sizing, 
                installation steps, product recommendations, or code compliance.
              </p>
              <QuickActions onAction={handleQuickAction} disabled={isLoading} />
            </div>
          ) : (
            messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))
          )}
          
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <div className="flex items-center justify-between">
                <span className="text-sm text-destructive">{error}</span>
                <Button size="sm" variant="ghost" onClick={retryLastMessage}>
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Retry
                </Button>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
      
      {/* Quick Actions (when chat has messages) */}
      {messages.length > 0 && (
        <div className="border-t p-3 shrink-0">
          <QuickActions onAction={handleQuickAction} disabled={isLoading} />
        </div>
      )}
      
      {/* Input */}
      <div className="border-t p-4 shrink-0">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your plumbing installation..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button onClick={handleSend} disabled={isLoading || !input.trim()}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
