import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Message, UploadedFile, SearchHistory } from '@/types/ai4gp';

export const useAI4GPService = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([]);
  const [sessionMemory, setSessionMemory] = useState(true);
  const [includeLatestUpdates, setIncludeLatestUpdates] = useState(true);
  const [showResponseMetrics, setShowResponseMetrics] = useState(false);

  const buildSystemPrompt = useCallback((practiceContext: any, uploadedFiles: UploadedFile[], includeLatestUpdates: boolean) => {
    let prompt = `You are "AI 4 GP Service", an AI Assistant built specifically to help General Practitioners (GPs) in the UK NHS.

You understand and can explain:
- Clinical guidelines (NICE, SIGN, local protocols)
- Primary care workflows and consultation management
- Clinical coding, Read codes, SNOMED CT
- QOF indicators and clinical quality measures
- Prescribing guidance and drug interactions
- Referral pathways and secondary care liaison
- Clinical audit and quality improvement
- Patient safety and risk management
- Always stay professional, evidence-based, and clinically appropriate

${uploadedFiles.length > 0 ? `\nIMPORTANT: The user has uploaded ${uploadedFiles.length} file(s): ${uploadedFiles.map(f => f.name).join(', ')}. These files contain content that you can directly analyze and reference. You have full access to the file contents, so you can answer questions about them, summarize them, or analyze them without asking the user to upload again.` : ''}`;

    // Add practice context if available
    if (practiceContext.practiceName) {
      prompt += `\n\nCONTEXT ABOUT THE USER'S PRACTICE:
- Practice Name: ${practiceContext.practiceName}`;
      
      if (practiceContext.practiceManagerName) {
        prompt += `\n- Practice Manager: ${practiceContext.practiceManagerName}`;
      }
      
      if (practiceContext.pcnName) {
        prompt += `\n- Primary Care Network (PCN): ${practiceContext.pcnName}`;
      }
      
      if (practiceContext.neighbourhoodName) {
        prompt += `\n- Neighbourhood: ${practiceContext.neighbourhoodName}`;
      }
      
      if (practiceContext.otherPracticesInPCN?.length > 0) {
        prompt += `\n- Other practices in the same PCN: ${practiceContext.otherPracticesInPCN.join(', ')}`;
      }
      
      prompt += `\n\nWhen relevant to queries, you can reference this practice information to provide more personalized and contextual responses.`;
    }

    prompt += `\n\nKnowledge domains you should reference:
1. Clinical Guidelines (NICE, SIGN, specialty-specific protocols)
2. Primary Care Operations (consultation management, clinical workflows)
3. Clinical Coding & Documentation (Read codes, SNOMED CT, clinical templates)
4. Quality & Safety (QOF, clinical audit, patient safety incidents)
5. Prescribing & Therapeutics (BNF, drug interactions, safety alerts)
6. Referral Management (secondary care pathways, urgent referrals)

SPECIAL CAPABILITIES:
- Clinical Document Generation: When asked to create clinical documents, format your response with clear headings, sections, and structured content appropriate for healthcare settings.
- File Analysis: When files are uploaded by the user, you have access to their full content and can analyze, summarize, and answer questions about them directly.
${includeLatestUpdates ? '- Web Search: You have access to current web search capabilities for the latest NHS guidance, policy updates, and clinical developments. Use this when users ask about recent changes, current guidance, or up-to-date information.' : ''}

Always provide evidence-based, clinically appropriate advice that follows current NHS guidelines and best practices.`;

    return prompt;
  }, []);

  const handleSend = useCallback(async (practiceContext: any, selectedModel: string = 'gpt-5') => {
    if (!input.trim() && uploadedFiles.length === 0) return;
    
    // Enhance the message content when files are attached
    let messageContent = input;
    if (uploadedFiles.length > 0 && input.trim()) {
      messageContent = `${input}\n\n[Note: I have uploaded ${uploadedFiles.length} file(s): ${uploadedFiles.map(f => f.name).join(', ')}. Please analyze these files in relation to my question above.]`;
    } else if (uploadedFiles.length > 0 && !input.trim()) {
      messageContent = `Please analyze the uploaded file(s): ${uploadedFiles.map(f => f.name).join(', ')}`;
    }
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageContent,
      timestamp: new Date(),
      files: uploadedFiles.length > 0 ? [...uploadedFiles] : undefined
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setUploadedFiles([]);
    setIsLoading(true);

    // Create assistant message for streaming
    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      model: selectedModel,
      isStreaming: true
    };

    const messagesWithStreaming = [...newMessages, assistantMessage];
    setMessages(messagesWithStreaming);

    try {
      const startTime = Date.now();
      const systemPrompt = buildSystemPrompt(practiceContext, uploadedFiles, includeLatestUpdates);
      
      // Prepare messages for API
      const messagesForAPI = newMessages.map(msg => {
        let content = msg.content;
        
        // Add file contents to the message if present
        if (msg.files && msg.files.length > 0) {
          const fileContents = msg.files.map(file => 
            `\n\n--- File: ${file.name} ---\n${file.content}\n--- End of ${file.name} ---`
          ).join('');
          content += fileContents;
        }
        
        return {
          role: msg.role,
          content: content
        };
      });

      const requestBody = {
        messages: messagesForAPI,
        model: selectedModel,
        systemPrompt: systemPrompt,
        files: uploadedFiles.length > 0 ? uploadedFiles : undefined,
        enableWebSearch: includeLatestUpdates
      };

      // Get response from edge function
      const { data, error } = await supabase.functions.invoke('ai-4-pm-chat', {
        body: requestBody
      });

      if (error) {
        throw error;
      }

      const responseContent = data?.response || data?.content || 'No response received';
      
      // Simulate streaming by chunking the response
      const chunks = responseContent.split(' ');
      const chunkSize = Math.max(1, Math.floor(chunks.length / 20)); // ~20 updates
      let currentIndex = 0;
      let accumulatedContent = '';

      const streamChunks = () => {
        if (currentIndex < chunks.length) {
          const endIndex = Math.min(currentIndex + chunkSize, chunks.length);
          const chunkText = chunks.slice(currentIndex, endIndex).join(' ') + ' ';
          accumulatedContent += chunkText;
          currentIndex = endIndex;

          setMessages(prev => prev.map(msg => 
            msg.id === assistantMessageId 
              ? { ...msg, content: accumulatedContent.trim(), isStreaming: true }
              : msg
          ));

          if (currentIndex < chunks.length) {
            // Continue streaming with slight delay for better UX
            setTimeout(streamChunks, 50 + Math.random() * 50);
          } else {
            // Streaming complete
            const endTime = Date.now();
            const responseTime = endTime - startTime;
            
            setMessages(prev => prev.map(msg => 
              msg.id === assistantMessageId 
                ? { ...msg, content: responseContent, isStreaming: false, responseTime }
                : msg
            ));

            // Auto-save the search
            setTimeout(async () => {
              const finalMessages = [...newMessages, {
                ...assistantMessage,
                content: responseContent,
                isStreaming: false,
                responseTime
              }];
              await saveSearchAutomatically(finalMessages);
            }, 100);
          }
        }
      };

      // Start the streaming simulation
      streamChunks();


    } catch (error: any) {
      console.error('Streaming error:', error);
      
      const errorMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: `Error: ${error.message || 'Something went wrong. Please try again.'}`,
        timestamp: new Date(),
        isStreaming: false
      };

      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId ? errorMessage : msg
      ));
    } finally {
      setIsLoading(false);
    }
  }, [input, messages, uploadedFiles, buildSystemPrompt, includeLatestUpdates]);

  const saveSearchAutomatically = async (messagesData: Message[]) => {
    if (!user || messagesData.length === 0) return;

    try {
      // Generate title from first user message
      const firstUserMessage = messagesData.find(m => m.role === 'user');
      const title = firstUserMessage?.content.substring(0, 50) + (firstUserMessage?.content.length > 50 ? '...' : '') || 'Untitled Search';
      
      // Generate brief overview from AI responses
      const aiMessages = messagesData.filter(m => m.role === 'assistant');
      const overview = aiMessages.length > 0 
        ? aiMessages[0].content.substring(0, 100) + (aiMessages[0].content.length > 100 ? '...' : '')
        : 'No AI response';

      const { data, error } = await supabase
        .from('ai_4_pm_searches')
        .insert({
          user_id: user.id,
          title,
          brief_overview: overview,
          messages: messagesData as any
        })
        .select()
        .single();

      if (!error && data) {
        // Add the new search to the beginning of the local state instead of reloading everything
        const newSearch: SearchHistory = {
          id: data.id,
          title: data.title,
          brief_overview: data.brief_overview || undefined,
          messages: (data.messages as any) as Message[] || [],
          created_at: data.created_at,
          updated_at: data.updated_at
        };
        
        setSearchHistory(prev => [newSearch, ...prev.slice(0, 19)]); // Keep only 20 items
      }
    } catch (error) {
      // Silent failure for auto-save
      console.error('Error auto-saving search:', error);
    }
  };

  const handleNewSearch = useCallback(() => {
    setMessages([]);
    setUploadedFiles([]);
    setInput('');
  }, []);

  return {
    messages,
    setMessages,
    input,
    setInput,
    isLoading,
    uploadedFiles,
    setUploadedFiles,
    searchHistory,
    setSearchHistory,
    sessionMemory,
    setSessionMemory,
    includeLatestUpdates,
    setIncludeLatestUpdates,
    showResponseMetrics,
    setShowResponseMetrics,
    handleSend,
    handleNewSearch,
    saveSearchAutomatically
  };
};