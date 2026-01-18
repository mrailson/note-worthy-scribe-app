import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare, Send, Loader2 } from 'lucide-react';
import { useSendSMS } from '@/hooks/useSendSMS';

interface SMSSendButtonProps {
  message: string;
  consultationId?: string;
  defaultPhoneNumber?: string;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export function SMSSendButton({
  message,
  consultationId,
  defaultPhoneNumber = '',
  variant = 'outline',
  size = 'default',
  className,
}: SMSSendButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState(defaultPhoneNumber);
  const [smsMessage, setSmsMessage] = useState(message);
  const { sendSMS, isSending, validatePhoneNumber } = useSendSMS();

  const handleSend = async () => {
    const result = await sendSMS({
      phoneNumber,
      message: smsMessage,
      consultationId,
    });

    if (result.success) {
      setIsOpen(false);
      setPhoneNumber(defaultPhoneNumber);
    }
  };

  const characterCount = smsMessage.length;
  const smsSegments = Math.ceil(characterCount / 160) || 1;
  const isPhoneValid = phoneNumber ? validatePhoneNumber(phoneNumber) : false;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          <MessageSquare className="h-4 w-4 mr-2" />
          Send SMS
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Send SMS to Patient</DialogTitle>
          <DialogDescription>
            Send a text message using GOV.UK Notify. Standard NHS messaging rates apply.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="phone">Mobile Number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="07xxx xxxxxx or +447xxxxxxxxx"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className={phoneNumber && !isPhoneValid ? 'border-destructive' : ''}
            />
            {phoneNumber && !isPhoneValid && (
              <p className="text-xs text-destructive">
                Please enter a valid UK mobile number
              </p>
            )}
          </div>
          <div className="grid gap-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="message">Message</Label>
              <span className="text-xs text-muted-foreground">
                {characterCount} characters ({smsSegments} SMS{smsSegments > 1 ? 's' : ''})
              </span>
            </div>
            <Textarea
              id="message"
              value={smsMessage}
              onChange={(e) => setSmsMessage(e.target.value)}
              rows={6}
              maxLength={918}
              className="resize-none"
            />
            {characterCount > 160 && (
              <p className="text-xs text-muted-foreground">
                Messages over 160 characters will be sent as multiple SMS segments
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSending}>
            Cancel
          </Button>
          <Button 
            onClick={handleSend} 
            disabled={isSending || !isPhoneValid || !smsMessage.trim()}
          >
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send SMS
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
