import { detectDevice } from '@/utils/DeviceDetection';
import { supabase } from '@/integrations/supabase/client';

export interface MeetingDeviceInfo {
  device_ip_address: string;
  device_user_agent: string;
  device_type: string;
  device_browser: string;
  device_os: string;
  device_screen_resolution: string;
}

/**
 * Capture device information for a meeting record.
 * Calls the get-client-info edge function for IP, and uses local detection for the rest.
 */
export const captureMeetingDeviceInfo = async (): Promise<MeetingDeviceInfo> => {
  const device = detectDevice();
  const screen = window.screen;

  // Get IP from edge function (non-blocking, fallback to unknown)
  let ipAddress = 'unknown';
  try {
    const { data } = await supabase.functions.invoke('get-client-info', { method: 'GET' });
    ipAddress = data?.ip_address || 'unknown';
  } catch {
    console.warn('Could not fetch IP for meeting device capture');
  }

  // Parse browser info from UA
  const ua = navigator.userAgent;
  let browserName = 'Unknown';
  if (/Edg/.test(ua)) browserName = 'Edge';
  else if (/Chrome/.test(ua)) browserName = 'Chrome';
  else if (/Safari/.test(ua)) browserName = 'Safari';
  else if (/Firefox/.test(ua)) browserName = 'Firefox';

  const osName = device.isIOS ? 'iOS' : device.isAndroid ? 'Android' : 
    /Mac/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'Unknown';

  return {
    device_ip_address: ipAddress,
    device_user_agent: ua,
    device_type: device.deviceType,
    device_browser: browserName,
    device_os: osName,
    device_screen_resolution: `${screen.width}x${screen.height}`,
  };
};

/**
 * Attach device info to an existing meeting record (fire-and-forget).
 * Use this when the insert is already done and you want to update afterwards.
 */
export const attachDeviceInfoToMeeting = async (meetingId: string): Promise<void> => {
  try {
    const deviceInfo = await captureMeetingDeviceInfo();
    await supabase
      .from('meetings')
      .update(deviceInfo as any)
      .eq('id', meetingId);
    console.log('📱 Device info attached to meeting:', meetingId);
  } catch (error) {
    console.warn('Failed to attach device info to meeting:', error);
  }
};
