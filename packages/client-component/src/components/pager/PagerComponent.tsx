import { Button } from "../ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePager } from "./pager-context-provider";

export function PagerComponent() {
  const { page, pageSize, totalPages, previousPage, nextPage, setPageSize } =
    usePager();
  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium">Rows per page</p>
        <Select
          value={pageSize.toString()}
          onValueChange={(value) => setPageSize(parseInt(value))}
        >
          <SelectTrigger className="w-[70px] h-8">
            <SelectValue placeholder="Rows" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10</SelectItem>
            <SelectItem value="20">20</SelectItem>
            <SelectItem value="30">30</SelectItem>
            <SelectItem value="50">50</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="text-sm font-medium">
        Page {page} of {totalPages}
      </div>{" "}
      {/* TODO: Implement pagination logic */}
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => previousPage()}
          disabled={page === 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => nextPage()}
          disabled={page === totalPages}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
