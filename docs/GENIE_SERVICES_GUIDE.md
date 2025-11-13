# GP Genie & Oak Lane Patient Line Services - Comprehensive Guide

## Overview

This document provides a complete technical overview of the Genie voice services within Notewell AI, specifically GP Genie, PM Genie, and Oak Lane Patient Line. These are real-time voice conversation services powered by OpenAI's Realtime API and AssemblyAI's speech recognition.

## Service Types

### 1. GP Genie
- **Purpose**: Multilingual voice translation service for GP consultations
- **Target Users**: GPs and healthcare professionals
- **Primary Use Case**: Real-time patient communication support for over 100 languages
- **Key Feature**: Includes prominent disclaimer that it's NOT for real-world clinical use (proof-of-concept only)
- **Branding Color**: NHS Blue (#005EB8)

### 2. PM Genie
- **Purpose**: Practice management assistant
- **Target Users**: Practice managers and administrative staff
- **Primary Use Case**: Administrative guidance and support
- **Branding Color**: Emerald Green (#10B981)

### 3. Oak Lane Patient Line
- **Purpose**: Patient communication service
- **Target Users**: Oak Lane surgery patients
- **Primary Use Case**: Patient queries and information
- **Branding Color**: Emerald Green (#10B981)

---

## Architecture Overview

### Technology Stack

1. **Frontend**: React + TypeScript
2. **Voice Input**: Browser MediaRecorder API + AssemblyAI Real-time Transcription
3. **AI Conversation**: OpenAI Realtime API (WebRTC)
4. **Voice Output**: OpenAI's built-in text-to-speech (alloy voice)
5. **Email Service**: EmailJS for automatic transcript delivery
6. **Database**: Supabase (PostgreSQL) for conversation history
7. **File Generation**: docx library for Word document transcripts

### Key API Integrations

#### 1. AssemblyAI Real-time Transcription
- **Endpoint**: `wss://api.assemblyai.com/v2/realtime/ws`
- **Purpose**: Convert user's speech to text in real-time
- **Token Management**: Temporary tokens obtained via edge function `assemblyai-realtime-token`
- **Configuration**:
  - Sample rate: 16000 Hz
  - Encoding: PCM16
  - Partial results: Enabled
  - End utterance silence threshold: 700ms

#### 2. OpenAI Realtime API
- **Endpoint**: `wss://api.openai.com/v1/realtime`
- **Model**: `gpt-4o-realtime-preview-2024-12-17`
- **Session Creation**: Via edge function `openai-realtime-session`
- **Modalities**: Text and audio
- **Voice**: `alloy`
- **Features Used**:
  - Session creation with custom instructions
  - Conversation history management
  - Built-in voice synthesis

#### 3. EmailJS
- **Service**: Automated email delivery
- **Purpose**: Send formatted conversation transcripts at call end
- **Template**: Custom HTML with service-specific branding
- **Configuration**: Requires EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID_GENIE, EMAILJS_PUBLIC_KEY

---

## Component Structure

### Primary Components

#### 1. GPGenieVoiceAgent.tsx
**Location**: `src/components/GPGenieVoiceAgent.tsx`

**Purpose**: Main component handling all three services via tabs

**Key Features**:
- Tab-based interface for GP Genie, PM Genie, and Oak Lane Patient Line
- Real-time voice conversation
- Automatic email transcript delivery
- Downloadable Word document transcripts
- Conversation history with search and filtering
- Service-specific branding and instructions

**State Management**:
```typescript
const [isConnected, setIsConnected] = useState(false);
const [isRecording, setIsRecording] = useState(false);
const [activeTab, setActiveTab] = useState<'gp-genie' | 'pm-genie' | 'patient-line'>('gp-genie');
const [conversationBuffer, setConversationBuffer] = useState<GenieMessage[]>([]);
const [transcriptText, setTranscriptText] = useState('');
const [conversationStartTime, setConversationStartTime] = useState<Date | null>(null);
const [conversationEndTime, setConversationEndTime] = useState<Date | null>(null);
```

#### 2. PMGenieVoiceAgent.tsx
**Location**: `src/components/PMGenieVoiceAgent.tsx`

**Purpose**: Standalone component specifically for PM Genie (duplicate functionality)

**Note**: Contains identical conversation history setup as GPGenieVoiceAgent with tabs for all three services.

#### 3. GenieHistory.tsx
**Location**: `src/components/genie/GenieHistory.tsx`

**Purpose**: Display and manage conversation history for each service

**Features**:
- Search conversations by keywords
- View conversation metadata (date, time, duration, message count)
- Download Word document transcripts from history
- Delete past conversations
- Filter by service type

---

## Database Schema

### Table: `genie_sessions`

**Purpose**: Store all conversation sessions for all three Genie services

**Columns**:
```sql
- id: uuid (primary key)
- user_id: uuid (references auth.users)
- service_type: text ('gp-genie' | 'pm-genie' | 'patient-line')
- title: text (auto-generated: "ServiceName — HH:mm on DD/MM/YYYY")
- brief_overview: text (first user question + last agent response summary)
- messages: jsonb (complete conversation array)
- start_time: timestamp with time zone
- end_time: timestamp with time zone
- duration_seconds: integer
- message_count: integer
- email_sent: boolean
- created_at: timestamp with time zone
```

**Row Level Security (RLS)**:
- Users can only view their own sessions (`user_id = auth.uid()`)
- Users can insert their own sessions
- Users can delete their own sessions

**Indexes**:
- Index on `user_id` for fast user-specific queries
- Index on `service_type` for filtering by service
- Index on `created_at` for chronological sorting

---

## Conversation Flow

### 1. Connection Phase
```
User clicks "Start Conversation"
↓
Request temporary AssemblyAI token (edge function)
↓
Create OpenAI session with service-specific instructions (edge function)
↓
Establish WebSocket connections:
  - AssemblyAI for speech-to-text
  - OpenAI Realtime API for conversation
↓
Start MediaRecorder to capture user audio
↓
Set isConnected = true, conversationStartTime = now()
```

### 2. Active Conversation Phase
```
User speaks
↓
Browser MediaRecorder captures audio chunks
↓
Send audio to AssemblyAI WebSocket (PCM16 format)
↓
AssemblyAI returns transcribed text
↓
Display transcript in UI
↓
Send transcript to OpenAI Realtime API
↓
OpenAI processes and responds with:
  - Text response
  - Audio response (played automatically)
↓
Add to conversationBuffer with timestamps
↓
Display agent response in UI
```

### 3. End Conversation Phase
```
User clicks "End Conversation"
↓
Set conversationEndTime = now()
↓
Close WebSocket connections (AssemblyAI + OpenAI)
↓
Stop MediaRecorder
↓
Generate conversation metadata:
  - Duration (end_time - start_time)
  - Message count
  - Title (auto-generated)
  - Brief overview (first Q + last A)
↓
Save to Supabase genie_sessions table
↓
Send email transcript via EmailJS (automatic, silent)
↓
Keep conversationBuffer in state (for download button)
↓
User can download Word document until navigation away
```

### 4. Disconnect Handling
```
If user disconnects unexpectedly (WebSocket close/error)
↓
Trigger same end conversation flow as backup
↓
Ensure transcript email is sent
↓
Ensure session is saved to database
```

---

## Service-Specific Instructions

### GP Genie System Prompt
```
You are GP Genie, a multilingual AI assistant designed to help GPs communicate with patients who speak different languages.

Core Capabilities:
- Real-time translation between English and 100+ languages
- Medical terminology translation with accuracy
- Cultural sensitivity in healthcare communication
- Support for complex medical conversations

Instructions:
1. When a GP provides text in English, translate it accurately to the patient's language
2. When receiving text in another language (from patient), translate it to English for the GP
3. Maintain medical accuracy and appropriate terminology
4. Be concise but complete in translations
5. Flag any cultural considerations that might affect care
6. If unsure about medical terminology, ask for clarification

Limitations:
- This is a translation support tool only
- Not for clinical decision making
- Not for diagnosis or treatment recommendations
- Proof-of-concept only - not approved for real clinical use
```

### PM Genie System Prompt
```
You are PM Genie, an AI assistant specialized in helping practice managers with NHS primary care administration.

Core Capabilities:
- Guidance on practice management tasks
- NHS administrative processes and requirements
- Staff management and HR queries
- Financial and operational advice for GP practices
- CQC compliance and quality improvement

Instructions:
1. Provide clear, actionable advice for practice management
2. Reference NHS guidelines and best practices
3. Help with operational efficiency and problem-solving
4. Support with staff-related queries and procedures
5. Assist with understanding regulatory requirements

Focus Areas:
- Practice operations and workflow
- Staff management and training
- Financial management
- Compliance and governance
- Patient experience and service improvement
```

### Oak Lane Patient Line System Prompt
```
You are the Oak Lane Patient Line AI assistant, helping patients of Oak Lane Surgery with their queries.

Core Capabilities:
- General practice information and guidance
- Appointment booking assistance
- Prescription queries
- Test results information
- Signposting to appropriate services

Instructions:
1. Be friendly, professional, and patient-focused
2. Provide clear information about practice services
3. Help patients navigate NHS services appropriately
4. Signpost to emergency services when needed
5. Maintain patient confidentiality at all times
6. If unsure, direct patients to contact practice staff directly

Important:
- Do not provide medical advice or diagnosis
- Always recommend speaking to a healthcare professional for clinical concerns
- Prioritize patient safety in all interactions
- Be clear about the limitations of AI assistance
```

---

## Transcript Features

### Automatic Email Delivery

**Trigger**: Automatically sent when conversation ends (both normal end and disconnect)

**Format**: HTML email with professional formatting

**Email Structure**:
```html
<div style="max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: [service-color]; padding: 20px; text-align: center;">
    <h1 style="color: white;">[Service Name] Conversation Transcript</h1>
  </div>
  
  <div style="padding: 20px; background-color: #f9f9f9;">
    <table>
      <tr><td>Start Time:</td><td>HH:mm on DD/MM/YYYY</td></tr>
      <tr><td>End Time:</td><td>HH:mm on DD/MM/YYYY</td></tr>
      <tr><td>Duration:</td><td>X minutes Y seconds</td></tr>
      <tr><td>Messages:</td><td>N messages</td></tr>
    </table>
  </div>
  
  <div style="padding: 20px;">
    [For each message:]
    <div style="margin: 10px 0; padding: 15px; background-color: [user: #E3F2FD, agent: #F5F5F5]; border-radius: 8px;">
      <strong>[User/Agent Name]</strong> - HH:mm on DD/MM/YYYY
      <p>[Message content]</p>
    </div>
  </div>
</div>
```

**Service Colors**:
- GP Genie: NHS Blue (#005EB8)
- PM Genie: Emerald Green (#10B981)
- Oak Lane Patient Line: Emerald Green (#10B981)

**Failure Handling**:
- If user has no email in profile: Skip silently (no error shown)
- If EmailJS fails: Log error but don't block conversation end
- If conversation is empty: Don't send email

### Downloadable Word Documents

**Trigger**: User clicks "Download Transcript" button (persists after call ends)

**Format**: .docx file using docx library

**Document Structure**:
```
┌─────────────────────────────────────┐
│      Notewell AI - [Service Name]    │
│         Conversation Transcript       │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│         Session Information          │
├─────────────────────────────────────┤
│ User Name:     [Full Name]          │
│ User Email:    [email@domain]       │
│ Start Time:    HH:mm on DD/MM/YYYY  │
│ End Time:      HH:mm on DD/MM/YYYY  │
│ Duration:      X min Y sec          │
│ Messages:      N messages           │
└─────────────────────────────────────┘

[GP Genie Only:]
┌─────────────────────────────────────┐
│            IMPORTANT NOTICE          │
├─────────────────────────────────────┤
│ This transcript is from GP Genie,   │
│ a proof-of-concept AI service.      │
│                                     │
│ ⚠️ NOT AN APPROVED NHS CLINICAL TOOL │
│                                     │
│ This service is for concept testing │
│ and demonstration purposes only.    │
│ It should NOT be used for:         │
│ • Patient diagnosis                 │
│ • Clinical decision making          │
│ • Real-world patient care           │
│                                     │
│ Always consult qualified healthcare │
│ professionals for clinical matters. │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│        Conversation History          │
└─────────────────────────────────────┘

You — HH:mm on DD/MM/YYYY
[User message content]

[Service Name] — HH:mm on DD/MM/YYYY
[Agent response content]

[Repeat for all messages...]
```

**Styling**:
- Headings: Bold, larger font, centered
- Metadata table: Bordered cells, clear labels
- Disclaimer (GP Genie): Red border, warning icon, prominent placement
- Messages: Clear timestamp, sender name, readable content
- Overall: Professional, clean, printable

**File Naming**: `[service-name]-transcript-YYYY-MM-DD-HHmmss.docx`

---

## History Feature

### UI Components

**Location**: Bottom of each service page

**Structure**:
```
Conversation History
├── Tab: GP Genie
├── Tab: PM Genie
└── Tab: Oak Lane Patient Line

Each tab contains:
├── Search bar (filter by keywords)
├── Session cards showing:
│   ├── Title (auto-generated)
│   ├── Brief overview
│   ├── Metadata (date, time, duration, message count)
│   ├── Download button (generates Word doc)
│   └── Delete button (removes from history)
```

### Data Loading

**Query**: Fetch from `genie_sessions` table filtered by:
- `user_id` = current user
- `service_type` = selected tab
- Optional: `title` or `brief_overview` contains search keywords

**Sorting**: Most recent first (`created_at DESC`)

**Caching**: None (always fetch fresh from Supabase)

### Download from History

**Process**:
1. User clicks "Download" on a historical session
2. Retrieve `messages` array from that session
3. Generate Word document using same `downloadTranscript()` function
4. Include same metadata and disclaimer rules
5. Download to user's device

**Deduplication**: System checks for existing sessions with same `user_id`, `service_type`, and `start_time` (within 5-second window) before inserting to prevent duplicate history entries.

---

## Edge Functions

### 1. assemblyai-realtime-token

**Location**: `supabase/functions/assemblyai-realtime-token/index.ts`

**Purpose**: Generate temporary tokens for AssemblyAI real-time transcription

**Method**: GET

**Authentication**: Required (uses Supabase auth)

**Response**:
```json
{
  "token": "temporary_assemblyai_token"
}
```

**Token Lifetime**: Short-lived (typically 60 seconds)

**Error Handling**: Returns 500 if token generation fails

### 2. openai-realtime-session

**Location**: `supabase/functions/openai-realtime-session/index.ts`

**Purpose**: Create OpenAI Realtime API session with custom instructions

**Method**: POST

**Body**:
```json
{
  "instructions": "System prompt text",
  "voice": "alloy"
}
```

**Response**:
```json
{
  "client_secret": {
    "value": "session_token",
    "expires_at": 1234567890
  }
}
```

**Configuration**:
- Model: `gpt-4o-realtime-preview-2024-12-17`
- Modalities: `["text", "audio"]`
- Voice: `alloy`
- Turn detection: Server-based

**Error Handling**: Returns 500 if OpenAI API fails

---

## User Interface Features

### Visual Elements

#### Connection Status Indicators
- **Disconnected**: Grey/muted button, "Start Conversation" text
- **Connecting**: Loading spinner, disabled button
- **Connected**: Green accent, "End Conversation" text, pulsing animation

#### Audio Visualization
- **Not Recording**: Microphone icon, muted state
- **Recording**: Animated sound waves, active microphone
- **Agent Speaking**: Different color waveform

#### Conversation Display
- **User Messages**: Light blue background (#E3F2FD), left-aligned
- **Agent Messages**: Light grey background (#F5F5F5), left-aligned
- **Timestamps**: Format `HH:mm on DD/MM/YYYY` (British format)
- **Scrolling**: Auto-scroll to latest message

#### Download Button
- **Before Conversation**: Disabled, greyed out
- **During Conversation**: Disabled
- **After Conversation**: Enabled, primary color, persistent until page navigation

### Accessibility

- **Keyboard Navigation**: All buttons and controls keyboard accessible
- **Screen Readers**: ARIA labels on all interactive elements
- **Visual Indicators**: Clear status changes with color and text
- **Error Messages**: Clear, actionable error text when connections fail

---

## Error Handling

### Connection Errors

**AssemblyAI Connection Failure**:
```typescript
try {
  assemblySocket = new WebSocket(ASSEMBLYAI_WS_URL);
} catch (error) {
  toast({ title: "Connection Error", description: "Failed to connect to speech recognition service", variant: "destructive" });
  // Clean up and reset UI
}
```

**OpenAI Connection Failure**:
```typescript
try {
  dataChannel = peerConnection.createDataChannel('oai-events');
} catch (error) {
  toast({ title: "AI Service Error", description: "Failed to connect to AI service", variant: "destructive" });
  // Clean up and reset UI
}
```

### Audio Errors

**Microphone Permission Denied**:
```typescript
try {
  stream = await navigator.mediaDevices.getUserMedia({ audio: true });
} catch (error) {
  toast({ title: "Microphone Access Required", description: "Please allow microphone access to use voice services", variant: "destructive" });
}
```

**Audio Recording Failure**:
```typescript
mediaRecorder.onerror = (event) => {
  console.error("MediaRecorder error:", event);
  toast({ title: "Recording Error", description: "Failed to record audio", variant: "destructive" });
  // Stop conversation and clean up
};
```

### Database Errors

**Session Save Failure**:
```typescript
const { error } = await supabase.from('genie_sessions').insert([sessionData]);
if (error) {
  console.error("Failed to save session:", error);
  // Log error but don't block user (transcript still available for download)
}
```

**History Load Failure**:
```typescript
const { error } = await supabase.from('genie_sessions').select('*');
if (error) {
  toast({ title: "History Unavailable", description: "Could not load conversation history", variant: "destructive" });
  // Show empty state with retry option
}
```

### Email Errors

**EmailJS Failure**:
```typescript
try {
  await emailjs.send(serviceId, templateId, emailParams, publicKey);
} catch (error) {
  console.error("Failed to send email:", error);
  // Log but don't show error to user (silent failure)
}
```

**Missing User Email**:
```typescript
if (!userEmail) {
  console.log("No email address found - skipping transcript email");
  // Skip silently, no error shown
}
```

---

## Configuration Requirements

### Environment Variables (Supabase Secrets)

Required secrets in Supabase:
- `ASSEMBLYAI_API_KEY`: AssemblyAI API key for speech recognition
- `OPENAI_API_KEY`: OpenAI API key for Realtime API
- `EMAILJS_SERVICE_ID`: EmailJS service identifier
- `EMAILJS_TEMPLATE_ID_GENIE`: EmailJS template for Genie transcripts
- `EMAILJS_PUBLIC_KEY`: EmailJS public key for client-side integration

### Supabase Configuration

**config.toml**:
```toml
[functions.assemblyai-realtime-token]
verify_jwt = true

[functions.openai-realtime-session]
verify_jwt = true
```

### Database Setup

**Migration Required**: Create `genie_sessions` table with RLS policies

**RLS Policies**:
```sql
-- Users can view their own sessions
CREATE POLICY "Users can view own genie sessions"
ON genie_sessions FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own sessions
CREATE POLICY "Users can insert own genie sessions"
ON genie_sessions FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own sessions
CREATE POLICY "Users can delete own genie sessions"
ON genie_sessions FOR DELETE
USING (auth.uid() = user_id);
```

---

## Testing Considerations

### Unit Tests
- Test conversation message handling
- Test timestamp formatting (British format)
- Test Word document generation
- Test email template rendering

### Integration Tests
- Test full conversation flow (connect → speak → respond → end)
- Test WebSocket connection handling
- Test database persistence
- Test email delivery

### Manual Testing Scenarios

1. **Normal Conversation Flow**:
   - Start conversation
   - Speak several messages
   - Receive agent responses
   - End conversation
   - Verify email received
   - Download Word document
   - Check history entry

2. **Unexpected Disconnect**:
   - Start conversation
   - Close browser tab mid-conversation
   - Verify session saved
   - Verify email sent

3. **No Email Address**:
   - User profile without email
   - Complete conversation
   - Verify no error shown
   - Verify session still saved

4. **Empty Conversation**:
   - Connect and immediately disconnect
   - Verify no email sent
   - Verify no history entry created

5. **Long Conversation**:
   - 50+ messages
   - Large transcript
   - Verify Word doc generation
   - Verify email delivery

---

## Performance Considerations

### Audio Processing
- **Sample Rate**: 16000 Hz for optimal AssemblyAI performance
- **Buffer Size**: 2048 samples for low latency
- **Audio Format**: PCM16 for compatibility

### WebSocket Management
- **Connection Pooling**: Reuse connections when possible
- **Heartbeat**: Implement ping/pong to keep connections alive
- **Reconnection**: Auto-retry on temporary disconnections (up to 3 attempts)

### Database Queries
- **Indexed Columns**: `user_id`, `service_type`, `created_at` for fast queries
- **Pagination**: Limit history queries to 50 records initially, load more on scroll
- **Caching**: Consider client-side caching for recently viewed history

### Memory Management
- **Conversation Buffer**: Clear only on page navigation, not on conversation end
- **Audio Chunks**: Process and discard immediately, don't accumulate
- **WebSocket Cleanup**: Always close connections and remove listeners

---

## Security Considerations

### Authentication
- **Required**: All Genie services require authenticated user
- **Session Tokens**: Short-lived tokens for AssemblyAI and OpenAI
- **RLS**: Database enforces user-level isolation

### Data Privacy
- **User Isolation**: Users can only access their own conversations
- **No Sharing**: Conversations are private to individual users
- **Email Security**: Only send to verified user email address

### API Security
- **Secret Management**: All API keys stored in Supabase secrets (never client-side)
- **Token Rotation**: Request fresh tokens for each conversation
- **Rate Limiting**: Consider implementing rate limits to prevent abuse

### Content Security
- **Input Sanitization**: Sanitize user inputs before storage
- **Output Encoding**: Encode content in Word documents and emails
- **No PII Logging**: Avoid logging conversation content in plain text

---

## Known Limitations

1. **Browser Compatibility**: Requires modern browser with WebRTC and MediaRecorder support
2. **Mobile Performance**: May have latency issues on slower mobile connections
3. **Concurrent Conversations**: One conversation at a time per user
4. **Audio Quality**: Depends on user's microphone quality
5. **Language Support**: AssemblyAI quality varies by language
6. **Session Duration**: OpenAI Realtime sessions expire after 15 minutes of inactivity
7. **Email Attachments**: Word documents not attached to emails (must download manually)
8. **Offline Mode**: No offline support (requires active internet connection)

---

## Future Enhancements

### Potential Features
- Multiple conversation tabs (parallel conversations)
- Export history to CSV/JSON
- Conversation analytics (word count, topic analysis)
- Voice activity detection improvements
- Custom voice selection
- Conversation sharing (with permission)
- Mobile app versions
- Conversation search across all services
- Audio quality settings
- Background noise suppression

### Technical Improvements
- WebSocket connection pooling
- Client-side audio caching
- Progressive transcript loading for long conversations
- Optimistic UI updates
- Offline draft mode
- Push notifications for email delivery
- Real-time collaboration features

---

## Troubleshooting Guide

### "Connection Error" Toast
**Cause**: AssemblyAI or OpenAI WebSocket connection failed
**Solution**:
1. Check internet connection
2. Verify API keys are configured in Supabase secrets
3. Check browser console for specific error
4. Try refreshing page and reconnecting

### "Microphone Access Required" Toast
**Cause**: Browser microphone permission denied
**Solution**:
1. Click browser's address bar lock icon
2. Allow microphone access for this site
3. Refresh page and try again

### No Agent Response
**Cause**: OpenAI API issue or session expired
**Solution**:
1. End conversation and start new one
2. Check if OpenAI API is operational
3. Verify OPENAI_API_KEY is valid

### Email Not Received
**Cause**: EmailJS failure or no user email
**Solution**:
1. Check spam/junk folder
2. Verify user profile has email address
3. Check EmailJS dashboard for delivery status
4. Download Word document as backup

### History Not Loading
**Cause**: Database query failure or RLS policy issue
**Solution**:
1. Refresh page
2. Check Supabase logs for errors
3. Verify user is authenticated
4. Check RLS policies are correctly configured

### Word Document Download Fails
**Cause**: Browser popup blocker or docx library error
**Solution**:
1. Allow popups for this site
2. Try different browser
3. Check browser console for errors
4. Verify conversation has messages

---

## Code Organization

### File Structure
```
src/
├── components/
│   ├── GPGenieVoiceAgent.tsx       # Main component with tabs
│   ├── PMGenieVoiceAgent.tsx       # Standalone PM Genie component
│   └── genie/
│       └── GenieHistory.tsx        # History display component
├── hooks/
│   ├── useGenieHistory.ts          # History management hook
│   └── useUserProfile.ts           # User profile hook
├── lib/
│   └── getAssemblyToken.ts         # AssemblyAI token fetcher
└── pages/
    ├── GPGenie.tsx                 # GP Genie page
    └── (other pages)

supabase/
└── functions/
    ├── assemblyai-realtime-token/
    │   └── index.ts
    └── openai-realtime-session/
        └── index.ts
```

### Key Functions

**startConversation()**: Initialize WebSocket connections and audio recording
**endConversation()**: Close connections, save session, send email
**onDisconnect()**: Backup handler for unexpected disconnections
**downloadTranscript()**: Generate and download Word document
**saveSession()**: Persist conversation to Supabase
**sendTranscriptEmail()**: Send formatted email via EmailJS

---

## Conclusion

The Genie voice services (GP Genie, PM Genie, Oak Lane Patient Line) provide real-time AI-powered voice conversations with automatic transcription, email delivery, and persistent history. The architecture leverages modern web APIs (MediaRecorder, WebRTC), powerful AI services (OpenAI Realtime API, AssemblyAI), and reliable infrastructure (Supabase) to deliver a seamless conversational experience.

Key strengths:
- Real-time bidirectional voice communication
- Service-specific AI instructions and branding
- Automatic transcript delivery via email
- Downloadable Word documents with professional formatting
- Persistent conversation history with search and filtering
- Robust error handling and user feedback
- Security through authentication and RLS

This guide provides the foundation for understanding, maintaining, and extending the Genie voice services within Notewell AI.
