import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Smartphone, Monitor, Tablet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface RecordingDeviceBadgeProps {
  meetingId: string;
}

interface DeviceData {
  device_browser: string | null;
  device_os: string | null;
  device_type: string | null;
}

const getDeviceLabel = (device: DeviceData): string | null => {
  const os = device.device_os?.toLowerCase() || '';
  const browser = device.device_browser?.toLowerCase() || '';

  if (os === 'ios' && os) return 'iPhone / iOS';
  if (os === 'android') return 'Android';
  if (browser === 'chrome') return 'Chrome';
  if (browser === 'edge') return 'Edge';
  if (browser === 'safari') return 'Safari';
  if (browser === 'firefox') return 'Firefox';
  if (device.device_browser) return device.device_browser;
  return null;
};

const getDeviceIcon = (device: DeviceData) => {
  const os = device.device_os?.toLowerCase() || '';
  const type = device.device_type?.toLowerCase() || '';

  if (os === 'ios' || os === 'android' || type === 'iphone' || type === 'android') {
    return <Smartphone className="h-3 w-3" />;
  }
  if (type === 'ios') {
    return <Tablet className="h-3 w-3" />;
  }
  return <Monitor className="h-3 w-3" />;
};

const getBadgeColour = (device: DeviceData): string => {
  const os = device.device_os?.toLowerCase() || '';
  const browser = device.device_browser?.toLowerCase() || '';

  if (os === 'ios') return 'bg-gray-700 hover:bg-gray-700 text-white';
  if (os === 'android') return 'bg-green-700 hover:bg-green-700 text-white';
  if (browser === 'chrome') return 'bg-blue-600 hover:bg-blue-600 text-white';
  if (browser === 'edge') return 'bg-cyan-700 hover:bg-cyan-700 text-white';
  return 'bg-muted text-muted-foreground';
};

export const RecordingDeviceBadge = ({ meetingId }: RecordingDeviceBadgeProps) => {
  const [device, setDevice] = useState<DeviceData | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('meetings')
        .select('device_browser, device_os, device_type')
        .eq('id', meetingId)
        .single();
      if (data?.device_browser || data?.device_os || data?.device_type) {
        setDevice(data as DeviceData);
      }
    };
    fetch();
  }, [meetingId]);

  if (!device) return null;

  const label = getDeviceLabel(device);
  if (!label) return null;

  return (
    <Badge className={`gap-1 cursor-default text-xs ${getBadgeColour(device)}`}>
      {getDeviceIcon(device)}
      {label}
    </Badge>
  );
};
