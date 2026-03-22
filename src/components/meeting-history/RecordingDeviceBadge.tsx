import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Smartphone, Monitor, Tablet, Wifi, WifiOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface RecordingDeviceBadgeProps {
  meetingId: string;
}

interface DeviceData {
  device_browser: string | null;
  device_os: string | null;
  device_type: string | null;
  import_source: string | null;
}

const getDeviceLabel = (device: DeviceData): string | null => {
  const source = device.import_source?.toLowerCase() || '';

  // Mobile recording modes take priority
  if (source === 'mobile_live') return 'Mobile · Live';
  if (source === 'mobile_offline') return 'Mobile · Offline';
  if (source === 'mobile_recorder') return 'Mobile';

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
  const source = device.import_source?.toLowerCase() || '';

  if (source === 'mobile_live') return <Wifi className="h-3 w-3" />;
  if (source === 'mobile_offline') return <WifiOff className="h-3 w-3" />;
  if (source === 'mobile_recorder') return <Smartphone className="h-3 w-3" />;

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
  const source = device.import_source?.toLowerCase() || '';

  if (source === 'mobile_live') return 'bg-blue-600 hover:bg-blue-600 text-white';
  if (source === 'mobile_offline') return 'bg-amber-600 hover:bg-amber-600 text-white';
  if (source === 'mobile_recorder') return 'bg-purple-600 hover:bg-purple-600 text-white';

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
        .select('device_browser, device_os, device_type, import_source')
        .eq('id', meetingId)
        .single();
      if (data?.device_browser || data?.device_os || data?.device_type || data?.import_source) {
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
