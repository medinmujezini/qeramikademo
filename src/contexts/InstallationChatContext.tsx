/**
 * Installation Chat Context
 * 
 * Manages chat state and MEP context for the AI plumbing assistant.
 */

import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import type { MEPFixture, MEPNode, MEPRoute } from '@/types/mep';
import { generateInstallationGuide, formatGuideForAI } from '@/utils/installationGuideGenerator';

// =============================================================================
// TYPES
// =============================================================================

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  context?: {
    fixtureId?: string;
    routeId?: string;
    stepId?: string;
  };
  isStreaming?: boolean;
}

export interface ProjectContext {
  fixtures: MEPFixture[];
  nodes: MEPNode[];
  routes: MEPRoute[];
  projectName: string;
}

interface InstallationChatContextType {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  projectContext: ProjectContext | null;
  
  // Actions
  sendMessage: (content: string, context?: ChatMessage['context']) => Promise<void>;
  clearMessages: () => void;
  setProjectContext: (context: ProjectContext) => void;
  retryLastMessage: () => Promise<void>;
}

// =============================================================================
// CONTEXT
// =============================================================================

const InstallationChatContext = createContext<InstallationChatContextType | undefined>(undefined);

// =============================================================================
// PROVIDER
// =============================================================================

interface InstallationChatProviderProps {
  children: ReactNode;
}

export const InstallationChatProvider: React.FC<InstallationChatProviderProps> = ({ children }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectContext, setProjectContext] = useState<ProjectContext | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Generate context string for AI
  const generateContextForAI = useCallback((): string => {
    if (!projectContext) return '';
    
    const guide = generateInstallationGuide(
      projectContext.fixtures,
      projectContext.routes,
      projectContext.nodes,
      projectContext.projectName
    );
    
    return formatGuideForAI(guide);
  }, [projectContext]);

  const sendMessage = useCallback(async (content: string, context?: ChatMessage['context']) => {
    if (!content.trim()) return;
    
    // Add user message
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
      context,
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);
    
    // Create assistant message placeholder for streaming
    const assistantMessageId = crypto.randomUUID();
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    };
    
    setMessages(prev => [...prev, assistantMessage]);
    
    try {
      // Cancel any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      
      const projectContextString = generateContextForAI();
      
      // Build message history for context
      const messageHistory = messages.slice(-10).map(m => ({
        role: m.role,
        content: m.content,
      }));
      
      // Call edge function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/plumbing-assistant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [
            ...messageHistory,
            { role: 'user', content },
          ],
          projectContext: projectContextString,
          stepContext: context?.stepId,
        }),
        signal: abortControllerRef.current.signal,
      });
      
      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please wait a moment and try again.');
        }
        if (response.status === 402) {
          throw new Error('Usage limit reached. Please check your account.');
        }
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to get response');
      }
      
      // Handle streaming response
      if (!response.body) {
        throw new Error('No response body');
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let textBuffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        textBuffer += decoder.decode(value, { stream: true });
        
        // Process line by line
        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullContent += delta;
              setMessages(prev => prev.map(m =>
                m.id === assistantMessageId
                  ? { ...m, content: fullContent }
                  : m
              ));
            }
          } catch {
            // Partial JSON, put back in buffer
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }
      
      // Mark streaming complete
      setMessages(prev => prev.map(m =>
        m.id === assistantMessageId
          ? { ...m, isStreaming: false }
          : m
      ));
      
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      
      // Update assistant message with error
      setMessages(prev => prev.map(m =>
        m.id === assistantMessageId
          ? { ...m, content: `Sorry, I encountered an error: ${errorMessage}`, isStreaming: false }
          : m
      ));
    } finally {
      setIsLoading(false);
    }
  }, [messages, generateContextForAI]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const retryLastMessage = useCallback(async () => {
    // Find the last user message
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMessage) return;
    
    // Remove last assistant message
    setMessages(prev => {
      const newMessages = [...prev];
      if (newMessages[newMessages.length - 1]?.role === 'assistant') {
        newMessages.pop();
      }
      if (newMessages[newMessages.length - 1]?.role === 'user') {
        newMessages.pop();
      }
      return newMessages;
    });
    
    // Resend
    await sendMessage(lastUserMessage.content, lastUserMessage.context);
  }, [messages, sendMessage]);

  return (
    <InstallationChatContext.Provider value={{
      messages,
      isLoading,
      error,
      projectContext,
      sendMessage,
      clearMessages,
      setProjectContext,
      retryLastMessage,
    }}>
      {children}
    </InstallationChatContext.Provider>
  );
};

// =============================================================================
// HOOK
// =============================================================================

export const useInstallationChat = (): InstallationChatContextType => {
  const context = useContext(InstallationChatContext);
  if (context === undefined) {
    throw new Error('useInstallationChat must be used within an InstallationChatProvider');
  }
  return context;
};
