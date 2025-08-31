import { manualTriggerAutoNotes } from './manualTriggerNotes';

// Manually trigger note generation for the stuck meeting
const STUCK_MEETING_ID = '77b6b634-4946-4d96-a403-7bf1b641cb89';

console.log('🚀 Attempting to recover stuck meeting:', STUCK_MEETING_ID);
manualTriggerAutoNotes(STUCK_MEETING_ID)
  .then((success) => {
    if (success) {
      console.log('✅ Successfully triggered note generation for stuck meeting');
    } else {
      console.error('❌ Failed to trigger note generation');
    }
  })
  .catch((error) => {
    console.error('❌ Error during recovery:', error);
  });