"use client";
import { useTranslations } from "next-intl";
import { ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@zdocs/client-component";

interface FetchMoreButtonProps {
  remaining: number;
  isFetching: boolean;
  onFetchMore: () => void;
}

export default function FetchMoreButton({
  remaining,
  isFetching,
  onFetchMore,
}: FetchMoreButtonProps) {
  const t = useTranslations("drive");

  return (
    <div
      className="flex justify-center pt-4"
      data-testid="drive-fetch-more-container"
    >
      <Button
        variant="outline"
        size="sm"
        onClick={onFetchMore}
        disabled={isFetching}
        data-testid="drive-fetch-more-button"
      >
        {isFetching ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            {t("loading")}
          </>
        ) : (
          <>
            <ChevronDown className="w-4 h-4 mr-2" />
            {t("fetchMore")} ({remaining} {t("remaining")})
          </>
        )}
      </Button>
    </div>
  );
}
