import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Shield, 
  Heart, 
  Users, 
  Clock, 
  Award,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import { useState } from "react";

interface CQCDomain {
  name: string;
  description: string;
  percentage: number;
  status: 'compliant' | 'warning' | 'critical';
  gaps: string[];
}

interface CQCDomainCardProps {
  domain: CQCDomain;
  index: number;
}

const CQCDomainCard = ({ domain, index }: CQCDomainCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const domainIcons = {
    safe: Shield,
    effective: Heart,
    caring: Users,
    responsive: Clock,
    well_led: Award
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'compliant': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'compliant': return CheckCircle;
      case 'warning': return AlertCircle;
      case 'critical': return XCircle;
      default: return AlertCircle;
    }
  };

  const getProgressColor = (status: string) => {
    switch (status) {
      case 'compliant': return 'bg-green-500';
      case 'warning': return 'bg-yellow-500';
      case 'critical': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const Icon = domainIcons[domain.name as keyof typeof domainIcons];
  const StatusIcon = getStatusIcon(domain.status);

  return (
    <Card className="transition-all duration-200 hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-primary/10`}>
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg capitalize">
                {domain.name.replace('_', '-')}
              </CardTitle>
              <CardDescription className="text-sm">
                {domain.description}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusIcon className={`h-5 w-5 ${getStatusColor(domain.status)}`} />
            <span className="font-bold text-lg">{domain.percentage}%</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Progress 
            value={domain.percentage} 
            className="h-3" 
          />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Compliance Progress</span>
            <Badge 
              variant={domain.status === 'compliant' ? 'default' : 'destructive'}
              className="text-xs"
            >
              {domain.status === 'compliant' ? 'Compliant' : domain.status === 'warning' ? 'Needs Attention' : 'Critical'}
            </Badge>
          </div>
        </div>

        {domain.gaps.length > 0 && (
          <div className="space-y-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full justify-between p-2 h-auto"
            >
              <span className="text-sm font-medium">
                {domain.gaps.length} gap(s) identified
              </span>
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
            
            {isExpanded && (
              <div className="space-y-2 pl-4 border-l-2 border-red-200">
                {domain.gaps.map((gap, gapIndex) => (
                  <div key={gapIndex} className="text-sm text-red-600 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{gap}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CQCDomainCard;