import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLGCapture, LGPatient } from '@/hooks/useLGCapture';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Search, Plus, FileText, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';

export default function LGCapturePatients() {
  const navigate = useNavigate();
  const { listPatients, isLoading } = useLGCapture();
  
  const [patients, setPatients] = useState<LGPatient[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      const data = await listPatients();
      setPatients(data);
    };
    load();
  }, [listPatients]);

  const handleSearch = async () => {
    const data = await listPatients(search || undefined);
    setPatients(data);
  };

  const getStatusBadge = (status: LGPatient['job_status']) => {
    switch (status) {
      case 'succeeded':
        return (
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Complete
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      case 'processing':
        return (
          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Processing
          </Badge>
        );
      case 'queued':
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Queued
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            {status}
          </Badge>
        );
    }
  };

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => navigate('/lg-capture')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        
        <Button onClick={() => navigate('/lg-capture/start')}>
          <Plus className="mr-2 h-4 w-4" />
          New Patient
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold mb-2">Recent Captures</h1>
        <p className="text-muted-foreground text-sm">
          Search by patient name or NHS number
        </p>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <Input
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <Button onClick={handleSearch} disabled={isLoading}>
          <Search className="h-4 w-4" />
        </Button>
      </div>

      {/* Patient List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : patients.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No captures found</p>
            <Button
              variant="link"
              onClick={() => navigate('/lg-capture/start')}
              className="mt-2"
            >
              Start your first capture
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {patients.map((patient) => (
            <Card
              key={patient.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => navigate(`/lg-capture/results/${patient.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="font-medium">{patient.patient_name}</p>
                    <p className="text-sm text-muted-foreground font-mono">
                      NHS: {patient.nhs_number}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(patient.created_at), 'dd/MM/yyyy HH:mm')} • {patient.images_count} pages
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {getStatusBadge(patient.job_status)}
                    <span className="text-xs text-muted-foreground">
                      {patient.practice_ods}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
