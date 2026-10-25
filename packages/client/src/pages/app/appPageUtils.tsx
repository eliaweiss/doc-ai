import { CheckCircle, Clock, AlertCircle } from "lucide-react";

export function getStatusIcon(status: string) {
  switch (status) {
    case "COMPLETE":
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case "PENDING":
      return <Clock className="w-4 h-4 text-yellow-500" />;
    case "PARTIAL":
      return <Clock className="w-4 h-4 text-blue-500" />;
    case "RETRYING":
      return <Clock className="w-4 h-4 text-yellow-500" />;
    case "FAILED":
      return <AlertCircle className="w-4 h-4 text-red-500" />;
    default:
      return <Clock className="w-4 h-4 text-muted-foreground" />;
  }
}

export function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
