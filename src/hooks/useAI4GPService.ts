import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Message, UploadedFile, SearchHistory, GeneratedImage, GeneratedPresentation } from '@/types/ai4gp';
import { useDisplayPreferences } from './useDisplayPreferences';
import { prepareMessagesForAPI, getMemoryStats } from '@/utils/conversationMemory';
import { detectImageRequest, extractImageContext, isReferringToPreviousContent, ImageRequestDetection } from '@/utils/imageRequestDetection';
import { detectVoiceRequest } from '@/utils/voiceRequestDetection';
import { detectPowerPointRequest, getPresentationTypeDisplayName } from '@/utils/powerpointRequestDetection';
import { VOICE_OPTIONS, VoiceOption } from '@/hooks/useVoicePreference';
import { BrandingLevel, CustomBrandingOptions } from '@/components/ai4gp/ImageBrandingDialog';

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
  const [chatHistoryRetentionDays, setChatHistoryRetentionDays] = useState(30);
  const [hideGPClinical, setHideGPClinical] = useState(false);
  const [imageGenerationModel, setImageGenerationModel] = useState<'google/gemini-3-pro-image-preview' | 'google/gemini-2.5-flash-image-preview' | 'openai/gpt-image-1'>('google/gemini-3-pro-image-preview');
  const [includePracticeLogo, setIncludePracticeLogo] = useState(true);
  
  // Image branding dialog state
  const [showBrandingDialog, setShowBrandingDialog] = useState(false);
  const [pendingImageRequest, setPendingImageRequest] = useState<{
    message: string;
    imageDetection: ImageRequestDetection;
    assistantMessageId: string;
    startTime: number;
    userMessage: Message;
    newMessages: Message[];
    documentContent?: string;
    imageAttachments?: { name: string; content: string; type: string }[];
    isVisualFromFilesRequest: boolean;
  } | null>(null);
  
  // Display Settings - now managed by useDisplayPreferences
  const {
    textSize,
    setTextSize,
    interfaceDensity,
    setInterfaceDensity,
    containerWidth,
    setContainerWidth,
    highContrast,
    setHighContrast,
    readingFont,
    setReadingFont,
    autoCollapseUserPrompts,
    setAutoCollapseUserPrompts,
  } = useDisplayPreferences();

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
    onStream?: (chunk: string, webSearchPerformed?: boolean) => void
  ): Promise<{ response: string; webSearchPerformed: boolean }> => {
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
      let webSearchPerformed = false;
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
              
              // Check for web search meta message
              if (data._meta?.webSearchPerformed) {
                webSearchPerformed = true;
                continue;
              }
              
              // Skip other meta messages
              if (data._meta) continue;
              
              const content = data.choices?.[0]?.delta?.content;
              if (content) {
                fullResponse += content;
                onStream?.(content, webSearchPerformed);
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }

      return { response: fullResponse || 'No response received', webSearchPerformed };
    } catch (error) {
      console.error('GPT-5 Fast Clinical error:', error);
      throw error;
    }
  };

  const buildSystemPrompt = useCallback((practiceContext: any, uploadedFiles: UploadedFile[], verificationLevel: string) => {
    console.log('🔧 Building system prompt with practice context:', practiceContext);
    
    // Detect if files contain numerical data for enhanced calculation prompts
    const hasNumericalData = uploadedFiles.some(file => file.metadata?.hasNumericalData);
    const fileCount = uploadedFiles.length;
    
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

    // Add enhanced calculation instructions if numerical data detected
    if (hasNumericalData) {
      prompt += `\n\n🔢 CALCULATION ACCURACY PROTOCOL:
The uploaded files contain numerical data (invoices, financial documents, spreadsheets, etc.). When performing ANY calculations:

1. DOUBLE-CHECK YOUR MATH: Always verify calculations step-by-step before providing final answers
2. SHOW YOUR WORK: Display calculations clearly using standard mathematical symbols (×, ÷, +, -, =)
3. VERIFY TOTALS: Cross-reference any totals you calculate with totals mentioned in the source documents
4. CURRENCY FORMAT: Use consistent formatting (e.g., £1,234.56) throughout your response - NO LaTeX notation
5. MATHEMATICAL SYMBOLS: Use Unicode symbols (×, ÷) NOT LaTeX (\\times, \\div, \\(, \\))
6. CLEAN FORMATTING: Format currency amounts as £1,234.56 NOT \\£1,234.56
7. HIGHLIGHT DISCREPANCIES: If you find discrepancies between your calculations and document totals, point them out explicitly
8. MULTIPLE FILE PROCESSING: When analyzing multiple files with numbers, process them systematically and clearly indicate which calculations belong to which files

CRITICAL: Avoid ALL LaTeX mathematical notation including \\times, \\div, \\(, \\), \\[, \\]. Use standard symbols: × ÷ + - = instead.
If you're unsure about any calculation, explicitly state your uncertainty and suggest the user double-check the figures manually.`;
    }

    // Add file complexity warnings for large file sets
    if (fileCount > 3) {
      prompt += `\n\n📁 MULTIPLE FILE PROCESSING:
You are processing ${fileCount} files. To ensure accuracy:
- Process files systematically, one at a time when possible
- Clearly indicate which information comes from which file
- If calculations span multiple files, break them down by source
- Double-check any cross-file calculations or comparisons`;
    }

    // Add practice/organisation context if available
    if (practiceContext.practiceName) {
      // Determine if this is a GP Practice or another organisation type
      const isGPPractice = !practiceContext.organisationType || practiceContext.organisationType === 'GP Practice';
      const entityLabel = isGPPractice ? 'Practice' : 'Organisation';
      
      console.log('✅ Adding organisation details to system prompt:', practiceContext.practiceName, '(', practiceContext.organisationType || 'GP Practice', ')');
      
      prompt += `\n\n=== YOUR ${entityLabel.toUpperCase()} INFORMATION (ALWAYS USE THIS WHEN CREATING DOCUMENTS) ===
${entityLabel} Name: ${practiceContext.practiceName}`;
      
      if (practiceContext.organisationType && !isGPPractice) {
        prompt += `\nOrganisation Type: ${practiceContext.organisationType}`;
      }
      
      if (practiceContext.practiceAddress) {
        prompt += `\n${entityLabel} Address: ${practiceContext.practiceAddress}`;
      }
      
      if (practiceContext.practicePhone) {
        prompt += `\n${entityLabel} Phone: ${practiceContext.practicePhone}`;
      }
      
      if (practiceContext.practiceEmail) {
        prompt += `\n${entityLabel} Email: ${practiceContext.practiceEmail}`;
      }
      
      if (practiceContext.practiceWebsite) {
        prompt += `\n${entityLabel} Website: ${practiceContext.practiceWebsite}`;
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
        prompt += `\n${isGPPractice ? 'Practice' : 'Organisation'} Manager: ${practiceContext.practiceManagerName}`;
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
      
      prompt += `\n=== END ${entityLabel.toUpperCase()} INFORMATION ===

CRITICAL: When creating any documents, letters, or responses, you MUST use the actual ${entityLabel.toLowerCase()} information listed above. NEVER use placeholder text like "[Your ${entityLabel} Address]" or "[Phone Number]". Always use the real ${entityLabel.toLowerCase()} name, address, phone, and email provided above.

EXAMPLES OF CORRECT USAGE:
- Use "${practiceContext.practiceName}" not "[${entityLabel} Name]"`;
      
      if (practiceContext.practiceAddress) {
        prompt += `\n- Use "${practiceContext.practiceAddress}" not "[Your ${entityLabel} Address]"`;
      }
      
      if (practiceContext.practicePhone) {
        prompt += `\n- Use "${practiceContext.practicePhone}" not "[Phone Number]"`;
      }
      
      if (practiceContext.practiceEmail) {
        prompt += `\n- Use "${practiceContext.practiceEmail}" not "[Email Address]"`;
      }
      
      if (practiceContext.practiceWebsite) {
        prompt += `\n- Use "${practiceContext.practiceWebsite}" not "[Website]" - display as plain text, NOT as a markdown link`;
      }

      prompt += `\n\nWhen relevant to queries, you can reference this ${entityLabel.toLowerCase()} and user information to provide more personalised and contextual responses. For example:
- Use the ${entityLabel.toLowerCase()} name and address when creating letters or referrals
- Reference the user's role when providing role-specific guidance
- Include contact details when generating ${entityLabel.toLowerCase()} communications
- Use available signatures when creating formal documents`;
    } else {
      console.log('❌ No practice/organisation name found in context:', practiceContext);
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

✍️ EMAIL WRITING STYLE - CRITICAL RULES:
When drafting any email or written correspondence, NEVER start with these clichéd phrases:
- "I hope you are well" / "I hope this finds you well" / "I hope this email finds you well" / "I hope this message finds you well"
- "I trust this email finds you well" / "I trust you are well"
- "Thank you for your email" / "Thank you for contacting us" / "Thank you for reaching out"
- "Thank you for getting in touch" / "Many thanks for your email"
- "I am writing to..." / "I'm writing to..."
- "Further to your email..." / "With reference to your recent correspondence..."
- "Hope you're having a good day" / "Hope all is well"
- "Good morning/afternoon" as a standalone opener

INSTEAD, start emails DIRECTLY with the substance:
- Jump straight to acknowledging the specific matter
- Reference the actual topic from their correspondence
- Use context-specific openings like:
  - "Regarding your [appointment/request/query]..."
  - "Following your query about [specific matter]..."
  - "[Topic] - we can confirm that..."
  - "Your message about [topic] has been reviewed..."
  - Start with a direct answer or action taken

Always provide evidence-based, clinically appropriate advice that follows current NHS guidelines and best practices.`;

    return prompt;
  }, []);

  const handleSend = useCallback(async (practiceContext: any, selectedModel: string = 'claude-4-sonnet', messageOverride?: string) => {
    console.log('🚀 handleSend called with:', { 
      hasInput: !!input.trim(), 
      inputLength: input.length,
      messageOverride: messageOverride ? `"${messageOverride.substring(0, 50)}..."` : 'none',
      filesCount: uploadedFiles.length, 
      selectedModel, 
      practiceContext: !!practiceContext,
      isLoading 
    });
    
    const messageToUse = messageOverride || input;
    
    if (!messageToUse.trim() && uploadedFiles.length === 0) {
      console.log('❌ Aborting send: no input and no files');
      return;
    }
    
    console.log('🔄 Proceeding with send - creating user message...');
    
    // Use the provided model instead of useOpenAI setting for model selection
    const modelToUse = selectedModel;
    console.log('🤖 Model selection:', { selectedModel, modelToUse });
    
    // Enhance the message content when files are attached
    let messageContent = messageToUse;
    if (uploadedFiles.length > 0 && messageToUse.trim()) {
      messageContent = `${messageToUse}\n\n[Note: I have uploaded ${uploadedFiles.length} file(s): ${uploadedFiles.map(f => f.name).join(', ')}. Please analyze these files in relation to my question above.]`;
    } else if (uploadedFiles.length > 0 && !messageToUse.trim()) {
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

    // Track if files were attached and what type they are
    const hadFilesAttached = userMessage.files && userMessage.files.length > 0;
    const hasDocumentFiles = hadFilesAttached && userMessage.files!.some(file => 
      !file.type.startsWith('image/')
    );
    const hasImageFiles = hadFilesAttached && userMessage.files!.some(file => 
      file.type.startsWith('image/')
    );
    const hasAnyFiles = hasDocumentFiles || hasImageFiles;
    
    try {
      const startTime = Date.now();
      
      // Check if this is an image generation request
      // Pass previous messages for context-aware detection (e.g., "can you do it" follow-ups)
      const previousMessagesForDetection = messages.map(m => ({ role: m.role, content: m.content }));
      const imageDetection = detectImageRequest(messageToUse, previousMessagesForDetection);
      
      // Allow image generation for visual types even with document/image files
      // These types explicitly want to CREATE visuals FROM the attached content
      const visualTypesAllowedWithFiles = [
        'infographic', 'chart', 'diagram', 'poster', 'calendar',
        'leaflet', 'newsletter', 'social', 'waiting-room', 'form-header', 'campaign', 'general'
      ];
      const isVisualFromFilesRequest = hasAnyFiles && visualTypesAllowedWithFiles.includes(imageDetection.requestType);
      const shouldGenerateImage = imageDetection.isImageRequest && 
                                   imageDetection.confidence !== 'low' && 
                                   (!hasDocumentFiles || isVisualFromFilesRequest);
      
      if (shouldGenerateImage) {
        console.log('🎨 Image request detected:', { 
          originalMessage: messageToUse.substring(0, 100),
          requestType: imageDetection.requestType,
          confidence: imageDetection.confidence,
          isVisualFromFilesRequest, 
          hasDocumentFiles,
          hasImageFiles,
          filesCount: uploadedFiles.length
        });
        
        // Extract document content from non-image files
        let documentContent = uploadedFiles.length > 0
          ? uploadedFiles
              .filter(f => !f.type.startsWith('image/'))
              .map(f => `## ${f.name}\n${f.content.substring(0, 8000)}`)
              .join('\n\n') || undefined
          : undefined;
        
        // If no uploaded files but user is referring to previous content, use last AI response
        if (!documentContent && isReferringToPreviousContent(messageToUse)) {
          const lastAssistantMessage = messages.slice().reverse()
            .find(m => m.role === 'assistant' && m.content.length > 100);
          
          if (lastAssistantMessage) {
            documentContent = `## Previous AI Response\n${lastAssistantMessage.content.substring(0, 8000)}`;
            console.log('🎨 Using previous AI response as document content for image');
          }
        }
        
        // Check if user message itself contains substantial pasted content
        if (!documentContent && messageToUse.length > 300) {
          // Remove the command portion and see if there's substantial content left
          const cleanedContent = messageToUse
            .replace(/^.{0,100}(?:create|generate|make|turn|convert).{0,50}(?:infographic|image|picture|visual|chart|diagram|poster|leaflet).{0,50}(?:from|using|based\s+on|about|of)?:?\s*/i, '')
            .trim();
          if (cleanedContent.length > 200) {
            documentContent = `## User Provided Content\n${cleanedContent.substring(0, 8000)}`;
            console.log('🎨 Using pasted content from user message for image');
          }
        }
        
        // Extract image file data for reference-based generation
        const imageAttachments = uploadedFiles
          .filter(f => f.type.startsWith('image/'))
          .map(f => ({ name: f.name, content: f.content, type: f.type }));
        
        // Store pending request and show branding dialog
        setPendingImageRequest({
          message: messageToUse,
          imageDetection,
          assistantMessageId,
          startTime,
          userMessage,
          newMessages,
          documentContent,
          imageAttachments,
          isVisualFromFilesRequest
        });
        setShowBrandingDialog(true);
        
        // Update message to show waiting for branding selection
        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessageId 
            ? { ...msg, content: '🎨 Waiting for branding options...', isStreaming: true }
            : msg
        ));
        
        return; // Wait for user to select branding options
      }
      
      // Check if this is a voice file generation request
      // Pass uploaded files so we can extract text from them for voice generation
      const voiceDetection = detectVoiceRequest(
        messageToUse, 
        previousMessagesForDetection,
        userMessage.files?.map(f => ({ name: f.name, content: f.content, type: f.type }))
      );
      
      if (voiceDetection.isVoiceRequest && voiceDetection.confidence !== 'low' && voiceDetection.textToSpeak) {
        console.log('🎤 Voice request detected:', voiceDetection);
        
        // Update message to show audio generation in progress
        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessageId 
            ? { ...msg, content: '🎤 Generating voice file...', isStreaming: true }
            : msg
        ));
        
        try {
          // Get user's voice preference from localStorage
          const storedVoice = localStorage.getItem('audioVoiceSelection') || 'elevenlabs-alice';
          let voiceKey: VoiceOption = 'alice';
          
          // Find matching voice
          for (const [key, config] of Object.entries(VOICE_OPTIONS)) {
            if (storedVoice === config.id || storedVoice.includes(config.voiceId)) {
              voiceKey = key as VoiceOption;
              break;
            }
          }
          
          const voiceConfig = VOICE_OPTIONS[voiceKey];
          
          // Truncate text if too long (ElevenLabs has limits)
          const maxChars = 4500;
          let textToSpeak = voiceDetection.textToSpeak;
          const wasTruncated = textToSpeak.length > maxChars;
          if (wasTruncated) {
            textToSpeak = textToSpeak.substring(0, maxChars) + '...';
          }
          
          const { data, error } = await supabase.functions.invoke('elevenlabs-tts', {
            body: {
              text: textToSpeak,
              voiceId: voiceConfig.voiceId
            }
          });
          
          if (error) {
            console.error('Voice generation error:', error);
            throw new Error(error.message || 'Voice generation failed');
          }
          
          if (!data?.audioContent) {
            throw new Error('No audio content received');
          }
          
          const endTime = Date.now();
          const responseTime = endTime - startTime;
          
          // Create message with generated audio
          const audioMessage: Message = {
            ...assistantMessage,
            content: `✅ Voice file generated successfully using **${voiceConfig.name}** voice.${wasTruncated ? '\n\n⚠️ Note: The text was truncated due to length limits.' : ''}\n\nYou can play the audio below or download it as an MP3 file.`,
            isStreaming: false,
            responseTime,
            model: 'ElevenLabs TTS',
            generatedAudio: {
              audioContent: data.audioContent,
              voiceName: voiceConfig.name,
              voiceId: voiceConfig.voiceId,
              textLength: textToSpeak.length
            }
          };
          
          setMessages(prev => prev.map(msg => 
            msg.id === assistantMessageId ? audioMessage : msg
          ));
          
          // Auto-save the search
          setTimeout(async () => {
            const finalMessages = [...newMessages, audioMessage];
            await saveSearchAutomatically(finalMessages);
          }, 100);
          
          setIsLoading(false);
          toast.success('Voice file generated successfully!');
          return;
          
        } catch (voiceError: any) {
          console.error('Voice generation failed:', voiceError);
          
          // Fall back to regular AI response with explanation
          const fallbackMessage = `I wasn't able to generate a voice file for that content. ${voiceError.message || 'Please try again.'}\n\nWould you like me to try again, or is there something else I can help you with?`;
          
          setMessages(prev => prev.map(msg => 
            msg.id === assistantMessageId 
              ? { ...msg, content: fallbackMessage, isStreaming: false }
              : msg
          ));
          
          setIsLoading(false);
          return;
        }
      }
      
      // Check if this is a PowerPoint generation request
      const pptDetection = detectPowerPointRequest(messageToUse, previousMessagesForDetection, uploadedFiles);
      
      // Debug logging for topic extraction
      console.log('📊 PowerPoint detection result:', {
        originalMessage: messageToUse.substring(0, 100),
        isPowerPointRequest: pptDetection.isPowerPointRequest,
        extractedTopic: pptDetection.topic,
        confidence: pptDetection.confidence,
        presentationType: pptDetection.presentationType
      });
      
      if (pptDetection.isPowerPointRequest && pptDetection.confidence !== 'low') {
        console.log('📊 PowerPoint request detected, proceeding with generation');
        
        // Update message to show generation in progress
        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessageId 
            ? { ...msg, content: '📊 Generating professional presentation with Notewell AI...\n\nThis may take 30-60 seconds for best quality.', isStreaming: true }
            : msg
        ));
        
        try {
          // Prepare supporting content from uploaded files
          let supportingContent = '';
          if (uploadedFiles.length > 0) {
            supportingContent = uploadedFiles.map(file => {
              // Limit each file content and format nicely
              const truncatedContent = file.content.substring(0, 15000);
              return `### ${file.name}\n${truncatedContent}`;
            }).join('\n\n---\n\n');
          }
          
          // If no uploaded files but user is referring to previous content, use last AI response
          if (!supportingContent && isReferringToPreviousContent(messageToUse)) {
            const lastAssistantMessage = messages.slice().reverse()
              .find(m => m.role === 'assistant' && m.content.length > 100);
            
            if (lastAssistantMessage) {
              supportingContent = `### Previous AI Response\n${lastAssistantMessage.content.substring(0, 20000)}`;
              console.log('📊 Using previous AI response as supporting content for PowerPoint');
            }
          }
          
          // Check if user message itself contains substantial pasted content
          if (!supportingContent && messageToUse.length > 300) {
            // Remove the command portion and see if there's substantial content left
            const cleanedContent = messageToUse
              .replace(/^.{0,100}(?:please\s+)?(?:create|generate|make|turn|convert).{0,50}(?:power\s*point|pptx?|presentation|slides?).{0,50}(?:from|using|based\s+on|about|on)?:?\s*/i, '')
              .trim();
            if (cleanedContent.length > 200) {
              supportingContent = `### User Provided Content\n${cleanedContent.substring(0, 20000)}`;
              console.log('📊 Using pasted content from user message for PowerPoint');
            }
          }
          
          // Call Gamma API edge function
          const { data: gammaResponse, error: gammaError } = await supabase.functions.invoke('generate-powerpoint-gamma', {
            body: {
              topic: pptDetection.topic,
              presentationType: getPresentationTypeDisplayName(pptDetection.presentationType),
              slideCount: pptDetection.slideCount || 10,
              supportingContent: supportingContent || undefined,
              customInstructions: pptDetection.customInstructions,
              audience: 'NHS healthcare professionals and primary care staff'
            }
          });
          
          if (gammaError) {
            console.error('Gamma API error:', gammaError);
            throw new Error(gammaError.message || 'Failed to generate presentation');
          }
          
          if (!gammaResponse?.success || (!gammaResponse?.downloadUrl && !gammaResponse?.pptxBase64)) {
            console.error('Invalid Gamma response:', gammaResponse);
            throw new Error(gammaResponse?.error || 'No presentation data received');
          }
          
          console.log('📊 Gamma presentation generated successfully');
          
          const endTime = Date.now();
          const responseTime = endTime - startTime;
          
          // Create the presentation object - prefer downloadUrl over pptxBase64
          const generatedPresentation: GeneratedPresentation = {
            downloadUrl: gammaResponse.downloadUrl,
            pptxBase64: gammaResponse.pptxBase64, // Legacy fallback
            title: gammaResponse.title || pptDetection.topic,
            slideCount: gammaResponse.slideCount || pptDetection.slideCount || 10,
            presentationType: getPresentationTypeDisplayName(pptDetection.presentationType),
            sourceFiles: uploadedFiles.length > 0 ? uploadedFiles.map(f => f.name) : undefined
          };
          
          // Create message with generated presentation
          const pptMessage: Message = {
            ...assistantMessage,
            content: `✅ **Professional PowerPoint Generated!**\n\n**Title:** ${generatedPresentation.title}\n**Type:** ${generatedPresentation.presentationType}\n**Slides:** ${generatedPresentation.slideCount}\n${uploadedFiles.length > 0 ? `\n**Source Materials:** ${uploadedFiles.map(f => f.name).join(', ')}` : ''}\n\n*Powered by Gamma AI for professional-grade design.*\n\nYour presentation is ready to download below.`,
            isStreaming: false,
            responseTime,
            model: 'Gamma AI',
            generatedPresentation
          };
          
          setMessages(prev => prev.map(msg => 
            msg.id === assistantMessageId ? pptMessage : msg
          ));
          
          // Auto-save the search
          setTimeout(async () => {
            const finalMessages = [...newMessages, pptMessage];
            await saveSearchAutomatically(finalMessages);
          }, 100);
          
          setIsLoading(false);
          toast.success('Professional PowerPoint generated successfully!');
          return;
          
        } catch (pptError: any) {
          console.error('PowerPoint generation failed:', pptError);
          
          // Fall back to regular AI response with explanation
          const fallbackMessage = `I wasn't able to generate the PowerPoint presentation. ${pptError.message || 'Please try again.'}\n\nWould you like me to try again, or would you prefer the content in a different format?`;
          
          setMessages(prev => prev.map(msg => 
            msg.id === assistantMessageId 
              ? { ...msg, content: fallbackMessage, isStreaming: false }
              : msg
          ));
          
          setIsLoading(false);
          return;
        }
      }
      const systemPrompt = buildSystemPrompt(practiceContext, uploadedFiles, verificationLevel);
      console.log('📄 Final system prompt (first 500 chars):', systemPrompt.substring(0, 500));
      
      // Prepare optimised messages for API using conversation memory management
      // This automatically handles token limits, summarises older messages, and deduplicates file content
      const messagesForAPI = prepareMessagesForAPI(
        newMessages.map(msg => ({
          ...msg,
          timestamp: msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp)
        })),
        systemPrompt,
        30000 // Max tokens for conversation history
      );
      
      // Log memory stats
      const memoryStats = getMemoryStats(newMessages);
      console.log('🧠 Memory status:', memoryStats);
      
      // Warn user if approaching limits
      if (memoryStats.recommendation && memoryStats.tokenPercentage >= 70) {
        console.warn('⚠️ Memory warning:', memoryStats.recommendation);
      }

      // For GPT-5 queries, prefer the fast clinical function (works better and more reliable)
      if (modelToUse === 'gpt-5-2025-08-07' || modelToUse === 'gpt-5') {
        console.log('🚀 Using GPT-5 Fast Clinical function');
        
        try {
          let accumulatedContent = '';
          let timeToFirstWords: number | undefined;
          let webSearchUsed = false;
          
          const streamHandler = (chunk: string, webSearchPerformed?: boolean) => {
            accumulatedContent += chunk;
            if (webSearchPerformed) webSearchUsed = true;
            
            if (!timeToFirstWords) {
              timeToFirstWords = Date.now() - startTime;
            }
            
            setMessages(prev => prev.map(msg => 
              msg.id === assistantMessageId 
                ? { ...msg, content: accumulatedContent, isStreaming: true, timeToFirstWords, webSearchPerformed: webSearchUsed }
                : msg
            ));
          };
          
          // The messagesForAPI already includes system prompt as first message
          // Extract the system prompt and non-system messages for the API
          const systemMessage = messagesForAPI.find(m => m.role === 'system');
          const nonSystemMessages = messagesForAPI.filter(m => m.role !== 'system');
          
          const result = await handleGPT5FastClinical(
            nonSystemMessages as { role: 'user' | 'assistant' | 'system'; content: string }[], 
            systemMessage?.content || systemPrompt, 
            streamHandler
          );
          
          const endTime = Date.now();
          const responseTime = endTime - startTime;
          
          const finalAssistantMessage = {
            ...assistantMessage,
            content: result.response,
            isStreaming: false,
            responseTime,
            timeToFirstWords,
            apiResponseTime: responseTime,
            webSearchPerformed: result.webSearchPerformed || webSearchUsed
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
          // The messagesForAPI already contains the system message from prepareMessagesForAPI
          const chatgptRequestBody = {
            messages: messagesForAPI,
            model: 'gpt-4o',
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
      // The messagesForAPI already contains the system message from prepareMessagesForAPI
      const requestBody = {
        messages: messagesForAPI,
        model: modelToUse,
        files: uploadedFiles.length > 0 ? uploadedFiles : undefined,
        verificationLevel: verificationLevel,
        stream: true // Request streaming
      };

      // Check if model supports streaming
      const streamableModels = ['google/gemini-3-flash-preview', 'google/gemini-3-pro-preview', 'google/gemini-2.5-flash', 'openai/gpt-5', 'openai/gpt-5-mini'];
      const canStream = streamableModels.includes(modelToUse);
      
      if (canStream) {
        // Use fetch for true streaming
        console.log('🔄 Using true streaming for model:', modelToUse);
        
        const session = await supabase.auth.getSession();
        const accessToken = session.data.session?.access_token;
        
        const response = await fetch('https://dphcnbricafkbtizkoal.supabase.co/functions/v1/ai-4-pm-chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaGNuYnJpY2Fma2J0aXprb2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MzIyMzIsImV4cCI6MjA2ODMwODIzMn0.U3bJI6P1yzgRBz_k2s0zlJGu1GWiVRTHjYgv9QQggPs'
          },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Stream error: ${response.status} - ${errorText}`);
        }

        // Check if we got an SSE stream
        const contentType = response.headers.get('content-type') || '';
        
        if (contentType.includes('text/event-stream')) {
          // True SSE streaming
          const reader = response.body?.getReader();
          const decoder = new TextDecoder();
          
          let accumulatedContent = '';
          let timeToFirstWords: number | undefined;
          let buffer = '';
          
          const processStream = async () => {
            if (!reader) return;
            
            while (true) {
              const { done, value } = await reader.read();
              
              if (done) {
                // Stream complete
                const endTime = Date.now();
                const responseTime = endTime - startTime;
                
                const finalAssistantMessage = {
                  ...assistantMessage,
                  content: accumulatedContent.trim(),
                  isStreaming: false,
                  responseTime,
                  timeToFirstWords,
                  apiResponseTime: timeToFirstWords || responseTime
                };

                // Perform clinical verification if this was a clinical query
                if (isClinical && userMessage.isClinical) {
                  setTimeout(async () => {
                    const verificationData = await performClinicalVerification(
                      assistantMessageId,
                      userMessage.content,
                      accumulatedContent.trim()
                    );
                    if (verificationData) {
                      setMessages(prev => prev.map(msg => 
                        msg.id === assistantMessageId 
                          ? { ...msg, clinicalVerification: verificationData }
                          : msg
                      ));
                    }
                  }, 500);
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
                
                break;
              }
              
              buffer += decoder.decode(value, { stream: true });
              
              // Parse SSE events
              const lines = buffer.split('\n');
              buffer = lines.pop() || ''; // Keep incomplete line in buffer
              
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6);
                  if (data === '[DONE]') continue;
                  
                  try {
                    const parsed = JSON.parse(data);
                    const content = parsed.choices?.[0]?.delta?.content || '';
                    
                    if (content) {
                      accumulatedContent += content;
                      
                      if (!timeToFirstWords) {
                        timeToFirstWords = Date.now() - startTime;
                        console.log('⚡ Time to first words:', timeToFirstWords, 'ms');
                      }
                      
                      setMessages(prev => prev.map(msg => 
                        msg.id === assistantMessageId 
                          ? { ...msg, content: accumulatedContent, isStreaming: true, timeToFirstWords }
                          : msg
                      ));
                    }
                  } catch {
                    // Ignore parse errors for incomplete JSON
                  }
                }
              }
            }
          };
          
          await processStream();
        } else {
          // Non-streaming JSON response (fallback)
          const data = await response.json();
          const responseContent = data?.response || data?.content || 'No response received';
          
          // Capture API response time
          const apiResponseTime = Date.now() - startTime;
          
          // Fast simulated streaming
          const chunks = responseContent.split(' ');
          const chunkSize = Math.max(5, Math.floor(chunks.length / 5));
          let currentIndex = 0;
          let accumulatedContent = '';
          let timeToFirstWords: number | undefined;

          const streamChunks = () => {
            if (currentIndex < chunks.length) {
              const endIndex = Math.min(currentIndex + chunkSize, chunks.length);
              const chunkText = chunks.slice(currentIndex, endIndex).join(' ') + ' ';
              accumulatedContent += chunkText;
              currentIndex = endIndex;

              if (currentIndex === chunkSize && !timeToFirstWords) {
                timeToFirstWords = Date.now() - startTime;
              }

              setMessages(prev => prev.map(msg => 
                msg.id === assistantMessageId 
                  ? { ...msg, content: accumulatedContent.trim(), isStreaming: true, timeToFirstWords, apiResponseTime }
                  : msg
              ));

              if (currentIndex < chunks.length) {
                setTimeout(streamChunks, 15 + Math.random() * 10);
              } else {
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

                if (isClinical && userMessage.isClinical) {
                  setTimeout(async () => {
                    const verificationData = await performClinicalVerification(
                      assistantMessageId,
                      userMessage.content,
                      responseContent
                    );
                    if (verificationData) {
                      setMessages(prev => prev.map(msg => 
                        msg.id === assistantMessageId 
                          ? { ...msg, clinicalVerification: verificationData }
                          : msg
                      ));
                    }
                  }, 500);
                }
                
                setMessages(prev => prev.map(msg => 
                  msg.id === assistantMessageId 
                    ? finalAssistantMessage
                    : msg
                ));

                setTimeout(async () => {
                  const finalMessages = [...newMessages, finalAssistantMessage];
                  await saveSearchAutomatically(finalMessages);
                }, 100);
              }
            }
          };

          streamChunks();
        }
      } else {
        // Use supabase.functions.invoke for non-streamable models (original logic)
        const { data, error } = await supabase.functions.invoke('ai-4-pm-chat', {
          body: { ...requestBody, stream: false }
        });

        if (error) {
          console.error('AI Service Error:', error);
          throw new Error(`AI service error: ${error.message || 'Unknown error'}`);
        }

        const responseContent = data?.response || data?.content || 'No response received';
        
        const apiResponseTime = Date.now() - startTime;
        
        if (!responseContent || responseContent === 'No response received') {
          throw new Error('No valid response received from AI service');
        }
        
        const hasFiles = uploadedFiles.length > 0;
        const chunks = responseContent.split(' ');
        
        if (!hasFiles) {
          const chunkSize = Math.max(5, Math.floor(chunks.length / 5));
          let currentIndex = 0;
          let accumulatedContent = '';
          let timeToFirstWords: number | undefined;

          const streamChunks = () => {
            if (currentIndex < chunks.length) {
              const endIndex = Math.min(currentIndex + chunkSize, chunks.length);
              const chunkText = chunks.slice(currentIndex, endIndex).join(' ') + ' ';
              accumulatedContent += chunkText;
              currentIndex = endIndex;

              if (currentIndex === chunkSize && !timeToFirstWords) {
                timeToFirstWords = Date.now() - startTime;
              }

              setMessages(prev => prev.map(msg => 
                msg.id === assistantMessageId 
                  ? { ...msg, content: accumulatedContent.trim(), isStreaming: true, timeToFirstWords, apiResponseTime }
                  : msg
              ));

              if (currentIndex < chunks.length) {
                setTimeout(streamChunks, 15 + Math.random() * 10);
              } else {
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

                if (isClinical && userMessage.isClinical) {
                  setTimeout(async () => {
                    const verificationData = await performClinicalVerification(
                      assistantMessageId,
                      userMessage.content,
                      responseContent
                    );
                    if (verificationData) {
                      setMessages(prev => prev.map(msg => 
                        msg.id === assistantMessageId 
                          ? { ...msg, clinicalVerification: verificationData }
                          : msg
                      ));
                    }
                  }, 500);
                }
                
                setMessages(prev => prev.map(msg => 
                  msg.id === assistantMessageId 
                    ? finalAssistantMessage
                    : msg
                ));

                setTimeout(async () => {
                  const finalMessages = [...newMessages, finalAssistantMessage];
                  await saveSearchAutomatically(finalMessages);
                }, 100);
              }
            }
          };

          streamChunks();
        }
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

  // Sanitise messages to strip file content before saving to database
  const sanitiseMessagesForStorage = (messagesData: Message[]): Message[] => {
    return messagesData.map(msg => ({
      ...msg,
      files: msg.files?.map(file => ({
        name: file.name,
        type: file.type,
        size: file.size,
        content: '', // Strip content for storage - prevents database bloat
        isLoading: false,
        metadata: file.metadata
      }))
    }));
  };

  const saveSearchAutomatically = async (messagesData: Message[]) => {
    if (!user || messagesData.length < 2) return; // Need at least user + assistant message

    console.log('🔄 Auto-saving search with:', {
      messagesCount: messagesData.length,
      currentSearchId,
      userId: user.id
    });

    // Sanitise messages to remove file content before saving
    const sanitisedMessages = sanitiseMessagesForStorage(messagesData);

    try {
      // If we have a current search ID, update it instead of creating a new one
      if (currentSearchId) {
        console.log('📝 Updating existing search:', currentSearchId);
        
        // Generate updated brief overview
        const aiMessages = messagesData.filter(m => m.role === 'assistant');
        const overview = aiMessages.length > 0 
          ? aiMessages[0].content.substring(0, 120) + (aiMessages[0].content.length > 120 ? '...' : '')
          : 'No AI response';

        const { error } = await supabase
          .from('ai_4_pm_searches')
          .update({
            messages: sanitisedMessages as any,
            brief_overview: overview,
            updated_at: new Date().toISOString()
          })
          .eq('id', currentSearchId)
          .eq('user_id', user.id); // Add user_id check for security
        
        if (error) {
          console.error('❌ Error updating existing search:', error);
          // If update fails, try to create a new search instead
          console.log('⚠️ Falling back to create new search due to update failure');
        } else {
          console.log('✅ Successfully updated existing search');
          // Update local search history to reflect changes
          setSearchHistory(prev => prev.map(search => 
            search.id === currentSearchId 
              ? { ...search, messages: messagesData, brief_overview: overview, updated_at: new Date().toISOString() }
              : search
          ));
          return;
        }
      }

      // Create new search (either no current search ID or update failed)
      console.log('➕ Creating new search entry');
      
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
          messages: sanitisedMessages as any
        })
        .select()
        .single();

      if (!error && data) {
        // Set the current search ID so future updates modify this entry
        setCurrentSearchId(data.id);
        console.log('✅ Created new search with ID:', data.id);
        
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
      } else {
        console.error('❌ Failed to create new search:', error);
      }
    } catch (error) {
      console.error('❌ Error auto-saving search:', error);
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
          setAutoCollapseUserPrompts(preferences.autoCollapseUserPrompts ?? false);
          setChatHistoryRetentionDays(preferences.chatHistoryRetentionDays ?? 30);
          setHideGPClinical(preferences.hideGPClinical ?? false);
          setImageGenerationModel(preferences.imageGenerationModel ?? 'google/gemini-3-pro-image-preview');
          setIncludePracticeLogo(preferences.includePracticeLogo ?? true);
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
        readingFont,
        autoCollapseUserPrompts,
        chatHistoryRetentionDays,
        hideGPClinical,
        imageGenerationModel,
        includePracticeLogo
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

      // Also save chat retention to profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ ai4gp_chat_retention_days: chatHistoryRetentionDays })
        .eq('user_id', user.id);

      if (error || profileError) {
        console.error('Error saving settings:', error || profileError);
      } else {
        console.log('AI4GP settings saved successfully');
      }
    } catch (error) {
      console.error('Error saving user settings:', error);
    }
  }, [user?.id, sessionMemory, verificationLevel, showResponseMetrics, selectedModel, useOpenAI, showRenderTimes, showAIService, northamptonshireICB, textSize, interfaceDensity, containerWidth, highContrast, readingFont, autoCollapseUserPrompts, chatHistoryRetentionDays, hideGPClinical, imageGenerationModel, includePracticeLogo]);

  // Save settings when they change (with debounce to avoid too many saves)
  useEffect(() => {
    if (user?.id) {
      const timeoutId = setTimeout(() => {
        saveUserSettings();
      }, 500); // Debounce saves by 500ms

      return () => clearTimeout(timeoutId);
    }
  }, [user?.id, sessionMemory, verificationLevel, showResponseMetrics, selectedModel, useOpenAI, showRenderTimes, showAIService, northamptonshireICB, textSize, interfaceDensity, containerWidth, highContrast, readingFont, autoCollapseUserPrompts, chatHistoryRetentionDays, hideGPClinical, saveUserSettings]);

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

      // For GPT-5 queries, use the fast clinical function with real streaming
      if (selectedModel === 'gpt-5-2025-08-07' || selectedModel === 'gpt-5') {
        console.log('🚀 Using GPT-5 Fast Clinical for quick response with real streaming');
        
        try {
          let accumulatedContent = '';
          let timeToFirstWords: number | undefined;
          let webSearchUsed = false;
          
          const streamHandler = (chunk: string, webSearchPerformed?: boolean) => {
            accumulatedContent += chunk;
            if (webSearchPerformed) webSearchUsed = true;
            
            if (!timeToFirstWords) {
              timeToFirstWords = Date.now() - startTime;
            }
            
            setMessages(prev => prev.map(msg => 
              msg.id === assistantMessageId 
                ? { ...msg, content: accumulatedContent, isStreaming: true, timeToFirstWords, webSearchPerformed: webSearchUsed }
                : msg
            ));
          };
          
          const result = await handleGPT5FastClinical(messagesForAPI, systemPrompt, streamHandler);
          
          const endTime = Date.now();
          const responseTime = endTime - startTime;
          
          const finalAssistantMessage = {
            ...assistantMessage,
            content: result.response,
            isStreaming: false,
            responseTime,
            timeToFirstWords,
            apiResponseTime: responseTime,
            webSearchPerformed: result.webSearchPerformed || webSearchUsed
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
          console.error('GPT-5 Fast Clinical failed for quick response:', error);
          // Fall through to regular edge function approach
        }
      }

      // For non-GPT-5 models or GPT-5 fallback, use the ai-4-pm-chat function
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
      
      // Ultra-fast simulated streaming for quick actions - start immediately
      const chunks = responseContent.split(' ');
      const chunkSize = Math.max(3, Math.floor(chunks.length / 8)); // ~8 very fast updates
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
            // Ultra-fast streaming for quick actions - minimal delay
            setTimeout(streamChunks, 8 + Math.random() * 5);
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

      // Start ultra-fast streaming immediately
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
  }, [messages, uploadedFiles, buildSystemPrompt, verificationLevel, input, handleGPT5FastClinical, saveSearchAutomatically]);

  // Handle branding selection and proceed with image generation
  const handleBrandingConfirm = useCallback(async (
    brandingLevel: BrandingLevel,
    customBranding: CustomBrandingOptions,
    practiceContext: any,
    includeLogo: boolean,
    layout?: 'portrait' | 'landscape' | 'square' | 'circle',
    editedDetails?: string[]
  ) => {
    if (!pendingImageRequest) {
      console.error('No pending image request');
      setShowBrandingDialog(false);
      return;
    }

    const {
      message,
      imageDetection,
      assistantMessageId,
      startTime,
      userMessage,
      newMessages,
      documentContent,
      imageAttachments,
    } = pendingImageRequest;

    setShowBrandingDialog(false);

    // Update message to show image generation in progress
    setMessages(prev => prev.map(msg => 
      msg.id === assistantMessageId 
        ? { ...msg, content: '🎨 Generating visual representation...', isStreaming: true }
        : msg
    ));

    // Extract context from previous messages
    const conversationContext = extractImageContext(
      imageDetection.imagePrompt || message,
      messages.map(m => ({ role: m.role, content: m.content }))
    );

    try {
      const { data, error } = await supabase.functions.invoke('ai4gp-image-generation', {
        body: {
          prompt: message,
          conversationContext,
          documentContent,
          imageAttachments,
          imageModel: imageGenerationModel,
          layoutPreference: layout || 'portrait',
          practiceContext: {
            practiceName: practiceContext?.practiceName,
            pcnName: practiceContext?.pcnName,
            organisationType: practiceContext?.organisationType,
            practiceAddress: practiceContext?.practiceAddress,
            practicePhone: practiceContext?.practicePhone,
            practiceEmail: practiceContext?.practiceEmail,
            practiceWebsite: practiceContext?.practiceWebsite,
            logoUrl: practiceContext?.logoUrl,
            // Pass branding options
            brandingLevel,
            customBranding,
            // Pass logo toggle state
            includeLogo,
            // Pass edited details (user-edited branding text)
            editedDetails
          },
          requestType: imageDetection.requestType
        }
      });

      if (error) {
        console.error('Image generation error:', error);
        throw new Error(error.message || 'Image generation failed');
      }

      if (!data.success) {
        throw new Error(data.error || 'Image generation failed');
      }

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Create message with generated image
      const imageMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: data.textResponse,
        timestamp: userMessage.timestamp,
        isStreaming: false,
        responseTime,
        model: imageGenerationModel === 'google/gemini-3-pro-image-preview' ? 'Gemini 3 Pro' : imageGenerationModel === 'google/gemini-2.5-flash-image-preview' ? 'Gemini Flash' : 'GPT Image',
        generatedImages: [data.image as GeneratedImage]
      };

      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId ? imageMessage : msg
      ));

      // Auto-save the search
      setTimeout(async () => {
        const finalMessages = [...newMessages, imageMessage];
        await saveSearchAutomatically(finalMessages);
      }, 100);

      setIsLoading(false);
      setPendingImageRequest(null);
      toast.success('Image generated successfully!');

    } catch (imageError: any) {
      console.error('Image generation failed:', imageError);

      // Fall back to regular AI response with explanation
      const fallbackMessage = `I wasn't able to generate an image for that request. ${imageError.message || 'Please try again with a different description.'}\n\nWould you like me to describe the information in text format instead, or would you like to try a different image request?`;

      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { ...msg, content: fallbackMessage, isStreaming: false }
          : msg
      ));

      setIsLoading(false);
      setPendingImageRequest(null);
    }
  }, [pendingImageRequest, messages, saveSearchAutomatically, imageGenerationModel]);

  // Handle branding dialog cancel
  const handleBrandingCancel = useCallback(() => {
    if (pendingImageRequest) {
      const { assistantMessageId } = pendingImageRequest;
      
      // Remove the assistant message or show cancelled
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { ...msg, content: 'Image generation cancelled.', isStreaming: false }
          : msg
      ));
    }
    
    setShowBrandingDialog(false);
    setPendingImageRequest(null);
    setIsLoading(false);
  }, [pendingImageRequest]);

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
    setReadingFont,
    autoCollapseUserPrompts,
    setAutoCollapseUserPrompts,
    chatHistoryRetentionDays,
    setChatHistoryRetentionDays,
    hideGPClinical,
    setHideGPClinical,
    imageGenerationModel,
    setImageGenerationModel,
    // Image branding dialog
    showBrandingDialog,
    setShowBrandingDialog,
    pendingImageRequest,
    handleBrandingConfirm,
    handleBrandingCancel,
    // Practice logo toggle
    includePracticeLogo,
    setIncludePracticeLogo
  };
};
