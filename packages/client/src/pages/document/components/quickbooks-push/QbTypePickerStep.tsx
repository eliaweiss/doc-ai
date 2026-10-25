"use client";

import { useTranslations } from "next-intl";
import {
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { Button } from "@zdocs/client-component";
import { useLogUserJourneyEvent } from "../../../../utilities/api/logUserJourneyEventApi";

export type QbDirection = "income" | "expense";

const DIRECTION_ICONS: Record<QbDirection, React.ElementType> = {
  income: TrendingUp,
  expense: TrendingDown,
};

const DIRECTION_ORDER: QbDirection[] = ["income", "expense"];

interface QbTypePickerStepProps {
  selected: QbDirection;
  onSelect: (dir: QbDirection) => void;
  onContinue: () => void;
  onCancel: () => void;
}

export function QbTypePickerStep({
  selected,
  onSelect,
  onContinue,
  onCancel,
}: QbTypePickerStepProps) {
  const t = useTranslations("documentPage.quickbooks");
  const { logEvent } = useLogUserJourneyEvent();

  return (
    <div data-testid="qb-type-picker-step">
      <p className="text-sm text-muted-foreground mb-4" data-testid="qb-type-picker-description">
        {t("chooseTypeDescription")}
      </p>

      <div className="grid grid-cols-1 gap-2" data-testid="qb-type-picker-options">
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
              data-testid={`qb-type-option-${dir}`}
            >
              <Icon className="w-5 h-5 mt-0.5 shrink-0 text-muted-foreground" />
              <div data-testid={`qb-type-option-${dir}-content`}>
                <div className="font-medium text-sm">{t(`direction.${dir}`)}</div>
                <div className="text-xs text-muted-foreground">
                  {t(`directionDesc.${dir}`)}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex justify-end gap-2 mt-4" data-testid="qb-type-picker-actions">
        <Button
          variant="outline"
          onClick={() => {
            logEvent({
              eventType: "qb_push_type_picker_cancelled",
              eventData: { selected },
            });
            onCancel();
          }}
          data-testid="qb-type-picker-cancel-btn"
        >
          {t("cancel")}
        </Button>
        <Button
          onClick={() => {
            logEvent({
              eventType: "qb_push_continue_to_form",
              eventData: { direction: selected },
            });
            onContinue();
          }}
          data-testid="qb-type-picker-continue-btn"
        >
          {t("continue")}
        </Button>
      </div>
    </div>
  );
}
