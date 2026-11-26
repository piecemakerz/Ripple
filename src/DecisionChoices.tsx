import { useId } from 'react';
import { CheckCircle2, Clock3, PencilLine } from 'lucide-react';
import { useI18n } from './i18n.js';
import { decisionLabels } from './review-workflow.js';
import type { ReviewDraft } from './review-presentation.js';

const options = [
  { status: 'keep', hint: 'Still valid', Icon: CheckCircle2 },
  { status: 'revise', hint: 'Needs adaptation', Icon: PencilLine },
  { status: 'defer', hint: 'Revisit later', Icon: Clock3 },
] as const;

export function DecisionChoices({
  value,
  disabled,
  describedBy,
  onChange,
}: {
  value: ReviewDraft['status'];
  disabled: boolean;
  describedBy: string;
  onChange: (value: Exclude<ReviewDraft['status'], ''>) => void;
}) {
  const { t } = useI18n();
  const id = useId();
  return (
    <fieldset className="studio-decisions" disabled={disabled} aria-describedby={describedBy}>
      <legend>{t('Choose one response')}</legend>
      {options.map(({ status, hint, Icon }) => (
        <label key={status} className={`decision-option ${status}`}>
          <Icon size={19} aria-hidden="true" />
          <span>
            <strong id={`${id}-${status}-label`}>{t(decisionLabels[status])}</strong>
            <small id={`${id}-${status}-hint`}>{t(hint)}</small>
          </span>
          <input
            type="radio"
            name={`${id}-decision`}
            value={status}
            checked={value === status}
            aria-labelledby={`${id}-${status}-label`}
            aria-describedby={`${id}-${status}-hint`}
            onChange={() => onChange(status)}
          />
        </label>
      ))}
    </fieldset>
  );
}
