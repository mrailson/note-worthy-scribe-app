import { useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface LiveUpdateConfig {
  isRecording: boolean;
  meetingId: string | null;
  wordCount: number;
  transcript: string;
  currentTitle: string;
  attendees?: string[];
  meetingContext?: any;
  onTitleUpdate?: (newTitle: string) => void;
  onActionItemsUpdate?: (actionItems: Array<{ action_text: string; assignee_name: string; due_date: string }>) => void;
}

interface LiveUpdateRefs {
  wordCountSync: number;
  insightsExtraction: number;
  lastWordCountSynced: number;
  lastInsightsWordCount: number;
  extractedActionItems: string[];
}

const WORD_COUNT_SYNC_INTERVAL = 30000; // 30 seconds
const INSIGHTS_EXTRACTION_INTERVAL = 180000; // 3 minutes
const MIN_WORDS_FOR_TITLE = 200; // Minimum words before generating title
const WORDS_BETWEEN_INSIGHTS = 500; // Minimum new words before re-extracting

export const useLiveMeetingUpdates = (config: LiveUpdateConfig) => {
  const {
    isRecording,
    meetingId,
    wordCount,
    transcript,
    currentTitle,
    attendees,
    meetingContext,
    onTitleUpdate,
    onActionItemsUpdate
  } = config;

  const lastUpdateRef = useRef<LiveUpdateRefs>({
    wordCountSync: 0,
    insightsExtraction: 0,
    lastWordCountSynced: 0,
    lastInsightsWordCount: 0,
    extractedActionItems: []
  });

  // Sync word count to database
  const syncWordCount = useCallback(async () => {
    if (!meetingId || wordCount <= 0) return;
    
    // Only sync if word count has actually changed
    if (wordCount === lastUpdateRef.current.lastWordCountSynced) return;

    try {
      console.log('📊 Syncing word count to database:', wordCount);
      
      const { error } = await supabase
        .from('meetings')
        .update({ 
          word_count: wordCount,
          updated_at: new Date().toISOString()
        })
        .eq('id', meetingId);

      if (error) {
        console.error('❌ Failed to sync word count:', error);
      } else {
        lastUpdateRef.current.lastWordCountSynced = wordCount;
        console.log('✅ Word count synced:', wordCount);
      }
    } catch (err) {
      console.error('❌ Error syncing word count:', err);
    }
  }, [meetingId, wordCount]);

  // Extract live insights (title and action items)
  const extractLiveInsights = useCallback(async () => {
    if (!meetingId || !transcript || transcript.length < 100) return;
    if (wordCount < MIN_WORDS_FOR_TITLE) return;
    
    // Check if enough new words since last extraction
    const wordsSinceLastExtraction = wordCount - lastUpdateRef.current.lastInsightsWordCount;
    if (wordsSinceLastExtraction < WORDS_BETWEEN_INSIGHTS && lastUpdateRef.current.lastInsightsWordCount > 0) {
      console.log('⏸️ Not enough new words for insights extraction:', wordsSinceLastExtraction);
      return;
    }

    try {
      console.log('🔍 Extracting live insights...');
      console.log('📝 Current word count:', wordCount, 'Last extraction at:', lastUpdateRef.current.lastInsightsWordCount);

      const { data, error } = await supabase.functions.invoke('extract-live-meeting-insights', {
        body: {
          meetingId,
          transcript,
          currentTitle,
          existingActionItems: lastUpdateRef.current.extractedActionItems,
          attendees,
          meetingContext
        }
      });

      if (error) {
        console.error('❌ Failed to extract insights:', error);
        return;
      }

      if (data) {
        lastUpdateRef.current.lastInsightsWordCount = wordCount;

        // Handle title update
        if (data.suggestedTitle && !data.isGenericTitle && data.suggestedTitle !== currentTitle) {
          console.log('📝 New title suggested:', data.suggestedTitle);
          
          // Update database
          const { error: updateError } = await supabase
            .from('meetings')
            .update({ 
              title: data.suggestedTitle,
              auto_generated_name: data.suggestedTitle,
              updated_at: new Date().toISOString()
            })
            .eq('id', meetingId);

          if (updateError) {
            console.error('❌ Failed to update title:', updateError);
          } else {
            console.log('✅ Title updated in database');
            onTitleUpdate?.(data.suggestedTitle);
          }
        }

        // Handle new action items
        if (data.actionItems && data.actionItems.length > 0) {
          console.log('📋 New action items found:', data.actionItems.length);
          
          // Get the current user for insertion
          const { data: userData } = await supabase.auth.getUser();
          const userId = userData?.user?.id;
          
          if (userId) {
            for (const item of data.actionItems) {
              try {
                const { error: insertError } = await supabase
                  .from('meeting_action_items')
                  .insert({
                    meeting_id: meetingId,
                    user_id: userId,
                    action_text: item.action_text,
                    assignee_name: item.assignee_name || 'TBC',
                    due_date: item.due_date === 'TBC' ? null : item.due_date,
                    status: 'pending'
                  });

                if (insertError) {
                  console.error('❌ Failed to insert action item:', insertError);
                } else {
                  // Track extracted items to avoid duplicates
                  lastUpdateRef.current.extractedActionItems.push(item.action_text);
                  console.log('✅ Action item saved:', item.action_text.substring(0, 50));
                }
              } catch (insertErr) {
                console.error('❌ Error inserting action item:', insertErr);
              }
            }
          }

          onActionItemsUpdate?.(data.actionItems);
        }
      }
    } catch (err) {
      console.error('❌ Error extracting insights:', err);
    }
  }, [meetingId, transcript, wordCount, currentTitle, attendees, meetingContext, onTitleUpdate, onActionItemsUpdate]);

  // Set up periodic updates during recording
  useEffect(() => {
    if (!isRecording || !meetingId) {
      // Reset refs when not recording
      lastUpdateRef.current = {
        wordCountSync: 0,
        insightsExtraction: 0,
        lastWordCountSynced: 0,
        lastInsightsWordCount: 0,
        extractedActionItems: []
      };
      return;
    }

    console.log('🔄 Setting up live meeting updates for:', meetingId);

    // Word count sync interval (every 30 seconds)
    const wordCountInterval = setInterval(() => {
      syncWordCount();
    }, WORD_COUNT_SYNC_INTERVAL);

    // Insights extraction interval (every 3 minutes)
    const insightsInterval = setInterval(() => {
      extractLiveInsights();
    }, INSIGHTS_EXTRACTION_INTERVAL);

    // Initial sync after 30 seconds
    const initialSyncTimeout = setTimeout(() => {
      syncWordCount();
    }, WORD_COUNT_SYNC_INTERVAL);

    // Initial insights extraction after 3 minutes (if enough content)
    const initialInsightsTimeout = setTimeout(() => {
      extractLiveInsights();
    }, INSIGHTS_EXTRACTION_INTERVAL);

    return () => {
      clearInterval(wordCountInterval);
      clearInterval(insightsInterval);
      clearTimeout(initialSyncTimeout);
      clearTimeout(initialInsightsTimeout);
    };
  }, [isRecording, meetingId, syncWordCount, extractLiveInsights]);

  // Sync word count on unmount or when recording stops
  useEffect(() => {
    return () => {
      if (meetingId && wordCount > 0 && wordCount !== lastUpdateRef.current.lastWordCountSynced) {
        // Final sync when stopping
        supabase
          .from('meetings')
          .update({ 
            word_count: wordCount,
            updated_at: new Date().toISOString()
          })
          .eq('id', meetingId)
          .then(({ error }) => {
            if (error) {
              console.error('❌ Final word count sync failed:', error);
            } else {
              console.log('✅ Final word count synced:', wordCount);
            }
          });
      }
    };
  }, [meetingId, wordCount]);

  return {
    syncWordCount,
    extractLiveInsights
  };
};
