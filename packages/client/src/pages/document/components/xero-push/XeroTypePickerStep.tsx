"use client";

import { useTranslations } from "next-intl";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@zdocs/client-component";
import { useLogUserJourneyEvent } from "../../../../utilities/api/logUserJourneyEventApi";

export type XeroDirection = "income" | "expense";

const DIRECTION_ICONS: Record<XeroDirection, React.ElementType> = {
  income: TrendingUp,
  expense: TrendingDown,
};

const DIRECTION_ORDER: XeroDirection[] = ["income", "expense"];

interface XeroTypePickerStepProps {
  selected: XeroDirection;
  onSelect: (dir: XeroDirection) => void;
  onContinue: () => void;
  onCancel: () => void;
}

export function XeroTypePickerStep({
  selected,
  onSelect,
  onContinue,
  onCancel,
}: XeroTypePickerStepProps) {
  const t = useTranslations("documentPage.xero");
  const { logEvent } = useLogUserJourneyEvent();

  return (
    <div data-testid="xero-type-picker-step">
      <p
        className="text-sm text-muted-foreground mb-4"
        data-testid="xero-type-picker-description"
      >
        {t("chooseTypeDescription")}
      </p>

      <div className="grid grid-cols-1 gap-2" data-testid="xero-type-picker-options">
        {DIRECTION_ORDER.map((dir) => {
          const Icon = DIRECTION_ICONS[dir];
          const isSelected = selected === dir;
          return (
            <button
              key={dir}
              type="button"
              onClick={() => onSelect(dir)}
              className={`text-left p-4 border rounded-lg transition-colors flex items-start gap-3 ${
                isSelected
                  ? "border-primary bg-accent/30"
                  : "border-border bg-card hover:border-primary/50"
              }`}
              data-testid={`xero-type-option-${dir}`}
            >
              <Icon className="w-5 h-5 mt-0.5 shrink-0 text-muted-foreground" />
              <div data-testid={`xero-type-option-${dir}-content`}>
                <div className="font-medium text-sm">{t(`direction.${dir}`)}</div>
                <div className="text-xs text-muted-foreground">
                  {t(`directionDesc.${dir}`)}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex justify-end gap-2 mt-4" data-testid="xero-type-picker-actions">
        <Button
          variant="outline"
          onClick={() => {
            logEvent({
              eventType: "xero_push_type_picker_cancelled",
              eventData: { selected },
            });
            onCancel();
          }}
          data-testid="xero-type-picker-cancel-btn"
        >
          {t("cancel")}
        </Button>
        <Button
          onClick={() => {
            logEvent({
              eventType: "xero_push_continue_to_form",
              eventData: { direction: selected },
            });
            onContinue();
          }}
          data-testid="xero-type-picker-continue-btn"
        >
          {t("continue")}
        </Button>
      </div>
    </div>
  );
}
