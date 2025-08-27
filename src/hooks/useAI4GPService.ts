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
  const [currentSearchId, setCurrentSearchId] = useState<string | null>(null);
  const [sessionMemory, setSessionMemory] = useState(true);
  const [verificationLevel, setVerificationLevel] = useState('standard');
  const [showResponseMetrics, setShowResponseMetrics] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gpt-5-2025-08-07');
  const [useOpenAI, setUseOpenAI] = useState(true);
  const [showRenderTimes, setShowRenderTimes] = useState(false);
  const [showAIService, setShowAIService] = useState(false);
  const [isClinical, setIsClinical] = useState(false);
  const [northamptonshireICB, setNorthamptonshireICB] = useState(false);
  
  // Display Settings
  const [textSize, setTextSize] = useState<'smallest' | 'smaller' | 'small' | 'default' | 'medium' | 'large' | 'larger' | 'largest'>('default');
  const [interfaceDensity, setInterfaceDensity] = useState<'compact' | 'comfortable' | 'spacious'>('comfortable');
  const [containerWidth, setContainerWidth] = useState<'narrow' | 'standard' | 'wide' | 'full'>('full');
  const [highContrast, setHighContrast] = useState(false);
  const [readingFont, setReadingFont] = useState(false);

  // Update isClinical when verificationLevel changes
  useEffect(() => {
    setIsClinical(verificationLevel === 'latest' || verificationLevel === 'maximum');
  }, [verificationLevel]);

  // Clinical verification function
  const performClinicalVerification = useCallback(async (messageId: string, originalPrompt: string, aiResponse: string) => {
    console.log('🩺 Starting clinical verification for:', messageId);
    console.log('📝 Original prompt:', originalPrompt.substring(0, 100) + '...');
    console.log('🤖 AI response:', aiResponse.substring(0, 100) + '...');
    
    try {
      const { data, error } = await supabase.functions.invoke('clinical-verification', {
        body: {
          originalPrompt,
          aiResponse,
          messageId
        }
      });

      if (error) {
        console.error('❌ Clinical verification error:', error);
        return null;
      }

      console.log('✅ Clinical verification completed:', data);
      return data;
    } catch (error) {
      console.error('❌ Clinical verification failed:', error);
      return null;
    }
  }, []);

  const handleGPT5FastClinical = async (
    messages: { role: 'user' | 'assistant' | 'system'; content: string }[],
    systemPrompt?: string,
    onStream?: (chunk: string) => void
  ): Promise<string> => {
    try {
      // Use stable model names instead of date-suffixed ones
      const stableModel = selectedModel === 'gpt-5-2025-08-07' ? 'gpt-5' :
                         selectedModel === 'gpt-5-mini-2025-08-07' ? 'gpt-5-instant' :
                         selectedModel;

      // Content type detection for dynamic token allocation
      function detectContentType(messages: { content: string }[]): { maxTokens: number; contentType: string } {
        const lastMessage = messages[messages.length - 1];
        const content = lastMessage?.content?.toLowerCase() || '';
        
        // Check for comprehensive content indicators
        const comprehensiveIndicators = [
          'leaflet', 'comprehensive', 'detailed guide', 'full guide', 'complete guide',
          'patient information', 'detailed explanation', 'comprehensive overview',
          'step by step', 'complete instructions', 'full instructions'
        ];
        
        const medicalAnalysisIndicators = [
          'analyze', 'assessment', 'evaluation', 'diagnosis', 'differential',
          'complex case', 'investigation', 'clinical reasoning', 'pathophysiology'
        ];
        
        const clinicalNotesIndicators = [
          'clinical note', 'soap note', 'consultation note', 'discharge summary',
          'referral letter', 'brief summary', 'quick note'
        ];
        
        // Use maximum tokens for ALL content types to prevent cutoffs
        if (comprehensiveIndicators.some(indicator => content.includes(indicator))) {
          return { maxTokens: 4096, contentType: 'comprehensive' };
        }
        
        if (medicalAnalysisIndicators.some(indicator => content.includes(indicator))) {
          return { maxTokens: 4096, contentType: 'analysis' };
        }
        
        if (clinicalNotesIndicators.some(indicator => content.includes(indicator))) {
          return { maxTokens: 4096, contentType: 'clinical_notes' };
        }
        
        // Check content length as secondary indicator
        if (content.length > 200) {
          return { maxTokens: 4096, contentType: 'medium' };
        }
        
        return { maxTokens: 4096, contentType: 'short' };
      }

      const { maxTokens } = detectContentType(messages);
      
      const response = await fetch(
        `https://dphcnbricafkbtizkoal.supabase.co/functions/v1/gpt5-fast-clinical`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaGNuYnJpY2Fma2J0aXprb2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MzIyMzIsImV4cCI6MjA2ODMwODIzMn0.U3bJI6P1yzgRBz_k2s0zlJGu1GWiVRTHjYgv9QQggPs`,
            'Content-Type': 'application/json',
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaGNuYnJpY2Fma2J0aXprb2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MzIyMzIsImV4cCI6MjA2ODMwODIzMn0.U3bJI6P1yzgRBz_k2s0zlJGu1GWiVRTHjYgv9QQggPs',
          },
          body: JSON.stringify({
            messages,
            model: stableModel,
            systemPrompt,
            max_tokens: maxTokens
          })
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      let fullResponse = '';
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const payload = line.slice(6);
            if (payload === '[DONE]') break;
            
            try {
              const data = JSON.parse(payload);
              
              // Skip the meta message from the function
              if (data._meta) continue;
              
              const content = data.choices?.[0]?.delta?.content;
              if (content) {
                fullResponse += content;
                onStream?.(content);
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }

      return fullResponse || 'No response received';
    } catch (error) {
      console.error('GPT-5 Fast Clinical error:', error);
      throw error;
    }
  };

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
      prompt += `\n\n=== YOUR PRACTICE INFORMATION (ALWAYS USE THIS WHEN CREATING DOCUMENTS) ===
Practice Name: ${practiceContext.practiceName}`;
      
      if (practiceContext.practiceAddress) {
        prompt += `\nPractice Address: ${practiceContext.practiceAddress}`;
      }
      
      if (practiceContext.practicePhone) {
        prompt += `\nPractice Phone: ${practiceContext.practicePhone}`;
      }
      
      if (practiceContext.practiceEmail) {
        prompt += `\nPractice Email: ${practiceContext.practiceEmail}`;
      }
      
      if (practiceContext.practiceWebsite) {
        prompt += `\nPractice Website: ${practiceContext.practiceWebsite}`;
      }
      
      if (practiceContext.userFullName) {
        prompt += `\nUser Name: ${practiceContext.userFullName}`;
      }
      
      if (practiceContext.userEmail) {
        prompt += `\nUser Email: ${practiceContext.userEmail}`;
      }
      
      if (practiceContext.userRole) {
        prompt += `\nUser Role: ${practiceContext.userRole}`;
      }
      
      if (practiceContext.userRoles && practiceContext.userRoles.length > 1) {
        prompt += `\nAll User Roles: ${practiceContext.userRoles.join(', ')}`;
      }
      
      if (practiceContext.practiceManagerName) {
        prompt += `\nPractice Manager: ${practiceContext.practiceManagerName}`;
      }
      
      if (practiceContext.pcnName) {
        prompt += `\nPrimary Care Network (PCN): ${practiceContext.pcnName}`;
      }
      
      if (practiceContext.neighbourhoodName) {
        prompt += `\nNeighbourhood: ${practiceContext.neighbourhoodName}`;
      }
      
      if (practiceContext.otherPracticesInPCN?.length > 0) {
        prompt += `\nOther practices in the same PCN: ${practiceContext.otherPracticesInPCN.join(', ')}`;
      }
      
      if (practiceContext.emailSignature) {
        prompt += `\nEmail Signature Available: Yes (can be used in email drafts when appropriate)`;
      }
      
      if (practiceContext.letterSignature) {
        prompt += `\nLetter Signature Available: Yes (can be used in formal letters when appropriate)`;
      }
      
      prompt += `\n=== END PRACTICE INFORMATION ===

CRITICAL: When creating any documents, letters, or responses (especially complaint responses), you MUST use the actual practice information listed above. NEVER use placeholder text like "[Your Practice Address]" or "[Phone Number]". Always use the real practice name, address, phone, and email provided above.

EXAMPLES OF CORRECT USAGE:
- Use "${practiceContext.practiceName}" not "[Practice Name]"`;
      
      if (practiceContext.practiceAddress) {
        prompt += `\n- Use "${practiceContext.practiceAddress}" not "[Your Practice Address]"`;
      }
      
      if (practiceContext.practicePhone) {
        prompt += `\n- Use "${practiceContext.practicePhone}" not "[Phone Number]"`;
      }
      
      if (practiceContext.practiceEmail) {
        prompt += `\n- Use "${practiceContext.practiceEmail}" not "[Email Address]"`;
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

  const handleSend = useCallback(async (practiceContext: any, selectedModel: string = 'claude-4-sonnet') => {
    console.log('🚀 handleSend called with:', { 
      hasInput: !!input.trim(), 
      inputLength: input.length,
      filesCount: uploadedFiles.length, 
      selectedModel, 
      practiceContext: !!practiceContext,
      isLoading 
    });
    
    if (!input.trim() && uploadedFiles.length === 0) {
      console.log('❌ Aborting send: no input and no files');
      return;
    }
    
    console.log('🔄 Proceeding with send - creating user message...');
    
    // Use the provided model instead of useOpenAI setting for model selection
    const modelToUse = selectedModel;
    console.log('🤖 Model selection:', { selectedModel, modelToUse });
    
    // Enhance the message content when files are attached
    let messageContent = input;
    if (uploadedFiles.length > 0 && input.trim()) {
      messageContent = `${input}\n\n[Note: I have uploaded ${uploadedFiles.length} file(s): ${uploadedFiles.map(f => f.name).join(', ')}. Please analyze these files in relation to my question above.]`;
    } else if (uploadedFiles.length > 0 && !input.trim()) {
      messageContent = `Please analyze the uploaded file(s): ${uploadedFiles.map(f => f.name).join(', ')}`;
    }
    
    console.log('📝 Message content prepared:', { 
      originalInput: input,
      finalContent: messageContent.substring(0, 100) + '...',
      hasFiles: uploadedFiles.length > 0 
    });
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageContent,
      timestamp: new Date(),
      files: uploadedFiles.length > 0 ? [...uploadedFiles] : undefined,
      isClinical: isClinical
    };
    
    console.log('👤 User message created:', { 
      id: userMessage.id, 
      contentLength: userMessage.content.length,
      hasFiles: !!userMessage.files,
      isClinical: userMessage.isClinical 
    });

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    console.log('✅ Starting AI request...', { userMessage });
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
      model: modelToUse,
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

      // For GPT-5 queries, prefer the fast clinical function (works better and more reliable)
      if (modelToUse === 'gpt-5-2025-08-07' || modelToUse === 'gpt-5') {
        console.log('🚀 Using GPT-5 Fast Clinical function');
        
        try {
          let accumulatedContent = '';
          let timeToFirstWords: number | undefined;
          
          const streamHandler = (chunk: string) => {
            accumulatedContent += chunk;
            
            if (!timeToFirstWords) {
              timeToFirstWords = Date.now() - startTime;
            }
            
            setMessages(prev => prev.map(msg => 
              msg.id === assistantMessageId 
                ? { ...msg, content: accumulatedContent, isStreaming: true, timeToFirstWords }
                : msg
            ));
          };
          
          const response = await handleGPT5FastClinical(messagesForAPI, systemPrompt, streamHandler);
          
          const endTime = Date.now();
          const responseTime = endTime - startTime;
          
          const finalAssistantMessage = {
            ...assistantMessage,
            content: response,
            isStreaming: false,
            responseTime,
            timeToFirstWords,
            apiResponseTime: responseTime
          };

          setMessages(prev => prev.map(msg => 
            msg.id === assistantMessageId 
              ? finalAssistantMessage
              : msg
          ));

          // Auto-save the search
          setTimeout(async () => {
            const finalMessages = [...newMessages, finalAssistantMessage];
            await saveSearchAutomatically(finalMessages);
          }, 100);
          
          setIsLoading(false);
          return;
          
        } catch (error) {
          console.error('GPT-5 Fast Clinical failed:', error);
          
          // Don't remove the message, instead show an error in it and fall back to ChatGPT 4o
          setMessages(prev => prev.map(msg => 
            msg.id === assistantMessageId 
              ? { 
                  ...msg, 
                  content: 'GPT-5 service encountered an error. Switching to ChatGPT 4o...', 
                  isStreaming: false 
                }
              : msg
          ));
          
          // Fall back to ChatGPT 4o instead of failing completely
          const chatgptRequestBody = {
            messages: messagesForAPI,
            model: 'gpt-4o',
            systemPrompt: systemPrompt,
            files: uploadedFiles.length > 0 ? uploadedFiles : undefined,
            verificationLevel: verificationLevel
          };

          try {
            const { data: chatgptData, error: chatgptError } = await supabase.functions.invoke('ai-4-pm-chat', {
              body: chatgptRequestBody
            });

            if (chatgptError) {
              throw chatgptError;
            }

            const chatgptResponse = chatgptData?.response || chatgptData?.content || 'No response received from ChatGPT 4o';
            const endTime = Date.now();
            const responseTime = endTime - startTime;
            
            const finalMessage = {
              ...assistantMessage,
              content: `${chatgptResponse}\n\n_Note: Response generated using ChatGPT 4o due to GPT-5 service unavailability._`,
              isStreaming: false,
              responseTime,
              apiResponseTime: responseTime,
              model: 'gpt-4o'
            };

            setMessages(prev => prev.map(msg => 
              msg.id === assistantMessageId 
                ? finalMessage
                : msg
            ));

            // Auto-save the search
            setTimeout(async () => {
              const finalMessages = [...newMessages, finalMessage];
              await saveSearchAutomatically(finalMessages);
            }, 100);

          } catch (fallbackError) {
            console.error('Fallback to ChatGPT 4o also failed:', fallbackError);
            
            setMessages(prev => prev.map(msg => 
              msg.id === assistantMessageId 
                ? { 
                    ...msg, 
                    content: 'Both GPT-5 and ChatGPT 4o services are currently unavailable. Please try again later or check your connection.', 
                    isStreaming: false 
                  }
                : msg
            ));
          }
          
          setIsLoading(false);
          return;
        }
      }

      // For non-GPT-5 models, use the ai-4-pm-chat function
      const requestBody = {
        messages: messagesForAPI,
        model: modelToUse,
        systemPrompt: systemPrompt,
        files: uploadedFiles.length > 0 ? uploadedFiles : undefined,
        verificationLevel: verificationLevel
      };

      // Get response from edge function
      const { data, error } = await supabase.functions.invoke('ai-4-pm-chat', {
        body: requestBody
      });

      if (error) {
        console.error('AI Service Error:', error);
        throw new Error(`AI service error: ${error.message || 'Unknown error'}`);
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
              
              const finalAssistantMessage = {
                ...assistantMessage,
                content: responseContent,
                isStreaming: false,
                responseTime,
                timeToFirstWords,
                apiResponseTime
              };

              // Perform clinical verification if this was a clinical query
              console.log('🔍 Checking clinical verification conditions:', { isClinical, userIsClinical: userMessage.isClinical });
              if (isClinical && userMessage.isClinical) {
                console.log('✅ Clinical verification conditions met, starting verification...');
                setTimeout(async () => {
                  const verificationData = await performClinicalVerification(
                    assistantMessageId,
                    userMessage.content,
                    responseContent
                  );

                  console.log('📊 Verification data received:', verificationData);
                  if (verificationData) {
                    console.log('💾 Adding verification data to message...');
                    setMessages(prev => prev.map(msg => 
                      msg.id === assistantMessageId 
                        ? { ...msg, clinicalVerification: verificationData }
                        : msg
                    ));
                  } else {
                    console.log('❌ No verification data to add');
                  }
                }, 500); // Delay to allow UI to settle
              } else {
                console.log('❌ Clinical verification skipped - conditions not met');
              }
              
              setMessages(prev => prev.map(msg => 
                msg.id === assistantMessageId 
                  ? finalAssistantMessage
                  : msg
              ));

                 // Auto-save the search
                setTimeout(async () => {
                  const finalMessages = [...newMessages, finalAssistantMessage];
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
  }, [input, messages, uploadedFiles, buildSystemPrompt, verificationLevel, useOpenAI]);

  const saveSearchAutomatically = async (messagesData: Message[]) => {
    if (!user || messagesData.length < 2) return; // Need at least user + assistant message

    try {
      // If we have a current search ID, update it instead of creating a new one
      if (currentSearchId) {
        // Generate updated brief overview
        const aiMessages = messagesData.filter(m => m.role === 'assistant');
        const overview = aiMessages.length > 0 
          ? aiMessages[0].content.substring(0, 120) + (aiMessages[0].content.length > 120 ? '...' : '')
          : 'No AI response';

        const { error } = await supabase
          .from('ai_4_pm_searches')
          .update({
            messages: messagesData as any,
            brief_overview: overview,
            updated_at: new Date().toISOString()
          })
          .eq('id', currentSearchId);
        
        if (error) {
          console.error('Error updating search:', error);
        } else {
          // Update local search history to reflect changes
          setSearchHistory(prev => prev.map(search => 
            search.id === currentSearchId 
              ? { ...search, messages: messagesData, brief_overview: overview, updated_at: new Date().toISOString() }
              : search
          ));
        }
        return;
      }

      // Create new search only if we don't have a current search ID
      const firstUserMessage = messagesData.find(m => m.role === 'user');
      const title = firstUserMessage?.content.substring(0, 50) + (firstUserMessage?.content.length > 50 ? '...' : '') || 'Untitled Search';
      
      // Generate brief overview from AI responses
      const aiMessages = messagesData.filter(m => m.role === 'assistant');
      const overview = aiMessages.length > 0 
        ? aiMessages[0].content.substring(0, 120) + (aiMessages[0].content.length > 120 ? '...' : '')
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
        // Set the current search ID so future updates modify this entry
        setCurrentSearchId(data.id);
        
        // Add the new search to the beginning of the local state
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
      if (!user?.id) return;

      try {
        console.log('Loading AI4GP settings for user:', user.id);
        const { data, error } = await supabase
          .from('user_settings')
          .select('setting_key, setting_value')
          .eq('user_id', user.id)
          .eq('setting_key', 'ai4gp_preferences');

        if (error) {
          console.error('Error loading user settings:', error);
          return;
        }

        if (data && data.length > 0) {
          const preferences = data[0].setting_value as any;
          console.log('Loaded AI4GP preferences:', preferences);
          
          // Set defaults first, then override with saved values
          setSessionMemory(preferences.sessionMemory ?? true);
          setVerificationLevel(preferences.verificationLevel ?? 'standard');
          setShowResponseMetrics(preferences.showResponseMetrics ?? false);
          setSelectedModel(preferences.selectedModel ?? 'gpt-5-2025-08-07');
          setUseOpenAI(preferences.useOpenAI ?? true);
          setShowRenderTimes(preferences.showRenderTimes ?? false);
          setShowAIService(preferences.showAIService ?? false);
          setNorthamptonshireICB(preferences.northamptonshireICB ?? false);
          
          // Load display settings
          setTextSize(preferences.textSize ?? 'default');
          setInterfaceDensity(preferences.interfaceDensity ?? 'comfortable');
          setContainerWidth(preferences.containerWidth ?? 'full');
          setHighContrast(preferences.highContrast ?? false);
          setReadingFont(preferences.readingFont ?? false);
          
          console.log('AI4GP settings loaded successfully');
        } else {
          console.log('No saved AI4GP preferences found, using defaults');
        }
      } catch (error) {
        console.error('Error loading user settings:', error);
      }
    };

    // Add a small delay to ensure user is fully authenticated
    if (user?.id) {
      setTimeout(() => {
        loadUserSettings();
      }, 100);
    }
  }, [user?.id]);

  // Save user settings when they change
  const saveUserSettings = useCallback(async () => {
    if (!user?.id) return;

    try {
      const preferences = {
        sessionMemory,
        verificationLevel,
        showResponseMetrics,
        selectedModel,
        useOpenAI,
        showRenderTimes,
        showAIService,
        northamptonshireICB,
        // Display settings
        textSize,
        interfaceDensity,
        containerWidth,
        highContrast,
        readingFont
      };

      console.log('Saving AI4GP preferences:', preferences);
      
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          setting_key: 'ai4gp_preferences',
          setting_value: preferences
        }, {
          onConflict: 'user_id,setting_key'
        });

      if (error) {
        console.error('Error saving user settings:', error);
      } else {
        console.log('AI4GP settings saved successfully');
      }
    } catch (error) {
      console.error('Error saving user settings:', error);
    }
  }, [user?.id, sessionMemory, verificationLevel, showResponseMetrics, selectedModel, useOpenAI, showRenderTimes, showAIService, northamptonshireICB, textSize, interfaceDensity, containerWidth, highContrast, readingFont]);

  // Save settings when they change (with debounce to avoid too many saves)
  useEffect(() => {
    if (user?.id) {
      const timeoutId = setTimeout(() => {
        saveUserSettings();
      }, 500); // Debounce saves by 500ms

      return () => clearTimeout(timeoutId);
    }
  }, [sessionMemory, verificationLevel, showResponseMetrics, selectedModel, useOpenAI, showRenderTimes, showAIService, northamptonshireICB, textSize, interfaceDensity, containerWidth, highContrast, readingFont, saveUserSettings]);

  // Use Display Settings Effect to apply CSS classes
  useEffect(() => {
    const applyDisplaySettings = () => {
      const body = document.body;
      
      // Remove existing display setting classes
      body.classList.remove(
        'ai4gp-text-smallest', 'ai4gp-text-smaller', 'ai4gp-text-small', 'ai4gp-text-default', 'ai4gp-text-medium', 'ai4gp-text-large', 'ai4gp-text-larger', 'ai4gp-text-largest',
        'ai4gp-compact', 'ai4gp-comfortable', 'ai4gp-spacious',
        'ai4gp-narrow', 'ai4gp-standard', 'ai4gp-wide', 'ai4gp-full',
        'ai4gp-high-contrast', 'ai4gp-reading-font'
      );
      
      // Apply new classes
      body.classList.add(`ai4gp-text-${textSize}`);
      body.classList.add(`ai4gp-${interfaceDensity}`);
      body.classList.add(`ai4gp-${containerWidth}`);
      
      if (highContrast) {
        body.classList.add('ai4gp-high-contrast');
      }
      
      if (readingFont) {
        body.classList.add('ai4gp-reading-font');
      }

      // Update CSS custom properties for real-time changes
      const root = document.documentElement;
      const textScales = { smallest: 0.75, smaller: 0.875, small: 1.0, default: 1.125, medium: 1.25, large: 1.375, larger: 1.5, largest: 1.625 };
      const spacingScales = { compact: 0.75, comfortable: 1, spacious: 1.25 };
      const containerWidths = { narrow: '672px', standard: '896px', wide: '1152px', full: '100%' };
      
      root.style.setProperty('--ai4gp-text-scale', textScales[textSize].toString());
      root.style.setProperty('--ai4gp-spacing-scale', spacingScales[interfaceDensity].toString());
      root.style.setProperty('--ai4gp-container-width', containerWidths[containerWidth]);
      
      if (readingFont) {
        root.style.setProperty('--ai4gp-reading-font', "'Comic Sans MS', 'Trebuchet MS', cursive");
      } else {
        root.style.setProperty('--ai4gp-reading-font', 'inherit');
      }
    };

    applyDisplaySettings();
  }, [textSize, interfaceDensity, containerWidth, highContrast, readingFont]);

  const handleNewSearch = useCallback(() => {
    setMessages([]);
    setUploadedFiles([]);
    setInput('');
    setCurrentSearchId(null); // Reset search ID when starting new conversation
  }, []);

  // Handle quick action responses
  const handleQuickResponse = useCallback(async (quickResponse: string, practiceContext: any, selectedModel: string = 'gpt-5') => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: quickResponse,
      timestamp: new Date(),
      files: [],
      isQuickPick: true // Mark as quick pick message for auto-collapse
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
    useOpenAI,
    setUseOpenAI,
    showRenderTimes,
    setShowRenderTimes,
    showAIService,
    setShowAIService,
    handleSend,
    handleNewSearch,
    saveSearchAutomatically,
    handleQuickResponse,
    isClinical,
    setIsClinical,
    performClinicalVerification,
    saveUserSettings,
    loadSearch: (search: SearchHistory) => {
      setMessages(search.messages);
      setCurrentSearchId(search.id); // Set the current search ID when loading
      setInput('');
      setUploadedFiles([]);
    },
    clearMessages: () => {
      setMessages([]);
      setInput('');
      setUploadedFiles([]);
      setCurrentSearchId(null); // Reset search ID when clearing messages
    },
    northamptonshireICB,
    setNorthamptonshireICB,
    // Display Settings
    textSize,
    setTextSize,
    interfaceDensity,
    setInterfaceDensity,
    containerWidth,
    setContainerWidth,
    highContrast,
    setHighContrast,
    readingFont,
    setReadingFont
  };
};
