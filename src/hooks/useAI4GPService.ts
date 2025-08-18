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
  const [verificationLevel, setVerificationLevel] = useState('standard');
  const [showResponseMetrics, setShowResponseMetrics] = useState(false);
  const [selectedModel, setSelectedModel] = useState('grok-beta');

  const buildSystemPrompt = useCallback((practiceContext: any, uploadedFiles: UploadedFile[], verificationLevel: string) => {
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
      prompt += `\n\nCONTEXT ABOUT THE USER AND PRACTICE:
- Practice Name: ${practiceContext.practiceName}`;
      
      if (practiceContext.practiceAddress) {
        prompt += `\n- Practice Address: ${practiceContext.practiceAddress}`;
      }
      
      if (practiceContext.practicePhone) {
        prompt += `\n- Practice Phone: ${practiceContext.practicePhone}`;
      }
      
      if (practiceContext.practiceEmail) {
        prompt += `\n- Practice Email: ${practiceContext.practiceEmail}`;
      }
      
      if (practiceContext.practiceWebsite) {
        prompt += `\n- Practice Website: ${practiceContext.practiceWebsite}`;
      }
      
      if (practiceContext.userFullName) {
        prompt += `\n- User Name: ${practiceContext.userFullName}`;
      }
      
      if (practiceContext.userEmail) {
        prompt += `\n- User Email: ${practiceContext.userEmail}`;
      }
      
      if (practiceContext.userRole) {
        prompt += `\n- User Role: ${practiceContext.userRole}`;
      }
      
      if (practiceContext.userRoles && practiceContext.userRoles.length > 1) {
        prompt += `\n- All User Roles: ${practiceContext.userRoles.join(', ')}`;
      }
      
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
      
      if (practiceContext.emailSignature) {
        prompt += `\n- Email Signature Available: Yes (can be used in email drafts when appropriate)`;
      }
      
      if (practiceContext.letterSignature) {
        prompt += `\n- Letter Signature Available: Yes (can be used in formal letters when appropriate)`;
      }
      
      prompt += `\n\nWhen relevant to queries, you can reference this practice and user information to provide more personalized and contextual responses. For example:
- Use the practice name and address when creating letters or referrals
- Reference the user's role when providing role-specific guidance
- Include contact details when generating practice communications
- Use available signatures when creating formal documents`;
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
${verificationLevel !== 'standard' ? '- Live Source Verification: You have access to real-time trusted source verification from NHS, NICE, BNF, MHRA, and other official sources. Use this for the most current guidance and policy updates.' : ''}

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
      const systemPrompt = buildSystemPrompt(practiceContext, uploadedFiles, verificationLevel);
      
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
        verificationLevel: verificationLevel
      };

      // Get response from edge function
      const { data, error } = await supabase.functions.invoke('ai-4-pm-chat', {
        body: requestBody
      });

      if (error) {
        throw error;
      }

      const responseContent = data?.response || data?.content || 'No response received';
      
      // Capture API response time (when data first comes back)
      const apiResponseTime = Date.now() - startTime;
      
      if (!responseContent || responseContent === 'No response received') {
        throw new Error('No valid response received from AI service');
      }
      
      // Fast response when no files, slower when files are present for better UX
      const hasFiles = uploadedFiles.length > 0;
      const chunks = responseContent.split(' ');
      
      if (!hasFiles) {
        // Fast response - show immediately with minimal chunking for natural feel
        const chunkSize = Math.max(5, Math.floor(chunks.length / 5)); // ~5 fast updates
        let currentIndex = 0;
        let accumulatedContent = '';
        let timeToFirstWords: number | undefined;

        const streamChunks = () => {
          if (currentIndex < chunks.length) {
            const endIndex = Math.min(currentIndex + chunkSize, chunks.length);
            const chunkText = chunks.slice(currentIndex, endIndex).join(' ') + ' ';
            accumulatedContent += chunkText;
            currentIndex = endIndex;

            // Capture time to first words on first chunk
            if (currentIndex === chunkSize && !timeToFirstWords) {
              timeToFirstWords = Date.now() - startTime;
            }

            setMessages(prev => prev.map(msg => 
              msg.id === assistantMessageId 
                ? { ...msg, content: accumulatedContent.trim(), isStreaming: true, timeToFirstWords, apiResponseTime }
                : msg
            ));

            if (currentIndex < chunks.length) {
              // Very fast streaming - minimal delay
              setTimeout(streamChunks, 15 + Math.random() * 10);
            } else {
              // Streaming complete
              const endTime = Date.now();
              const responseTime = endTime - startTime;
              
              setMessages(prev => prev.map(msg => 
                msg.id === assistantMessageId 
                  ? { ...msg, content: responseContent, isStreaming: false, responseTime, timeToFirstWords, apiResponseTime }
                  : msg
              ));

              // Auto-save the search
              setTimeout(async () => {
                const finalMessages = [...newMessages, {
                  ...assistantMessage,
                  content: responseContent,
                  isStreaming: false,
                  responseTime,
                  timeToFirstWords,
                  apiResponseTime
                }];
                await saveSearchAutomatically(finalMessages);
              }, 100);
            }
          }
        };

        // Start fast streaming
        streamChunks();
      } else {
        // Slower streaming for file-based responses
        const chunkSize = Math.max(1, Math.floor(chunks.length / 20)); // ~20 updates
        let currentIndex = 0;
        let accumulatedContent = '';
        let timeToFirstWords: number | undefined;

        const streamChunks = () => {
          if (currentIndex < chunks.length) {
            const endIndex = Math.min(currentIndex + chunkSize, chunks.length);
            const chunkText = chunks.slice(currentIndex, endIndex).join(' ') + ' ';
            accumulatedContent += chunkText;
            currentIndex = endIndex;

            // Capture time to first words on first chunk
            if (currentIndex === chunkSize && !timeToFirstWords) {
              timeToFirstWords = Date.now() - startTime;
            }

            setMessages(prev => prev.map(msg => 
              msg.id === assistantMessageId 
                ? { ...msg, content: accumulatedContent.trim(), isStreaming: true, timeToFirstWords, apiResponseTime }
                : msg
            ));

            if (currentIndex < chunks.length) {
              // Continue streaming with delay for file processing
              setTimeout(streamChunks, 50 + Math.random() * 50);
            } else {
              // Streaming complete
              const endTime = Date.now();
              const responseTime = endTime - startTime;
              
              setMessages(prev => prev.map(msg => 
                msg.id === assistantMessageId 
                  ? { ...msg, content: responseContent, isStreaming: false, responseTime, timeToFirstWords, apiResponseTime }
                  : msg
              ));

              // Auto-save the search
              setTimeout(async () => {
                const finalMessages = [...newMessages, {
                  ...assistantMessage,
                  content: responseContent,
                  isStreaming: false,
                  responseTime,
                  timeToFirstWords,
                  apiResponseTime
                }];
                await saveSearchAutomatically(finalMessages);
              }, 100);
            }
          }
        };

        // Start slower streaming for file processing
        streamChunks();
      }


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
  }, [input, messages, uploadedFiles, buildSystemPrompt, verificationLevel]);

  const saveSearchAutomatically = async (messagesData: Message[]) => {
    if (!user || messagesData.length < 2) return; // Need at least user + assistant message

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
          setVerificationLevel(preferences.verificationLevel ?? 'standard');
          setShowResponseMetrics(preferences.showResponseMetrics ?? false);
          setSelectedModel(preferences.selectedModel ?? 'grok-beta');
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
        verificationLevel,
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
  }, [user, sessionMemory, verificationLevel, showResponseMetrics, selectedModel]);

  // Save settings when they change
  useEffect(() => {
    if (user) {
      saveUserSettings();
    }
  }, [sessionMemory, verificationLevel, showResponseMetrics, selectedModel, saveUserSettings]);

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
    
    // Call handleSend with the quick response directly
    if (!quickResponse.trim() && uploadedFiles.length === 0) return;
    
    // Enhance the message content when files are attached
    let messageContent = quickResponse;
    if (uploadedFiles.length > 0 && quickResponse.trim()) {
      messageContent = `${quickResponse}\n\n[Note: I have uploaded ${uploadedFiles.length} file(s): ${uploadedFiles.map(f => f.name).join(', ')}. Please analyze these files in relation to my question above.]`;
    } else if (uploadedFiles.length > 0 && !quickResponse.trim()) {
      messageContent = `Please analyze the uploaded file(s): ${uploadedFiles.map(f => f.name).join(', ')}`;
    }
    
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
      const systemPrompt = buildSystemPrompt(practiceContext, uploadedFiles, verificationLevel);
      
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
        verificationLevel: verificationLevel
      };

      // Get response from edge function
      const { data, error } = await supabase.functions.invoke('ai-4-pm-chat', {
        body: requestBody
      });

      if (error) {
        throw error;
      }

      const responseContent = data?.response || data?.content || 'No response received';
      
      // Capture API response time (when data first comes back)
      const apiResponseTime = Date.now() - startTime;
      
      if (!responseContent || responseContent === 'No response received') {
        throw new Error('No valid response received from AI service');
      }
      
      // Fast response for quick actions - no files expected
      const chunks = responseContent.split(' ');
      const chunkSize = Math.max(5, Math.floor(chunks.length / 5)); // ~5 fast updates
      let currentIndex = 0;
      let accumulatedContent = '';
      let timeToFirstWords: number | undefined;

      const streamChunks = () => {
        if (currentIndex < chunks.length) {
          const endIndex = Math.min(currentIndex + chunkSize, chunks.length);
          const chunkText = chunks.slice(currentIndex, endIndex).join(' ') + ' ';
          accumulatedContent += chunkText;
          currentIndex = endIndex;

          // Capture time to first words on first chunk
          if (currentIndex === chunkSize && !timeToFirstWords) {
            timeToFirstWords = Date.now() - startTime;
          }

          setMessages(prev => prev.map(msg => 
            msg.id === assistantMessageId 
              ? { ...msg, content: accumulatedContent.trim(), isStreaming: true, timeToFirstWords, apiResponseTime }
              : msg
          ));

          if (currentIndex < chunks.length) {
            // Very fast streaming for quick actions
            setTimeout(streamChunks, 15 + Math.random() * 10);
          } else {
            // Streaming complete
            const endTime = Date.now();
            const responseTime = endTime - startTime;
            
            setMessages(prev => prev.map(msg => 
              msg.id === assistantMessageId 
                ? { ...msg, content: responseContent, isStreaming: false, responseTime, timeToFirstWords, apiResponseTime }
                : msg
            ));

            // Auto-save the search
            setTimeout(async () => {
              const finalMessages = [...newMessages, {
                ...assistantMessage,
                content: responseContent,
                isStreaming: false,
                responseTime,
                timeToFirstWords,
                apiResponseTime
              }];
              await saveSearchAutomatically(finalMessages);
            }, 100);
          }
        }
      };

      // Start fast streaming for quick actions
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
    
    setInput(originalInput);
  }, [input, messages, uploadedFiles, buildSystemPrompt, verificationLevel]);

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
    verificationLevel,
    setVerificationLevel,
    showResponseMetrics,
    setShowResponseMetrics,
    selectedModel,
    setSelectedModel,
    handleSend,
    handleNewSearch,
    saveSearchAutomatically,
    handleQuickResponse
  };
};