import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertTriangle, XCircle } from "lucide-react";

export const getSeverityColor = (severity: string) => {
  switch (severity) {
    case "CATASTROPHIC":
      return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";
    case "MAJOR":
      return "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300";
    case "MODERATE":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300";
    case "LOW":
      return "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300";
    default:
      return "bg-muted text-muted-foreground";
  }
};

export const getStatusBadge = (status: string) => {
  switch (status) {
    case "COMPLIANT":
    case "COMPLETE":
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"><CheckCircle className="w-3 h-3 mr-1" /> {status}</Badge>;
    case "PARTIAL":
      return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300"><AlertTriangle className="w-3 h-3 mr-1" /> {status}</Badge>;
    case "OUTSTANDING":
      return <Badge className="bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"><XCircle className="w-3 h-3 mr-1" /> {status}</Badge>;
    case "HIGH":
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">{status}</Badge>;
    case "MEDIUM":
      return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300">{status}</Badge>;
    case "LOW":
      return <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300">{status}</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};
