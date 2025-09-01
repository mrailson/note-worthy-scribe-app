import { recoverStuckMeeting } from './meetingRecovery';

// Quick recovery for the specific stuck meeting
const STUCK_MEETING_ID = 'aa009eed-4463-4919-a508-a9d02495216f';

console.log('🚀 Starting emergency recovery for stuck meeting:', STUCK_MEETING_ID);

// Export function so it can be called from console or imported elsewhere
export const executeEmergencyRecovery = async () => {
  try {
    console.log('⚡ Executing emergency recovery...');
    const success = await recoverStuckMeeting(STUCK_MEETING_ID);
    
    if (success) {
      console.log('✅ Emergency recovery completed successfully!');
      console.log('📝 Meeting should now be in completed status and notes should auto-generate.');
      return true;
    } else {
      console.error('❌ Emergency recovery failed');
      return false;
    }
  } catch (error) {
    console.error('💥 Critical error during emergency recovery:', error);
    return false;
  }
};

// Auto-execute the recovery on import
setTimeout(() => {
  executeEmergencyRecovery();
}, 1000);