import { useState, useCallback, useEffect } from 'react';
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
  const [selectedModel, setSelectedModel] = useState('gpt-5');
  const [lightningMode, setLightningMode] = useState(false); // New lightning mode for ultra-fast responses

  const buildSystemPrompt = useCallback((practiceContext: any, uploadedFiles: UploadedFile[], includeLatestUpdates: boolean, useSimpleMode: boolean = false) => {
    // Use lightweight prompt for simple queries (like API tester)
    if (useSimpleMode && uploadedFiles.length === 0) {
      return `You are an expert UK NHS GP assistant. Use only UK primary care sources including NICE guidelines, NHS.uk, BNF, MHRA alerts, the Green Book, and local ICB protocols. Do not use non-UK or non-NHS sources. Present information in concise, GP-friendly bullet points using UK medical terminology.`;
    }

    // Full system prompt for complex queries
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


  // LIGHTNING MODE: Ultra-fast responses matching API tester speed
  const handleLightningSend = useCallback(async () => {
    const startTime = Date.now();
    
    // Simple system prompt (same as API tester)
    const lightningSystemPrompt = `You are an expert UK NHS GP assistant. Use only UK primary care sources including NICE guidelines, NHS.uk, BNF, MHRA alerts, the Green Book, and local ICB protocols. Do not use non-UK or non-NHS sources. Present information in concise, GP-friendly bullet points using UK medical terminology.`;
    
    // Create user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    // Create assistant message  
    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      model: selectedModel,
      isStreaming: true
    };

    setMessages([userMessage, assistantMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Ultra-simple request (matching API tester)
      const { data, error } = await supabase.functions.invoke('api-testing-service', {
        body: {
          prompt: input,
          model: selectedModel,
          systemPrompt: lightningSystemPrompt
        }
      });

      if (error) throw error;

      const responseTime = Date.now() - startTime;
      const responseContent = data?.response || 'No response received';

      // Update with final response
      setMessages([
        userMessage,
        {
          ...assistantMessage,
          content: responseContent,
          isStreaming: false,
          responseTime
        }
      ]);

    } catch (error: any) {
      console.error('Lightning mode error:', error);
      setMessages([
        userMessage,
        {
          ...assistantMessage,
          content: `Error: ${error.message || 'Something went wrong. Please try again.'}`,
          isStreaming: false
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, selectedModel]);

  // ENHANCED MODE: Full-featured mode with advanced web search
  const handleEnhancedSend = useCallback(async (practiceContext: any, selectedModel: string = 'gpt-5') => {
    const startTime = Date.now();
    
    // Enhanced system prompt
    const enhancedSystemPrompt = buildSystemPrompt(practiceContext, uploadedFiles, includeLatestUpdates, false);
    
    // Enhance the message content when files are attached
    let messageContent = input;
    if (uploadedFiles.length > 0 && input.trim()) {
      messageContent = `${input}\n\n[Note: I have uploaded ${uploadedFiles.length} file(s): ${uploadedFiles.map(f => f.name).join(', ')}. Please analyze these files in relation to my question above.]`;
    } else if (uploadedFiles.length > 0 && !input.trim()) {
      messageContent = `Please analyze the uploaded file(s): ${uploadedFiles.map(f => f.name).join(', ')}`;
    }
    
    // Create user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageContent,
      timestamp: new Date(),
      files: uploadedFiles.length > 0 ? [...uploadedFiles] : undefined
    };

    // Create assistant message  
    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      model: selectedModel,
      isStreaming: true
    };

    const newMessages = [...messages, userMessage];
    setMessages([...newMessages, assistantMessage]);
    setInput('');
    setUploadedFiles([]);
    setIsLoading(true);

    try {
      // Prepare messages for API
      const messagesForAPI = newMessages.map(msg => {
        let content = msg.content;
        
        // Add file contents if files exist
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

      // Enhanced request body
      const requestBody = {
        messages: messagesForAPI,
        model: selectedModel,
        systemPrompt: enhancedSystemPrompt,
        enableWebSearch: includeLatestUpdates,
        searchDepth: 'advanced',
        files: uploadedFiles.length > 0 ? uploadedFiles : undefined
      };

      console.log('Making enhanced AI request with full web search capabilities');

      // Get response from enhanced edge function
      const { data, error } = await supabase.functions.invoke('ai-4-gp-enhanced', {
        body: requestBody
      });

      if (error) throw error;

      const responseTime = Date.now() - startTime;
      const responseContent = data?.response || 'No response received';

      // Update with final response
      const finalMessages = [
        ...newMessages,
        {
          ...assistantMessage,
          content: responseContent,
          isStreaming: false,
          responseTime,
          searchPerformed: data?.searchPerformed || false
        }
      ];

      setMessages(finalMessages);

      // Save search history in background
      Promise.resolve().then(() => saveSearchAutomatically(finalMessages));

    } catch (error: any) {
      console.error('Enhanced mode error:', error);
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessage.id 
          ? {
              ...msg,
              content: `Error: ${error.message || 'Something went wrong. Please try again.'}`,
              isStreaming: false
            }
          : msg
      ));
    } finally {
      setIsLoading(false);
    }
  }, [input, messages, uploadedFiles, buildSystemPrompt, includeLatestUpdates]);

  // Main send handler that routes to appropriate mode
  const handleSend = useCallback(async (practiceContext: any, selectedModel: string = 'gpt-5') => {
    if (!input.trim() && uploadedFiles.length === 0) return;
    
    // LIGHTNING MODE: Skip all complex processing for ultra-fast responses
    if (lightningMode) {
      return handleLightningSend();
    }

    // Use enhanced AI function for full featured mode
    return handleEnhancedSend(practiceContext, selectedModel);
  }, [input, uploadedFiles, lightningMode, handleLightningSend, handleEnhancedSend]);

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
        // Update search history in background without blocking UI
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
      // Silent failure for auto-save - don't impact user experience
      console.error('Error auto-saving search:', error);
    }
  };

  // Load user settings on component mount
  useEffect(() => {
    const loadUserSettings = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('user_settings')
          .select('setting_key, setting_value')
          .eq('user_id', user.id)
          .eq('setting_key', 'ai4gp_preferences');

        if (data && data.length > 0) {
          const preferences = data[0].setting_value as any;
          setSessionMemory(preferences.sessionMemory ?? true);
          setIncludeLatestUpdates(preferences.includeLatestUpdates ?? true);
          setShowResponseMetrics(preferences.showResponseMetrics ?? false);
          setSelectedModel(preferences.selectedModel ?? 'gpt-5');
        }
      } catch (error) {
        console.error('Error loading user settings:', error);
      }
    };

    loadUserSettings();
  }, [user]);

  // Save user settings when they change
  const saveUserSettings = useCallback(async () => {
    if (!user) return;

    try {
      const preferences = {
        sessionMemory,
        includeLatestUpdates,
        showResponseMetrics,
        selectedModel
      };

      await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          setting_key: 'ai4gp_preferences',
          setting_value: preferences
        }, {
          onConflict: 'user_id,setting_key'
        });
    } catch (error) {
      console.error('Error saving user settings:', error);
    }
  }, [user, sessionMemory, includeLatestUpdates, showResponseMetrics, selectedModel]);

  // Save settings when they change
  useEffect(() => {
    if (user) {
      saveUserSettings();
    }
  }, [sessionMemory, includeLatestUpdates, showResponseMetrics, selectedModel, saveUserSettings]);

  const handleNewSearch = useCallback(() => {
    setMessages([]);
    setUploadedFiles([]);
    setInput('');
  }, []);

  // Handle quick action responses
  const handleQuickResponse = useCallback(async (quickResponse: string, practiceContext: any, selectedModel: string = 'gpt-5') => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: quickResponse,
      timestamp: new Date(),
      files: []
    };

    setMessages(prev => [...prev, userMessage]);
    
    // Auto-send the quick response - temporarily set input
    const originalInput = input;
    setInput(quickResponse);
    await handleSend(practiceContext, selectedModel);
    setInput(originalInput);
  }, [handleSend, input]);

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
    selectedModel,
    setSelectedModel,
    lightningMode,
    setLightningMode,
    handleSend,
    handleNewSearch,
    saveSearchAutomatically,
    handleQuickResponse
  };
};