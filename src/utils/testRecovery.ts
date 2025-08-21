// Manual recovery test
import { recoverMeetingTranscript } from "./recoverTranscript";

export async function testRecovery() {
  const meetingId = 'f0d0d35b-85a1-4e59-9186-8c33e79d8b24';
  
  try {
    console.log('🔄 Testing recovery for meeting:', meetingId);
    const result = await recoverMeetingTranscript(meetingId);
    console.log('✅ Recovery test result:', result);
    return result;
  } catch (error) {
    console.error('❌ Recovery test failed:', error);
    throw error;
  }
}

// Auto-run if imported
testRecovery().then(result => {
  console.log('Recovery completed:', result);
}).catch(error => {
  console.error('Recovery failed:', error);
});