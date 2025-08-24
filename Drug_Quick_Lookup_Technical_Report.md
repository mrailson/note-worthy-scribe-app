# Drug Quick Lookup Feature - Technical Report

## Overview
The Drug Quick Lookup is a sophisticated medication policy search system integrated into the AI4GP application. It provides healthcare professionals with instant access to local drug policies, traffic light status, formulary information, and prior approval requirements for medications within the ICN (Integrated Care Northamptonshire) region.

## Architecture & Components

### Frontend Components

#### 1. DrugQuickModal (`src/components/DrugQuickModal.tsx`)
- **Primary Interface**: The main modal component triggered by Ctrl+K shortcut
- **Key Features**:
  - Real-time search with fuzzy matching
  - Drug policy status display with color-coded badges
  - Traffic light system (GREEN/AMBER/RED status)
  - Prior approval requirements display
  - Formulary information with preference rankings
  - Alternative drug suggestions
  - Copy-to-clipboard functionality for policy summaries

#### 2. TrafficLightSearch (`src/components/TrafficLightSearch.tsx`)
- **Advanced Search Component**: More detailed search interface
- **Features**:
  - Fuzzy search using Fuse.js library
  - Keyboard navigation (arrow keys, enter, escape)
  - Live search results with highlighting
  - Integration with PolicyModal for detailed views
  - Formulary status caching and display

#### 3. TrafficLightQuickPick (`src/components/TrafficLightQuickPick.tsx`)
- **Simplified Picker**: Streamlined component for quick lookups
- **Integration**: Can insert results directly into chat conversations
- **Features**: Policy status descriptions and external link access

### Backend Infrastructure

#### 1. Comprehensive Drug Lookup (`supabase/functions/comprehensive-drug-lookup/index.ts`)
- **Core API Endpoint**: Main backend service for drug information retrieval
- **Database Integration**: Queries multiple Supabase tables:
  - `icn_tl_norm`: Traffic light status data
  - `icn_formulary`: Formulary preferences and rankings
  - `icn_prior_approval`: Prior approval requirements
- **Data Processing**:
  - Medicine name normalization using `icn_norm()` function
  - Fuzzy matching and similarity scoring
  - Alternative drug suggestions from same formulary sections
  - Traffic light status lookup for alternatives

#### 2. Drug Vocabulary Service (`supabase/functions/drug-vocabulary/index.ts`)
- **Vocabulary Provider**: Supplies searchable drug names
- **Data Sources**: Combines data from traffic light and formulary tables
- **Optimization**: Provides deduplicated, sorted vocabulary for autocomplete

### Data Hooks & State Management

#### 1. useTrafficLightVocab (`src/hooks/useTrafficLightVocab.ts`)
- **Vocabulary Management**: Fetches and caches drug vocabulary
- **Fallback System**: 
  - Primary: Supabase database
  - Secondary: Local storage cache
  - Tertiary: Hardcoded fallback data
- **Offline Support**: Maintains functionality without network

#### 2. useTrafficLightResolver (`src/hooks/useTrafficLightResolver.ts`)
- **Policy Resolution**: Main hook for drug policy lookup
- **Features**:
  - Medicine name extraction from text
  - Single and batch lookups
  - Name normalization and cleaning
  - Fallback data for testing

## Data Schema & Structure

### Traffic Light System
```typescript
interface PolicyHit {
  name: string;
  status: 'GREEN' | 'AMBER' | 'RED' | 'BLACK';
  bnf_chapter: string;
  detail_url: string;
  notes?: string;
}
```

### Formulary Information
```typescript
interface FormularyData {
  bnf_chapter: string;
  section: string;
  preferred: Array<{
    item_name: string;
    rank: number;
    notes?: string;
    otc?: boolean;
  }>;
  page_url: string;
  found_exact_match: boolean;
}
```

### API Response Structure
```typescript
interface DrugLookupResponse {
  drug: {
    name: string;
    searched_term: string;
  };
  traffic_light: PolicyHit | null;
  prior_approval: Array<PriorApprovalData>;
  formulary: FormularyData | null;
  alternatives: Array<AlternativeDrug>;
}
```

## Key Workflows

### 1. Search Flow
1. User types drug name in search input
2. Frontend performs fuzzy search on cached vocabulary
3. User selects from dropdown suggestions
4. System calls `comprehensive-drug-lookup` API
5. Backend queries multiple data sources:
   - Normalizes drug name using `icn_norm()`
   - Searches traffic light database
   - Looks up prior approval requirements
   - Finds formulary preferences
   - Generates alternatives from same section
6. Results displayed in modal with policy information

### 2. Data Fetching Strategy
1. **Vocabulary Loading**: On app load, fetch complete drug vocabulary
2. **Caching**: Store vocabulary in localStorage for offline access
3. **Lazy Loading**: Detailed drug information fetched on-demand
4. **Fallback**: Multiple fallback layers ensure reliability

### 3. Integration Points
- **AI4GP Chat**: Ctrl+K shortcut opens modal from anywhere
- **Custom Event System**: `openDrugModal` event for programmatic access
- **Chat Integration**: Results can be inserted into conversations
- **Copy Functionality**: Policy summaries copied to clipboard

## Technical Features

### Search & Performance
- **Fuzzy Search**: Fuse.js with optimized search parameters
- **Debounced Input**: Prevents excessive API calls
- **Result Caching**: Formulary status cached per session
- **Keyboard Navigation**: Full accessibility support

### Data Quality & Validation
- **Name Normalization**: Consistent drug name formatting
- **Similarity Matching**: Handles variations in drug names
- **Data Deduplication**: Removes duplicate entries
- **Error Handling**: Graceful degradation on API failures

### User Experience
- **Real-time Search**: Instant results as user types
- **Visual Indicators**: Color-coded status badges
- **Contextual Information**: Detailed policy explanations
- **Quick Actions**: Copy summaries, open external links

## Database Tables

### Core Tables
- **`icn_tl_norm`**: Normalized traffic light data
- **`icn_formulary`**: Formulary preferences and rankings  
- **`icn_prior_approval`**: Prior approval requirements
- **`icn_policy_unified_fuzzy`**: Combined policy view for fuzzy searches

### Key Functions
- **`icn_norm(input_name)`**: Drug name normalization
- **`comprehensive-drug-lookup`**: Main lookup API
- **`drug-vocabulary`**: Vocabulary provider

## Integration with AI4GP

The Drug Quick Lookup is deeply integrated into the AI4GP workflow:

1. **Shortcut Access**: Ctrl+K opens modal from any screen
2. **Chat Integration**: Results can be inserted into AI conversations
3. **Context Awareness**: Provides medication context for AI responses
4. **Policy Compliance**: Ensures AI recommendations align with local policies

## Future Development Considerations

### Scalability
- Vocabulary caching strategy can handle thousands of drugs
- API designed for high-frequency queries
- Database indexes optimize search performance

### Extensibility  
- Modular component design allows easy feature additions
- Hook-based architecture enables reuse across components
- API supports additional data fields without breaking changes

### Maintenance
- Centralized data normalization ensures consistency
- Fallback systems provide reliability during updates
- Comprehensive logging aids troubleshooting

## Security & Compliance

- **Data Privacy**: No patient data stored or transmitted
- **Access Control**: Integrated with user authentication system
- **Audit Trail**: Usage logging for compliance monitoring
- **Data Validation**: Input sanitization prevents injection attacks

This system provides healthcare professionals with reliable, fast access to critical drug policy information while maintaining high standards for data quality, user experience, and system reliability.